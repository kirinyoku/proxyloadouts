package zfae

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

var (
	reCardStart = regexp.MustCompile(`<div class="agent-card"`)

	reMindscape = regexp.MustCompile(`src="[^"]*Mindscape_(\d+)_`)

	reDataAgentSlug     = regexp.MustCompile(`data-agent-slug="([^"]*)"`)
	reDataAssessmentID  = regexp.MustCompile(`data-assessment-id="([^"]*)"`)
	reDataRank          = regexp.MustCompile(`data-rank="([^"]*)"`)
	reDataTopPercentile = regexp.MustCompile(`data-top-percentile="([^"]*)"`)
	reDataDateUpdated   = regexp.MustCompile(`data-date-updated="([^"]*)"`)

	reRankOf = regexp.MustCompile(`<span class="rank-of">([^<]+)</span>`)
	reScore  = regexp.MustCompile(`Total score:</span>\s*<span>([0-9.]+)`)

	reBracketToggle = regexp.MustCompile(`<[^>]+class="[^"]*leaderboard-info-toggle[^"]*"[^>]*>.*?class="highlight-text"[^>]*>([^<]+)<`)
	reActiveFilter  = regexp.MustCompile(`<ul class="dropdown-menu filter-menu">.*?<li class="active"[^>]*>\s*<span[^>]*>([^<]+)</span>`)

	reActiveSwitchLeaderboard = regexp.MustCompile(`<li class="active"[^>]*>\s*<span[^>]*switchLeaderboard\([^,]+,\s*(\d+),\s*(-?\d+)\)`)

	reBreakdownWeapon  = regexp.MustCompile(`W-Engine choice:\s*</span>\s*<span[^>]*>([0-9]+)%`)
	reBreakdownDiscSet = regexp.MustCompile(`Drive Disc Set choices:\s*</span>\s*<span[^>]*>([0-9]+)%`)
	reBreakdownMain    = regexp.MustCompile(`Mainstat choices:\s*</span>\s*<span[^>]*>([0-9]+)%`)
	reBreakdownSub     = regexp.MustCompile(`Substat assessment:\s*</span>\s*<span[^>]*>([0-9]+)%`)

	reWeaponRefinement = regexp.MustCompile(`<span class="refinement">\s*R([1-5])\s*</span>`)

	reStatListSubstat = regexp.MustCompile(`<li class="sub stat[^>]*>.*?<span class="label">\s*([^<]+)\s*</span>(?:\s*<span>\+([0-9]+)</span>)?`)
	reModalSubstat    = regexp.MustCompile(`<li class="sub stat[^>]*>.*?<span>\s*([^<]+)\s*</span>(?:\s*<strong>\+([0-9]+)</strong>)?`)
)

func normalizeSlug(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

var agentSlugToIDMap = map[string]int{
	"anby":           1011,
	"nekomata":       1021,
	"nicole":         1031,
	"soldier11":      1041,
	"yidhari":        1051,
	"corin":          1061,
	"caesar":         1071,
	"billy":          1081,
	"miyabi":         1091,
	"koleda":         1101,
	"anton":          1111,
	"ben":            1121,
	"soukaku":        1131,
	"lycaon":         1141,
	"lucy":           1151,
	"lighter":        1161,
	"burnice":        1171,
	"grace":          1181,
	"ellen":          1191,
	"harumasa":       1201,
	"rina":           1211,
	"yanagi":         1221,
	"zhuyuan":        1241,
	"qingyi":         1251,
	"jane":           1261,
	"seth":           1271,
	"piper":          1281,
	"hugo":           1291,
	"orphiemagus":    1301,
	"astrayao":       1311,
	"evelyn":         1321,
	"vivian":         1331,
	"zhao":           1341,
	"pulchra":        1351,
	"trigger":        1361,
	"yixuan":         1371,
	"soldier0anby":   1381,
	"jufufu":         1391,
	"alice":          1401,
	"yuzuha":         1411,
	"panyinhu":       1421,
	"yeshunguang":    1431,
	"manato":         1441,
	"lucia":          1451,
	"seed":           1461,
	"banyue":         1471,
	"dialyn":         1481,
	"sunna":          1491,
	"aria":           1501,
	"nangongyu":      1511,
	"cissia":         1521,
	"starlightbilly": 1531,
	"promeia":        1541,
	"pyrois":         1551,
	"velina":         1561,
	"norma":          1571,
	"remielle":       1581,
	"sigrid":         1591,
	"claret":         1611,
	"roxy":           1621,
	"severian":       1631,
	"phoenix":        1641,
}

type CardParseResult struct {
	AgentID             int
	Rating              *domain.FaeRating
	ActiveLeaderboardID int
	AssessmentID        string
	RawCardHTML         string
}

func ParseProfileCards(html string) []CardParseResult {
	indices := reCardStart.FindAllStringIndex(html, -1)
	if len(indices) == 0 {
		return nil
	}

	results := make([]CardParseResult, 0, len(indices))
	for i := range indices {
		start := indices[i][0]
		end := len(html)
		if i+1 < len(indices) {
			end = indices[i+1][0]
		}
		cardHTML := html[start:end]

		res, ok := ParseCardHTML(cardHTML)
		if ok {
			results = append(results, res)
		}
	}
	return results
}

func ParseCardHTML(cardHTML string) (CardParseResult, bool) {
	agentID := 0
	if m := reMindscape.FindStringSubmatch(cardHTML); len(m) > 1 {
		if id, err := strconv.Atoi(m[1]); err == nil {
			agentID = id
		}
	}

	slug := ""
	if m := reDataAgentSlug.FindStringSubmatch(cardHTML); len(m) > 1 {
		slug = m[1]
	}
	if agentID == 0 && slug != "" {
		norm := normalizeSlug(slug)
		if id, ok := agentSlugToIDMap[norm]; ok {
			agentID = id
		}
	}

	if agentID == 0 {
		return CardParseResult{}, false
	}

	assessmentID := ""
	if m := reDataAssessmentID.FindStringSubmatch(cardHTML); len(m) > 1 {
		assessmentID = m[1]
	}

	activeLeaderboardID := 0
	if m := reActiveSwitchLeaderboard.FindStringSubmatch(cardHTML); len(m) > 2 {
		if aid := m[1]; aid != "" && assessmentID == "" {
			assessmentID = aid
		}
		if lid, err := strconv.Atoi(m[2]); err == nil {
			activeLeaderboardID = lid
		}
	}

	var timeAssessed *int64
	if m := reDataDateUpdated.FindStringSubmatch(cardHTML); len(m) > 1 && m[1] != "" {
		if t, err := strconv.ParseInt(m[1], 10, 64); err == nil {
			timeAssessed = &t
		}
	}

	var slugPtr *string
	if slug != "" {
		slugPtr = &slug
	}

	fp := ExtractCardEquipmentFingerprint(cardHTML)
	var fpPtr *string
	if fp != "" {
		fpPtr = &fp
	}

	rankStr := ""
	if m := reDataRank.FindStringSubmatch(cardHTML); len(m) > 1 {
		rankStr = strings.TrimSpace(m[1])
	}

	if rankStr == "" || rankStr == "0" {
		return CardParseResult{
			AgentID:             agentID,
			ActiveLeaderboardID: activeLeaderboardID,
			AssessmentID:        assessmentID,
			RawCardHTML:         cardHTML,
			Rating: &domain.FaeRating{
				Status:               domain.FaeStatusUnassessed,
				Outdated:             false,
				Slug:                 slugPtr,
				TimeAssessed:         timeAssessed,
				EquipmentFingerprint: fpPtr,
			},
		}, true
	}

	rankVal, err := strconv.Atoi(rankStr)
	if err != nil {
		return CardParseResult{}, false
	}

	var rankOfPtr *int
	if m := reRankOf.FindStringSubmatch(cardHTML); len(m) > 1 {
		clean := strings.ReplaceAll(strings.TrimSpace(m[1]), ",", "")
		clean = strings.ReplaceAll(clean, " ", "")
		if ro, err := strconv.Atoi(clean); err == nil {
			rankOfPtr = &ro
		}
	}

	var topPctPtr *float64
	if m := reDataTopPercentile.FindStringSubmatch(cardHTML); len(m) > 1 && m[1] != "" {
		if pct, err := strconv.ParseFloat(m[1], 64); err == nil {
			topPctPtr = &pct
		}
	}

	var scorePtr *float64
	if m := reScore.FindStringSubmatch(cardHTML); len(m) > 1 {
		if sc, err := strconv.ParseFloat(m[1], 64); err == nil {
			scorePtr = &sc
		}
	}

	var bracketPtr *string
	if m := reBracketToggle.FindStringSubmatch(cardHTML); len(m) > 1 {
		b := strings.TrimSpace(m[1])
		if b != "" {
			bracketPtr = &b
		}
	}
	if bracketPtr == nil {
		if m := reActiveFilter.FindStringSubmatch(cardHTML); len(m) > 1 {
			b := strings.TrimSpace(m[1])
			if b != "" {
				bracketPtr = &b
			}
		}
	}

	breakdown := parseBreakdown(cardHTML)

	return CardParseResult{
		AgentID:             agentID,
		ActiveLeaderboardID: activeLeaderboardID,
		AssessmentID:        assessmentID,
		RawCardHTML:         cardHTML,
		Rating: &domain.FaeRating{
			Status:               domain.FaeStatusLive,
			Outdated:             false,
			Rank:                 &rankVal,
			RankOf:               rankOfPtr,
			TopPercentile:        topPctPtr,
			Score:                scorePtr,
			TimeAssessed:         timeAssessed,
			Slug:                 slugPtr,
			BracketName:          bracketPtr,
			EquipmentFingerprint: fpPtr,
			Breakdown:            breakdown,
		},
	}, true
}

func parseBreakdown(cardHTML string) *domain.FaeScoreBreakdown {
	var (
		wPtr *int
		dPtr *int
		mPtr *int
		sPtr *int
	)
	if m := reBreakdownWeapon.FindStringSubmatch(cardHTML); len(m) > 1 {
		if v, err := strconv.Atoi(m[1]); err == nil {
			wPtr = &v
		}
	}
	if m := reBreakdownDiscSet.FindStringSubmatch(cardHTML); len(m) > 1 {
		if v, err := strconv.Atoi(m[1]); err == nil {
			dPtr = &v
		}
	}
	if m := reBreakdownMain.FindStringSubmatch(cardHTML); len(m) > 1 {
		if v, err := strconv.Atoi(m[1]); err == nil {
			mPtr = &v
		}
	}
	if m := reBreakdownSub.FindStringSubmatch(cardHTML); len(m) > 1 {
		if v, err := strconv.Atoi(m[1]); err == nil {
			sPtr = &v
		}
	}

	if wPtr == nil && dPtr == nil && mPtr == nil && sPtr == nil {
		return nil
	}
	return &domain.FaeScoreBreakdown{
		WeaponPercent:   wPtr,
		DiscSetPercent:  dPtr,
		MainstatPercent: mPtr,
		SubstatPercent:  sPtr,
	}
}

func ExtractCardEquipmentFingerprint(cardHTML string) string {
	weaponPrefix := "w:r0"
	if m := reWeaponRefinement.FindStringSubmatch(cardHTML); len(m) > 1 {
		weaponPrefix = "w:r" + m[1]
	}

	slotParts := make([]string, 6)
	for slot := 1; slot <= 6; slot++ {
		substats := extractSlotSubstats(cardHTML, slot)
		if len(substats) == 0 {
			return ""
		}
		sort.Strings(substats)
		slotParts[slot-1] = fmt.Sprintf("s%d:%s", slot, strings.Join(substats, ","))
	}

	return weaponPrefix + "|" + strings.Join(slotParts, "|")
}

func extractSlotSubstats(cardHTML string, slot int) []string {
	patternStatList := fmt.Sprintf(`stat-list slot%d[^>]*>.*?<ul>(.*?)</ul>`, slot)
	reStatList := regexp.MustCompile(`(?s)` + patternStatList)
	if m := reStatList.FindStringSubmatch(cardHTML); len(m) > 1 {
		matches := reStatListSubstat.FindAllStringSubmatch(m[1], -1)
		if len(matches) > 0 {
			subs := make([]string, len(matches))
			for i, sub := range matches {
				code := strings.TrimSpace(sub[1])
				upgrades := "0"
				if len(sub) > 2 && sub[2] != "" {
					upgrades = sub[2]
				}
				subs[i] = fmt.Sprintf("%s+%s", code, upgrades)
			}
			return subs
		}
	}

	patternModal := fmt.Sprintf(`<li class="slot%d"[^>]*>.*?<ul>(.*?)</ul>`, slot)
	reModal := regexp.MustCompile(`(?s)` + patternModal)
	if m := reModal.FindStringSubmatch(cardHTML); len(m) > 1 {
		matches := reModalSubstat.FindAllStringSubmatch(m[1], -1)
		if len(matches) > 0 {
			subs := make([]string, len(matches))
			for i, sub := range matches {
				code := strings.TrimSpace(sub[1])
				upgrades := "0"
				if len(sub) > 2 && sub[2] != "" {
					upgrades = sub[2]
				}
				subs[i] = fmt.Sprintf("%s+%s", code, upgrades)
			}
			return subs
		}
	}

	return nil
}
