#!/usr/bin/env python3
"""Validate and normalize the non-secret Production public HTTPS origin."""

from __future__ import annotations

import os
import re
import sys
from urllib.parse import urlsplit


HOST_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


class SiteUrlError(ValueError):
    pass


def normalize_public_site_url(value: str) -> str:
    if not value or value != value.strip() or "\n" in value or "\r" in value:
        raise SiteUrlError("NEXT_PUBLIC_SITE_URL must be a non-empty single-line value")

    parsed = urlsplit(value)
    if parsed.scheme != "https":
        raise SiteUrlError("NEXT_PUBLIC_SITE_URL must use HTTPS")
    try:
        port = parsed.port
    except ValueError as error:
        raise SiteUrlError("NEXT_PUBLIC_SITE_URL contains an invalid port") from error
    if parsed.username or parsed.password or port is not None:
        raise SiteUrlError("NEXT_PUBLIC_SITE_URL must not contain credentials or a port")
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise SiteUrlError("NEXT_PUBLIC_SITE_URL must be an origin without a path, query, or fragment")

    hostname = parsed.hostname or ""
    if parsed.netloc != hostname or hostname.endswith("."):
        raise SiteUrlError("NEXT_PUBLIC_SITE_URL hostname must be lowercase without a trailing dot")
    labels = hostname.split(".")
    if len(labels) < 2 or any(not HOST_LABEL.fullmatch(label) for label in labels):
        raise SiteUrlError("NEXT_PUBLIC_SITE_URL must contain a valid DNS hostname")
    if hostname == "localhost" or hostname.startswith("127."):
        raise SiteUrlError("NEXT_PUBLIC_SITE_URL must not reference localhost")

    return f"https://{hostname}"


def self_test() -> None:
    valid = {
        "https://kokusei.yanada.tokyo": "https://kokusei.yanada.tokyo",
        "https://kokusei.yanada.tokyo/": "https://kokusei.yanada.tokyo",
        "https://app.orangeisland.japaneast.azurecontainerapps.io":
            "https://app.orangeisland.japaneast.azurecontainerapps.io",
    }
    for value, expected in valid.items():
        assert normalize_public_site_url(value) == expected

    invalid = (
        "",
        "http://kokusei.yanada.tokyo",
        "https://localhost",
        "https://127.0.0.1",
        "https://KOKUSEI.yanada.tokyo",
        "https://kokusei.yanada.tokyo:443",
        "https://kokusei.yanada.tokyo:not-a-port",
        "https://kokusei.yanada.tokyo/path",
        "https://kokusei.yanada.tokyo?query=1",
        "https://kokusei.yanada.tokyo#fragment",
        " https://kokusei.yanada.tokyo",
        "https://kokusei.yanada.tokyo\n",
    )
    for value in invalid:
        try:
            normalize_public_site_url(value)
        except SiteUrlError:
            continue
        raise AssertionError(f"Expected invalid Production site URL: {value!r}")


def main() -> None:
    if sys.argv[1:] == ["--self-test"]:
        self_test()
        return
    if sys.argv[1:]:
        raise SystemExit("Usage: validate-public-site-url.py [--self-test]")
    try:
        print(normalize_public_site_url(os.environ.get("NEXT_PUBLIC_SITE_URL", "")))
    except SiteUrlError as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
