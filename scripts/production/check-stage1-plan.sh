#!/bin/sh
set -eu

plan=${1:-}
if [ -z "$plan" ] || [ ! -f "$plan" ]; then
  echo "Usage: $0 <saved-production-plan.tfplan>" >&2
  exit 1
fi

command -v terraform >/dev/null 2>&1 || { echo "terraform is required" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }

summary=$(
  terraform show -json "$plan" | jq -r '
    [.resource_changes[]?.change.actions] as $actions
    | [
        ($actions | map(select(. == ["create"])) | length),
        ($actions | map(select(. == ["update"])) | length),
        ($actions | map(select(. == ["delete"])) | length),
        ($actions | map(select((index("create") != null) and (index("delete") != null))) | length)
      ]
    | @tsv
  '
)

set -- $summary
add=${1:-0}
change=${2:-0}
destroy=${3:-0}
replace=${4:-0}

printf 'Stage 1 saved plan: add=%s change=%s destroy=%s replace=%s\n' "$add" "$change" "$destroy" "$replace"

if [ "$destroy" -ne 0 ] || [ "$replace" -ne 0 ]; then
  echo "Stage 1 plan contains destroy or replace actions; do not apply it" >&2
  exit 1
fi

echo "Stage 1 plan contains no destroy or replace actions"
