#!/bin/sh
set -eu

required="AZURE_STORAGE_ACCOUNT_NAME AZURE_STORAGE_CONTAINER_NAME GITHUB_ENV"
for name in $required; do
  eval "value=\${$name:-}"
  [ -n "$value" ] || {
    echo "Required Blob snapshot setting is missing: $name" >&2
    exit 1
  }
done

current_blob="${AZURE_STORAGE_CURRENT_BLOB:-current.json}"
output_directory="$(mktemp -d "${RUNNER_TEMP:-/tmp}/kokusei-previous-snapshot.XXXXXX")"
chmod 0700 "$output_directory"
manifest="$output_directory/current.json"
dataset="$output_directory/dataset.json"

exists="$(az storage blob exists \
  --auth-mode login \
  --account-name "$AZURE_STORAGE_ACCOUNT_NAME" \
  --container-name "$AZURE_STORAGE_CONTAINER_NAME" \
  --name "$current_blob" \
  --query exists -o tsv)"

if [ "$exists" != "true" ]; then
  {
    echo "PREVIOUS_SNAPSHOT_PRESENT=false"
    echo "PREVIOUS_SNAPSHOT_DIRECTORY=$output_directory"
  } >> "$GITHUB_ENV"
  exit 0
fi

az storage blob download \
  --auth-mode login \
  --account-name "$AZURE_STORAGE_ACCOUNT_NAME" \
  --container-name "$AZURE_STORAGE_CONTAINER_NAME" \
  --name "$current_blob" \
  --file "$manifest" \
  --overwrite true \
  --no-progress \
  --only-show-errors
chmod 0600 "$manifest"

snapshot_blob="$(jq -er '.snapshot' "$manifest")"
commit_sha="$(jq -er '.commitSha' "$manifest")"
expected_sha="$(jq -er '.sha256' "$manifest")"
jq -e '
  .schemaVersion == 1
  and (.generatedAt | type == "string" and length > 0)
  and (.snapshot | type == "string")
  and (.commitSha | type == "string" and test("^[0-9a-f]{40}$"))
  and (.sha256 | type == "string" and test("^[0-9a-f]{64}$"))
' "$manifest" >/dev/null
[ "$snapshot_blob" = "snapshots/$commit_sha/dataset.json" ] || {
  echo "Current Blob manifest contains an unsafe snapshot path" >&2
  exit 1
}

az storage blob download \
  --auth-mode login \
  --account-name "$AZURE_STORAGE_ACCOUNT_NAME" \
  --container-name "$AZURE_STORAGE_CONTAINER_NAME" \
  --name "$snapshot_blob" \
  --file "$dataset" \
  --overwrite true \
  --no-progress \
  --only-show-errors
chmod 0600 "$dataset"

actual_sha="$(sha256sum "$dataset" | awk '{print $1}')"
[ "$actual_sha" = "$expected_sha" ] || {
  echo "Previous snapshot SHA-256 does not match current.json" >&2
  exit 1
}
jq -e --arg commit "$commit_sha" '
  .schemaVersion == 1
  and .sourceCommitSha == $commit
  and (.indicators | length == 3)
  and ([.indicators[].slug] | sort == ["births", "population", "unemployment-rate"])
  and (.updates | type == "array")
' "$dataset" >/dev/null

{
  echo "PREVIOUS_SNAPSHOT_PRESENT=true"
  echo "PREVIOUS_SNAPSHOT_PATH=$dataset"
  echo "PREVIOUS_SNAPSHOT_DIRECTORY=$output_directory"
} >> "$GITHUB_ENV"
