package provider

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/kokusei/dashboard/backend/internal/domain"
)

const (
	defaultPopulationStatInfID   = "000040462410"
	defaultPopulationPublishedAt = "2026-06-19"
	maxWorkbookBytes             = 10 << 20
)

var (
	yearPattern  = regexp.MustCompile(`^(20[0-9]{2})年$`)
	monthPattern = regexp.MustCompile(`^([0-9]{1,2})月$`)
	integerValue = regexp.MustCompile(`^[0-9]+$`)
)

type HTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

type EStatPopulationProvider struct {
	client          HTTPClient
	statInfID       string
	publishedAt     time.Time
	downloadBaseURL string
	now             func() time.Time
}

func NewEStatPopulationProvider(client HTTPClient, statInfID, publishedAt string) *EStatPopulationProvider {
	if strings.TrimSpace(statInfID) == "" {
		statInfID = defaultPopulationStatInfID
	}
	if strings.TrimSpace(publishedAt) == "" {
		publishedAt = defaultPopulationPublishedAt
	}
	parsed, _ := time.Parse("2006-01-02", publishedAt)
	return &EStatPopulationProvider{
		client: client, statInfID: strings.TrimSpace(statInfID), publishedAt: parsed,
		downloadBaseURL: "https://www.e-stat.go.jp/stat-search/file-download", now: time.Now,
	}
}

func (p *EStatPopulationProvider) Fetch(ctx context.Context) ([]domain.FetchedIndicatorValue, error) {
	if p.client == nil {
		return nil, errors.New("HTTP client is required")
	}
	if !regexp.MustCompile(`^[0-9]{12}$`).MatchString(p.statInfID) {
		return nil, errors.New("invalid e-Stat statInfId")
	}
	if p.publishedAt.IsZero() || p.publishedAt.After(p.now().Add(24*time.Hour)) {
		return nil, errors.New("invalid publication date")
	}
	endpoint, err := url.Parse(p.downloadBaseURL)
	if err != nil {
		return nil, err
	}
	query := endpoint.Query()
	query.Set("fileKind", "4")
	query.Set("statInfId", p.statInfID)
	endpoint.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download population workbook: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download population workbook: status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxWorkbookBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read population workbook: %w", err)
	}
	if len(body) > maxWorkbookBytes {
		return nil, errors.New("population workbook is too large")
	}
	return p.parseWorkbook(body)
}

func (p *EStatPopulationProvider) parseWorkbook(data []byte) ([]domain.FetchedIndicatorValue, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, errors.New("population file is not a valid XLSX workbook")
	}
	sharedXML, err := readZipFile(zr, "xl/sharedStrings.xml")
	if err != nil {
		return nil, err
	}
	shared, err := parseSharedStrings(sharedXML)
	if err != nil {
		return nil, fmt.Errorf("parse shared strings: %w", err)
	}
	sheet, err := readZipFile(zr, "xl/worksheets/sheet1.xml")
	if err != nil {
		return nil, err
	}
	rows, err := parseRows(sheet, shared)
	if err != nil {
		return nil, fmt.Errorf("parse population worksheet: %w", err)
	}
	header := ""
	for _, row := range rows {
		for _, value := range row {
			header += strings.ReplaceAll(strings.ReplaceAll(value, " ", ""), "　", "")
		}
	}
	if !strings.Contains(header, "全国人口の推移") || !strings.Contains(header, "総人口") || !strings.Contains(header, "確定値") {
		return nil, errors.New("unexpected population worksheet definition")
	}
	sourceURL := "https://www.e-stat.go.jp/stat-search/files?layout=dataset&stat_infid=" + url.QueryEscape(p.statInfID) + "&toukei=00200524"
	currentYear := ""
	seen := map[string]bool{}
	values := make([]domain.FetchedIndicatorValue, 0, 24)
	for _, row := range rows {
		label := strings.TrimSpace(row["A"])
		if match := yearPattern.FindStringSubmatch(label); match != nil {
			currentYear = match[1]
		}
		match := monthPattern.FindStringSubmatch(label)
		if match == nil || currentYear == "" {
			continue
		}
		month, _ := strconv.Atoi(match[1])
		if month < 1 || month > 12 {
			return nil, fmt.Errorf("invalid month %q", label)
		}
		raw := strings.TrimSpace(row["D"])
		if !integerValue.MatchString(raw) {
			continue
		}
		people, err := strconv.ParseUint(raw, 10, 64)
		if err != nil || people < 50_000_000 || people > 200_000_000 {
			return nil, fmt.Errorf("invalid total population value for %s年%d月", currentYear, month)
		}
		period := fmt.Sprintf("%s年%d月", currentYear, month)
		if seen[period] {
			return nil, fmt.Errorf("duplicate period %s", period)
		}
		seen[period] = true
		values = append(values, domain.FetchedIndicatorValue{
			IndicatorSlug: "population", Value: personsToTenThousands(raw), Period: period,
			PublishedAt: p.publishedAt, FetchedAt: p.now().UTC(), SourceName: "総務省統計局",
			SourceURL: sourceURL, ExternalID: p.statInfID + ":" + period, EstimateKind: "final",
		})
	}
	if len(values) == 0 {
		return nil, errors.New("validated final total population values not found")
	}
	return values, nil
}

func personsToTenThousands(value string) string {
	if len(value) <= 4 {
		value = strings.Repeat("0", 5-len(value)) + value
	}
	whole, fraction := value[:len(value)-4], strings.TrimRight(value[len(value)-4:], "0")
	if fraction == "" {
		return whole
	}
	return whole + "." + fraction
}

func readZipFile(zr *zip.Reader, name string) ([]byte, error) {
	for _, file := range zr.File {
		if file.Name == name {
			r, err := file.Open()
			if err != nil {
				return nil, err
			}
			defer r.Close()
			return io.ReadAll(io.LimitReader(r, maxWorkbookBytes))
		}
	}
	return nil, fmt.Errorf("XLSX entry %s not found", name)
}

func parseSharedStrings(data []byte) ([]string, error) {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	result := []string{}
	var current strings.Builder
	inItem := false
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		switch v := token.(type) {
		case xml.StartElement:
			if v.Name.Local == "si" {
				inItem = true
				current.Reset()
			}
			if inItem && v.Name.Local == "t" {
				var text string
				if err := decoder.DecodeElement(&text, &v); err != nil {
					return nil, err
				}
				current.WriteString(text)
			}
		case xml.EndElement:
			if v.Name.Local == "si" {
				result = append(result, current.String())
				inItem = false
			}
		}
	}
	return result, nil
}

func parseRows(data []byte, shared []string) ([]map[string]string, error) {
	type cell struct {
		Ref    string `xml:"r,attr"`
		Type   string `xml:"t,attr"`
		Value  string `xml:"v"`
		Inline string `xml:"is>t"`
	}
	type row struct {
		Cells []cell `xml:"c"`
	}
	var worksheet struct {
		Rows []row `xml:"sheetData>row"`
	}
	if err := xml.Unmarshal(data, &worksheet); err != nil {
		return nil, err
	}
	result := make([]map[string]string, 0, len(worksheet.Rows))
	for _, source := range worksheet.Rows {
		target := map[string]string{}
		for _, c := range source.Cells {
			column := strings.TrimRight(c.Ref, "0123456789")
			value := c.Value
			if c.Type == "s" {
				index, err := strconv.Atoi(c.Value)
				if err != nil || index < 0 || index >= len(shared) {
					return nil, fmt.Errorf("invalid shared string index in %s", c.Ref)
				}
				value = shared[index]
			} else if c.Type == "inlineStr" {
				value = c.Inline
			}
			target[column] = value
		}
		result = append(result, target)
	}
	return result, nil
}
