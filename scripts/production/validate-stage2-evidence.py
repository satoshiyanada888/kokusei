#!/usr/bin/env python3
"""Validate that Stage 3 inputs match one successful Stage 2 run and artifact."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable


class EvidenceError(ValueError):
    pass


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def load_json(path: str) -> dict[str, Any]:
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise EvidenceError(f"Evidence JSON could not be read: {error}") from error
    if not isinstance(value, dict):
        raise EvidenceError("Evidence JSON must be an object")
    return value


def required_environment(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise EvidenceError(f"Required evidence setting is missing: {name}")
    return value


def expected_values() -> dict[str, str | int]:
    run_id = required_environment("STAGE2_RUN_ID")
    if not run_id.isascii() or not run_id.isdigit() or run_id.startswith("0"):
        raise EvidenceError("stage2_run_id must be a positive integer")

    return {
        "run_id": int(run_id),
        "repository": required_environment("GITHUB_REPOSITORY"),
        "commit": required_environment("TARGET_COMMIT"),
        "frontend_digest": required_environment("FRONTEND_DIGEST"),
        "backend_digest": required_environment("BACKEND_DIGEST"),
        "artifact_name": f"production-stage2-{required_environment('TARGET_COMMIT')}",
    }


def validate_run_and_artifact(
    run: dict[str, Any], artifacts_response: dict[str, Any], expected: dict[str, Any]
) -> int:
    checks = {
        "run ID": run.get("id") == expected["run_id"],
        "repository": run.get("repository", {}).get("full_name")
        == expected["repository"],
        "workflow": run.get("name") == "Prepare production (Stage 2)",
        "event": run.get("event") == "workflow_dispatch",
        "branch": run.get("head_branch") == "main",
        "head SHA": run.get("head_sha") == expected["commit"],
        "status": run.get("status") == "completed",
        "conclusion": run.get("conclusion") == "success",
        "run attempt": run.get("run_attempt") == 1,
    }
    for label, valid in checks.items():
        if not valid:
            raise EvidenceError(f"Stage 2 {label} does not match")

    artifacts = artifacts_response.get("artifacts")
    if not isinstance(artifacts, list):
        raise EvidenceError("Stage 2 artifact response is invalid")
    if artifacts_response.get("total_count") != len(artifacts):
        raise EvidenceError("Stage 2 artifact response must not be paginated")
    matches = [
        artifact
        for artifact in artifacts
        if isinstance(artifact, dict)
        and artifact.get("name") == expected["artifact_name"]
        and artifact.get("workflow_run", {}).get("id") == expected["run_id"]
    ]
    if len(matches) != 1:
        raise EvidenceError("Exactly one Stage 2 artifact must belong to the run")

    artifact = matches[0]
    if artifact.get("expired") is not False:
        raise EvidenceError("Stage 2 artifact is expired")
    artifact_id = artifact.get("id")
    if not isinstance(artifact_id, int) or artifact_id <= 0:
        raise EvidenceError("Stage 2 artifact ID is invalid")
    return artifact_id


def validate_metadata(metadata: dict[str, Any], expected: dict[str, Any]) -> None:
    blob = metadata.get("blob_snapshot", {})
    checks = {
        "commit SHA": metadata.get("commit_sha") == expected["commit"],
        "Frontend digest": metadata.get("frontend", {}).get("digest")
        == expected["frontend_digest"],
        "Backend digest": metadata.get("backend", {}).get("digest")
        == expected["backend_digest"],
        "Frontend platform": (
            metadata.get("frontend", {}).get("os"),
            metadata.get("frontend", {}).get("architecture"),
        )
        == ("linux", "amd64"),
        "Backend platform": (
            metadata.get("backend", {}).get("os"),
            metadata.get("backend", {}).get("architecture"),
        )
        == ("linux", "amd64"),
        "snapshot generation": metadata.get("snapshot_generation") == "succeeded",
        "births fetch": metadata.get("official_data_fetch", {}).get("births")
        == "succeeded",
        "unemployment fetch": metadata.get("official_data_fetch", {}).get(
            "unemployment_rate"
        )
        == "succeeded",
        "population fetch": metadata.get("official_data_fetch", {}).get(
            "population"
        )
        == "succeeded",
        "births validation": metadata.get("validation", {}).get("births")
        == "succeeded",
        "unemployment validation": metadata.get("validation", {}).get(
            "unemployment_rate"
        )
        == "succeeded",
        "population validation": metadata.get("validation", {}).get("population")
        == "succeeded",
        "cross-indicator validation": metadata.get("validation", {}).get("all")
        == "succeeded",
        "Blob snapshot enabled": blob.get("enabled") is True,
        "Blob snapshot upload": blob.get("uploadSucceeded") is True,
        "Blob snapshot read-back": blob.get("readBackSucceeded") is True,
        "Blob snapshot source commit": blob.get("sourceCommitSha")
        == expected["commit"],
        "Blob snapshot path": blob.get("snapshotBlobName")
        == f"snapshots/{expected['commit']}/dataset.json",
        "Blob current pointer": blob.get("currentBlobName") == "current.json",
        "Blob dataset digest": isinstance(blob.get("datasetSha256"), str)
        and re.fullmatch(r"[0-9a-f]{64}", blob["datasetSha256"]) is not None,
        "Blob dataset size": isinstance(blob.get("datasetSize"), int)
        and blob["datasetSize"] > 0,
        "Blob schema version": blob.get("schemaVersion") == 1,
    }
    for label, valid in checks.items():
        if not valid:
            raise EvidenceError(f"Stage 2 artifact {label} does not match")


def expect_failure(callback: Callable[[], object], label: str) -> None:
    try:
        callback()
    except EvidenceError:
        return
    raise AssertionError(f"Self-test expected failure: {label}")


def self_test() -> None:
    expected = {
        "run_id": 30509831983,
        "repository": "satoshiyanada888/kokusei",
        "commit": "6" * 40,
        "frontend_digest": f"sha256:{'a' * 64}",
        "backend_digest": f"sha256:{'b' * 64}",
        "artifact_name": f"production-stage2-{'6' * 40}",
    }
    run = {
        "id": expected["run_id"],
        "repository": {"full_name": expected["repository"]},
        "name": "Prepare production (Stage 2)",
        "event": "workflow_dispatch",
        "head_branch": "main",
        "head_sha": expected["commit"],
        "status": "completed",
        "conclusion": "success",
        "run_attempt": 1,
    }
    artifact = {
        "id": 123,
        "name": expected["artifact_name"],
        "expired": False,
        "workflow_run": {"id": expected["run_id"]},
    }
    artifacts = {"total_count": 1, "artifacts": [artifact]}
    metadata = {
        "commit_sha": expected["commit"],
        "frontend": {
            "digest": expected["frontend_digest"],
            "os": "linux",
            "architecture": "amd64",
        },
        "backend": {
            "digest": expected["backend_digest"],
            "os": "linux",
            "architecture": "amd64",
        },
        "snapshot_generation": "succeeded",
        "official_data_fetch": {
            "births": "succeeded",
            "unemployment_rate": "succeeded",
            "population": "succeeded",
        },
        "validation": {
            "births": "succeeded",
            "unemployment_rate": "succeeded",
            "population": "succeeded",
            "all": "succeeded",
        },
        "blob_snapshot": {
            "enabled": True,
            "uploadSucceeded": True,
            "readBackSucceeded": True,
            "sourceCommitSha": expected["commit"],
            "snapshotBlobName": f"snapshots/{expected['commit']}/dataset.json",
            "currentBlobName": "current.json",
            "datasetSha256": "d" * 64,
            "datasetSize": 1024,
            "schemaVersion": 1,
        },
    }

    assert validate_run_and_artifact(run, artifacts, expected) == 123
    validate_metadata(metadata, expected)

    original_environment = {
        name: os.environ.get(name)
        for name in (
            "STAGE2_RUN_ID",
            "GITHUB_REPOSITORY",
            "TARGET_COMMIT",
            "FRONTEND_DIGEST",
            "BACKEND_DIGEST",
        )
    }
    os.environ.update(
        {
            "STAGE2_RUN_ID": "not-a-run-id",
            "GITHUB_REPOSITORY": str(expected["repository"]),
            "TARGET_COMMIT": str(expected["commit"]),
            "FRONTEND_DIGEST": str(expected["frontend_digest"]),
            "BACKEND_DIGEST": str(expected["backend_digest"]),
        }
    )
    expect_failure(expected_values, "invalid Stage 2 run ID input")
    for name, value in original_environment.items():
        if value is None:
            os.environ.pop(name, None)
        else:
            os.environ[name] = value

    invalid_run_id = deepcopy(run)
    invalid_run_id["id"] = 0
    expect_failure(
        lambda: validate_run_and_artifact(invalid_run_id, artifacts, expected),
        "invalid run ID",
    )
    failed_run = deepcopy(run)
    failed_run["conclusion"] = "failure"
    expect_failure(
        lambda: validate_run_and_artifact(failed_run, artifacts, expected),
        "failure run",
    )
    rerun = deepcopy(run)
    rerun["run_attempt"] = 2
    expect_failure(
        lambda: validate_run_and_artifact(rerun, artifacts, expected), "attempt 2"
    )
    wrong_sha = deepcopy(run)
    wrong_sha["head_sha"] = "7" * 40
    expect_failure(
        lambda: validate_run_and_artifact(wrong_sha, artifacts, expected),
        "SHA mismatch",
    )
    expect_failure(
        lambda: validate_run_and_artifact(
            run, {"total_count": 0, "artifacts": []}, expected
        ),
        "artifact missing",
    )
    expect_failure(
        lambda: validate_run_and_artifact(
            run,
            {
                "total_count": 2,
                "artifacts": [artifact, deepcopy(artifact)],
            },
            expected,
        ),
        "duplicate artifact",
    )
    wrong_owner = deepcopy(artifact)
    wrong_owner["workflow_run"]["id"] = 1
    expect_failure(
        lambda: validate_run_and_artifact(
            run, {"total_count": 1, "artifacts": [wrong_owner]}, expected
        ),
        "artifact owned by another run",
    )
    expired_artifact = deepcopy(artifact)
    expired_artifact["expired"] = True
    expect_failure(
        lambda: validate_run_and_artifact(
            run, {"total_count": 1, "artifacts": [expired_artifact]}, expected
        ),
        "expired artifact",
    )
    wrong_metadata_sha = deepcopy(metadata)
    wrong_metadata_sha["commit_sha"] = "7" * 40
    expect_failure(
        lambda: validate_metadata(wrong_metadata_sha, expected),
        "artifact SHA mismatch",
    )
    wrong_digest = deepcopy(metadata)
    wrong_digest["frontend"]["digest"] = f"sha256:{'c' * 64}"
    expect_failure(
        lambda: validate_metadata(wrong_digest, expected), "digest mismatch"
    )
    wrong_platform = deepcopy(metadata)
    wrong_platform["backend"]["architecture"] = "arm64"
    expect_failure(
        lambda: validate_metadata(wrong_platform, expected), "platform mismatch"
    )
    failed_blob_readback = deepcopy(metadata)
    failed_blob_readback["blob_snapshot"]["readBackSucceeded"] = False
    expect_failure(
        lambda: validate_metadata(failed_blob_readback, expected),
        "Blob read-back failure",
    )
    wrong_blob_path = deepcopy(metadata)
    wrong_blob_path["blob_snapshot"]["snapshotBlobName"] = "dataset.json"
    expect_failure(
        lambda: validate_metadata(wrong_blob_path, expected), "Blob path mismatch"
    )
    print(
        "Stage 2 evidence validator self-test passed: normal, invalid run ID, "
        "failure run, attempt 2, run/artifact SHA mismatch, artifact "
        "missing/duplicate/wrong-owner/expired, digest/platform mismatch, "
        "Blob read-back/path mismatch"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    subcommands = parser.add_subparsers(dest="command", required=True)
    select = subcommands.add_parser("select-artifact")
    select.add_argument("run_json")
    select.add_argument("artifacts_json")
    metadata = subcommands.add_parser("validate-metadata")
    metadata.add_argument("metadata_json")
    subcommands.add_parser("self-test")
    args = parser.parse_args()

    try:
        if args.command == "self-test":
            self_test()
            return
        expected = expected_values()
        if args.command == "select-artifact":
            artifact_id = validate_run_and_artifact(
                load_json(args.run_json), load_json(args.artifacts_json), expected
            )
            print(artifact_id)
            return
        validate_metadata(load_json(args.metadata_json), expected)
        print("Stage 2 artifact metadata matches immutable Stage 3 inputs")
    except (EvidenceError, AssertionError) as error:
        fail(str(error))


if __name__ == "__main__":
    main()
