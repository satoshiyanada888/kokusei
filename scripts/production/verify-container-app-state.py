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


def normalize_resource_id(value: object) -> str:
    """Normalize an Azure Resource ID for case-insensitive comparison."""
    return value.casefold() if isinstance(value, str) else ""


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
    expected_data_store: str = "postgres",
    expected_storage_account: str = "",
    expected_storage_container: str = "",
    expected_current_blob: str = "current.json",
    expected_backend_client_id: str = "",
    expected_public_host: str = "",
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
            and normalize_resource_id(registry.get("identity"))
            == normalize_resource_id(expected_identity)
            for registry in configuration.get("registries", [])
            if isinstance(registry, dict)
        ),
        "managed identity": normalize_resource_id(expected_identity)
        in {
            normalize_resource_id(identity)
            for identity in app.get("identity", {}).get(
                "userAssignedIdentities", {}
            )
        },
    }
    if expected_external:
        checks["Frontend FQDN"] = bool(ingress.get("fqdn"))
        if expected_public_host and expected_public_host != ingress.get("fqdn"):
            custom_domains = ingress.get("customDomains", [])
            checks["Frontend public custom domain"] = sum(
                1
                for domain in custom_domains
                if isinstance(domain, dict)
                and domain.get("name") == expected_public_host
                and domain.get("bindingType") == "SniEnabled"
                and isinstance(domain.get("certificateId"), str)
                and bool(domain.get("certificateId"))
            ) == 1

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
            data_store = environment.get("DATA_STORE", {})
            checks["Backend data store"] = data_store.get("value") == expected_data_store
            if expected_data_store == "blob":
                checks["Backend storage account"] = (
                    environment.get("AZURE_STORAGE_ACCOUNT_NAME", {}).get("value")
                    == expected_storage_account
                )
                checks["Backend storage container"] = (
                    environment.get("AZURE_STORAGE_CONTAINER_NAME", {}).get("value")
                    == expected_storage_container
                )
                checks["Backend current blob"] = (
                    environment.get("AZURE_STORAGE_CURRENT_BLOB", {}).get("value")
                    == expected_current_blob
                )
                checks["Backend Managed Identity client ID"] = (
                    environment.get("AZURE_CLIENT_ID", {}).get("value")
                    == expected_backend_client_id
                )
                checks["Backend database URL absent in Blob mode"] = (
                    "DATABASE_URL" not in environment
                )
            else:
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
        else [
            {"name": "DATA_STORE", "value": "postgres"},
            {"name": "DATABASE_URL", "secretRef": "neon-database-url"},
        ]
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
                    "customDomains": [],
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
    custom_domain_frontend = deepcopy(frontend)
    custom_domain_frontend["properties"]["configuration"]["ingress"][
        "customDomains"
    ] = [
        {
            "name": "kokusei.example",
            "bindingType": "SniEnabled",
            "certificateId": "/managedCertificates/kokusei-example",
        }
    ]
    validate_state(
        custom_domain_frontend,
        frontend_revision,
        **frontend_expected,
        expected_public_host="kokusei.example",
    )
    missing_custom_domain = deepcopy(custom_domain_frontend)
    missing_custom_domain["properties"]["configuration"]["ingress"][
        "customDomains"
    ] = []
    expect_failure(
        lambda: validate_state(
            missing_custom_domain,
            frontend_revision,
            **frontend_expected,
            expected_public_host="kokusei.example",
        ),
        "missing Frontend public custom domain",
    )
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
    case_variant_identity = (
        "/subscriptions/00000000-0000-0000-0000-000000000000/"
        "resourcegroups/rg-kokusei-prod/providers/"
        "microsoft.managedidentity/userassignedidentities/kokusei-prod-backend"
    )
    case_variant_backend = deepcopy(backend)
    case_variant_backend["identity"]["userAssignedIdentities"] = {
        case_variant_identity: {}
    }
    case_variant_backend["properties"]["configuration"]["registries"][0][
        "identity"
    ] = case_variant_identity
    case_variant_expected = dict(backend_expected)
    case_variant_expected["expected_identity"] = (
        "/subscriptions/00000000-0000-0000-0000-000000000000/"
        "resourceGroups/rg-kokusei-prod/providers/"
        "Microsoft.ManagedIdentity/userAssignedIdentities/kokusei-prod-backend"
    )
    validate_state(
        case_variant_backend,
        backend_revision,
        **case_variant_expected,
    )
    wrong_identity_backend = deepcopy(case_variant_backend)
    wrong_identity = case_variant_identity.replace(
        "kokusei-prod-backend", "different-backend"
    )
    wrong_identity_backend["identity"]["userAssignedIdentities"] = {
        wrong_identity: {}
    }
    wrong_identity_backend["properties"]["configuration"]["registries"][0][
        "identity"
    ] = wrong_identity
    expect_failure(
        lambda: validate_state(
            wrong_identity_backend,
            backend_revision,
            **case_variant_expected,
        ),
        "different Managed Identity",
    )
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
    blob_backend = deepcopy(backend_revision)
    blob_backend["properties"]["template"]["containers"][0]["env"] = [
        {"name": "DATA_STORE", "value": "blob"},
        {"name": "AZURE_STORAGE_ACCOUNT_NAME", "value": "kokuseiproddata"},
        {"name": "AZURE_STORAGE_CONTAINER_NAME", "value": "official-data"},
        {"name": "AZURE_STORAGE_CURRENT_BLOB", "value": "current.json"},
        {"name": "AZURE_CLIENT_ID", "value": "backend-client-id"},
    ]
    validate_state(
        backend,
        blob_backend,
        **backend_expected,
        expected_data_store="blob",
        expected_storage_account="kokuseiproddata",
        expected_storage_container="official-data",
        expected_current_blob="current.json",
        expected_backend_client_id="backend-client-id",
    )
    print(
        "Container App read-back validator self-test passed: normal Frontend/"
        "Backend, case-equivalent Resource ID, different Managed Identity, Blob Backend, "
        "Traffic 0%, Traffic total mismatch, Frontend internal, Backend external, "
        "revision digest mismatch, custom domain binding"
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
            expected_data_store=os.environ.get("EXPECTED_DATA_STORE", "postgres"),
            expected_storage_account=os.environ.get(
                "EXPECTED_STORAGE_ACCOUNT", ""
            ),
            expected_storage_container=os.environ.get(
                "EXPECTED_STORAGE_CONTAINER", ""
            ),
            expected_current_blob=os.environ.get(
                "EXPECTED_CURRENT_BLOB", "current.json"
            ),
            expected_backend_client_id=os.environ.get(
                "EXPECTED_BACKEND_CLIENT_ID", ""
            ),
            expected_public_host=os.environ.get("EXPECTED_PUBLIC_HOST", ""),
        )
        print("Container App read-back matches the immutable deployment inputs")
    except (StateError, AssertionError) as error:
        fail(str(error))


if __name__ == "__main__":
    main()
