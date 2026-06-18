package server

import (
	"context"
	"log/slog"
	"net/http"
	"sync/atomic"
	"time"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

type requestMetricsContextKey string

const requestMetricsKey requestMetricsContextKey = "requestMetrics"

type requestMetrics struct {
	start        time.Time
	tbCalls      atomic.Int64
	cacheHits    atomic.Int64
	cacheMisses  atomic.Int64
	statusCode   atomic.Int64
	responseSize atomic.Int64
}

func requestMetricsFromContext(ctx context.Context) (*requestMetrics, bool) {
	metrics, ok := ctx.Value(requestMetricsKey).(*requestMetrics)
	return metrics, ok
}

func withRequestMetrics(ctx context.Context) (context.Context, *requestMetrics) {
	metrics := &requestMetrics{start: time.Now()}
	return context.WithValue(ctx, requestMetricsKey, metrics), metrics
}

func observeTBCall(ctx context.Context) {
	if metrics, ok := requestMetricsFromContext(ctx); ok {
		metrics.tbCalls.Add(1)
	}
}

func observeCacheHit(ctx context.Context) {
	if metrics, ok := requestMetricsFromContext(ctx); ok {
		metrics.cacheHits.Add(1)
	}
}

func observeCacheMiss(ctx context.Context) {
	if metrics, ok := requestMetricsFromContext(ctx); ok {
		metrics.cacheMisses.Add(1)
	}
}

type metricsResponseWriter struct {
	http.ResponseWriter
	statusCode int
	bytes      int
}

func (w *metricsResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *metricsResponseWriter) Write(data []byte) (int, error) {
	if w.statusCode == 0 {
		w.statusCode = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(data)
	w.bytes += n
	return n, err
}

func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, metrics := withRequestMetrics(r.Context())
			wrapped := &metricsResponseWriter{ResponseWriter: w}
			next.ServeHTTP(wrapped, r.WithContext(ctx))

			statusCode := wrapped.statusCode
			if statusCode == 0 {
				statusCode = http.StatusOK
			}
			metrics.statusCode.Store(int64(statusCode))
			metrics.responseSize.Store(int64(wrapped.bytes))

			logger.Info("request completed",
				"requestId", chimiddleware.GetReqID(r.Context()),
				"method", r.Method,
				"path", r.URL.Path,
				"query", r.URL.RawQuery,
				"status", statusCode,
				"durationMs", time.Since(metrics.start).Milliseconds(),
				"tbCalls", metrics.tbCalls.Load(),
				"cacheHits", metrics.cacheHits.Load(),
				"cacheMisses", metrics.cacheMisses.Load(),
				"responseBytes", metrics.responseSize.Load(),
			)
		})
	}
}
