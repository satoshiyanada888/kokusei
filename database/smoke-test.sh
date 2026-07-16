#!/bin/sh
set -eu

if [ -z "${TARGET_URL:-}" ] || [ -z "${TARGET_KIND:-}" ]; then
  echo "TARGET_URL and TARGET_KIND are required" >&2
  exit 1
fi

case "$TARGET_KIND" in
  backend) paths="/health /api/indicators /api/indicators/population /api/indicators/births /api/indicators/unemployment-rate" ;;
  frontend) paths="/ /indicators/population /updates /robots.txt /sitemap.xml" ;;
  *) echo "TARGET_KIND must be backend or frontend" >&2; exit 1 ;;
esac

for path in $paths; do
  curl --fail --silent --show-error --location \
    --retry 12 --retry-all-errors --retry-delay 5 \
    --output /dev/null "${TARGET_URL%/}$path"
done

echo "$TARGET_KIND smoke test succeeded"
