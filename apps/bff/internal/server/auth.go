package server

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/isapr/nms-dashboard/apps/bff/internal/thingsboard"
)

type authContextKey string

const authUserContextKey authContextKey = "authUser"
const authTokenContextKey authContextKey = "authToken"

func (s *apiServer) authLoginHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.tb == nil {
			writeError(w, http.StatusBadGateway, "ThingsBoard integration not configured")
			return
		}

		var req authLoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if strings.TrimSpace(req.Username) == "" || strings.TrimSpace(req.Password) == "" {
			writeError(w, http.StatusBadRequest, "username and password are required")
			return
		}

		login, err := s.tb.Login(r.Context(), req.Username, req.Password)
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		user, err := s.tb.GetCurrentUser(r.Context(), login.Token)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}

		writeJSON(w, http.StatusOK, authUserResponse{
			User:         toAuthUserInfo(user),
			Token:        login.Token,
			RefreshToken: login.RefreshToken,
			Source:       "thingsboard",
			Message:      "Authenticated via ThingsBoard",
		})
	}
}

func (s *apiServer) authRefreshHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.tb == nil {
			writeError(w, http.StatusBadGateway, "ThingsBoard integration not configured")
			return
		}

		var req authRefreshRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if strings.TrimSpace(req.RefreshToken) == "" {
			writeError(w, http.StatusBadRequest, "refreshToken is required")
			return
		}

		login, err := s.tb.RefreshToken(r.Context(), req.RefreshToken)
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		user, err := s.tb.GetCurrentUser(r.Context(), login.Token)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}

		writeJSON(w, http.StatusOK, authUserResponse{
			User:         toAuthUserInfo(user),
			Token:        login.Token,
			RefreshToken: login.RefreshToken,
			Source:       "thingsboard",
			Message:      "Token refreshed via ThingsBoard",
		})
	}
}

func (s *apiServer) authMeHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := authUserFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		writeJSON(w, http.StatusOK, authUserResponse{
			User:    toAuthUserInfo(user),
			Source:  "thingsboard",
			Message: "Current user loaded from ThingsBoard",
		})
	}
}

func (s *apiServer) authLogoutHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		bearerToken, ok := bearerTokenFromRequest(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		if err := s.tb.Logout(r.Context(), bearerToken); err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Logged out from ThingsBoard"})
	}
}

func (s *apiServer) requireTBAuth() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if s.tb == nil {
				writeError(w, http.StatusBadGateway, "ThingsBoard integration not configured")
				return
			}
			bearerToken, ok := bearerTokenFromRequest(r)
			if !ok {
				writeError(w, http.StatusUnauthorized, "authentication required")
				return
			}
			user, err := s.tb.GetCurrentUser(r.Context(), bearerToken)
			if err != nil {
				writeError(w, http.StatusUnauthorized, err.Error())
				return
			}
			ctx := context.WithValue(r.Context(), authUserContextKey, user)
			ctx = context.WithValue(ctx, authTokenContextKey, bearerToken)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func (s *apiServer) requireAuthority(authorities ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(authorities))
	for _, authority := range authorities {
		allowed[authority] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := authUserFromContext(r.Context())
			if !ok {
				writeError(w, http.StatusUnauthorized, "authentication required")
				return
			}
			if !allowed[user.Authority] {
				writeError(w, http.StatusForbidden, "forbidden")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func bearerTokenFromRequest(r *http.Request) (string, bool) {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return "", false
	}
	value := strings.TrimSpace(authHeader[len("Bearer "):])
	if value == "" {
		return "", false
	}
	return value, true
}

func authUserFromContext(ctx context.Context) (thingsboard.UserInfo, bool) {
	user, ok := ctx.Value(authUserContextKey).(thingsboard.UserInfo)
	return user, ok
}

func authTokenFromContext(ctx context.Context) (string, bool) {
	token, ok := ctx.Value(authTokenContextKey).(string)
	return token, ok
}

func toAuthUserInfo(user thingsboard.UserInfo) authUserInfo {
	return authUserInfo{
		ID:         user.ID,
		Email:      user.Email,
		Authority:  user.Authority,
		FirstName:  user.FirstName,
		LastName:   user.LastName,
		CustomerID: user.CustomerID,
		TenantID:   user.TenantID,
	}
}
