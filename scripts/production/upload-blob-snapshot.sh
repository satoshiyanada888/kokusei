#!/bin/sh
set -eu

required="AZURE_STORAGE_ACCOUNT_NAME AZURE_STORAGE_CONTAINER_NAME SNAPSHOT_DATASET GITHUB_SHA GITHUB_ENV"
for name in $required; do
  eval "value=\${$name:-}"
  [ -n "$value" ] || {
    echo "Required Blob snapshot setting is missing: $name" >&2
    exit 1
  }
done

printf '%s' "$GITHUB_SHA" | grep -Eq '^[0-9a-f]{40}$' || {
  echo "GITHUB_SHA must be a full lowercase commit SHA" >&2
  exit 1
}

current_blob="${AZURE_STORAGE_CURRENT_BLOB:-current.json}"
snapshot_blob="snapshots/$GITHUB_SHA/dataset.json"
temporary_directory="$(mktemp -d "${RUNNER_TEMP:-/tmp}/kokusei-blob-snapshot.XXXXXX")"
cleanup() {
  rm -rf "$temporary_directory"
}
trap cleanup EXIT HUP INT TERM

dataset_sha="$(sha256sum "$SNAPSHOT_DATASET" | awk '{print $1}')"
dataset_size="$(wc -c < "$SNAPSHOT_DATASET" | tr -d ' ')"
schema_version="$(jq -er '.schemaVersion' "$SNAPSHOT_DATASET")"
generated_at="$(jq -er '.generatedAt' "$SNAPSHOT_DATASET")"
source_commit="$(jq -er '.sourceCommitSha' "$SNAPSHOT_DATASET")"
[ "$schema_version" = "1" ] || { echo "Snapshot schema version must be 1" >&2; exit 1; }
[ "$source_commit" = "$GITHUB_SHA" ] || { echo "Snapshot commit does not match GITHUB_SHA" >&2; exit 1; }

blob_exists="$(az storage blob exists \
  --auth-mode login \
  --account-name "$AZURE_STORAGE_ACCOUNT_NAME" \
  --container-name "$AZURE_STORAGE_CONTAINER_NAME" \
  --name "$snapshot_blob" \
  --query exists -o tsv)"
if [ "$blob_exists" = "true" ]; then
  existing="$temporary_directory/existing-dataset.json"
  az storage blob download \
    --auth-mode login \
    --account-name "$AZURE_STORAGE_ACCOUNT_NAME" \
    --container-name "$AZURE_STORAGE_CONTAINER_NAME" \
    --name "$snapshot_blob" \
    --file "$existing" \
    --overwrite true \
    --no-progress \
    --only-show-errors
  [ "$(sha256sum "$existing" | awk '{print $1}')" = "$dataset_sha" ] || {
    echo "Refusing to overwrite a different snapshot for the same commit SHA" >&2
    exit 1
  }
else
  az storage blob upload \
    --auth-mode login \
    --account-name "$AZURE_STORAGE_ACCOUNT_NAME" \
    --container-name "$AZURE_STORAGE_CONTAINER_NAME" \
    --name "$snapshot_blob" \
    --file "$SNAPSHOT_DATASET" \
    --overwrite false \
    --no-progress \
    --only-show-errors
fi

read_back="$temporary_directory/read-back-dataset.json"
az storage blob download \
  --auth-mode login \
  --account-name "$AZURE_STORAGE_ACCOUNT_NAME" \
  --container-name "$AZURE_STORAGE_CONTAINER_NAME" \
  --name "$snapshot_blob" \
  --file "$read_back" \
  --overwrite true \
  --no-progress \
  --only-show-errors
[ "$(sha256sum "$read_back" | awk '{print $1}')" = "$dataset_sha" ] || {
  echo "Uploaded snapshot SHA-256 read-back mismatch" >&2
  exit 1
}

manifest="$temporary_directory/current.json"
jq -n \
  --arg snapshot "$snapshot_blob" \
  --arg commit "$GITHUB_SHA" \
  --arg generated_at "$generated_at" \
  --arg sha256 "$dataset_sha" \
  '{
    schemaVersion: 1,
    snapshot: $snapshot,
    commitSha: $commit,
    generatedAt: $generated_at,
    sha256: $sha256
  }' > "$manifest"
chmod 0600 "$manifest"

# current.json is updated only after dataset upload and read-back validation succeed.
az storage blob upload \
  --auth-mode login \
  --account-name "$AZURE_STORAGE_ACCOUNT_NAME" \
  --container-name "$AZURE_STORAGE_CONTAINER_NAME" \
  --name "$current_blob" \
  --file "$manifest" \
  --overwrite true \
  --no-progress \
  --only-show-errors

manifest_read_back="$temporary_directory/current-read-back.json"
az storage blob download \
  --auth-mode login \
  --account-name "$AZURE_STORAGE_ACCOUNT_NAME" \
  --container-name "$AZURE_STORAGE_CONTAINER_NAME" \
  --name "$current_blob" \
  --file "$manifest_read_back" \
  --overwrite true \
  --no-progress \
  --only-show-errors
jq -e \
  --arg snapshot "$snapshot_blob" \
  --arg commit "$GITHUB_SHA" \
  --arg sha256 "$dataset_sha" \
  '.schemaVersion == 1 and .snapshot == $snapshot and .commitSha == $commit and .sha256 == $sha256' \
  "$manifest_read_back" >/dev/null || {
    echo "current.json read-back does not match the verified snapshot" >&2
    exit 1
  }

{
  echo "SNAPSHOT_BLOB=$snapshot_blob"
  echo "SNAPSHOT_SHA256=$dataset_sha"
  echo "SNAPSHOT_SIZE=$dataset_size"
  echo "SNAPSHOT_SCHEMA_VERSION=$schema_version"
  echo "SNAPSHOT_GENERATED_AT=$generated_at"
  echo "SNAPSHOT_CURRENT_BLOB=$current_blob"
  echo "SNAPSHOT_UPLOAD_SUCCEEDED=true"
  echo "SNAPSHOT_READ_BACK_SUCCEEDED=true"
} >> "$GITHUB_ENV"
