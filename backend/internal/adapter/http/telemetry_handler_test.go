package http

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/telegram"
)

type spyAlertNotifier struct {
	mu           sync.Mutex
	serverErrors []telegram.ServerErrorAlert
	panics       []telegram.PanicAlert
	clientErrors []telegram.ClientErrorAlert
}

func (s *spyAlertNotifier) NotifyServerError(alert telegram.ServerErrorAlert) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.serverErrors = append(s.serverErrors, alert)
}

func (s *spyAlertNotifier) NotifyPanic(alert telegram.PanicAlert) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.panics = append(s.panics, alert)
}

func (s *spyAlertNotifier) NotifyClientError(alert telegram.ClientErrorAlert) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.clientErrors = append(s.clientErrors, alert)
}

func TestTelemetryClientErrorEndpoint(t *testing.T) {
	spy := &spyAlertNotifier{}
	router := NewRouter(
		Options{FrontendURL: "http://localhost:5173"},
		Deps{Alerts: spy},
	)

	// 1. Valid client error report -> 204 No Content
	validBody := `{"message":"TypeError: undefined is not a function","stack":"at App.tsx:10","url":"http://localhost:5173/roster"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/telemetry/client-error", strings.NewReader(validBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204 No Content, got %d: %s", rec.Code, rec.Body.String())
	}

	spy.mu.Lock()
	if len(spy.clientErrors) != 1 ||
		spy.clientErrors[0].Message != "TypeError: undefined is not a function" ||
		spy.clientErrors[0].PageURL != "http://localhost:5173/roster" {
		t.Errorf("unexpected captured client errors: %+v", spy.clientErrors)
	}
	spy.mu.Unlock()

	// 2. Empty message -> 400 Bad Request
	emptyReq := httptest.NewRequest(http.MethodPost, "/api/v1/telemetry/client-error", strings.NewReader(`{"message":"   "}`))
	emptyReq.Header.Set("Content-Type", "application/json")
	emptyReq.Header.Set("Origin", "http://localhost:5173")
	emptyRec := httptest.NewRecorder()
	router.ServeHTTP(emptyRec, emptyReq)

	if emptyRec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for empty message, got %d", emptyRec.Code)
	}
}

func TestAlertMiddleware_CapturesPanicAnd500WithDiagnostics(t *testing.T) {
	spy := &spyAlertNotifier{}

	// Verify 500 error capture via respondDomainError with query string and caller location
	req500 := httptest.NewRequest(http.MethodGet, "/api/v1/builds?game_account_id=123&lang=ru", nil)
	rec500 := httptest.NewRecorder()
	handler500 := alertMiddleware(spy)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		respondDomainError(w, r, errors.New("unexpected disk I/O error"))
	}))
	handler500.ServeHTTP(rec500, req500)

	if rec500.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec500.Code)
	}

	// Verify panic capture, culprit extraction, and re-panic
	reqPanic := httptest.NewRequest(http.MethodPost, "/api/v1/teams?dry_run=1", nil)
	recPanic := httptest.NewRecorder()
	handlerPanic := alertMiddleware(spy)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("unexpected nil dereference")
	}))

	func() {
		defer func() { _ = recover() }()
		handlerPanic.ServeHTTP(recPanic, reqPanic)
	}()

	spy.mu.Lock()
	defer spy.mu.Unlock()

	if len(spy.serverErrors) != 1 {
		t.Fatalf("expected 1 server error alert, got %+v", spy.serverErrors)
	}
	if spy.serverErrors[0].RequestURI != "/api/v1/builds?game_account_id=123&lang=ru" {
		t.Errorf("expected full RequestURI with query params, got %q", spy.serverErrors[0].RequestURI)
	}
	if !strings.Contains(spy.serverErrors[0].Caller, "telemetry_handler_test.go:") {
		t.Errorf("expected caller location to point to test caller, got %q", spy.serverErrors[0].Caller)
	}

	if len(spy.panics) != 1 {
		t.Fatalf("expected 1 panic alert, got %+v", spy.panics)
	}
	if spy.panics[0].Method != http.MethodPost || spy.panics[0].RequestURI != "/api/v1/teams?dry_run=1" {
		t.Errorf("unexpected panic route metadata: %+v", spy.panics[0])
	}
	if !strings.Contains(spy.panics[0].Culprit, "telemetry_handler_test.go:") {
		t.Errorf("expected culprit to identify panicking file:line, got %q", spy.panics[0].Culprit)
	}
}
