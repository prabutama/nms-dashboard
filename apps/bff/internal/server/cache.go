package server

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"sync"
	"time"

	"github.com/isapr/nms-dashboard/apps/bff/internal/thingsboard"
)

type authCacheEntry struct {
	user      thingsboard.UserInfo
	expiresAt time.Time
}

type responseCacheEntry struct {
	statusCode int
	body       []byte
	expiresAt  time.Time
}

type memoryCache struct {
	mu             sync.RWMutex
	authUsers      map[string]authCacheEntry
	responses      map[string]responseCacheEntry
	authTTL        time.Duration
	defaultRespTTL time.Duration
}

func newMemoryCache(cfgTTLSeconds int) *memoryCache {
	respTTL := time.Duration(cfgTTLSeconds) * time.Second
	if respTTL <= 0 {
		respTTL = 30 * time.Second
	}
	return &memoryCache{
		authUsers:      make(map[string]authCacheEntry),
		responses:      make(map[string]responseCacheEntry),
		authTTL:        15 * time.Second,
		defaultRespTTL: respTTL,
	}
}

func (c *memoryCache) getAuthUser(token string) (thingsboard.UserInfo, bool) {
	cacheKey := hashCacheKey(token)
	now := time.Now()
	c.mu.RLock()
	entry, ok := c.authUsers[cacheKey]
	c.mu.RUnlock()
	if !ok || now.After(entry.expiresAt) {
		if ok {
			c.mu.Lock()
			delete(c.authUsers, cacheKey)
			c.mu.Unlock()
		}
		return thingsboard.UserInfo{}, false
	}
	return entry.user, true
}

func (c *memoryCache) setAuthUser(token string, user thingsboard.UserInfo) {
	c.mu.Lock()
	c.authUsers[hashCacheKey(token)] = authCacheEntry{user: user, expiresAt: time.Now().Add(c.authTTL)}
	c.mu.Unlock()
}

func (c *memoryCache) getResponse(key string) (responseCacheEntry, bool) {
	now := time.Now()
	c.mu.RLock()
	entry, ok := c.responses[key]
	c.mu.RUnlock()
	if !ok || now.After(entry.expiresAt) {
		if ok {
			c.mu.Lock()
			delete(c.responses, key)
			c.mu.Unlock()
		}
		return responseCacheEntry{}, false
	}
	return responseCacheEntry{statusCode: entry.statusCode, body: bytes.Clone(entry.body), expiresAt: entry.expiresAt}, true
}

func (c *memoryCache) setResponse(key string, statusCode int, body []byte, ttl time.Duration) {
	if ttl <= 0 {
		ttl = c.defaultRespTTL
	}
	c.mu.Lock()
	c.responses[key] = responseCacheEntry{statusCode: statusCode, body: bytes.Clone(body), expiresAt: time.Now().Add(ttl)}
	c.mu.Unlock()
}

func hashCacheKey(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

type cacheResponseWriter struct {
	http.ResponseWriter
	statusCode int
	body       bytes.Buffer
}

func (w *cacheResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *cacheResponseWriter) Write(data []byte) (int, error) {
	if w.statusCode == 0 {
		w.statusCode = http.StatusOK
	}
	w.body.Write(data)
	return w.ResponseWriter.Write(data)
}

func responseCacheKey(r *http.Request) string {
	key := r.URL.Path
	if r.URL.RawQuery != "" {
		key += "?" + r.URL.RawQuery
	}
	if user, ok := authUserFromContext(r.Context()); ok {
		key += "|auth=" + user.Authority + "|customer=" + user.CustomerID + "|user=" + user.ID
	}
	return hashCacheKey(key)
}

func (s *apiServer) cacheGetResponse(ttl time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet || s.cache == nil {
				next.ServeHTTP(w, r)
				return
			}

			cacheKey := responseCacheKey(r)
			if cached, ok := s.cache.getResponse(cacheKey); ok {
				observeCacheHit(r.Context())
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-NMS-Cache", "hit")
				w.WriteHeader(cached.statusCode)
				_, _ = w.Write(cached.body)
				return
			}
			observeCacheMiss(r.Context())

			writer := &cacheResponseWriter{ResponseWriter: w}
			next.ServeHTTP(writer, r)
			if writer.statusCode == http.StatusOK && writer.body.Len() > 0 {
				s.cache.setResponse(cacheKey, writer.statusCode, writer.body.Bytes(), ttl)
			}
		})
	}
}
