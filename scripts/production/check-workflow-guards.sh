#!/bin/sh
set -eu

workflow=.github/workflows/deploy-production.yml
stage2=scripts/production/run-stage2.sh
url_validator=scripts/production/validate-neon-urls.py
oidc_validator=scripts/production/verify-github-oidc-claims.py

require() {
  pattern=$1
  file=$2
  grep -F "$pattern" "$file" >/dev/null || {
    echo "Missing production guard in $file: $pattern" >&2
    exit 1
  }
}

require "workflow_dispatch:" "$workflow"
require "if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'" "$workflow"
require "name: production" "$workflow"
require "cancel-in-progress: false" "$workflow"
require "id-token: write" "$workflow"
require "AZURE_FEDERATED_SUBJECT" "$workflow"
require "NEON_DATABASE_URL" "$workflow"
require "NEON_MIGRATION_DATABASE_URL" "$workflow"
require "FRONTEND_IDENTITY_ID" "$workflow"
require "BACKEND_IDENTITY_ID" "$workflow"
require "Required production setting is missing" "$workflow"
require "scripts/production/validate-neon-urls.py" "$workflow"
require "Production target commit: \$GITHUB_SHA" "$workflow"
require "scripts/production/verify-github-oidc-claims.py" "$workflow"
require "Authenticate to Azure with verified OIDC" "$workflow"
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
require 'pooled=True' "$url_validator"
require 'pooled=False' "$url_validator"
require 'ALLOWED_SSL_MODES = {"require", "verify-ca", "verify-full"}' "$url_validator"

if grep -E '^  (push|pull_request|pull_request_target|workflow_call|schedule):' "$workflow" >/dev/null; then
  echo "Production workflow must only be triggered by workflow_dispatch" >&2
  exit 1
fi

if [ "$(grep -c 'id-token: write' "$workflow")" -ne 1 ]; then
  echo "Only the production deploy job may request an OIDC token" >&2
  exit 1
fi

if grep -F 'set -x' "$workflow" "$stage2" "$url_validator" "$oidc_validator" >/dev/null; then
  echo "Production scripts must not enable shell tracing" >&2
  exit 1
fi

if grep -E 'docker build .*\b(NEON_DATABASE_URL|NEON_MIGRATION_DATABASE_URL|ESTAT_APP_ID)\b' "$workflow" >/dev/null; then
  echo "Production secrets must not be passed as Docker build arguments" >&2
  exit 1
fi

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
deploy_line=$(grep -n -m1 '^  deploy:' "$workflow" | cut -d: -f1)
environment_line=$(grep -n -m1 '^    environment:' "$workflow" | cut -d: -f1)
first_secret_line=$(grep -n -m1 'secrets\.' "$workflow" | cut -d: -f1)

[ "$manifest_line" -lt "$stage2_line" ] || { echo "ACR verification must precede database changes" >&2; exit 1; }
[ "$stage2_line" -lt "$backend_line" ] || { echo "Database validation must precede Backend deployment" >&2; exit 1; }
[ "$backend_line" -lt "$backend_verify_line" ] || { echo "Backend creation must precede health validation" >&2; exit 1; }
[ "$backend_verify_line" -lt "$frontend_line" ] || { echo "Backend validation must precede Frontend deployment" >&2; exit 1; }
[ "$deploy_line" -lt "$environment_line" ] && [ "$environment_line" -lt "$first_secret_line" ] || {
  echo "Production secrets must only be referenced by the protected deploy job" >&2
  exit 1
}

valid_backend='postgresql://kokusei_backend:example@ep-example-pooler.ap-southeast-1.aws.neon.tech/kokusei?sslmode=require&channel_binding=require'
valid_migration='postgresql://kokusei_migration:example@ep-example.ap-southeast-1.aws.neon.tech/kokusei?sslmode=require&channel_binding=require'
NEON_DATABASE_URL="$valid_backend" NEON_MIGRATION_DATABASE_URL="$valid_migration" "$url_validator" >/dev/null

if NEON_DATABASE_URL="$valid_migration" NEON_MIGRATION_DATABASE_URL="$valid_backend" "$url_validator" >/dev/null 2>&1; then
  echo "Neon URL validator accepted reversed pooled/direct endpoints" >&2
  exit 1
fi

disabled_backend=$(printf '%s' "$valid_backend" | sed 's/sslmode=require/sslmode=disable/')
if NEON_DATABASE_URL="$disabled_backend" NEON_MIGRATION_DATABASE_URL="$valid_migration" "$url_validator" >/dev/null 2>&1; then
  echo "Neon URL validator accepted disabled TLS" >&2
  exit 1
fi

repository=satoshiyanada888/kokusei
commit=0123456789abcdef0123456789abcdef01234567
subject="repo:$repository:environment:production"
oidc_token=$(
  python3 -c 'import base64,json,sys; encode=lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("="); print(encode({"alg":"none"})+"."+encode(json.loads(sys.argv[1]))+".")' \
    "{\"iss\":\"https://token.actions.githubusercontent.com\",\"sub\":\"$subject\",\"repository\":\"$repository\",\"environment\":\"production\",\"ref\":\"refs/heads/main\",\"sha\":\"$commit\",\"event_name\":\"workflow_dispatch\",\"aud\":\"api://AzureADTokenExchange\",\"workflow_ref\":\"$repository/.github/workflows/deploy-production.yml@refs/heads/main\"}"
)
OIDC_TOKEN="$oidc_token" EXPECTED_OIDC_SUBJECT="$subject" GITHUB_REPOSITORY="$repository" GITHUB_SHA="$commit" "$oidc_validator" >/dev/null

if OIDC_TOKEN="$oidc_token" EXPECTED_OIDC_SUBJECT="repo:wrong/repository:environment:production" GITHUB_REPOSITORY="$repository" GITHUB_SHA="$commit" "$oidc_validator" >/dev/null 2>&1; then
  echo "OIDC claim validator accepted a mismatched federated subject" >&2
  exit 1
fi

echo "Production workflow guards are present"
