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

func workbook(t *testing.T, title, value string) []byte {
	t.Helper()
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	shared := `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>` + title + `</t></si><si><t>総人口（確定値）</t></si><si><t>2025年</t></si><si><t>12月</t></si></sst>`
	sheet := `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="D1" t="s"><v>1</v></c></row><row><c r="A2" t="s"><v>2</v></c><c r="D2"><v>` + value + `</v></c></row><row><c r="A3" t="s"><v>3</v></c><c r="D3"><v>` + value + `</v></c></row></sheetData></worksheet>`
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

func TestEStatPopulationProviderFetch(t *testing.T) {
	data := workbook(t, "(参考表)全国人口の推移", "123165360")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("fileKind") != "4" || r.URL.Query().Get("statInfId") != "000040462410" {
			t.Errorf("query=%s", r.URL.RawQuery)
		}
		_, _ = w.Write(data)
	}))
	defer server.Close()
	p := NewEStatPopulationProvider(server.Client(), "", "")
	p.downloadBaseURL = server.URL
	p.now = func() time.Time { return time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC) }
	values, err := p.Fetch(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 1 || values[0].Value != "12316.536" || values[0].Period != "2025年12月" || values[0].EstimateKind != "final" {
		t.Fatalf("values=%#v", values)
	}
	if !strings.HasPrefix(values[0].SourceURL, "https://www.e-stat.go.jp/") {
		t.Fatalf("source=%q", values[0].SourceURL)
	}
}

func TestEStatPopulationProviderRejectsUnexpectedDefinition(t *testing.T) {
	data := workbook(t, "別の統計", "123165360")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(data) }))
	defer server.Close()
	p := NewEStatPopulationProvider(server.Client(), "", "")
	p.downloadBaseURL = server.URL
	if _, err := p.Fetch(context.Background()); err == nil || !strings.Contains(err.Error(), "definition") {
		t.Fatalf("err=%v", err)
	}
}

func TestEStatPopulationProviderRejectsInvalidValue(t *testing.T) {
	data := workbook(t, "全国人口の推移", "999")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(data) }))
	defer server.Close()
	p := NewEStatPopulationProvider(server.Client(), "", "")
	p.downloadBaseURL = server.URL
	if _, err := p.Fetch(context.Background()); err == nil || !strings.Contains(err.Error(), "invalid total population") {
		t.Fatalf("err=%v", err)
	}
}

func TestEStatPopulationProviderKeepsExistingDataOnHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { http.Error(w, "failed", http.StatusBadGateway) }))
	defer server.Close()
	p := NewEStatPopulationProvider(server.Client(), "", "")
	p.downloadBaseURL = server.URL
	if _, err := p.Fetch(context.Background()); err == nil {
		t.Fatal("expected error")
	}
}

func TestPersonsToTenThousands(t *testing.T) {
	for input, want := range map[string]string{"123165360": "12316.536", "123160000": "12316", "5": "0.0005"} {
		if got := personsToTenThousands(input); got != want {
			t.Errorf("%s: got %q want %q", input, got, want)
		}
	}
}
