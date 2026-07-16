#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  psql_target="$DATABASE_URL"
else
  for name in PGHOST PGDATABASE PGUSER PGPASSWORD; do
    eval "value=\${$name:-}"
    if [ -z "$value" ]; then
      echo "DATABASE_URL or $name is required" >&2
      exit 1
    fi
  done
  psql_target=""
fi

query() {
  if [ -n "$psql_target" ]; then
    psql "$psql_target" -v ON_ERROR_STOP=1 -Atc "$1"
  else
    psql -v ON_ERROR_STOP=1 -Atc "$1"
  fi
}

validate_indicator() {
  slug=$1
  case "$slug" in
    population)
      unit='万人'
      period_regex='^[0-9]{4}年[0-9]{1,2}月$'
      minimum='5000'
      maximum='20000'
      representative_period='2025年12月'
      representative_value='12316.536'
      ;;
    births)
      unit='万人'
      period_regex='^[0-9]{4}年$'
      minimum='0'
      maximum='200'
      representative_period='2024年'
      representative_value='68.6173'
      ;;
    unemployment-rate)
      unit='%'
      period_regex='^[0-9]{4}年$'
      minimum='0'
      maximum='100'
      representative_period='2025年'
      representative_value='2.5'
      ;;
    *) echo "unsupported validation target: $slug" >&2; exit 1 ;;
  esac

  count="$(query "SELECT COUNT(*) FROM indicator_values v JOIN indicators i ON i.id=v.indicator_id WHERE i.slug='$slug' AND v.data_origin='official'")"
  [ "$count" -gt 0 ] || { echo "official production data is missing for $slug" >&2; exit 1; }

  actual_unit="$(query "SELECT unit FROM indicators WHERE slug='$slug'")"
  [ "$actual_unit" = "$unit" ] || { echo "unexpected unit for $slug: $actual_unit" >&2; exit 1; }

  invalid="$(query "
    SELECT COUNT(*)
    FROM indicator_values v JOIN indicators i ON i.id=v.indicator_id
    WHERE i.slug='$slug' AND (
      v.data_origin <> 'official'
      OR v.estimate_kind <> 'final'
      OR v.period !~ '$period_regex'
      OR v.value < $minimum OR v.value > $maximum
      OR v.source_url !~ '^https://(www\\.)?e-stat\\.go\\.jp/'
      OR lower(v.source_url) ~ '(fixture|mock|sample|localhost|example\\.)'
      OR v.published_at IS NULL OR v.fetched_at IS NULL OR v.external_id IS NULL
    )")"
  [ "$invalid" -eq 0 ] || { echo "invalid official rows found for $slug: $invalid" >&2; exit 1; }

  duplicates="$(query "
    SELECT COUNT(*) FROM (
      SELECT v.period FROM indicator_values v JOIN indicators i ON i.id=v.indicator_id
      WHERE i.slug='$slug' GROUP BY v.period HAVING COUNT(*) > 1
    ) duplicate_periods")"
  [ "$duplicates" -eq 0 ] || { echo "duplicate periods found for $slug" >&2; exit 1; }

  representative="$(query "
    SELECT COUNT(*) FROM indicator_values v JOIN indicators i ON i.id=v.indicator_id
    WHERE i.slug='$slug' AND v.period='$representative_period'
      AND v.value=$representative_value::numeric AND v.data_origin='official'")"
  [ "$representative" -eq 1 ] || { echo "reviewed representative value does not match for $slug" >&2; exit 1; }

  query "
    SELECT i.slug || E'\t' || i.unit || E'\t' || v.period || E'\t' || v.value::text
    FROM indicators i
    JOIN LATERAL (
      SELECT period,value FROM indicator_values
      WHERE indicator_id=i.id AND data_origin='official'
      ORDER BY published_at DESC, period DESC, id DESC LIMIT 1
    ) v ON true WHERE i.slug='$slug'"
  echo "Production data validation succeeded: $slug ($count row(s))"
}

target=${1:-all}
case "$target" in
  population|births|unemployment-rate) validate_indicator "$target" ;;
  all)
    catalog_count="$(query 'SELECT COUNT(*) FROM indicators')"
    [ "$catalog_count" -ge 5 ] || { echo "indicator catalog has fewer than five rows" >&2; exit 1; }
    validate_indicator population
    validate_indicator births
    validate_indicator unemployment-rate
    expected="$(query "SELECT COUNT(*) FROM indicators WHERE slug IN ('population','births','unemployment-rate')")"
    [ "$expected" -eq 3 ] || { echo "required indicator slugs are missing" >&2; exit 1; }
    echo "Cross-indicator production validation succeeded"
    ;;
  *) echo "usage: kokusei-validate-production-data [population|births|unemployment-rate|all]" >&2; exit 1 ;;
esac
