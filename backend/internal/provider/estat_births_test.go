package provider

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func birthsResponse(value, unit, period string) string {
	return `{"GET_STATS_DATA":{"RESULT":{"STATUS":0},"STATISTICAL_DATA":{"TABLE_INF":{"@id":"0003411597","STAT_NAME":{"@code":"00450011","$":"人口動態調査"},"GOV_ORG":{"@code":"00450","$":"厚生労働省"},"STATISTICS_NAME":"人口動態調査 人口動態統計 確定数 出生","CYCLE":"年次","UPDATED_DATE":"2026-04-15"},"CLASS_INF":{"CLASS_OBJ":[{"@id":"tab","CLASS":{"@code":"10040","@name":"出生数","@unit":"人"}},{"@id":"area","CLASS":{"@code":"00000","@name":"全国"}}]},"DATA_INF":{"VALUE":[{"@tab":"10040","@area":"00000","@time":"` + period + `","@unit":"` + unit + `","$":"` + value + `"}]}}}}`
}

func newBirthsTestProvider(t *testing.T, body string) *EStatBirthsProvider {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("statsDataId") != birthsStatsDataID || r.URL.Query().Get("cdTab") != birthsTableCode || r.URL.Query().Get("cdArea") != birthsAreaCode {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)
	provider := NewEStatBirthsProvider(server.Client(), "test-app-id")
	provider.endpoint = server.URL
	provider.allowUnsafe = true
	provider.expectedSHA = ""
	provider.now = func() time.Time { return time.Date(2026, 7, 16, 0, 0, 0, 0, time.UTC) }
	return provider
}

func TestEStatBirthsProviderFetchesReviewedFinalNationalSeries(t *testing.T) {
	provider := newBirthsTestProvider(t, birthsResponse("686173", "人", "2024000000"))
	values, err := provider.Fetch(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 1 || values[0].IndicatorSlug != "births" || values[0].Value != "68.6173" || values[0].Period != "2024年" || values[0].EstimateKind != "final" {
		t.Fatalf("values=%#v", values)
	}
}

func TestEStatBirthsProviderRejectsMissingValue(t *testing.T) {
	provider := newBirthsTestProvider(t, birthsResponse("...", "人", "2024000000"))
	if _, err := provider.Fetch(context.Background()); err == nil || !strings.Contains(err.Error(), "missing or invalid") {
		t.Fatalf("err=%v", err)
	}
}

func TestEStatBirthsProviderRejectsWrongUnit(t *testing.T) {
	provider := newBirthsTestProvider(t, birthsResponse("686173", "万人", "2024000000"))
	if _, err := provider.Fetch(context.Background()); err == nil || !strings.Contains(err.Error(), "mixed births series or unit") {
		t.Fatalf("err=%v", err)
	}
}

func TestEStatBirthsProviderRejectsInvalidPeriod(t *testing.T) {
	provider := newBirthsTestProvider(t, birthsResponse("686173", "人", "2024"))
	if _, err := provider.Fetch(context.Background()); err == nil || !strings.Contains(err.Error(), "invalid births period") {
		t.Fatalf("err=%v", err)
	}
}

func TestEStatBirthsProviderRequiresApplicationID(t *testing.T) {
	provider := NewEStatBirthsProvider(http.DefaultClient, "")
	if _, err := provider.Fetch(context.Background()); err == nil || !strings.Contains(err.Error(), "application ID") {
		t.Fatalf("err=%v", err)
	}
}
