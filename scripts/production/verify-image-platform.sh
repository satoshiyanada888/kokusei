#!/usr/bin/env bash
set -euo pipefail

image_reference=${1:-}
[[ -n "$image_reference" ]] || { echo "usage: verify-image-platform.sh <image-reference>" >&2; exit 1; }

manifest="$(docker buildx imagetools inspect "$image_reference" --format '{{json .Manifest}}')"
if jq -e '.manifests | type == "array"' <<<"$manifest" >/dev/null 2>&1; then
  jq -e '
    [.manifests[]
      | .platform
      | select((.architecture // "unknown") != "unknown" and (.os // "unknown") != "unknown")
    ] as $platforms
    | [.manifests[]
      | select(
          (.platform.architecture // "unknown") == "unknown"
          or (.platform.os // "unknown") == "unknown"
        )
      | select(.annotations["vnd.docker.reference.type"] != "attestation-manifest")
    ] as $unclassified
    | ($platforms | length) > 0
      and all($platforms[]; .architecture == "amd64" and .os == "linux")
      and ($unclassified | length) == 0
  ' <<<"$manifest" >/dev/null || {
    echo "Image manifest must contain only linux/amd64 runtime platforms" >&2
    exit 1
  }
else
  image_config="$(docker buildx imagetools inspect "$image_reference" --format '{{json .Image}}')"
  jq -e '.architecture == "amd64" and .os == "linux"' <<<"$image_config" >/dev/null || {
    echo "Image configuration must be linux/amd64" >&2
    exit 1
  }
fi

echo "linux/amd64"
