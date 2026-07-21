#!/usr/bin/env python3
"""Fail closed when GitHub's issued OIDC claims differ from Stage 1 trust."""

from __future__ import annotations

import base64
import json
import os
import sys
from typing import Any


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def required(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        fail(f"Required OIDC validation setting is missing: {name}")
    return value


def payload_from_token(token: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        fail("GitHub OIDC token has an invalid structure")
    try:
        encoded = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(encoded))
    except (ValueError, json.JSONDecodeError):
        fail("GitHub OIDC token payload could not be decoded")
    if not isinstance(payload, dict):
        fail("GitHub OIDC token payload must be an object")
    return payload


def main() -> None:
    token = required("OIDC_TOKEN")
    expected = {
        "iss": "https://token.actions.githubusercontent.com",
        "sub": required("EXPECTED_OIDC_SUBJECT"),
        "repository": required("GITHUB_REPOSITORY"),
        "environment": "production",
        "ref": "refs/heads/main",
        "sha": required("GITHUB_SHA"),
        "event_name": "workflow_dispatch",
    }
    payload = payload_from_token(token)
    for claim, expected_value in expected.items():
        if payload.get(claim) != expected_value:
            fail(f"GitHub OIDC claim does not match the production trust: {claim}")

    audience = payload.get("aud")
    if audience != "api://AzureADTokenExchange" and not (
        isinstance(audience, list) and "api://AzureADTokenExchange" in audience
    ):
        fail("GitHub OIDC audience does not match AzureADTokenExchange")

    expected_workflow = (
        f"{expected['repository']}/.github/workflows/deploy-production.yml@refs/heads/main"
    )
    if payload.get("workflow_ref") != expected_workflow:
        fail("GitHub OIDC token was not issued to the production workflow on main")

    print("GitHub OIDC claims match the production federated credential")


if __name__ == "__main__":
    main()
