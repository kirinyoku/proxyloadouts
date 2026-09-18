package http

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

//go:embed all:static
var staticFS embed.FS

// Cache policies for the embedded SPA.
//
// Vite emits content-hashed filenames under /assets, so the bytes behind a
// given URL can never change and are safe to pin in the browser cache for a
// year. Everything else — the SPA shell, the service worker bootstrap and the
// unhashed public/ files — must be revalidated so that a deploy is picked up on
// the next navigation.
const (
	immutableCacheControl  = "public, max-age=31536000, immutable"
	revalidateCacheControl = "no-cache"
)

// immutablePrefix is the only location served with a pinned cache lifetime.
const immutablePrefix = "/assets/"

// spaHandler serves the embedded React build with history-API fallback:
// unknown paths without a file extension resolve to index.html.
//
// embed.FS reports a zero modtime for every file, so http.ServeContent emits
// neither Last-Modified nor an ETag. Left to its own devices the response
// carries no cache validator at all and the browser re-downloads the whole
// bundle on every cold load, so the policy is declared explicitly here.
func spaHandler() http.Handler {
	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		panic("embedded static filesystem is corrupted: " + err.Error())
	}

	fileServer := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		if name == "" {
			name = "index.html"
		}
		if _, statErr := fs.Stat(sub, name); statErr != nil {
			// A missing file must not be answered with the SPA shell. Doing so
			// hands the browser HTML under a .js/.css/.woff2 URL, which surfaces
			// as a hard MIME failure on a <script type="module"> instead of a
			// plain 404 — far harder to diagnose, and cacheable at the wrong
			// URL. Client-side routes have no extension, so the distinction is
			// unambiguous.
			if path.Ext(name) != "" {
				w.Header().Set("Cache-Control", revalidateCacheControl)
				http.NotFound(w, r)
				return
			}
			// SPA fallback for client-side routes. Rewriting the path also routes
			// the response through the revalidate policy below.
			r.URL.Path = "/"
		}

		w.Header().Set("Cache-Control", cacheControlFor(r.URL.Path))
		fileServer.ServeHTTP(w, r)
	})
}

// cacheControlFor returns the Cache-Control policy for a served static path.
func cacheControlFor(urlPath string) string {
	if strings.HasPrefix(urlPath, immutablePrefix) {
		return immutableCacheControl
	}
	return revalidateCacheControl
}
