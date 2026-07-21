#!/usr/bin/env bash
set -euo pipefail

required=(NEON_DATABASE_URL NEON_MIGRATION_DATABASE_URL APP_DATABASE_USER ESTAT_APP_ID BACKEND_IMAGE MIGRATION_IMAGE GITHUB_SHA)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "Required Stage 2 setting is missing: $name" >&2; exit 1; }
done
[[ "$GITHUB_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "GITHUB_SHA must be a full commit SHA" >&2; exit 1; }
scripts/production/validate-neon-urls.py

docker image inspect "$MIGRATION_IMAGE" >/dev/null
docker image inspect "$BACKEND_IMAGE" >/dev/null

docker run --rm \
  --env DATABASE_URL="$NEON_MIGRATION_DATABASE_URL" \
  --env APP_DATABASE_USER="$APP_DATABASE_USER" \
  --env LOAD_PRODUCTION_CATALOG=true \
  "$MIGRATION_IMAGE"

run_import() {
  local command=$1
  shift
  docker run --rm \
    --env DATABASE_URL="$NEON_MIGRATION_DATABASE_URL" \
    --env IMPORTER_VERSION="$GITHUB_SHA" \
    "$@" \
    --entrypoint "$command" \
    "$BACKEND_IMAGE"
}

run_validation() {
  local target=$1
  docker run --rm \
    --env DATABASE_URL="$NEON_DATABASE_URL" \
    --entrypoint /usr/local/bin/kokusei-validate-production-data \
    "$MIGRATION_IMAGE" "$target"
}

run_import /import-births --env ESTAT_APP_ID
run_validation births

run_import /import-unemployment
run_validation unemployment-rate

run_import /import-population \
  --env ESTAT_POPULATION_STAT_INF_ID=000040462410 \
  --env ESTAT_POPULATION_PUBLISHED_AT=2026-06-19
run_validation population

run_validation all

echo "Neon migration, official imports, and cross-indicator validation succeeded"
