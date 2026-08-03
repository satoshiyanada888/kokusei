#!/bin/sh
# Literal shell fragments are intentionally single-quoted for exact guard matching.
# shellcheck disable=SC2016
set -eu

stage2_workflow=.github/workflows/prepare-production.yml
stage3_workflow=.github/workflows/deploy-production.yml
stage2=scripts/production/run-stage2.sh
url_validator=scripts/production/validate-neon-urls.py
oidc_validator=scripts/production/verify-github-oidc-claims.py
platform_verifier=scripts/production/verify-image-platform.sh
acr_login_server_validator=scripts/production/validate-acr-login-server.sh
stage2_evidence_validator=scripts/production/validate-stage2-evidence.py
container_app_state_validator=scripts/production/verify-container-app-state.py
snapshot_uploader=scripts/production/upload-blob-snapshot.sh
frontend_config=frontend/next.config.ts
frontend_middleware=frontend/middleware.ts

require() {
  pattern=$1
  file=$2
  grep -F -- "$pattern" "$file" >/dev/null || {
    echo "Missing production guard in $file: $pattern" >&2
    exit 1
  }
}

require_manual_only() {
  workflow=$1
  require "workflow_dispatch:" "$workflow"
  require "if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'" "$workflow"
  require "name: production" "$workflow"
  require "cancel-in-progress: false" "$workflow"

  if grep -E '^  (push|pull_request|pull_request_target|workflow_call|workflow_run|schedule):' "$workflow" >/dev/null; then
    echo "$workflow must only be triggered by workflow_dispatch" >&2
    exit 1
  fi
}

require_manual_only "$stage2_workflow"
require_manual_only "$stage3_workflow"

expected_commit_input=$(
  awk '
    /^      expected_commit_sha:$/ { capture = 1; next }
    capture && /^      [A-Za-z0-9_]+:$/ { exit }
    capture && !/^        / { exit }
    capture { print }
  ' "$stage2_workflow"
)
printf '%s\n' "$expected_commit_input" | grep -F "required: true" >/dev/null || {
  echo "Stage 2 expected_commit_sha input must be required" >&2
  exit 1
}
printf '%s\n' "$expected_commit_input" | grep -F "type: string" >/dev/null || {
  echo "Stage 2 expected_commit_sha input must be a string" >&2
  exit 1
}
if printf '%s\n' "$expected_commit_input" | grep -F "default:" >/dev/null; then
  echo "Stage 2 expected_commit_sha input must not define a default" >&2
  exit 1
fi

require "Validate reviewed commit SHA" "$stage2_workflow"
require 'EXPECTED_COMMIT_SHA: ${{ github.event.inputs.expected_commit_sha }}' "$stage2_workflow"
require 'ACTUAL_COMMIT_SHA: ${{ github.sha }}' "$stage2_workflow"
require '[[ "$EXPECTED_COMMIT_SHA" =~ ^[0-9a-fA-F]{40}$ ]]' "$stage2_workflow"
require 'if [ "$normalized_expected" != "$normalized_actual" ]; then' "$stage2_workflow"
require "Expected commit SHA does not match the dispatched workflow SHA." "$stage2_workflow"
require "needs: validate" "$stage2_workflow"

commit_validation_line=$(grep -n -m1 'Validate reviewed commit SHA' "$stage2_workflow" | cut -d: -f1)
protected_job_line=$(grep -n -m1 '^  prepare:$' "$stage2_workflow" | cut -d: -f1)
[ "$commit_validation_line" -lt "$protected_job_line" ] || {
  echo "Stage 2 commit validation must run before the protected prepare job" >&2
  exit 1
}

validate_commit_pair() {
  expected=$1
  actual=$2
  [ "${#expected}" -eq 40 ] || return 1
  case "$expected" in
    *[!0-9a-fA-F]*) return 1 ;;
  esac
  normalized_expected=$(printf '%s' "$expected" | tr '[:upper:]' '[:lower:]')
  normalized_actual=$(printf '%s' "$actual" | tr '[:upper:]' '[:lower:]')
  [ "$normalized_expected" = "$normalized_actual" ]
}

reviewed_sha=0123456789abcdef0123456789abcdef01234567
uppercase_sha=0123456789ABCDEF0123456789ABCDEF01234567
validate_commit_pair "$reviewed_sha" "$reviewed_sha" || {
  echo "Stage 2 commit validation rejected a matching SHA" >&2
  exit 1
}
validate_commit_pair "$uppercase_sha" "$reviewed_sha" || {
  echo "Stage 2 commit validation rejected a case-equivalent SHA" >&2
  exit 1
}
if validate_commit_pair "$reviewed_sha" 1123456789abcdef0123456789abcdef01234567; then
  echo "Stage 2 commit validation accepted a mismatched SHA" >&2
  exit 1
fi

invalid_with_newline=$(printf '%s\nx' "$reviewed_sha")
for invalid_sha in \
  "" \
  01234567 \
  0123456789abcdef0123456789abcdef0123456 \
  0123456789abcdef0123456789abcdef012345678 \
  0123456789abcdef0123456789abcdef0123456g \
  " $reviewed_sha" \
  "$reviewed_sha " \
  "$invalid_with_newline"
do
  if validate_commit_pair "$invalid_sha" "$reviewed_sha"; then
    echo "Stage 2 commit validation accepted an invalid SHA" >&2
    exit 1
  fi
done

require "GHSA-f88m-g3jw-g9cj" "$frontend_config"
require "unoptimized: true" "$frontend_config"
require "GHSA-f88m-g3jw-g9cj" "$frontend_middleware"
require "status: 404" "$frontend_middleware"
require 'matcher: "/_next/image"' "$frontend_middleware"

require "PREPARE" "$stage2_workflow"
require 'ACR_LOGIN_SERVER: ${{ vars.ACR_LOGIN_SERVER }}' "$stage2_workflow"
require 'PRODUCTION_SNAPSHOT_UPLOAD: ${{ vars.PRODUCTION_SNAPSHOT_UPLOAD || '\''false'\'' }}' "$stage2_workflow"
require "Generate and validate the official JSON snapshot" "$stage2_workflow"
require "Upload and read back the immutable Blob snapshot" "$stage2_workflow"
require "scripts/production/upload-blob-snapshot.sh" "$stage2_workflow"
require "/export-snapshot" "$stage2_workflow"
require "--commit-sha \"\$GITHUB_SHA\"" "$stage2_workflow"
require "AZURE_CONTAINER_REGISTRY ACR_LOGIN_SERVER" "$stage2_workflow"
require 'az acr login --name "$AZURE_CONTAINER_REGISTRY"' "$stage2_workflow"
require 'registry="$(scripts/production/validate-acr-login-server.sh)"' "$stage2_workflow"
require "Build linux/amd64 application and migration images" "$stage2_workflow"
require "docker buildx build --platform linux/amd64 --load" "$stage2_workflow"
require "Refuse to overwrite an existing commit SHA tag" "$stage2_workflow"
require "Refusing to overwrite existing ACR tag" "$stage2_workflow"
require 'frontend_image="$registry/frontend:$GITHUB_SHA"' "$stage2_workflow"
require 'backend_image="$registry/backend:$GITHUB_SHA"' "$stage2_workflow"
require 'docker push "$frontend_image"' "$stage2_workflow"
require 'docker push "$backend_image"' "$stage2_workflow"
require "az acr manifest show-metadata" "$stage2_workflow"
require "scripts/production/verify-image-platform.sh" "$stage2_workflow"
require "Frontend manifest must be linux/amd64" "$stage2_workflow"
require "Backend manifest must be linux/amd64" "$stage2_workflow"
require "Migrate Neon, import official data, and validate" "$stage2_workflow"
require "scripts/production/run-stage2.sh" "$stage2_workflow"
require "actions/upload-artifact@v4" "$stage2_workflow"
require "production-stage2-\${{ github.sha }}" "$stage2_workflow"
require "Stage 3 was not started" "$stage2_workflow"
require "EXPECTED_WORKFLOW_PATH: .github/workflows/prepare-production.yml" "$stage2_workflow"

if grep -F "az acr show" "$stage2_workflow" "$stage3_workflow" >/dev/null; then
  echo "Production workflows must not require ACR management-plane read access" >&2
  exit 1
fi

if grep -E '\baz containerapp (create|update|revision|ingress|job|secret|update|delete)\b' "$stage2_workflow" >/dev/null; then
  echo "Stage 2 must not create or update Container Apps, jobs, revisions, traffic, or secrets" >&2
  exit 1
fi

if grep -E '(workflow_run|gh workflow run|actions/github-script.*workflow)' "$stage2_workflow" >/dev/null; then
  echo "Stage 2 must not start Stage 3 automatically" >&2
  exit 1
fi

require "commit_sha:" "$stage3_workflow"
require "frontend_image_digest:" "$stage3_workflow"
require "backend_image_digest:" "$stage3_workflow"
require "actions: read" "$stage3_workflow"
stage2_run_input=$(
  awk '
    /^      stage2_run_id:$/ { capture = 1; next }
    capture && /^      [A-Za-z0-9_]+:$/ { exit }
    capture && !/^        / { exit }
    capture { print }
  ' "$stage3_workflow"
)
printf '%s\n' "$stage2_run_input" | grep -F "required: true" >/dev/null || {
  echo "Stage 3 stage2_run_id input must be required" >&2
  exit 1
}
printf '%s\n' "$stage2_run_input" | grep -F "type: string" >/dev/null || {
  echo "Stage 3 stage2_run_id input must be a string" >&2
  exit 1
}
if printf '%s\n' "$stage2_run_input" | grep -F "default:" >/dev/null; then
  echo "Stage 3 stage2_run_id input must not define a default" >&2
  exit 1
fi

require '[[ "$STAGE2_RUN_ID" =~ ^[1-9][0-9]*$ ]]' "$stage3_workflow"
require 'ACTUAL_COMMIT_SHA: ${{ github.sha }}' "$stage3_workflow"
require '[ "$TARGET_COMMIT" = "$ACTUAL_COMMIT_SHA" ]' "$stage3_workflow"
require "Bind Stage 3 inputs to the exact successful Stage 2 artifact" "$stage3_workflow"
require 'repos/$GITHUB_REPOSITORY/actions/runs/$STAGE2_RUN_ID' "$stage3_workflow"
require 'repos/$GITHUB_REPOSITORY/actions/runs/$STAGE2_RUN_ID/artifacts?per_page=100' "$stage3_workflow"
require 'repos/$GITHUB_REPOSITORY/actions/artifacts/$artifact_id/zip' "$stage3_workflow"
require "select-artifact" "$stage3_workflow"
require "validate-metadata" "$stage3_workflow"
require "production-stage2-metadata.json" "$stage3_workflow"
require "PUBLISH" "$stage3_workflow"
require 'ACR_LOGIN_SERVER: ${{ vars.ACR_LOGIN_SERVER }}' "$stage3_workflow"
require "AZURE_CONTAINER_REGISTRY ACR_LOGIN_SERVER" "$stage3_workflow"
require 'az acr login --name "$AZURE_CONTAINER_REGISTRY"' "$stage3_workflow"
require 'registry="$(scripts/production/validate-acr-login-server.sh)"' "$stage3_workflow"
require 'FRONTEND_IMAGE=$registry/frontend@$FRONTEND_DIGEST' "$stage3_workflow"
require 'BACKEND_IMAGE=$registry/backend@$BACKEND_DIGEST' "$stage3_workflow"
require 'NEXT_PUBLIC_SITE_URL: ${{ vars.NEXT_PUBLIC_SITE_URL }}' "$stage3_workflow"
require "digest is not tagged with the requested commit SHA" "$stage3_workflow"
require "scripts/production/verify-image-platform.sh" "$stage3_workflow"
require "Create or update internal Backend" "$stage3_workflow"
require 'external: false' "$stage3_workflow"
require 'PRODUCTION_DATA_STORE: ${{ vars.PRODUCTION_DATA_STORE || '\''postgres'\'' }}' "$stage3_workflow"
require 'case "$PRODUCTION_DATA_STORE" in' "$stage3_workflow"
require '{name: "DATA_STORE", value: $data_store}' "$stage3_workflow"
require '{name: "AZURE_STORAGE_ACCOUNT_NAME", value: $storage_account}' "$stage3_workflow"
require '{name: "AZURE_STORAGE_CONTAINER_NAME", value: $storage_container}' "$stage3_workflow"
require '{name: "AZURE_STORAGE_CURRENT_BLOB", value: $current_blob}' "$stage3_workflow"
require '{name: "AZURE_CLIENT_ID", value: $backend_client_id}' "$stage3_workflow"
require 'EXPECTED_DATA_STORE="$PRODUCTION_DATA_STORE"' "$stage3_workflow"
require 'EXPECTED_BACKEND_CLIENT_ID="$BACKEND_IDENTITY_CLIENT_ID"' "$stage3_workflow"
require "Create or update Frontend after Backend validation" "$stage3_workflow"
require 'external: true' "$stage3_workflow"
require 'path: "/health", port: 8080' "$stage3_workflow"
require 'path: "/health", port: 3000' "$stage3_workflow"
require "/health is intentionally process-only" "$stage3_workflow"
require "trap cleanup EXIT HUP INT TERM" "$stage3_workflow"
require "chmod 0600" "$stage3_workflow"
require "Verify Frontend health" "$stage3_workflow"
require "Run public smoke tests" "$stage3_workflow"
require "Write Stage 3 deployment summary" "$stage3_workflow"
require '--build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL"' "$stage2_workflow"
require 'site_url="${NEXT_PUBLIC_SITE_URL%/}"' "$stage3_workflow"
require '--arg site_url "$site_url"' "$stage3_workflow"
require '{name: "INTERNAL_API_URL", value: $backend_url}' "$stage3_workflow"
require '{name: "NEXT_PUBLIC_SITE_URL", value: $site_url}' "$stage3_workflow"
require 'Frontend INTERNAL_API_URL read-back does not match' "$stage3_workflow"
require 'Frontend NEXT_PUBLIC_SITE_URL read-back does not match the production HTTPS URL' "$stage3_workflow"
require 'normalize_public_url() {' "$stage3_workflow"
require 'printf '\''%s'\'' "${value%/}"' "$stage3_workflow"
require 'canonical_url="${BASH_REMATCH[1]}"' "$stage3_workflow"
require 'og_url="${BASH_REMATCH[1]}"' "$stage3_workflow"
require 'actual_normalized="$(normalize_public_url "$actual")"' "$stage3_workflow"
require 'if [ "$actual_normalized" != "$expected_normalized" ]; then' "$stage3_workflow"
require 'assert_public_url "canonical" "$canonical_url"' "$stage3_workflow"
require 'assert_public_url "og:url" "$og_url"' "$stage3_workflow"
require 'property=\"og:image\" content=\"$site/og-image.png\"' "$stage3_workflow"
require 'name=\"twitter:image\" content=\"$site/og-image.png\"' "$stage3_workflow"
require 'printf '\''%s'\'' "$sitemap" | grep -F "$site/"' "$stage3_workflow"
require 'printf '\''%s'\'' "$robots" | grep -F "$site/sitemap.xml"' "$stage3_workflow"
require "Public SEO metadata must not reference localhost" "$stage3_workflow"
require "Indicator API payload is empty" "$stage3_workflow"
require '"population", "births", "unemployment-rate"' "$stage3_workflow"
if grep -F '<link rel=\"canonical\" href=\"$site/\"' "$stage3_workflow" >/dev/null ||
  grep -F 'property=\"og:url\" content=\"$site/\"' "$stage3_workflow" >/dev/null; then
  echo "Stage 3 public URL checks must not require a trailing slash with fixed grep" >&2
  exit 1
fi

normalize_public_url() {
  value=$1
  [ -n "$value" ] || return 1
  printf '%s' "${value%/}"
}

public_urls_match() {
  expected_normalized=$(normalize_public_url "$1") || return 1
  actual_normalized=$(normalize_public_url "$2") || return 1
  [ "$expected_normalized" = "$actual_normalized" ]
}

require_url_match() {
  public_urls_match "$1" "$2" || {
    echo "Expected public URLs to match after trailing-slash normalization: $1 $2" >&2
    exit 1
  }
}

require_url_mismatch() {
  if public_urls_match "https://example.com" "$1"; then
    echo "Expected public URL mismatch: $1" >&2
    exit 1
  fi
}

require_url_match "https://example.com" "https://example.com"
require_url_match "https://example.com" "https://example.com/"
require_url_match "https://example.com/" "https://example.com"
require_url_match "https://example.com/" "https://example.com/"
require_url_mismatch "http://example.com"
require_url_mismatch "https://localhost:3000"
require_url_mismatch "https://example.org"
require_url_mismatch "https://example.com/path"
require_url_mismatch ""
require_url_mismatch "https://example.com/?x=1"

public_smoke_step=$(
  awk '
    /^      - name: Run public smoke tests$/ { capture = 1 }
    capture && /^      - name: / && !/Run public smoke tests/ { exit }
    capture { print }
  ' "$stage3_workflow"
)
if printf '%s\n' "$public_smoke_step" | grep -F '|| true' >/dev/null; then
  echo "Stage 3 public smoke tests must not ignore failures" >&2
  exit 1
fi
if grep -F -- '--input-type=module' "$stage3_workflow" >/dev/null; then
  echo "Stage 3 Smoke Job must not pass --input-type=module through Azure CLI" >&2
  exit 1
fi
if grep -F -- '--args=-e "$validation_code"' "$stage3_workflow" >/dev/null; then
  echo "Stage 3 Smoke Job must not leave validation_code as a separate Azure CLI argument" >&2
  exit 1
fi
if [ "$(grep -F -c -- '--args="--eval=$validation_code"' "$stage3_workflow")" -ne 2 ]; then
  echo "Stage 3 Smoke Job create and update must pass Node code as one --eval argument" >&2
  exit 1
fi
frontend_deployment_step=$(
  awk '
    /^      - name: Create or update Frontend after Backend validation$/ { capture = 1 }
    capture && /^      - name: / && !/Create or update Frontend after Backend validation/ { exit }
    capture { print }
  ' "$stage3_workflow"
)
if [ "$(printf '%s\n' "$frontend_deployment_step" | grep -F -c -- '{name: "NEXT_PUBLIC_SITE_URL", value: $site_url}')" -ne 1 ]; then
  echo "Stage 3 Frontend shared create/update specification must set one runtime NEXT_PUBLIC_SITE_URL" >&2
  exit 1
fi
printf '%s\n' "$frontend_deployment_step" | grep -F 'az containerapp create -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_CONTAINER_APP_FRONTEND"' >/dev/null || {
  echo "Stage 3 Frontend create must use the shared runtime specification" >&2
  exit 1
}
printf '%s\n' "$frontend_deployment_step" | grep -F -- '--yaml "$internal_specification"' >/dev/null || {
  echo "Stage 3 Frontend internal create must retain the runtime environment" >&2
  exit 1
}
if [ "$(printf '%s\n' "$frontend_deployment_step" | grep -F -c -- '--yaml "$specification"')" -ne 2 ]; then
  echo "Stage 3 Frontend existing-app update and post-create update must use the shared runtime specification" >&2
  exit 1
fi
if grep -F 'http://localhost:3000' "$stage3_workflow" >/dev/null; then
  echo "Stage 3 must not hard-code the local site URL" >&2
  exit 1
fi
validation_code=$(cat <<'JAVASCRIPT'
const sample = {
  text: "spaces, \"double quotes\", and 'single quotes'",
  url: "https://example.invalid/path?q=(value);",
  json: '{"ok":true}'
};
JAVASCRIPT
)
set -- "--eval=$validation_code"
if [ "$#" -ne 1 ] || [ "$1" != "--eval=$validation_code" ]; then
  echo "Stage 3 Smoke Job validation_code must remain one shell argv element" >&2
  exit 1
fi
require "az containerapp revision show" "$stage3_workflow"
require 'EXPECTED_IMAGE="$BACKEND_IMAGE"' "$stage3_workflow"
require 'EXPECTED_IMAGE="$FRONTEND_IMAGE"' "$stage3_workflow"
require "CONTAINER_APP_KIND=backend" "$stage3_workflow"
require "CONTAINER_APP_KIND=frontend" "$stage3_workflow"
require 'external: false' "$stage3_workflow"
require 'external: true' "$stage3_workflow"
require 'az containerapp ingress traffic set' "$stage3_workflow"
require '--revision-weight "$backend_revision=100"' "$stage3_workflow"
require '--revision-weight "$frontend_revision=100"' "$stage3_workflow"
require "Report remaining production state without mutation" "$stage3_workflow"
require "Automatic deletion: disabled" "$stage3_workflow"
require "Automatic rollback: disabled" "$stage3_workflow"
require "If Frontend external ingress is true" "$stage3_workflow"
require "EXPECTED_WORKFLOW_PATH: .github/workflows/deploy-production.yml" "$stage3_workflow"
require '"traffic total"' "$container_app_state_validator"
require '"target revision traffic"' "$container_app_state_validator"
require '"no old revision traffic"' "$container_app_state_validator"

evidence_line=$(grep -n -m1 'Bind Stage 3 inputs to the exact successful Stage 2 artifact' "$stage3_workflow" | cut -d: -f1)
publish_line=$(grep -n -m1 '^  publish:$' "$stage3_workflow" | cut -d: -f1)
azure_login_line=$(grep -n -m1 'Authenticate to Azure with verified OIDC' "$stage3_workflow" | cut -d: -f1)
[ "$evidence_line" -lt "$publish_line" ] || {
  echo "Stage 2 evidence validation must finish before the protected Stage 3 job" >&2
  exit 1
}
[ "$evidence_line" -lt "$azure_login_line" ] || {
  echo "Stage 2 evidence validation must finish before Azure login" >&2
  exit 1
}

for workflow in "$stage2_workflow" "$stage3_workflow"; do
  login_server_validation_line=$(grep -n -m1 'validate-acr-login-server.sh >/dev/null' "$workflow" | cut -d: -f1)
  oidc_validation_line=$(grep -n -m1 'Verify GitHub OIDC claims' "$workflow" | cut -d: -f1)
  azure_login_line=$(grep -n -m1 'Authenticate to Azure with verified OIDC' "$workflow" | cut -d: -f1)
  [ "$login_server_validation_line" -lt "$oidc_validation_line" ] || {
    echo "ACR login server validation must precede OIDC access in $workflow" >&2
    exit 1
  }
  [ "$login_server_validation_line" -lt "$azure_login_line" ] || {
    echo "ACR login server validation must precede Azure login in $workflow" >&2
    exit 1
  }
done

if grep -E '(^|[[:space:]])docker (build|push)([[:space:]]|$)|docker buildx build' "$stage3_workflow" >/dev/null; then
  echo "Stage 3 must not build or push Docker images" >&2
  exit 1
fi

if grep -E 'az containerapp (delete|revision deactivate)|gh run (rerun|run)' "$stage3_workflow" >/dev/null; then
  echo "Stage 3 must not automatically delete, roll back, rerun, or dispatch" >&2
  exit 1
fi

if grep -F "scripts/production/run-stage2.sh" "$stage3_workflow" >/dev/null; then
  echo "Stage 3 must not run Migration or official data import" >&2
  exit 1
fi

if grep -E 'NEON_MIGRATION_DATABASE_URL|ESTAT_APP_ID' "$stage3_workflow" >/dev/null; then
  echo "Stage 3 must not read Migration or importer secrets" >&2
  exit 1
fi

for workflow in "$stage2_workflow" "$stage3_workflow"; do
  if [ "$(grep -c 'id-token: write' "$workflow")" -ne 1 ]; then
    echo "Only one protected job in $workflow may request an OIDC token" >&2
    exit 1
  fi
done

if grep -F 'set -x' "$stage2_workflow" "$stage3_workflow" "$stage2" "$url_validator" "$oidc_validator" "$platform_verifier" "$acr_login_server_validator" >/dev/null; then
  echo "Production workflows and scripts must not enable shell tracing" >&2
  exit 1
fi

python3 "$stage2_evidence_validator" self-test >/dev/null
python3 "$container_app_state_validator" --self-test >/dev/null

require '--auth-mode login' "$snapshot_uploader"
require 'snapshots/$GITHUB_SHA/dataset.json' "$snapshot_uploader"
require 'Refusing to overwrite a different snapshot for the same commit SHA' "$snapshot_uploader"
require 'Uploaded snapshot SHA-256 read-back mismatch' "$snapshot_uploader"
require 'current.json is updated only after dataset upload and read-back validation succeed' "$snapshot_uploader"
require 'SNAPSHOT_READ_BACK_SUCCEEDED=true' "$snapshot_uploader"
if grep -E -- '--account-key|--sas-token|connection-string|AZURE_STORAGE_CONNECTION_STRING' "$stage2_workflow" "$stage3_workflow" "$snapshot_uploader" >/dev/null; then
  echo "Blob snapshot workflows must not use a Storage Account key, SAS, or connection string" >&2
  exit 1
fi
if grep -E 'https://[^ ]*[.]blob[.]core[.]windows[.]net' "$stage2_workflow" "$stage3_workflow" >/dev/null; then
  echo "Frontend and workflow metadata must not expose direct Blob URLs" >&2
  exit 1
fi

require "docker buildx imagetools inspect" "$platform_verifier"
require "only linux/amd64 runtime platforms" "$platform_verifier"

valid_acr_name=kokuseiprodacrd7btgb
valid_acr_login_server=kokuseiprodacrd7btgb.azurecr.io
validated_acr_login_server=$(
  AZURE_CONTAINER_REGISTRY="$valid_acr_name" \
    ACR_LOGIN_SERVER="$valid_acr_login_server" \
    "$acr_login_server_validator"
)
[ "$validated_acr_login_server" = "$valid_acr_login_server" ] || {
  echo "ACR login server validator did not return the verified hostname" >&2
  exit 1
}

invalid_acr_login_server_with_newline=$(printf '%s\nx' "$valid_acr_login_server")
for invalid_acr_login_server in \
  "" \
  otherregistry.azurecr.io \
  kokuseiprodacrd7btgb \
  "https://$valid_acr_login_server" \
  "$valid_acr_login_server/frontend" \
  " $valid_acr_login_server" \
  "$valid_acr_login_server " \
  "$invalid_acr_login_server_with_newline" \
  KOKUSEIPRODACRD7BTGB.azurecr.io \
  '*.azurecr.io' \
  '$(hostname).azurecr.io'
do
  if AZURE_CONTAINER_REGISTRY="$valid_acr_name" \
    ACR_LOGIN_SERVER="$invalid_acr_login_server" \
    "$acr_login_server_validator" >/dev/null 2>&1; then
    echo "ACR login server validator accepted an invalid hostname" >&2
    exit 1
  fi
done

if AZURE_CONTAINER_REGISTRY=otherregistry \
  ACR_LOGIN_SERVER="$valid_acr_login_server" \
  "$acr_login_server_validator" >/dev/null 2>&1; then
  echo "ACR login server validator accepted a hostname for another registry" >&2
  exit 1
fi

if grep -E 'docker (build|buildx build) .*\b(NEON_DATABASE_URL|NEON_MIGRATION_DATABASE_URL|ESTAT_APP_ID)\b' "$stage2_workflow" >/dev/null; then
  echo "Production secrets must not be passed as Docker build arguments" >&2
  exit 1
fi

if grep -E '(:latest|/latest)' "$stage2_workflow" "$stage3_workflow" "$stage2" >/dev/null; then
  echo "Production workflows must not use a latest image tag" >&2
  exit 1
fi

if grep -F 'docker push "$MIGRATION_IMAGE"' "$stage2_workflow" "$stage2" >/dev/null; then
  echo "Migration image must not be pushed to ACR" >&2
  exit 1
fi

if grep -E '(echo|printf).*(NEON_DATABASE_URL|NEON_MIGRATION_DATABASE_URL|DATABASE_URL)' "$stage2_workflow" "$stage3_workflow" "$stage2" >/dev/null; then
  echo "Production secrets must not be written to logs or summaries" >&2
  exit 1
fi

if grep -F -- '--env DATABASE_URL=' "$stage2_workflow" "$stage3_workflow" "$stage2" >/dev/null; then
  echo "Database URLs must not be placed in Docker command arguments" >&2
  exit 1
fi

manifest_line=$(grep -n -m1 'Resolve digests and verify linux/amd64 manifests' "$stage2_workflow" | cut -d: -f1)
database_line=$(grep -n -m1 'Migrate Neon, import official data, and validate' "$stage2_workflow" | cut -d: -f1)
snapshot_generate_line=$(grep -n -m1 'Generate and validate the official JSON snapshot' "$stage2_workflow" | cut -d: -f1)
snapshot_upload_line=$(grep -n -m1 'Upload and read back the immutable Blob snapshot' "$stage2_workflow" | cut -d: -f1)
metadata_line=$(grep -n -m1 'Write safe Stage 2 metadata' "$stage2_workflow" | cut -d: -f1)
[ "$manifest_line" -lt "$database_line" ] || { echo "Manifest validation must precede database changes" >&2; exit 1; }
[ "$database_line" -lt "$snapshot_generate_line" ] || { echo "Neon validation must precede snapshot generation in Phase 1" >&2; exit 1; }
[ "$snapshot_generate_line" -lt "$snapshot_upload_line" ] || { echo "Snapshot validation must precede Blob upload" >&2; exit 1; }
[ "$snapshot_upload_line" -lt "$metadata_line" ] || { echo "Blob read-back must precede Stage 2 metadata" >&2; exit 1; }
[ "$database_line" -lt "$metadata_line" ] || { echo "Successful database validation must precede Stage 2 metadata" >&2; exit 1; }

backend_line=$(grep -n -m1 'Create or update internal Backend' "$stage3_workflow" | cut -d: -f1)
backend_traffic_line=$(grep -n -m1 -- '--revision-weight "$backend_revision=100"' "$stage3_workflow" | cut -d: -f1)
backend_readback_line=$(grep -n -m1 'CONTAINER_APP_KIND=backend' "$stage3_workflow" | cut -d: -f1)
backend_verify_line=$(grep -n -m1 'Verify internal Backend health' "$stage3_workflow" | cut -d: -f1)
frontend_line=$(grep -n -m1 'Create or update Frontend after Backend validation' "$stage3_workflow" | cut -d: -f1)
frontend_traffic_line=$(grep -n -m1 -- '--revision-weight "$frontend_revision=100"' "$stage3_workflow" | cut -d: -f1)
frontend_readback_line=$(grep -n -m1 'CONTAINER_APP_KIND=frontend' "$stage3_workflow" | cut -d: -f1)
frontend_health_line=$(grep -n -m1 'Verify Frontend health' "$stage3_workflow" | cut -d: -f1)
smoke_line=$(grep -n -m1 'Run public smoke tests' "$stage3_workflow" | cut -d: -f1)
[ "$backend_line" -lt "$backend_traffic_line" ] || { echo "Backend deployment must precede Traffic assignment" >&2; exit 1; }
[ "$backend_traffic_line" -lt "$backend_readback_line" ] || { echo "Backend Traffic assignment must precede read-back" >&2; exit 1; }
[ "$backend_readback_line" -lt "$backend_verify_line" ] || { echo "Backend read-back must precede internal health validation" >&2; exit 1; }
[ "$backend_line" -lt "$backend_verify_line" ] || { echo "Backend deployment must precede internal health validation" >&2; exit 1; }
[ "$backend_verify_line" -lt "$frontend_line" ] || { echo "Backend validation must precede Frontend deployment" >&2; exit 1; }
[ "$frontend_line" -lt "$frontend_traffic_line" ] || { echo "Frontend deployment must precede Traffic assignment" >&2; exit 1; }
[ "$frontend_traffic_line" -lt "$frontend_readback_line" ] || { echo "Frontend Traffic assignment must precede read-back" >&2; exit 1; }
[ "$frontend_readback_line" -lt "$frontend_health_line" ] || { echo "Frontend read-back must precede Frontend health validation" >&2; exit 1; }
[ "$frontend_line" -lt "$frontend_health_line" ] || { echo "Frontend deployment must precede Frontend health validation" >&2; exit 1; }
[ "$frontend_health_line" -lt "$smoke_line" ] || { echo "Frontend health must precede public smoke tests" >&2; exit 1; }

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
require 'NEON_URL_VALIDATION_MODE' "$url_validator"

valid_backend='postgresql://kokusei_backend:example@ep-example-pooler.ap-southeast-1.aws.neon.tech/kokusei?sslmode=require&channel_binding=require'
valid_migration='postgresql://kokusei_migration:example@ep-example.ap-southeast-1.aws.neon.tech/kokusei?sslmode=require&channel_binding=require'
NEON_DATABASE_URL="$valid_backend" NEON_MIGRATION_DATABASE_URL="$valid_migration" "$url_validator" >/dev/null
NEON_DATABASE_URL="$valid_backend" NEON_URL_VALIDATION_MODE=backend "$url_validator" >/dev/null

if NEON_DATABASE_URL="$valid_migration" NEON_MIGRATION_DATABASE_URL="$valid_backend" "$url_validator" >/dev/null 2>&1; then
  echo "Neon URL validator accepted reversed pooled/direct endpoints" >&2
  exit 1
fi

disabled_backend=$(printf '%s' "$valid_backend" | sed 's/sslmode=require/sslmode=disable/')
if NEON_DATABASE_URL="$disabled_backend" NEON_URL_VALIDATION_MODE=backend "$url_validator" >/dev/null 2>&1; then
  echo "Neon URL validator accepted disabled TLS" >&2
  exit 1
fi

repository=satoshiyanada888/kokusei
repository_owner=satoshiyanada888
repository_name=kokusei
repository_owner_id=16567805
repository_id=1301151718
commit=0123456789abcdef0123456789abcdef01234567
subject="repo:$repository_owner@$repository_owner_id/$repository_name@$repository_id:environment:production"

verify_oidc_workflow() {
  workflow_path=$1
  oidc_token=$(
    python3 -c 'import base64,json,sys; encode=lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("="); print(encode({"alg":"none"})+"."+encode(json.loads(sys.argv[1]))+".")' \
      "{\"iss\":\"https://token.actions.githubusercontent.com\",\"sub\":\"$subject\",\"repository\":\"$repository\",\"environment\":\"production\",\"ref\":\"refs/heads/main\",\"sha\":\"$commit\",\"event_name\":\"workflow_dispatch\",\"aud\":\"api://AzureADTokenExchange\",\"workflow_ref\":\"$repository/$workflow_path@refs/heads/main\"}"
  )
  OIDC_TOKEN="$oidc_token" EXPECTED_OIDC_SUBJECT="$subject" EXPECTED_WORKFLOW_PATH="$workflow_path" GITHUB_REPOSITORY="$repository" GITHUB_SHA="$commit" "$oidc_validator" >/dev/null
}

verify_oidc_workflow .github/workflows/prepare-production.yml
verify_oidc_workflow .github/workflows/deploy-production.yml

reject_oidc_subject() {
  rejected_subject=$1
  description=$2
  if OIDC_TOKEN="$oidc_token" EXPECTED_OIDC_SUBJECT="$rejected_subject" EXPECTED_WORKFLOW_PATH=.github/workflows/deploy-production.yml GITHUB_REPOSITORY="$repository" GITHUB_SHA="$commit" "$oidc_validator" >/dev/null 2>&1; then
    echo "OIDC claim validator accepted $description" >&2
    exit 1
  fi
}

reject_oidc_subject "repo:$repository:environment:production" "the legacy production subject"
reject_oidc_subject "repo:$repository_owner/$repository_name@$repository_id:environment:production" "a subject without the owner ID"
reject_oidc_subject "repo:$repository_owner@$repository_owner_id/$repository_name:environment:production" "a subject without the repository ID"
reject_oidc_subject "repo:$repository_owner@$repository_owner_id/$repository_name@$repository_id:environment:*" "a wildcard environment subject"
reject_oidc_subject "repo:$repository_owner@$repository_owner_id/$repository_name@$repository_id:environment:staging" "a non-production environment subject"

if OIDC_TOKEN="$oidc_token" EXPECTED_OIDC_SUBJECT="$subject" EXPECTED_WORKFLOW_PATH=.github/workflows/unapproved.yml GITHUB_REPOSITORY="$repository" GITHUB_SHA="$commit" "$oidc_validator" >/dev/null 2>&1; then
  echo "OIDC claim validator accepted an unapproved workflow path" >&2
  exit 1
fi

echo "Production Stage 2 and Stage 3 workflow guards are present"
