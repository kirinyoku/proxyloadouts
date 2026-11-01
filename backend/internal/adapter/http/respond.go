// Package http implements the REST transport layer: JSON handlers over the
// application services, session middleware, domain-to-HTTP error mapping and
// the embedded SPA static server.
package http

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/telegram"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/teamsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

const maxBodyBytes = 1 << 20 // 1 MiB

// respondJSON writes v as a JSON response with the given status.
func respondJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("failed to encode json response", "error", err)
	}
}

// respondError writes a plain JSON error message.
func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// respondDomainError maps an error to an HTTP response using domain sentinel
// errors; unknown errors become 500 with details logged.
func respondDomainError(w http.ResponseWriter, r *http.Request, err error) {
	var validationErr *teamsvc.ValidationError
	if errors.As(err, &validationErr) {
		respondJSON(w, http.StatusUnprocessableEntity, map[string]any{
			"error":     validationErr.Error(),
			"conflicts": validationErr.Report,
		})
		return
	}

	switch {
	case errors.Is(err, domain.ErrInvalidInput):
		respondError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, domain.ErrUnauthorized):
		respondError(w, http.StatusUnauthorized, err.Error())
	case errors.Is(err, domain.ErrForbidden), errors.Is(err, domain.ErrUserBanned):
		respondError(w, http.StatusForbidden, err.Error())
	case errors.Is(err, domain.ErrNotFound):
		respondError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, domain.ErrConflict):
		respondError(w, http.StatusConflict, err.Error())
	case errors.Is(err, domain.ErrRateLimited):
		respondError(w, http.StatusTooManyRequests, err.Error())
	case errors.Is(err, domain.ErrSourceUnavailable):
		respondError(w, http.StatusBadGateway, err.Error())
	default:
		if r != nil {
			reqID := middleware.GetReqID(r.Context())
			caller := callerLocation()
			slog.ErrorContext(r.Context(), "internal server error",
				"error", err,
				"request_id", reqID,
				"path", safeRequestPath(r),
				"method", r.Method,
				"caller", caller,
			)
			if notifier := alertNotifierFromContext(r.Context()); notifier != nil {
				notifier.NotifyServerError(telegram.ServerErrorAlert{
					Method:       r.Method,
					RoutePattern: routePatternFromRequest(r),
					RequestURI:   safeRequestURI(r),
					RequestID:    reqID,
					ClientIP:     getClientIP(r),
					User:         userLabelFromRequest(r),
					Caller:       caller,
					Err:          err,
				})
			}
		} else {
			slog.Error("internal server error", "error", err)
		}
		respondError(w, http.StatusInternalServerError, "internal server error")
	}
}

// decodeJSON parses the request body into dst, enforcing a size limit and single JSON document.
func decodeJSON(r *http.Request, dst any) error {
	defer func() { _ = r.Body.Close() }()
	decoder := json.NewDecoder(io.LimitReader(r.Body, maxBodyBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return fmt.Errorf("%w: invalid json body: %w", domain.ErrInvalidInput, err)
	}
	var extra struct{}
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		return fmt.Errorf("%w: request body must contain a single JSON object", domain.ErrInvalidInput)
	}
	return nil
}

// extractLang reads the requested language from ?lang= or the Accept-Language header.
func extractLang(r *http.Request) string {
	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = r.Header.Get("Accept-Language")
	}
	return lang
}
