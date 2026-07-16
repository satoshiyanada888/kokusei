package provider

import (
	"archive/zip"
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func unemploymentWorkbook(t *testing.T, rate string) []byte {
	t.Helper()
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	shared := `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>長期時系列表２</t></si><si><t>全国</t></si><si><t>男女計</t></si><si><t>完全失業率（％）</t></si></sst>`
	sheet := `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="M1" t="s"><v>3</v></c></row><row><c r="B2"><v>2025</v></c><c r="M2"><v>` + rate + `</v></c></row></sheetData></worksheet>`
	for name, content := range map[string]string{"xl/sharedStrings.xml": shared, "xl/worksheets/sheet1.xml": sheet} {
		file, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func newUnemploymentTestProvider(t *testing.T, workbook []byte) *StatisticsUnemploymentProvider {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(workbook) }))
	t.Cleanup(server.Close)
	provider := NewStatisticsUnemploymentProvider(server.Client())
	provider.endpoint = server.URL
	provider.allowUnsafe = true
	provider.expectedSHA = ""
	provider.now = func() time.Time { return time.Date(2026, 7, 16, 0, 0, 0, 0, time.UTC) }
	return provider
}

func TestStatisticsUnemploymentProviderFetchesAnnualNationalRate(t *testing.T) {
	provider := newUnemploymentTestProvider(t, unemploymentWorkbook(t, "2.5"))
	values, err := provider.Fetch(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 1 || values[0].IndicatorSlug != "unemployment-rate" || values[0].Value != "2.5" || values[0].Period != "2025年" || values[0].EstimateKind != "final" {
		t.Fatalf("values=%#v", values)
	}
}

func TestStatisticsUnemploymentProviderRejectsMissingMarker(t *testing.T) {
	provider := newUnemploymentTestProvider(t, unemploymentWorkbook(t, "..."))
	if _, err := provider.Fetch(context.Background()); err == nil || !strings.Contains(err.Error(), "missing or invalid") {
		t.Fatalf("err=%v", err)
	}
}

func TestStatisticsUnemploymentProviderRejectsOutOfRangeRate(t *testing.T) {
	provider := newUnemploymentTestProvider(t, unemploymentWorkbook(t, "100.1"))
	if _, err := provider.Fetch(context.Background()); err == nil || !strings.Contains(err.Error(), "outside 0-100") {
		t.Fatalf("err=%v", err)
	}
}

func TestNormalizeStatisticalNumber(t *testing.T) {
	for input, want := range map[string]string{"２．５％": "2.5", "2,500": "2500", "...": "...", "-": "-", "NA": "NA", "": ""} {
		if got := normalizeStatisticalNumber(input); got != want {
			t.Errorf("%q: got %q want %q", input, got, want)
		}
	}
}
