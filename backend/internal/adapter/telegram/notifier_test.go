package telegram_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"golang.org/x/time/rate"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/telegram"
)

type capturedMessage struct {
	ChatID          string `json:"chat_id"`
	MessageThreadID int    `json:"message_thread_id"`
	Text            string `json:"text"`
	ParseMode       string `json:"parse_mode"`
}

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func newTestHTTPClient(t *testing.T, handler func(req *http.Request) (*http.Response, error)) *http.Client {
	t.Helper()
	return &http.Client{
		Transport: roundTripFunc(handler),
	}
}

func okTelegramResponse() *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(`{"ok":true}`)),
	}
}

func TestNotifier_DisabledNoOp(t *testing.T) {
	t.Parallel()

	n := telegram.NewNotifier(telegram.Options{})
	if n.Enabled() {
		t.Fatal("expected notifier to be disabled when token and chat ID are empty")
	}

	n.NotifyLifecycle("started", "test")
	n.NotifyServerError(telegram.ServerErrorAlert{
		Method:     http.MethodGet,
		RequestURI: "/api/v1/builds",
		RequestID:  "req-1",
		Err:        errors.New("boom"),
	})
	n.NotifyPanic(telegram.PanicAlert{
		Method:     http.MethodPost,
		RequestURI: "/api/v1/teams",
		RequestID:  "req-2",
		Recovered:  "nil pointer",
		Stack:      "stack",
	})
	n.NotifyClientError(telegram.ClientErrorAlert{
		Message:        "TypeError",
		Stack:          "stack",
		ComponentStack: "comp",
		PageURL:        "http://localhost",
		RequestID:      "req-3",
		ClientIP:       "127.0.0.1",
		UserAgent:      "Mozilla",
	})

	if err := n.Close(context.Background()); err != nil {
		t.Fatalf("unexpected error on Close: %v", err)
	}
}

func TestNotifier_FormatsAndEscapesAlerts(t *testing.T) {
	t.Parallel()

	var (
		mu       sync.Mutex
		messages []capturedMessage
	)

	client := newTestHTTPClient(t, func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/botsecret-token/sendMessage" {
			t.Errorf("unexpected request path: %s", r.URL.Path)
		}
		var payload capturedMessage
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Errorf("failed to decode request body: %v", err)
		}
		mu.Lock()
		messages = append(messages, payload)
		mu.Unlock()
		return okTelegramResponse(), nil
	})

	n := telegram.NewNotifier(telegram.Options{
		BotToken:    "secret-token",
		ChatID:      "-100123456",
		ThreadID:    42,
		Environment: "production",
		Release:     "abc1234",
		HTTPClient:  client,
		RateLimit:   rate.Inf,
	})

	n.NotifyLifecycle("Server Started", "listening on :8080")
	n.NotifyServerError(telegram.ServerErrorAlert{
		Method:       http.MethodGet,
		RoutePattern: "/api/v1/builds/{buildID}",
		RequestURI:   "/api/v1/builds/550e8400-e29b-41d4-a716-446655440000?lang=ru",
		RequestID:    "req-500",
		ClientIP:     "198.51.100.1",
		User:         "kirin (u-1)",
		Caller:       "internal/adapter/http/build_handler.go:88 (BuildHandler.handleGet)",
		Err:          errors.New("sqlite <locked> & failed"),
	})
	n.NotifyPanic(telegram.PanicAlert{
		Method:       http.MethodPost,
		RoutePattern: "/api/v1/teams",
		RequestURI:   "/api/v1/teams",
		RequestID:    "req-panic",
		ClientIP:     "198.51.100.2",
		User:         "kirin (u-1)",
		Culprit:      "internal/app/teamsvc/service.go:84",
		Recovered:    "index out of range [3]",
		Stack:        "goroutine 1 [running]:\nmain.go:42",
	})
	n.NotifyClientError(telegram.ClientErrorAlert{
		Message:        "Uncaught <SyntaxError>",
		Stack:          "at App (<anonymous>:1:2)",
		ComponentStack: "in DriveDiscGrid\nin ShowcasePage",
		PageURL:        "https://proxyloadouts.com/roster?a=1&b=2",
		RequestID:      "req-client",
		ClientIP:       "203.0.113.5",
		UserAgent:      "Mozilla/5.0 <Test>",
	})

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := n.Close(ctx); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()

	if len(messages) != 4 {
		t.Fatalf("expected 4 delivered messages, got %d", len(messages))
	}

	for i, msg := range messages {
		if msg.ChatID != "-100123456" {
			t.Errorf("msg[%d]: expected chat_id -100123456, got %s", i, msg.ChatID)
		}
		if msg.MessageThreadID != 42 {
			t.Errorf("msg[%d]: expected message_thread_id 42, got %d", i, msg.MessageThreadID)
		}
		if msg.ParseMode != "HTML" {
			t.Errorf("msg[%d]: expected parse_mode HTML, got %s", i, msg.ParseMode)
		}
	}

	if !strings.Contains(messages[1].Text, "sqlite &lt;locked&gt; &amp; failed") ||
		!strings.Contains(messages[1].Text, "build_handler.go:88") ||
		!strings.Contains(messages[1].Text, "kirin (u-1)") {
		t.Errorf("expected rich diagnostic fields in server error alert, got: %s", messages[1].Text)
	}
	if !strings.Contains(messages[2].Text, "[PANIC] Backend Panic Recovered") ||
		!strings.Contains(messages[2].Text, "internal/app/teamsvc/service.go:84") {
		t.Errorf("expected panic header and culprit location in panic alert, got: %s", messages[2].Text)
	}
	if !strings.Contains(messages[3].Text, "Uncaught &lt;SyntaxError&gt;") ||
		!strings.Contains(messages[3].Text, "a=1&amp;b=2") ||
		!strings.Contains(messages[3].Text, "JS Stack:") ||
		!strings.Contains(messages[3].Text, "Component Tree:") {
		t.Errorf("expected HTML-escaped client error fields with both JS stack and component tree, got: %s", messages[3].Text)
	}
}

func TestNotifier_DeduplicationAcrossDynamicIDs(t *testing.T) {
	t.Parallel()

	var (
		mu       sync.Mutex
		messages []capturedMessage
	)

	client := newTestHTTPClient(t, func(r *http.Request) (*http.Response, error) {
		var payload capturedMessage
		_ = json.NewDecoder(r.Body).Decode(&payload)
		mu.Lock()
		messages = append(messages, payload)
		mu.Unlock()
		return okTelegramResponse(), nil
	})

	cooldown := 60 * time.Millisecond
	n := telegram.NewNotifier(telegram.Options{
		BotToken:   "secret-token",
		ChatID:     "-100123456",
		HTTPClient: client,
		Cooldown:   cooldown,
		RateLimit:  rate.Inf,
	})

	// Simulate 200 concurrent 500 errors across different player UIDs and UUIDs.
	for i := range 200 {
		uid := fmt.Sprintf("150468%04d", i)
		n.NotifyServerError(telegram.ServerErrorAlert{
			Method:       http.MethodGet,
			RoutePattern: "/api/v1/showcase/{uid}",
			RequestURI:   "/api/v1/showcase/" + uid,
			RequestID:    fmt.Sprintf("req-%d", i),
			Err:          fmt.Errorf("upstream failed for uid %s", uid),
		})
	}

	time.Sleep(cooldown + 30*time.Millisecond)

	// Next occurrence after cooldown -> sent with suppressed count = 199.
	n.NotifyServerError(telegram.ServerErrorAlert{
		Method:       http.MethodGet,
		RoutePattern: "/api/v1/showcase/{uid}",
		RequestURI:   "/api/v1/showcase/1504689999",
		RequestID:    "req-final",
		Err:          errors.New("upstream failed for uid 1504689999"),
	})

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := n.Close(ctx); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()

	if len(messages) != 2 {
		t.Fatalf("expected 2 messages after deduplicating 200 dynamic UID errors, got %d", len(messages))
	}
	if !strings.Contains(messages[1].Text, "[SUPPRESSED]</b> Duplicates: <code>199</code>") {
		t.Errorf("expected suppressed count of 199 on second message, got: %s", messages[1].Text)
	}
}

func TestNotifier_StormCircuitBreaker(t *testing.T) {
	t.Parallel()

	var (
		mu       sync.Mutex
		messages []capturedMessage
	)

	client := newTestHTTPClient(t, func(r *http.Request) (*http.Response, error) {
		var payload capturedMessage
		_ = json.NewDecoder(r.Body).Decode(&payload)
		mu.Lock()
		messages = append(messages, payload)
		mu.Unlock()
		return okTelegramResponse(), nil
	})

	stormCooldown := 80 * time.Millisecond
	n := telegram.NewNotifier(telegram.Options{
		BotToken:       "secret-token",
		ChatID:         "-100123456",
		HTTPClient:     client,
		StormWindow:    time.Minute,
		StormMaxAlerts: 3,
		StormCooldown:  stormCooldown,
		RateLimit:      rate.Inf,
	})

	// Send 50 completely distinct error types simultaneously.
	// Only 3 alerts + 1 Storm Protection notice should be queued; the remaining 46 are muted.
	for i := range 50 {
		n.NotifyServerError(telegram.ServerErrorAlert{
			Method:       http.MethodGet,
			RoutePattern: fmt.Sprintf("/api/v1/route-%c", rune('a'+(i%26))) + fmt.Sprintf("-%c", rune('a'+(i/26))),
			Err:          fmt.Errorf("distinct error kind %c-%c", rune('A'+(i%26)), rune('A'+(i/26))),
		})
	}

	time.Sleep(stormCooldown + 30*time.Millisecond)

	// After storm cooldown expires, next error reports the 47 muted alerts (1 trigger + 46 subsequent).
	n.NotifyServerError(telegram.ServerErrorAlert{
		Method:       http.MethodPost,
		RoutePattern: "/api/v1/recovery-check",
		Err:          errors.New("post-storm error"),
	})

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := n.Close(ctx); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()

	// Expect: 3 normal alerts + 1 Storm Protection notice + 1 post-storm alert = 5 messages total (instead of 51).
	if len(messages) != 5 {
		t.Fatalf("expected 5 messages with storm circuit breaker, got %d", len(messages))
	}
	if !strings.Contains(messages[3].Text, "[ALERT STORM] Protection Activated") {
		t.Errorf("expected 4th message to be Storm Protection notice, got: %s", messages[3].Text)
	}
	if !strings.Contains(messages[4].Text, "[STORM MUTED]</b> Suppressed alerts: <code>47</code>") {
		t.Errorf("expected 5th message to report 47 storm-suppressed alerts, got: %s", messages[4].Text)
	}
}
