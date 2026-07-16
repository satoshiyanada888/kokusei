#!/bin/sh
set -eu

workflow=.github/workflows/deploy-production.yml
stage2=scripts/production/run-stage2.sh

require() {
  pattern=$1
  file=$2
  grep -F "$pattern" "$file" >/dev/null || {
    echo "Missing production guard in $file: $pattern" >&2
    exit 1
  }
}

require "workflow_dispatch:" "$workflow"
require "name: production" "$workflow"
require "NEON_DATABASE_URL" "$workflow"
require "NEON_MIGRATION_DATABASE_URL" "$workflow"
require "FRONTEND_IDENTITY_ID" "$workflow"
require "BACKEND_IDENTITY_ID" "$workflow"
require "Required production setting is missing" "$workflow"
require "az acr manifest show-metadata" "$workflow"
require "Migrate Neon, import official data, and validate" "$workflow"
require "Create or update internal Backend" "$workflow"
require 'path: "/health"' "$workflow"
require 'external: false' "$workflow"
require "Backend health/API validation failed" "$workflow"
require "Create or update Frontend after Backend validation" "$workflow"
require 'external: true' "$workflow"
require 'ingress remains internal' "$workflow"
require "docker image inspect" "$stage2"
require "/import-births" "$stage2"
require "run_validation births" "$stage2"
require "/import-unemployment" "$stage2"
require "run_validation unemployment-rate" "$stage2"
require "/import-population" "$stage2"
require "run_validation population" "$stage2"
require "run_validation all" "$stage2"

if grep -E '(:latest|/latest)' "$workflow" "$stage2" >/dev/null; then
  echo "Production workflow must not use a latest image tag" >&2
  exit 1
fi

if grep -F 'docker push "$MIGRATION_IMAGE"' "$workflow" "$stage2" >/dev/null; then
  echo "Migration image must not be pushed to ACR" >&2
  exit 1
fi

manifest_line=$(grep -n -m1 'az acr manifest show-metadata' "$workflow" | cut -d: -f1)
stage2_line=$(grep -n -m1 'Migrate Neon, import official data, and validate' "$workflow" | cut -d: -f1)
backend_line=$(grep -n -m1 'Create or update internal Backend' "$workflow" | cut -d: -f1)
backend_verify_line=$(grep -n -m1 'Verify internal Backend health' "$workflow" | cut -d: -f1)
frontend_line=$(grep -n -m1 'Create or update Frontend after Backend validation' "$workflow" | cut -d: -f1)

[ "$manifest_line" -lt "$stage2_line" ] || { echo "ACR verification must precede database changes" >&2; exit 1; }
[ "$stage2_line" -lt "$backend_line" ] || { echo "Database validation must precede Backend deployment" >&2; exit 1; }
[ "$backend_line" -lt "$backend_verify_line" ] || { echo "Backend creation must precede health validation" >&2; exit 1; }
[ "$backend_verify_line" -lt "$frontend_line" ] || { echo "Backend validation must precede Frontend deployment" >&2; exit 1; }

echo "Production workflow guards are present"
