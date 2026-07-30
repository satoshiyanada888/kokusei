#!/usr/bin/env python3
"""Fail closed when deployed Container App state differs from Stage 3 inputs."""

from __future__ import annotations

import argparse
import json
import os
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable


class StateError(ValueError):
    pass


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def load_json(path: str) -> dict[str, Any]:
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise StateError(f"Container App state could not be read: {error}") from error
    if not isinstance(value, dict):
        raise StateError("Container App state must be an object")
    return value


def required_environment(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise StateError(f"Required read-back setting is missing: {name}")
    return value


def validate_state(
    app: dict[str, Any],
    revision: dict[str, Any],
    *,
    kind: str,
    expected_name: str,
    expected_revision: str,
    expected_image: str,
    expected_registry: str,
    expected_identity: str,
) -> None:
    if kind not in {"frontend", "backend"}:
        raise StateError("Container App kind must be frontend or backend")

    properties = app.get("properties", {})
    configuration = properties.get("configuration", {})
    ingress = configuration.get("ingress", {})
    expected_external = kind == "frontend"
    expected_port = 3000 if expected_external else 8080
    checks = {
        "name": app.get("name") == expected_name,
        "ingress": ingress.get("external") is expected_external,
        "target port": ingress.get("targetPort") == expected_port,
        "latest revision": properties.get("latestRevisionName")
        == expected_revision,
        "revision name": revision.get("name") == expected_revision,
        "active revision": revision.get("properties", {}).get("active") is True,
        "registry server": any(
            registry.get("server") == expected_registry
            and registry.get("identity") == expected_identity
            for registry in configuration.get("registries", [])
            if isinstance(registry, dict)
        ),
        "managed identity": expected_identity
        in app.get("identity", {}).get("userAssignedIdentities", {}),
    }
    if expected_external:
        checks["Frontend FQDN"] = bool(ingress.get("fqdn"))

    containers = revision.get("properties", {}).get("template", {}).get(
        "containers", []
    )
    expected_container_name = kind
    container = next(
        (
            item
            for item in containers
            if isinstance(item, dict) and item.get("name") == expected_container_name
        ),
        None,
    )
    checks["revision image digest"] = (
        isinstance(container, dict) and container.get("image") == expected_image
    )

    traffic = ingress.get("traffic", [])
    weights = [
        item.get("weight")
        for item in traffic
        if isinstance(item, dict) and isinstance(item.get("weight"), int)
    ]
    checks["traffic total"] = sum(weights) == 100
    checks["target revision traffic"] = any(
        item.get("revisionName") == expected_revision and item.get("weight") == 100
        for item in traffic
        if isinstance(item, dict)
    )
    checks["no old revision traffic"] = all(
        item.get("revisionName") == expected_revision or item.get("weight") == 0
        for item in traffic
        if isinstance(item, dict)
    )

    if isinstance(container, dict):
        environment = {
            item.get("name"): item
            for item in container.get("env", [])
            if isinstance(item, dict) and isinstance(item.get("name"), str)
        }
        if kind == "backend":
            database_url = environment.get("DATABASE_URL", {})
            checks["Backend database secret reference"] = (
                database_url.get("secretRef") == "neon-database-url"
                and "value" not in database_url
            )
            checks["Migration URL absent"] = (
                "NEON_MIGRATION_DATABASE_URL" not in environment
            )
        else:
            internal_api_url = environment.get("INTERNAL_API_URL", {})
            checks["Frontend internal API URL"] = str(
                internal_api_url.get("value", "")
            ).startswith("https://")

    for label, valid in checks.items():
        if not valid:
            raise StateError(f"Container App read-back does not match: {label}")


def expect_failure(callback: Callable[[], object], label: str) -> None:
    try:
        callback()
    except StateError:
        return
    raise AssertionError(f"Self-test expected failure: {label}")


def fixture(kind: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, str]]:
    external = kind == "frontend"
    name = f"kokusei-prod-{kind}"
    revision_name = f"{name}--sha-66036f51-1-1"
    image = f"registry.azurecr.io/{kind}@sha256:{'a' * 64}"
    identity = f"/identities/{kind}"
    container_environment = (
        [{"name": "INTERNAL_API_URL", "value": "https://backend.internal"}]
        if external
        else [{"name": "DATABASE_URL", "secretRef": "neon-database-url"}]
    )
    app = {
        "name": name,
        "identity": {"userAssignedIdentities": {identity: {}}},
        "properties": {
            "latestRevisionName": revision_name,
            "configuration": {
                "ingress": {
                    "external": external,
                    "targetPort": 3000 if external else 8080,
                    "fqdn": "frontend.example" if external else "backend.internal",
                    "traffic": [{"revisionName": revision_name, "weight": 100}],
                },
                "registries": [
                    {"server": "registry.azurecr.io", "identity": identity}
                ],
            },
        },
    }
    revision = {
        "name": revision_name,
        "properties": {
            "active": True,
            "template": {
                "containers": [
                    {"name": kind, "image": image, "env": container_environment}
                ]
            },
        },
    }
    expected = {
        "kind": kind,
        "expected_name": name,
        "expected_revision": revision_name,
        "expected_image": image,
        "expected_registry": "registry.azurecr.io",
        "expected_identity": identity,
    }
    return app, revision, expected


def self_test() -> None:
    for kind in ("frontend", "backend"):
        app, revision, expected = fixture(kind)
        validate_state(app, revision, **expected)

    frontend, frontend_revision, frontend_expected = fixture("frontend")
    traffic_zero = deepcopy(frontend)
    traffic_zero["properties"]["configuration"]["ingress"]["traffic"][0][
        "weight"
    ] = 0
    expect_failure(
        lambda: validate_state(
            traffic_zero, frontend_revision, **frontend_expected
        ),
        "Traffic 0%",
    )
    traffic_total = deepcopy(frontend)
    traffic_total["properties"]["configuration"]["ingress"]["traffic"] = [
        {
            "revisionName": frontend_expected["expected_revision"],
            "weight": 70,
        },
        {"revisionName": "old-revision", "weight": 20},
    ]
    expect_failure(
        lambda: validate_state(
            traffic_total, frontend_revision, **frontend_expected
        ),
        "Traffic total not 100",
    )
    frontend_internal = deepcopy(frontend)
    frontend_internal["properties"]["configuration"]["ingress"]["external"] = False
    expect_failure(
        lambda: validate_state(
            frontend_internal, frontend_revision, **frontend_expected
        ),
        "Frontend internal",
    )

    backend, backend_revision, backend_expected = fixture("backend")
    backend_external = deepcopy(backend)
    backend_external["properties"]["configuration"]["ingress"]["external"] = True
    expect_failure(
        lambda: validate_state(
            backend_external, backend_revision, **backend_expected
        ),
        "Backend external",
    )
    wrong_image = deepcopy(backend_revision)
    wrong_image["properties"]["template"]["containers"][0][
        "image"
    ] = f"registry.azurecr.io/backend@sha256:{'b' * 64}"
    expect_failure(
        lambda: validate_state(backend, wrong_image, **backend_expected),
        "revision digest mismatch",
    )
    print(
        "Container App read-back validator self-test passed: normal Frontend/"
        "Backend, Traffic 0%, Traffic total mismatch, Frontend internal, "
        "Backend external, revision digest mismatch"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("app_json", nargs="?")
    parser.add_argument("revision_json", nargs="?")
    args = parser.parse_args()

    try:
        if args.self_test:
            self_test()
            return
        if not args.app_json or not args.revision_json:
            raise StateError("App and revision JSON paths are required")
        validate_state(
            load_json(args.app_json),
            load_json(args.revision_json),
            kind=required_environment("CONTAINER_APP_KIND"),
            expected_name=required_environment("EXPECTED_APP_NAME"),
            expected_revision=required_environment("EXPECTED_REVISION"),
            expected_image=required_environment("EXPECTED_IMAGE"),
            expected_registry=required_environment("EXPECTED_REGISTRY"),
            expected_identity=required_environment("EXPECTED_IDENTITY_ID"),
        )
        print("Container App read-back matches the immutable deployment inputs")
    except (StateError, AssertionError) as error:
        fail(str(error))


if __name__ == "__main__":
    main()
