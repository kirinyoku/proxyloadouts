package domain

import "errors"

// Domain-level sentinel errors. Repository and service layers wrap them with
// context (fmt.Errorf with %w) while HTTP handlers map them to status codes:
// ErrNotFound -> 404, ErrConflict -> 409, ErrUnauthorized -> 401, ErrForbidden -> 403.
var (
	// ErrNotFound is returned when the requested entity does not exist.
	ErrNotFound = errors.New("entity not found")

	// ErrConflict is returned when an operation violates data integrity,
	// e.g. deleting a build that is used by a team.
	ErrConflict = errors.New("conflict")

	// ErrUnauthorized is returned when credentials are missing or invalid.
	ErrUnauthorized = errors.New("unauthorized")

	// ErrForbidden is returned when an authenticated user tries to access
	// an entity they do not own.
	ErrForbidden = errors.New("forbidden")

	// ErrUserBanned is returned when a suspended user attempts to log in or access the API.
	ErrUserBanned = errors.New("user account is banned")

	// ErrInvalidInput is returned when request input fails format validation,
	// e.g. a malformed ZZZ UID.
	ErrInvalidInput = errors.New("invalid input")

	// ErrRateLimited is returned when the upstream game data source reports
	// HTTP 429 and the request should be retried later.
	ErrRateLimited = errors.New("upstream rate limited")

	// ErrSourceUnavailable is returned when the upstream game data source is
	// under maintenance or unreachable (network failure, 5xx).
	ErrSourceUnavailable = errors.New("data source unavailable")
)
