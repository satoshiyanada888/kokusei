package provider

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/kokusei/dashboard/backend/internal/domain"
)

const (
	unemploymentStatInfID          = "000001082681"
	unemploymentWorkbookSHA256     = "7ee865692c8882a8452c5d36f5c5111cb2f75ebee9d972205ebd4941eb5afdab"
	unemploymentPublishedAt        = "2026-01-30"
	unemploymentLatestPeriod       = "2025年"
	unemploymentLatestValue        = "2.5"
	unemploymentSourceURL          = "https://www.e-stat.go.jp/stat-search/files?layout=dataset&stat_infid=000001082681&toukei=00200531"
	unemploymentWorkbookMaxBytes   = 5 << 20
	unemploymentFirstImportedYear  = 2015
	unemploymentLatestReviewedYear = 2025
)

var decimalRate = regexp.MustCompile(`^[0-9]+(?:\.[0-9])?$`)

type StatisticsUnemploymentProvider struct {
	client      HTTPClient
	endpoint    string
	now         func() time.Time
	allowUnsafe bool
	expectedSHA string
}

func NewStatisticsUnemploymentProvider(client HTTPClient) *StatisticsUnemploymentProvider {
	return &StatisticsUnemploymentProvider{
		client:   client,
		endpoint: "https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=" + unemploymentStatInfID,
		now:      time.Now, expectedSHA: unemploymentWorkbookSHA256,
	}
}

func (p *StatisticsUnemploymentProvider) Fetch(ctx context.Context) ([]domain.FetchedIndicatorValue, error) {
	if p.client == nil {
		return nil, errors.New("HTTP client is required")
	}
	endpoint, err := url.Parse(p.endpoint)
	if err != nil || (!p.allowUnsafe && (endpoint.Scheme != "https" || endpoint.Hostname() != "www.e-stat.go.jp" || endpoint.Query().Get("statInfId") != unemploymentStatInfID || endpoint.Query().Get("fileKind") != "0")) {
		return nil, errors.New("untrusted unemployment workbook endpoint")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	response, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download official unemployment workbook: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download official unemployment workbook: status %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, unemploymentWorkbookMaxBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read official unemployment workbook: %w", err)
	}
	if len(body) > unemploymentWorkbookMaxBytes {
		return nil, errors.New("official unemployment workbook is too large")
	}
	sum := sha256.Sum256(body)
	checksum := hex.EncodeToString(sum[:])
	if p.expectedSHA != "" && checksum != p.expectedSHA {
		return nil, fmt.Errorf("official unemployment workbook checksum changed: %s", checksum)
	}
	values, err := p.parseWorkbook(body)
	if err != nil {
		return nil, err
	}
	log.Printf("official data fetched: indicator=unemployment-rate dataset=%s file=unemployment-2-1.xlsx checksum_sha256=%s periods=%d fetched_at=%s", unemploymentStatInfID, checksum, len(values), p.now().UTC().Format(time.RFC3339))
	return values, nil
}

func (p *StatisticsUnemploymentProvider) parseWorkbook(data []byte) ([]domain.FetchedIndicatorValue, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, errors.New("unemployment file is not a valid XLSX workbook")
	}
	sharedXML, err := readZipFile(zr, "xl/sharedStrings.xml")
	if err != nil {
		return nil, err
	}
	shared, err := parseSharedStrings(sharedXML)
	if err != nil {
		return nil, fmt.Errorf("parse unemployment shared strings: %w", err)
	}
	sheet, err := readZipFile(zr, "xl/worksheets/sheet1.xml")
	if err != nil {
		return nil, err
	}
	rows, err := parseRows(sheet, shared)
	if err != nil {
		return nil, fmt.Errorf("parse unemployment worksheet: %w", err)
	}
	header := ""
	for index, row := range rows {
		if index >= 10 {
			break
		}
		for _, item := range row {
			header += strings.ReplaceAll(strings.ReplaceAll(item, " ", ""), "　", "")
		}
	}
	for _, expected := range []string{"長期時系列表２", "全国", "男女計", "完全失業率（％）"} {
		if !strings.Contains(header, expected) {
			return nil, fmt.Errorf("unexpected unemployment worksheet definition: missing %s", expected)
		}
	}
	publishedAt, _ := time.Parse("2006-01-02", unemploymentPublishedAt)
	if publishedAt.After(p.now().Add(24 * time.Hour)) {
		return nil, errors.New("invalid unemployment publication date")
	}
	seen := map[string]bool{}
	values := make([]domain.FetchedIndicatorValue, 0, 11)
	foundReviewed := false
	for _, row := range rows {
		year, err := strconv.Atoi(strings.TrimSpace(row["B"]))
		if err != nil || year < unemploymentFirstImportedYear {
			continue
		}
		if year > unemploymentLatestReviewedYear {
			return nil, fmt.Errorf("unreviewed unemployment period %d", year)
		}
		period := fmt.Sprintf("%d年", year)
		if seen[period] {
			return nil, fmt.Errorf("duplicate unemployment period %s", period)
		}
		seen[period] = true
		raw := normalizeStatisticalNumber(row["M"])
		if !decimalRate.MatchString(raw) {
			return nil, fmt.Errorf("missing or invalid unemployment rate for %s", period)
		}
		rate, err := strconv.ParseFloat(raw, 64)
		if err != nil || rate < 0 || rate > 100 {
			return nil, fmt.Errorf("unemployment rate outside 0-100 for %s", period)
		}
		if period == unemploymentLatestPeriod && raw == unemploymentLatestValue {
			foundReviewed = true
		}
		values = append(values, domain.FetchedIndicatorValue{
			IndicatorSlug: "unemployment-rate", Value: raw, Period: period,
			PublishedAt: publishedAt, FetchedAt: p.now().UTC(), SourceName: "総務省統計局",
			SourceURL: unemploymentSourceURL, ExternalID: unemploymentStatInfID + ":" + period,
			EstimateKind: "final",
		})
	}
	if len(values) == 0 || !foundReviewed {
		return nil, errors.New("reviewed official unemployment value not found")
	}
	sort.Slice(values, func(i, j int) bool { return values[i].Period < values[j].Period })
	return values, nil
}

func normalizeStatisticalNumber(value string) string {
	value = strings.TrimSpace(value)
	replacer := strings.NewReplacer("０", "0", "１", "1", "２", "2", "３", "3", "４", "4", "５", "5", "６", "6", "７", "7", "８", "8", "９", "9", "．", ".", "％", "", "%", "", ",", "")
	return replacer.Replace(value)
}
