#!/usr/bin/env python3
"""Validate production Neon URL roles without printing connection strings."""

from __future__ import annotations

import os
import sys
from urllib.parse import parse_qs, unquote, urlsplit


ALLOWED_SSL_MODES = {"require", "verify-ca", "verify-full"}


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def parse_url(name: str, *, pooled: bool) -> tuple[str, str]:
    raw = os.environ.get(name, "")
    if not raw:
        fail(f"Required production setting is missing: {name}")

    try:
        parsed = urlsplit(raw)
        hostname = parsed.hostname or ""
        username = unquote(parsed.username or "")
    except ValueError:
        fail(f"{name} is not a valid PostgreSQL URL")

    if parsed.scheme not in {"postgres", "postgresql"}:
        fail(f"{name} must be a PostgreSQL URL")
    if not hostname.endswith(".neon.tech"):
        fail(f"{name} must use a Neon hostname")
    if pooled != ("-pooler." in hostname):
        expected = "pooled" if pooled else "direct"
        fail(f"{name} must use the Neon {expected} endpoint")
    if parsed.path.rstrip("/") != "/kokusei":
        fail(f"{name} must select the kokusei database")
    if not username or not parsed.password:
        fail(f"{name} must include role credentials")

    query = parse_qs(parsed.query, keep_blank_values=True)
    ssl_modes = query.get("sslmode", [])
    if len(ssl_modes) != 1 or ssl_modes[0] not in ALLOWED_SSL_MODES:
        fail(f"{name} must use sslmode=require, verify-ca, or verify-full")
    return hostname, username


def main() -> None:
    backend_host, backend_user = parse_url("NEON_DATABASE_URL", pooled=True)
    migration_host, migration_user = parse_url(
        "NEON_MIGRATION_DATABASE_URL", pooled=False
    )
    if backend_host.replace("-pooler.", ".", 1) != migration_host:
        fail("Backend and Migration URLs must target the same Neon endpoint")
    if backend_user == migration_user:
        fail("Backend and Migration URLs must use different database roles")
    print("Neon URL roles and TLS settings are valid")


if __name__ == "__main__":
    main()
