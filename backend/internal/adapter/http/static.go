package http

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"html"
	"io/fs"
	"net/http"
	"path"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/teamsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
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

// PublicMetaProvider provides public build and team metadata for dynamic OpenGraph injection.
type PublicMetaProvider interface {
	GetPublicBuild(ctx context.Context, id uuid.UUID, lang ...string) (*buildsvc.PublicBuildDetail, error)
	GetPublicTeam(ctx context.Context, id uuid.UUID, lang ...string) (*teamsvc.PublicTeamDetail, error)
}

type metaProvider struct {
	builds *buildsvc.Service
	teams  *teamsvc.Service
}

func (m *metaProvider) GetPublicBuild(ctx context.Context, id uuid.UUID, lang ...string) (*buildsvc.PublicBuildDetail, error) {
	if m.builds == nil {
		return nil, domain.ErrNotFound
	}
	return m.builds.GetPublic(ctx, id, lang...)
}

func (m *metaProvider) GetPublicTeam(ctx context.Context, id uuid.UUID, lang ...string) (*teamsvc.PublicTeamDetail, error) {
	if m.teams == nil {
		return nil, domain.ErrNotFound
	}
	return m.teams.GetPublic(ctx, id, lang...)
}

var (
	titleRegex     = regexp.MustCompile(`(?i)<title>.*?</title>`)
	ogTitleRegex   = regexp.MustCompile(`(?i)<meta\s+[^>]*property=["']og:title["'][^>]*>`)
	twTitleRegex   = regexp.MustCompile(`(?i)<meta\s+[^>]*name=["']twitter:title["'][^>]*>`)
	descRegex      = regexp.MustCompile(`(?i)<meta\s+[^>]*name=["']description["'][^>]*>`)
	ogDescRegex    = regexp.MustCompile(`(?i)<meta\s+[^>]*property=["']og:description["'][^>]*>`)
	twDescRegex    = regexp.MustCompile(`(?i)<meta\s+[^>]*name=["']twitter:description["'][^>]*>`)
	ogURLRegex     = regexp.MustCompile(`(?i)<meta\s+[^>]*property=["']og:url["'][^>]*>`)
	canonicalRegex = regexp.MustCompile(`(?i)<link\s+[^>]*rel=["']canonical["'][^>]*>`)
	ogImageRegex   = regexp.MustCompile(`(?i)<meta\s+[^>]*property=["']og:image["'][^>]*>`)
	twImageRegex   = regexp.MustCompile(`(?i)<meta\s+[^>]*name=["']twitter:image["'][^>]*>`)
)

func injectOpenGraph(htmlContent, title, description, pageURL, imageURL string) string {
	escapedTitle := html.EscapeString(title)
	escapedDesc := html.EscapeString(description)

	htmlContent = titleRegex.ReplaceAllLiteralString(htmlContent, "<title>"+escapedTitle+"</title>")
	htmlContent = ogTitleRegex.ReplaceAllLiteralString(htmlContent, `<meta property="og:title" content="`+escapedTitle+`" />`)
	htmlContent = twTitleRegex.ReplaceAllLiteralString(htmlContent, `<meta name="twitter:title" content="`+escapedTitle+`" />`)
	htmlContent = descRegex.ReplaceAllLiteralString(htmlContent, `<meta name="description" content="`+escapedDesc+`" />`)
	htmlContent = ogDescRegex.ReplaceAllLiteralString(htmlContent, `<meta property="og:description" content="`+escapedDesc+`" />`)
	htmlContent = twDescRegex.ReplaceAllLiteralString(htmlContent, `<meta name="twitter:description" content="`+escapedDesc+`" />`)

	if pageURL != "" {
		escapedURL := html.EscapeString(pageURL)
		htmlContent = ogURLRegex.ReplaceAllLiteralString(htmlContent, `<meta property="og:url" content="`+escapedURL+`" />`)
		htmlContent = canonicalRegex.ReplaceAllLiteralString(htmlContent, `<link rel="canonical" href="`+escapedURL+`" />`)
	}
	if imageURL != "" {
		escapedImg := html.EscapeString(imageURL)
		htmlContent = ogImageRegex.ReplaceAllLiteralString(htmlContent, `<meta property="og:image" content="`+escapedImg+`" />`)
		htmlContent = twImageRegex.ReplaceAllLiteralString(htmlContent, `<meta name="twitter:image" content="`+escapedImg+`" />`)
	}
	return htmlContent
}

type buildDataOG struct {
	Level   int `json:"level"`
	WEngine *struct {
		Name  string `json:"name"`
		Level int    `json:"level"`
	} `json:"w_engine"`
	DriveDiscs struct {
		SetBonuses []struct {
			Set struct {
				Name string `json:"name"`
			} `json:"set"`
			Count int `json:"count"`
		} `json:"set_bonuses"`
	} `json:"drive_discs"`
	UIStats struct {
		ATK struct {
			Total string `json:"total"`
		} `json:"atk"`
		CritRate struct {
			Total string `json:"total"`
		} `json:"crit_rate"`
		CritDMG struct {
			Total string `json:"total"`
		} `json:"crit_dmg"`
		AnomalyProficiency struct {
			Total string `json:"total"`
		} `json:"anomaly_proficiency"`
		AnomalyMastery struct {
			Total string `json:"total"`
		} `json:"anomaly_mastery"`
		PenRatio struct {
			Total string `json:"total"`
		} `json:"pen_ratio"`
		EnergyRegen struct {
			Total string `json:"total"`
		} `json:"energy_regen"`
	} `json:"ui_stats"`
	SplashArtURL string `json:"splash_art_url"`
}

func buildMetaForBuild(detail *buildsvc.PublicBuildDetail) (title, desc, imageURL string) {
	b := detail.Build
	owner := detail.Owner

	ownerName := "UID " + owner.UID
	if owner.Nickname != nil && *owner.Nickname != "" {
		ownerName = *owner.Nickname
	}
	title = fmt.Sprintf("%s — %s | Сборка игрока %s (UID %s)", b.AgentName, b.Name, ownerName, owner.UID)

	var descParts []string
	var data buildDataOG
	if len(b.BuildData) > 0 {
		_ = json.Unmarshal(b.BuildData, &data)
	}

	if data.SplashArtURL != "" {
		imageURL = data.SplashArtURL
	}

	if data.WEngine != nil && data.WEngine.Name != "" {
		descParts = append(descParts, "Амплификатор: "+data.WEngine.Name)
	}

	var setStrs []string
	for _, bonus := range data.DriveDiscs.SetBonuses {
		if bonus.Count >= 2 && bonus.Set.Name != "" {
			setStrs = append(setStrs, fmt.Sprintf("%d-pc %s", bonus.Count, bonus.Set.Name))
		}
	}
	if len(setStrs) > 0 {
		descParts = append(descParts, "Диски: "+strings.Join(setStrs, ", "))
	}

	var statStrs []string
	if data.UIStats.ATK.Total != "" && data.UIStats.ATK.Total != "0" {
		statStrs = append(statStrs, "ATK "+data.UIStats.ATK.Total)
	}
	if data.UIStats.CritRate.Total != "" && data.UIStats.CritRate.Total != "0" && data.UIStats.CritRate.Total != "0%" {
		statStrs = append(statStrs, "Крит "+data.UIStats.CritRate.Total)
	}
	if data.UIStats.CritDMG.Total != "" && data.UIStats.CritDMG.Total != "0" && data.UIStats.CritDMG.Total != "0%" {
		statStrs = append(statStrs, "КУ "+data.UIStats.CritDMG.Total)
	}
	if data.UIStats.AnomalyProficiency.Total != "" && data.UIStats.AnomalyProficiency.Total != "0" {
		statStrs = append(statStrs, "Знание аномалии "+data.UIStats.AnomalyProficiency.Total)
	}
	if data.UIStats.PenRatio.Total != "" && data.UIStats.PenRatio.Total != "0" && data.UIStats.PenRatio.Total != "0%" {
		statStrs = append(statStrs, "Пробивание "+data.UIStats.PenRatio.Total)
	}
	if len(statStrs) > 0 {
		descParts = append(descParts, strings.Join(statStrs, " • "))
	}

	if b.Description != nil && *b.Description != "" {
		descParts = append(descParts, *b.Description)
	}

	if len(descParts) > 0 {
		desc = strings.Join(descParts, " | ")
	} else {
		desc = fmt.Sprintf("Сборка персонажа %s от игрока %s", b.AgentName, ownerName)
	}

	return title, desc, imageURL
}

func teamMetaForTeam(detail *teamsvc.PublicTeamDetail) (title, desc string) {
	t := detail.Team
	owner := detail.Owner

	ownerName := "UID " + owner.UID
	if owner.Nickname != nil && *owner.Nickname != "" {
		ownerName = *owner.Nickname
	}
	title = fmt.Sprintf("%s | Отряд игрока %s (UID %s)", t.Name, ownerName, owner.UID)

	var agentEntries []string
	for _, m := range detail.Members {
		if m.Build == nil {
			continue
		}
		agentStr := m.Build.AgentName
		if len(m.Build.BuildData) > 0 {
			var bData struct {
				WEngine *struct {
					Name string `json:"name"`
				} `json:"w_engine"`
			}
			if err := json.Unmarshal(m.Build.BuildData, &bData); err == nil && bData.WEngine != nil && bData.WEngine.Name != "" {
				agentStr = fmt.Sprintf("%s (%s)", agentStr, bData.WEngine.Name)
			}
		}
		agentEntries = append(agentEntries, agentStr)
	}

	var descParts []string
	if len(agentEntries) > 0 {
		descParts = append(descParts, "Состав: "+strings.Join(agentEntries, ", "))
	}
	if t.Description != nil && *t.Description != "" {
		descParts = append(descParts, "Заметка: "+*t.Description)
	}

	if len(descParts) > 0 {
		desc = strings.Join(descParts, " | ")
	} else {
		desc = "Отряд игрока " + ownerName
	}

	return title, desc
}

func canonicalURLForRequest(r *http.Request) string {
	if r == nil {
		return ""
	}
	scheme := "https"
	if r.TLS == nil && !strings.Contains(r.Host, "proxyloadouts.com") {
		scheme = "http"
	}
	host := r.Host
	if host == "" {
		host = "proxyloadouts.com"
	}
	return fmt.Sprintf("%s://%s%s", scheme, host, r.URL.Path)
}

// spaHandler serves the embedded React build with history-API fallback:
// unknown paths without a file extension resolve to index.html.
//
// When requested with paths like /b/{buildID} or /t/{teamID}, public metadata
// is resolved and injected dynamically into OpenGraph / Twitter meta tags.
func spaHandler(provider ...PublicMetaProvider) http.Handler {
	var metaProv PublicMetaProvider
	if len(provider) > 0 {
		metaProv = provider[0]
	}

	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		panic("embedded static filesystem is corrupted: " + err.Error())
	}

	indexHTMLBytes, err := fs.ReadFile(sub, "index.html")
	if err != nil {
		panic("embedded static filesystem is corrupted: cannot read index.html: " + err.Error())
	}
	indexHTML := string(indexHTMLBytes)

	fileServer := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		if name == "" {
			name = "index.html"
		}

		if (r.Method == http.MethodGet || r.Method == http.MethodHead) && metaProv != nil {
			cleanPath := strings.Trim(path.Clean(r.URL.Path), "/")
			parts := strings.Split(cleanPath, "/")
			if len(parts) == 2 && (parts[0] == "b" || parts[0] == "t") {
				if id, err := uuid.Parse(parts[1]); err == nil {
					lang := extractLang(r)
					var (
						ogTitle  string
						ogDesc   string
						imageURL string
						found    bool
					)

					switch parts[0] {
					case "b":
						if detail, err := metaProv.GetPublicBuild(r.Context(), id, lang); err == nil && detail != nil {
							ogTitle, ogDesc, imageURL = buildMetaForBuild(detail)
							found = true
						}
					case "t":
						if detail, err := metaProv.GetPublicTeam(r.Context(), id, lang); err == nil && detail != nil {
							ogTitle, ogDesc = teamMetaForTeam(detail)
							found = true
						}
					}

					if found {
						pageURL := canonicalURLForRequest(r)
						injected := injectOpenGraph(indexHTML, ogTitle, ogDesc, pageURL, imageURL)
						w.Header().Set("Content-Type", "text/html; charset=utf-8")
						w.Header().Set("Cache-Control", revalidateCacheControl)
						w.WriteHeader(http.StatusOK)
						if r.Method != http.MethodHead {
							_, _ = w.Write([]byte(injected)) //nolint:gosec // user values are sanitized via html.EscapeString before injection
						}
						return
					}
				}
			}
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
