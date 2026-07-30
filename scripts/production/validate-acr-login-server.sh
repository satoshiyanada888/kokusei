#!/bin/sh
set -eu

acr_name=${AZURE_CONTAINER_REGISTRY:-}
login_server=${ACR_LOGIN_SERVER:-}

case "$acr_name" in
  '' | *[!a-z0-9]*)
    echo "AZURE_CONTAINER_REGISTRY must be a lowercase alphanumeric ACR name." >&2
    exit 1
    ;;
esac

case "$login_server" in
  '' | *[!a-z0-9.]*)
    echo "ACR_LOGIN_SERVER must be a lowercase Azure Container Registry hostname." >&2
    exit 1
    ;;
esac

expected_login_server="${acr_name}.azurecr.io"
if [ "$login_server" != "$expected_login_server" ]; then
  echo "ACR_LOGIN_SERVER does not match AZURE_CONTAINER_REGISTRY." >&2
  exit 1
fi

printf '%s\n' "$login_server"
