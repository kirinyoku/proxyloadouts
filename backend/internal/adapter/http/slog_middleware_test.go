package http

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5/middleware"
)

func TestSlogRequestLogger(t *testing.T) {
	buf := &bytes.Buffer{}
	handler := slog.NewJSONHandler(buf, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger := slog.New(handler)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	mw := SlogRequestLogger(logger)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/builds", nil)
	req = req.WithContext(context.WithValue(req.Context(), middleware.RequestIDKey, "test-req-123"))
	rec := httptest.NewRecorder()

	mw(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("failed to parse log entry as JSON: %v, raw: %s", err, buf.String())
	}

	if entry["msg"] != "http request" {
		t.Errorf("expected msg 'http request', got %v", entry["msg"])
	}
	if entry["path"] != "/api/v1/builds" {
		t.Errorf("expected path '/api/v1/builds', got %v", entry["path"])
	}
	if entry["method"] != "GET" {
		t.Errorf("expected method 'GET', got %v", entry["method"])
	}
	if entry["request_id"] != "test-req-123" {
		t.Errorf("expected request_id 'test-req-123', got %v", entry["request_id"])
	}
	if _, ok := entry["duration_ms"]; !ok {
		t.Errorf("expected duration_ms attribute in log")
	}
}

func TestSlogRequestLogger_SuppressesHealthOk(t *testing.T) {
	buf := &bytes.Buffer{}
	handler := slog.NewJSONHandler(buf, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger := slog.New(handler)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	mw := SlogRequestLogger(logger)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	mw(next).ServeHTTP(rec, req)

	if buf.Len() != 0 {
		t.Errorf("expected /health with 200 to be silenced, but got log: %s", buf.String())
	}
}

func TestSlogRequestLogger_LogsHealthDegraded(t *testing.T) {
	buf := &bytes.Buffer{}
	handler := slog.NewJSONHandler(buf, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger := slog.New(handler)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	})

	mw := SlogRequestLogger(logger)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	mw(next).ServeHTTP(rec, req)

	if buf.Len() == 0 {
		t.Errorf("expected /health with 503 to be logged, but got empty log")
	}

	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("failed to parse log entry: %v", err)
	}
	if entry["level"] != "ERROR" {
		t.Errorf("expected level ERROR, got %v", entry["level"])
	}
}
