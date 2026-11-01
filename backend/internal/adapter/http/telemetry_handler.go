package http

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"runtime"
	"runtime/debug"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/telegram"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// AlertNotifier dispatches operational alerts for unexpected server errors,
// recovered panics, and unhandled frontend client exceptions.
type AlertNotifier interface {
	NotifyServerError(alert telegram.ServerErrorAlert)
	NotifyPanic(alert telegram.PanicAlert)
	NotifyClientError(alert telegram.ClientErrorAlert)
}

type alertNotifierContextKey struct{}

func alertNotifierFromContext(ctx context.Context) AlertNotifier {
	if ctx == nil {
		return nil
	}
	n, _ := ctx.Value(alertNotifierContextKey{}).(AlertNotifier)
	return n
}

// alertMiddleware injects the AlertNotifier into the request context and
// reports any unhandled panic before re-panicking to Chi's Recoverer.
func alertMiddleware(notifier AlertNotifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if notifier == nil {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), alertNotifierContextKey{}, notifier)
			r = r.WithContext(ctx)

			defer func() {
				if rvr := recover(); rvr != nil {
					if err, ok := rvr.(error); ok && errors.Is(err, http.ErrAbortHandler) {
						panic(rvr)
					}
					culprit, cleanStack := parsePanicStack(string(debug.Stack()))
					notifier.NotifyPanic(telegram.PanicAlert{
						Method:       r.Method,
						RoutePattern: routePatternFromRequest(r),
						RequestURI:   safeRequestURI(r),
						RequestID:    middleware.GetReqID(r.Context()),
						ClientIP:     getClientIP(r),
						User:         userLabelFromRequest(r),
						Culprit:      culprit,
						Recovered:    rvr,
						Stack:        cleanStack,
					})
					panic(rvr)
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

func routePatternFromRequest(r *http.Request) string {
	if r == nil {
		return ""
	}
	if rctx := chi.RouteContext(r.Context()); rctx != nil {
		if pattern := rctx.RoutePattern(); pattern != "" {
			return pattern
		}
	}
	return safeRequestURI(r)
}

func userLabelFromRequest(r *http.Request) string {
	if r == nil {
		return ""
	}
	if u, ok := UserFromContext(r.Context()); ok && u != nil {
		if u.Username != "" {
			return fmt.Sprintf("%s (%s)", u.Username, u.ID.String())
		}
		return u.ID.String()
	}
	return ""
}

// callerLocation walks the call stack to find the originating function and file:line
// inside the application codebase.
func callerLocation() string {
	var pcs [12]uintptr
	n := runtime.Callers(2, pcs[:])
	frames := runtime.CallersFrames(pcs[:n])

	for {
		frame, more := frames.Next()
		if strings.Contains(frame.File, "internal/adapter/http/respond.go") ||
			strings.Contains(frame.File, "internal/adapter/http/telemetry_handler.go") {
			if !more {
				break
			}
			continue
		}
		if idx := strings.Index(frame.File, "internal/"); idx != -1 {
			shortFile := frame.File[idx:]
			shortFunc := frame.Function
			if lastSlash := strings.LastIndex(shortFunc, "/"); lastSlash != -1 {
				shortFunc = shortFunc[lastSlash+1:]
			}
			return fmt.Sprintf("%s:%d (%s)", shortFile, frame.Line, shortFunc)
		}
		if !more {
			break
		}
	}
	return ""
}

// parsePanicStack extracts the top application source frame as the culprit
// and strips internal recovery boilerplate lines from debug.Stack().
func parsePanicStack(rawStack string) (string, string) {
	lines := strings.Split(rawStack, "\n")
	var (
		culprit  string
		filtered []string
	)

	for i := 0; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)

		// Skip runtime/debug.Stack and alertMiddleware frames to reduce noise.
		if strings.Contains(trimmed, "runtime/debug.Stack") ||
			strings.Contains(trimmed, "alertMiddleware") {
			if i+1 < len(lines) {
				i++
			}
			continue
		}

		if culprit == "" && strings.Contains(trimmed, "internal/") && strings.Contains(trimmed, ".go:") &&
			!strings.Contains(trimmed, "telemetry_handler.go") {
			if idx := strings.Index(trimmed, "internal/"); idx != -1 {
				loc := trimmed[idx:]
				if spaceIdx := strings.Index(loc, " "); spaceIdx != -1 {
					loc = loc[:spaceIdx]
				}
				culprit = loc
			}
		}

		filtered = append(filtered, line)
	}

	return culprit, strings.TrimSpace(strings.Join(filtered, "\n"))
}

const (
	maxClientErrorMessageRunes = 500
	maxClientErrorStackRunes   = 4000
	maxClientErrorURLRunes     = 500
)

type clientErrorReportRequest struct {
	Message        string `json:"message"`
	Stack          string `json:"stack"`
	ComponentStack string `json:"component_stack"`
	URL            string `json:"url"`
}

// TelemetryHandler receives unhandled frontend error reports.
type TelemetryHandler struct {
	alerts AlertNotifier
}

// NewTelemetryHandler creates a handler for frontend error reporting.
func NewTelemetryHandler(alerts AlertNotifier) *TelemetryHandler {
	return &TelemetryHandler{alerts: alerts}
}

func (h *TelemetryHandler) handleClientError(w http.ResponseWriter, r *http.Request) {
	var req clientErrorReportRequest
	if err := decodeJSON(r, &req); err != nil {
		respondDomainError(w, r, err)
		return
	}

	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		respondDomainError(w, r, fmt.Errorf("%w: message is required", domain.ErrInvalidInput))
		return
	}
	if utf8.RuneCountInString(req.Message) > maxClientErrorMessageRunes {
		respondDomainError(w, r, fmt.Errorf("%w: message exceeds %d characters", domain.ErrInvalidInput, maxClientErrorMessageRunes))
		return
	}
	if utf8.RuneCountInString(req.Stack) > maxClientErrorStackRunes {
		respondDomainError(w, r, fmt.Errorf("%w: stack exceeds %d characters", domain.ErrInvalidInput, maxClientErrorStackRunes))
		return
	}
	if utf8.RuneCountInString(req.ComponentStack) > maxClientErrorStackRunes {
		respondDomainError(w, r, fmt.Errorf("%w: component_stack exceeds %d characters", domain.ErrInvalidInput, maxClientErrorStackRunes))
		return
	}
	if utf8.RuneCountInString(req.URL) > maxClientErrorURLRunes {
		respondDomainError(w, r, fmt.Errorf("%w: url exceeds %d characters", domain.ErrInvalidInput, maxClientErrorURLRunes))
		return
	}

	if h.alerts != nil {
		h.alerts.NotifyClientError(telegram.ClientErrorAlert{
			Message:        req.Message,
			Stack:          req.Stack,
			ComponentStack: req.ComponentStack,
			PageURL:        req.URL,
			RequestID:      middleware.GetReqID(r.Context()),
			ClientIP:       getClientIP(r),
			User:           userLabelFromRequest(r),
			UserAgent:      r.UserAgent(),
		})
	}

	w.WriteHeader(http.StatusNoContent)
}
