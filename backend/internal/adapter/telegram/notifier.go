// Package telegram provides an asynchronous, deduplicating alert notifier
// that delivers operational and error notifications via the Telegram Bot API.
package telegram

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"golang.org/x/time/rate"
)

const (
	// DefaultAPIBaseURL is the base URL for the Telegram Bot API.
	DefaultAPIBaseURL = "https://api.telegram.org"

	defaultQueueSize       = 128
	defaultCooldown        = 5 * time.Minute
	defaultStormWindow     = time.Minute
	defaultStormMaxAlerts  = 5
	defaultStormCooldown   = 5 * time.Minute
	defaultHTTPTimeout     = 5 * time.Second
	defaultBurst           = 5
	maxDedupEntries        = 1000
	maxStackRunes          = 1400
	maxComponentStackRunes = 800
	maxMessageFieldRune    = 400
)

var (
	uuidPattern   = regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)
	numberPattern = regexp.MustCompile(`\b\d{4,}\b`)
)

// Options configures the Telegram alert notifier.
type Options struct {
	BotToken    string
	ChatID      string
	ThreadID    int
	Environment string
	Release     string

	// Overridable for testing and custom tuning.
	APIBaseURL     string
	HTTPClient     *http.Client
	Cooldown       time.Duration
	StormWindow    time.Duration
	StormMaxAlerts int
	StormCooldown  time.Duration
	RateLimit      rate.Limit
	Burst          int
	QueueSize      int
}

// ServerErrorAlert carries diagnostic context for an unhandled HTTP 500 error.
type ServerErrorAlert struct {
	Method       string
	RoutePattern string
	RequestURI   string
	RequestID    string
	ClientIP     string
	User         string
	Caller       string
	Err          error
}

// PanicAlert carries diagnostic context for a recovered HTTP panic.
type PanicAlert struct {
	Method       string
	RoutePattern string
	RequestURI   string
	RequestID    string
	ClientIP     string
	User         string
	Culprit      string
	Recovered    any
	Stack        string
}

// ClientErrorAlert carries diagnostic context for an unhandled frontend error.
type ClientErrorAlert struct {
	Message        string
	Stack          string
	ComponentStack string
	PageURL        string
	RequestID      string
	ClientIP       string
	User           string
	UserAgent      string
}

type dedupEntry struct {
	lastSent   time.Time
	suppressed int
}

// Notifier dispatches deduplicated, storm-protected HTML alerts to a Telegram chat.
type Notifier struct {
	opts     Options
	enabled  bool
	limiter  *rate.Limiter
	queue    chan string
	doneChan chan struct{}

	mu              sync.Mutex
	closed          bool
	dedup           map[string]*dedupEntry
	recentSent      []time.Time
	stormUntil      time.Time
	stormSuppressed int
}

// NewNotifier creates and starts a background Telegram alert notifier.
// If BotToken or ChatID is empty, the notifier operates as a zero-overhead no-op.
func NewNotifier(opts Options) *Notifier {
	opts.BotToken = strings.TrimSpace(opts.BotToken)
	opts.ChatID = strings.TrimSpace(opts.ChatID)

	if opts.Environment == "" {
		opts.Environment = "development"
	}
	if opts.Release == "" {
		opts.Release = "proxyloadouts@prod"
	}
	if opts.APIBaseURL == "" {
		opts.APIBaseURL = DefaultAPIBaseURL
	}
	if opts.HTTPClient == nil {
		opts.HTTPClient = &http.Client{Timeout: defaultHTTPTimeout}
	}
	if opts.Cooldown <= 0 {
		opts.Cooldown = defaultCooldown
	}
	if opts.StormWindow <= 0 {
		opts.StormWindow = defaultStormWindow
	}
	if opts.StormMaxAlerts <= 0 {
		opts.StormMaxAlerts = defaultStormMaxAlerts
	}
	if opts.StormCooldown <= 0 {
		opts.StormCooldown = defaultStormCooldown
	}
	if opts.RateLimit <= 0 {
		opts.RateLimit = rate.Every(time.Second)
	}
	if opts.Burst <= 0 {
		opts.Burst = defaultBurst
	}
	if opts.QueueSize <= 0 {
		opts.QueueSize = defaultQueueSize
	}

	enabled := opts.BotToken != "" && opts.ChatID != ""
	n := &Notifier{
		opts:     opts,
		enabled:  enabled,
		limiter:  rate.NewLimiter(opts.RateLimit, opts.Burst),
		queue:    make(chan string, opts.QueueSize),
		doneChan: make(chan struct{}),
		dedup:    make(map[string]*dedupEntry),
	}

	if enabled {
		go n.worker()
	} else {
		close(n.doneChan)
	}

	return n
}

// Enabled reports whether Telegram credentials are configured and active.
func (n *Notifier) Enabled() bool {
	if n == nil {
		return false
	}
	return n.enabled
}

// Close stops accepting new notifications and flushes any queued messages
// until the queue is drained or ctx expires.
func (n *Notifier) Close(ctx context.Context) error {
	if n == nil || !n.enabled {
		return nil
	}

	n.mu.Lock()
	if !n.closed {
		n.closed = true
		close(n.queue)
	}
	n.mu.Unlock()

	select {
	case <-n.doneChan:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// NotifyLifecycle sends a service lifecycle notification (e.g., startup or shutdown).
func (n *Notifier) NotifyLifecycle(event, details string) {
	if !n.Enabled() {
		return
	}

	var b strings.Builder
	b.WriteString("<b>[INFO] ProxyLoadouts Lifecycle</b>\n")
	b.WriteString("<b>Event:</b> <code>")
	b.WriteString(escapeTruncated(event, 120))
	b.WriteString("</code>\n")
	n.writeMetaHeader(&b)
	if strings.TrimSpace(details) != "" {
		b.WriteString("<b>Details:</b> ")
		b.WriteString(escapeTruncated(details, maxMessageFieldRune))
		b.WriteString("\n")
	}

	n.enqueue("", b.String(), true)
}

// NotifyServerError sends an alert for an unhandled HTTP 500 internal server error.
func (n *Notifier) NotifyServerError(alert ServerErrorAlert) {
	if !n.Enabled() || alert.Err == nil {
		return
	}

	errMsg := alert.Err.Error()
	routeKey := alert.RoutePattern
	if routeKey == "" {
		routeKey = normalizeDynamicSegments(alert.RequestURI)
	}
	fp := fingerprint("backend_500", alert.Method, routeKey, normalizeDynamicSegments(errMsg))

	var b strings.Builder
	b.WriteString("<b>[CRITICAL] Backend 500 Internal Error</b>\n")
	n.writeMetaHeader(&b)
	if alert.RoutePattern != "" {
		b.WriteString("<b>Route:</b> <code>")
		b.WriteString(escapeTruncated(alert.Method+" "+alert.RoutePattern, 160))
		b.WriteString("</code>\n")
	}
	if alert.RequestURI != "" {
		b.WriteString("<b>URI:</b> <code>")
		b.WriteString(escapeTruncated(alert.Method+" "+alert.RequestURI, 240))
		b.WriteString("</code>\n")
	}
	if alert.Caller != "" {
		b.WriteString("<b>Location:</b> <code>")
		b.WriteString(escapeTruncated(alert.Caller, 180))
		b.WriteString("</code>\n")
	}
	n.writeActorMeta(&b, alert.User, alert.ClientIP, alert.RequestID)
	b.WriteString("<b>Error:</b>\n<pre><code>")
	b.WriteString(escapeTruncated(errMsg, maxStackRunes))
	b.WriteString("</code></pre>")

	n.enqueue(fp, b.String(), false)
}

// NotifyPanic sends a high-priority alert when an HTTP handler recovers from a runtime panic.
func (n *Notifier) NotifyPanic(alert PanicAlert) {
	if !n.Enabled() {
		return
	}

	panicStr := fmt.Sprintf("%v", alert.Recovered)
	routeKey := alert.RoutePattern
	if routeKey == "" {
		routeKey = normalizeDynamicSegments(alert.RequestURI)
	}
	fp := fingerprint("backend_panic", alert.Method, routeKey, alert.Culprit, normalizeDynamicSegments(panicStr))

	var b strings.Builder
	b.WriteString("<b>[PANIC] Backend Panic Recovered</b>\n")
	n.writeMetaHeader(&b)
	if alert.Culprit != "" {
		b.WriteString("<b>Location:</b> <code>")
		b.WriteString(escapeTruncated(alert.Culprit, 180))
		b.WriteString("</code>\n")
	}
	if alert.RoutePattern != "" {
		b.WriteString("<b>Route:</b> <code>")
		b.WriteString(escapeTruncated(alert.Method+" "+alert.RoutePattern, 160))
		b.WriteString("</code>\n")
	}
	if alert.RequestURI != "" {
		b.WriteString("<b>URI:</b> <code>")
		b.WriteString(escapeTruncated(alert.Method+" "+alert.RequestURI, 240))
		b.WriteString("</code>\n")
	}
	n.writeActorMeta(&b, alert.User, alert.ClientIP, alert.RequestID)
	b.WriteString("<b>Panic:</b> <code>")
	b.WriteString(escapeTruncated(panicStr, maxMessageFieldRune))
	b.WriteString("</code>\n")
	if strings.TrimSpace(alert.Stack) != "" {
		b.WriteString("<b>Stack:</b>\n<pre><code>")
		b.WriteString(escapeTruncated(alert.Stack, maxStackRunes))
		b.WriteString("</code></pre>")
	}

	n.enqueue(fp, b.String(), false)
}

// NotifyClientError sends an alert for an unhandled frontend browser/React exception.
func (n *Notifier) NotifyClientError(alert ClientErrorAlert) {
	if !n.Enabled() || strings.TrimSpace(alert.Message) == "" {
		return
	}

	topFrame := firstNonEmptyLine(alert.Stack)
	if topFrame == "" {
		topFrame = firstNonEmptyLine(alert.ComponentStack)
	}
	fp := fingerprint("frontend_error", normalizeDynamicSegments(alert.Message), topFrame)

	var b strings.Builder
	b.WriteString("<b>[CLIENT] Frontend Client Error</b>\n")
	n.writeMetaHeader(&b)
	if alert.PageURL != "" {
		b.WriteString("<b>URL:</b> <code>")
		b.WriteString(escapeTruncated(alert.PageURL, 300))
		b.WriteString("</code>\n")
	}
	n.writeActorMeta(&b, alert.User, alert.ClientIP, alert.RequestID)
	if alert.UserAgent != "" {
		b.WriteString("<b>UA:</b> <code>")
		b.WriteString(escapeTruncated(alert.UserAgent, 180))
		b.WriteString("</code>\n")
	}
	b.WriteString("<b>Message:</b> <code>")
	b.WriteString(escapeTruncated(alert.Message, maxMessageFieldRune))
	b.WriteString("</code>\n")

	if strings.TrimSpace(alert.Stack) != "" {
		b.WriteString("<b>JS Stack:</b>\n<pre><code>")
		b.WriteString(escapeTruncated(alert.Stack, maxStackRunes))
		b.WriteString("</code></pre>\n")
	}
	if strings.TrimSpace(alert.ComponentStack) != "" {
		b.WriteString("<b>Component Tree:</b>\n<pre><code>")
		b.WriteString(escapeTruncated(alert.ComponentStack, maxComponentStackRunes))
		b.WriteString("</code></pre>")
	}

	n.enqueue(fp, b.String(), false)
}

func (n *Notifier) writeMetaHeader(b *strings.Builder) {
	b.WriteString("<b>Env:</b> <code>")
	b.WriteString(escapeTruncated(n.opts.Environment, 32))
	b.WriteString("</code> · <b>Release:</b> <code>")
	b.WriteString(escapeTruncated(n.opts.Release, 48))
	b.WriteString("</code> · <b>Time:</b> <code>")
	b.WriteString(time.Now().UTC().Format("15:04:05 UTC"))
	b.WriteString("</code>\n")
}

func (n *Notifier) writeActorMeta(b *strings.Builder, user, clientIP, requestID string) {
	if user != "" {
		b.WriteString("<b>User:</b> <code>")
		b.WriteString(escapeTruncated(user, 100))
		b.WriteString("</code>\n")
	}
	if clientIP != "" {
		b.WriteString("<b>IP:</b> <code>")
		b.WriteString(escapeTruncated(clientIP, 64))
		b.WriteString("</code>\n")
	}
	if requestID != "" {
		b.WriteString("<b>Request ID:</b> <code>")
		b.WriteString(escapeTruncated(requestID, 64))
		b.WriteString("</code>\n")
	}
}

func (n *Notifier) enqueue(fp, htmlText string, bypassStorm bool) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.closed {
		return
	}

	now := time.Now()

	// 1. Per-fingerprint deduplication with cooldown.
	suppressed := 0
	if fp != "" {
		entry, exists := n.dedup[fp]
		if exists {
			if now.Sub(entry.lastSent) < n.opts.Cooldown {
				entry.suppressed++
				return
			}
			suppressed = entry.suppressed
			entry.lastSent = now
			entry.suppressed = 0
		} else {
			if len(n.dedup) >= maxDedupEntries {
				n.evictDedupLocked(now)
			}
			n.dedup[fp] = &dedupEntry{
				lastSent:   now,
				suppressed: 0,
			}
		}
	}

	// 2. Global Storm Circuit Breaker (protects against floods of distinct errors).
	stormSummary := 0
	if !bypassStorm {
		if now.Before(n.stormUntil) {
			n.stormSuppressed++
			return
		}
		if n.stormSuppressed > 0 {
			stormSummary = n.stormSuppressed
			n.stormSuppressed = 0
		}

		// Prune sliding window timestamps older than StormWindow.
		cutoff := now.Add(-n.opts.StormWindow)
		validIdx := 0
		for _, ts := range n.recentSent {
			if ts.After(cutoff) {
				n.recentSent[validIdx] = ts
				validIdx++
			}
		}
		n.recentSent = n.recentSent[:validIdx]

		if len(n.recentSent) >= n.opts.StormMaxAlerts {
			n.recentSent = n.recentSent[:0]
			n.stormUntil = now.Add(n.opts.StormCooldown)
			n.stormSuppressed = 1
			stormNotice := fmt.Sprintf(
				"<b>[ALERT STORM] Protection Activated</b>\n"+
					"<b>Env:</b> <code>%s</code> · <b>Release:</b> <code>%s</code>\n"+
					"Exceeded <code>%d</code> unique alerts within <code>%s</code>.\n"+
					"Muting error notifications for <code>%s</code> to prevent chat spam.",
				escapeTruncated(n.opts.Environment, 32),
				escapeTruncated(n.opts.Release, 48),
				n.opts.StormMaxAlerts,
				n.opts.StormWindow.String(),
				n.opts.StormCooldown.String(),
			)
			n.pushToQueueLocked(stormNotice)
			return
		}

		n.recentSent = append(n.recentSent, now)
	}

	if suppressed > 0 {
		htmlText += fmt.Sprintf("\n<b>[SUPPRESSED]</b> Duplicates: <code>%d</code>", suppressed)
	}
	if stormSummary > 0 {
		htmlText += fmt.Sprintf("\n<b>[STORM MUTED]</b> Suppressed alerts: <code>%d</code>", stormSummary)
	}

	n.pushToQueueLocked(htmlText)
}

func (n *Notifier) pushToQueueLocked(msg string) {
	select {
	case n.queue <- msg:
	default:
		slog.Warn("telegram alert queue is full; dropping notification")
	}
}

func (n *Notifier) evictDedupLocked(now time.Time) {
	for k, v := range n.dedup {
		if now.Sub(v.lastSent) >= n.opts.Cooldown {
			delete(n.dedup, k)
		}
	}
	if len(n.dedup) >= maxDedupEntries {
		for k := range n.dedup {
			delete(n.dedup, k)
			break
		}
	}
}

func (n *Notifier) worker() {
	defer close(n.doneChan)

	for msg := range n.queue {
		_ = n.limiter.Wait(context.Background())
		if err := n.sendTelegramMessage(context.Background(), msg); err != nil {
			slog.Warn("failed to deliver telegram alert", "error", err)
		}
	}
}

type sendMessagePayload struct {
	ChatID          string `json:"chat_id"`
	MessageThreadID int    `json:"message_thread_id,omitempty"`
	Text            string `json:"text"`
	ParseMode       string `json:"parse_mode"`
}

func (n *Notifier) sendTelegramMessage(ctx context.Context, htmlText string) error {
	payload := sendMessagePayload{
		ChatID:          n.opts.ChatID,
		MessageThreadID: n.opts.ThreadID,
		Text:            htmlText,
		ParseMode:       "HTML",
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal telegram payload: %w", err)
	}

	endpoint := fmt.Sprintf("%s/bot%s/sendMessage", strings.TrimRight(n.opts.APIBaseURL, "/"), n.opts.BotToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create telegram request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.opts.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("telegram request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("telegram API status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBytes)))
	}

	_, _ = io.Copy(io.Discard, resp.Body)
	return nil
}

func escapeTruncated(s string, maxRunes int) string {
	s = strings.TrimSpace(s)
	if maxRunes > 0 && utf8.RuneCountInString(s) > maxRunes {
		runes := []rune(s)
		s = string(runes[:maxRunes]) + "…"
	}
	return html.EscapeString(s)
}

func firstNonEmptyLine(s string) string {
	for line := range strings.SplitSeq(s, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

// normalizeDynamicSegments replaces UUIDs and long numeric IDs (like 10-digit UIDs)
// with placeholders so identical errors across different entities share a single fingerprint.
func normalizeDynamicSegments(s string) string {
	s = uuidPattern.ReplaceAllString(s, "{uuid}")
	s = numberPattern.ReplaceAllString(s, "{id}")
	return s
}

func fingerprint(parts ...string) string {
	h := sha256.New()
	for _, p := range parts {
		_, _ = h.Write([]byte(p))
		_, _ = h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil)[:16])
}
