package provider

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/kokusei/dashboard/backend/internal/domain"
)

const (
	birthsStatsDataID          = "0003411597"
	birthsTableCode            = "10040"
	birthsAreaCode             = "00000"
	birthsCanonicalSHA256      = "b21763cf39f1274b7d3079680132f0390bf79e83a6697fd0b6338e4e5c567d3f"
	birthsLatestReviewedPeriod = "2024年"
	birthsLatestReviewedValue  = "686173"
	birthsSourceURL            = "https://www.e-stat.go.jp/stat-search/database?layout=datalist&statdisp_id=0003411597"
	maxEStatResponseBytes      = 5 << 20
)

type EStatBirthsProvider struct {
	client      HTTPClient
	appID       string
	endpoint    string
	now         func() time.Time
	allowUnsafe bool
	expectedSHA string
}

func NewEStatBirthsProvider(client HTTPClient, appID string) *EStatBirthsProvider {
	return &EStatBirthsProvider{
		client: client, appID: strings.TrimSpace(appID),
		endpoint: "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData", now: time.Now,
		expectedSHA: birthsCanonicalSHA256,
	}
}

func (p *EStatBirthsProvider) Fetch(ctx context.Context) ([]domain.FetchedIndicatorValue, error) {
	if p.client == nil {
		return nil, errors.New("HTTP client is required")
	}
	if p.appID == "" {
		return nil, errors.New("e-Stat application ID is required")
	}
	endpoint, err := url.Parse(p.endpoint)
	if err != nil || (!p.allowUnsafe && (endpoint.Scheme != "https" || endpoint.Hostname() != "api.e-stat.go.jp")) {
		return nil, errors.New("untrusted e-Stat API endpoint")
	}
	query := endpoint.Query()
	query.Set("appId", p.appID)
	query.Set("statsDataId", birthsStatsDataID)
	query.Set("cdTab", birthsTableCode)
	query.Set("cdArea", birthsAreaCode)
	query.Set("metaGetFlg", "Y")
	query.Set("limit", "100")
	endpoint.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	response, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download official births data: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download official births data: status %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxEStatResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read official births data: %w", err)
	}
	if len(body) > maxEStatResponseBytes {
		return nil, errors.New("official births response is too large")
	}
	values, checksum, err := p.parse(body)
	if err != nil {
		return nil, err
	}
	log.Printf("official data fetched: indicator=births dataset=%s file=estat-%s.json checksum_sha256=%s periods=%d fetched_at=%s", birthsStatsDataID, birthsStatsDataID, checksum, len(values), p.now().UTC().Format(time.RFC3339))
	return values, nil
}

func (p *EStatBirthsProvider) parse(body []byte) ([]domain.FetchedIndicatorValue, string, error) {
	type named struct {
		Code string `json:"@code"`
		Name string `json:"$"`
	}
	type class struct {
		ID   string `json:"@id"`
		Name string `json:"@name"`
		Code string `json:"@code"`
		Unit string `json:"@unit"`
	}
	type value struct {
		Tab   string `json:"@tab"`
		Area  string `json:"@area"`
		Time  string `json:"@time"`
		Unit  string `json:"@unit"`
		Value string `json:"$"`
	}
	var payload struct {
		Data struct {
			Result struct {
				Status int `json:"STATUS"`
			} `json:"RESULT"`
			StatisticalData struct {
				Table struct {
					ID             string `json:"@id"`
					StatName       named  `json:"STAT_NAME"`
					Government     named  `json:"GOV_ORG"`
					StatisticsName string `json:"STATISTICS_NAME"`
					Cycle          string `json:"CYCLE"`
					UpdatedDate    string `json:"UPDATED_DATE"`
				} `json:"TABLE_INF"`
				Classes struct {
					Objects []struct {
						ID    string          `json:"@id"`
						Class json.RawMessage `json:"CLASS"`
					} `json:"CLASS_OBJ"`
				} `json:"CLASS_INF"`
				Values struct {
					Values []value `json:"VALUE"`
				} `json:"DATA_INF"`
			} `json:"STATISTICAL_DATA"`
		} `json:"GET_STATS_DATA"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, "", errors.New("invalid e-Stat births JSON")
	}
	data := payload.Data.StatisticalData
	if payload.Data.Result.Status != 0 || data.Table.ID != birthsStatsDataID || data.Table.StatName.Code != "00450011" || data.Table.Government.Name != "厚生労働省" || data.Table.Cycle != "年次" || !strings.Contains(data.Table.StatisticsName, "確定数 出生") {
		return nil, "", errors.New("unexpected e-Stat births dataset metadata")
	}
	classByID := map[string]class{}
	for _, object := range data.Classes.Objects {
		if object.ID != "tab" && object.ID != "area" {
			continue
		}
		var item class
		if err := json.Unmarshal(object.Class, &item); err != nil {
			return nil, "", errors.New("invalid e-Stat births classification")
		}
		classByID[object.ID] = item
	}
	if classByID["tab"].Code != birthsTableCode || classByID["tab"].Name != "出生数" || classByID["tab"].Unit != "人" || classByID["area"].Code != birthsAreaCode || classByID["area"].Name != "全国" {
		return nil, "", errors.New("unexpected e-Stat births series classification")
	}
	publishedAt, err := time.Parse("2006-01-02", data.Table.UpdatedDate)
	if err != nil || publishedAt.After(p.now().Add(24*time.Hour)) {
		return nil, "", errors.New("invalid e-Stat births update date")
	}

	canonical := make([]value, 0, len(data.Values.Values))
	result := make([]domain.FetchedIndicatorValue, 0, 10)
	seen := map[string]bool{}
	foundReviewed := false
	for _, item := range data.Values.Values {
		canonical = append(canonical, item)
		if item.Tab != birthsTableCode || item.Area != birthsAreaCode || item.Unit != "人" {
			return nil, "", errors.New("mixed births series or unit")
		}
		match := regexp.MustCompile(`^([0-9]{4})000000$`).FindStringSubmatch(item.Time)
		if match == nil {
			return nil, "", fmt.Errorf("invalid births period %q", item.Time)
		}
		year := match[1]
		if year < "2015" {
			continue
		}
		period := year + "年"
		if seen[period] {
			return nil, "", fmt.Errorf("duplicate births period %s", period)
		}
		seen[period] = true
		if !integerValue.MatchString(item.Value) {
			return nil, "", fmt.Errorf("missing or invalid births value for %s", period)
		}
		if len(item.Value) > 8 || item.Value == "0" {
			return nil, "", fmt.Errorf("births value outside expected range for %s", period)
		}
		if period == birthsLatestReviewedPeriod && item.Value == birthsLatestReviewedValue {
			foundReviewed = true
		}
		result = append(result, domain.FetchedIndicatorValue{
			IndicatorSlug: "births", Value: personsToTenThousands(item.Value), Period: period,
			PublishedAt: publishedAt, FetchedAt: p.now().UTC(), SourceName: "厚生労働省",
			SourceURL: birthsSourceURL, ExternalID: birthsStatsDataID + ":" + item.Time,
			EstimateKind: "final",
		})
	}
	if len(result) == 0 || !foundReviewed {
		return nil, "", errors.New("reviewed official births value not found")
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Period < result[j].Period })
	sort.Slice(canonical, func(i, j int) bool { return canonical[i].Time < canonical[j].Time })
	canonicalJSON, _ := json.Marshal(canonical)
	sum := sha256.Sum256(append(canonicalJSON, '\n'))
	checksum := hex.EncodeToString(sum[:])
	if p.expectedSHA != "" && checksum != p.expectedSHA {
		return nil, "", fmt.Errorf("official births canonical checksum changed: %s", checksum)
	}
	return result, checksum, nil
}
