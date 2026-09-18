package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/scannersvc"
)

// ShowcaseHandler implements the public showcase scan endpoint.
type ShowcaseHandler struct {
	scanner *scannersvc.Service
}

// NewShowcaseHandler creates the showcase handler.
func NewShowcaseHandler(scanner *scannersvc.Service) *ShowcaseHandler {
	return &ShowcaseHandler{scanner: scanner}
}

// handle scans the showcase for the UID from the path. The endpoint is
// public: guests may look up showcases without an account (SOW §4).
func (h *ShowcaseHandler) handle(w http.ResponseWriter, r *http.Request) {
	uid := chi.URLParam(r, "uid")
	lang := extractLang(r)

	showcase, err := h.scanner.ScanByUID(r.Context(), uid, lang)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, showcase)
}
