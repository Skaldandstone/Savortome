"""Fail-closed expiry handler for one Second Breakfast validation session."""

from __future__ import annotations

import json
import os
import re
import time


SESSION_RE = re.compile(r"^sb-[a-f0-9]{32}$")
STACK_NAMES = {
    "runtime": "skaldandstone-development-secondbreakfast-runtime",
    "database": "skaldandstone-development-secondbreakfast-database",
}
MAX_SESSION_SECONDS = 2 * 60 * 60
STABLE_STATUSES = {"CREATE_COMPLETE", "UPDATE_COMPLETE"}


def _config(environment: dict[str, str]) -> dict[str, object]:
    created = int(environment["CREATED_AT_EPOCH"])
    expires = int(environment["EXPIRES_AT_EPOCH"])
    config = {
        "session_id": environment["SESSION_ID"],
        "created": created,
        "expires": expires,
        "account": environment["EXPECTED_ACCOUNT"],
        "region": environment["EXPECTED_REGION"],
        "rule_name": environment["RULE_NAME"],
    }
    if not SESSION_RE.fullmatch(str(config["session_id"])):
        raise RuntimeError("Session identifier is outside the Second Breakfast boundary")
    if not re.fullmatch(r"\d{12}", str(config["account"])):
        raise RuntimeError("Expected account is invalid")
    if config["account"] != "051722405355" or config["region"] != "us-east-2":
        raise RuntimeError("Expected account or region is outside the reviewed boundary")
    if expires <= created or expires - created > MAX_SESSION_SECONDS:
        raise RuntimeError("Expiry must be after creation and within two hours")
    return config


def _evaluate_stack(
    stack: dict[str, object], name: str, config: dict[str, object]
) -> str:
    if name not in STACK_NAMES.values():
        raise RuntimeError("Stack name is outside the reviewed boundary")
    stack_id = str(stack["StackId"])
    expected_prefix = (
        f"arn:aws:cloudformation:{config['region']}:{config['account']}:stack/{name}/"
    )
    if not stack_id.startswith(expected_prefix):
        raise RuntimeError("Resolved stack ARN is outside the exact account, region, or name")
    tags = {str(item["Key"]): str(item["Value"]) for item in stack.get("Tags", [])}
    expected_tags = {
        "SkaldAndStone:ManagedBy": "secondbreakfast-session-expiry-v1",
        "SkaldAndStone:SessionId": str(config["session_id"]),
        "SkaldAndStone:ExpiresAtEpoch": str(config["expires"]),
    }
    if any(tags.get(key) != value for key, value in expected_tags.items()):
        raise RuntimeError("Stack expiry tags do not match the controller contract")
    status = str(stack["StackStatus"])
    if status == "DELETE_IN_PROGRESS":
        return "deleting"
    if status not in STABLE_STATUSES:
        raise RuntimeError("Stack is not in a deletion-safe stable state")
    return "ready"


def _describe(cloudformation, name: str) -> dict[str, object] | None:
    from botocore.exceptions import ClientError

    try:
        return cloudformation.describe_stacks(StackName=name)["Stacks"][0]
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code")
        message = error.response.get("Error", {}).get("Message", "")
        if code == "ValidationError" and "does not exist" in message:
            return None
        raise


def handler(_event, _context):
    import boto3

    config = _config(dict(os.environ))
    cloudformation = boto3.client("cloudformation", region_name=str(config["region"]))
    events = boto3.client("events", region_name=str(config["region"]))
    stacks = {key: _describe(cloudformation, name) for key, name in STACK_NAMES.items()}
    states = {
        key: "absent" if value is None else _evaluate_stack(value, STACK_NAMES[key], config)
        for key, value in stacks.items()
    }

    if int(time.time()) < int(config["expires"]):
        state = "wait"
    elif states["runtime"] == "ready":
        cloudformation.delete_stack(
            StackName=str(stacks["runtime"]["StackId"]),
            ClientRequestToken=f"expiry-{config['session_id']}-runtime",
        )
        state = "delete-runtime"
    elif states["runtime"] == "deleting":
        state = "wait-runtime"
    elif states["database"] == "ready":
        cloudformation.delete_stack(
            StackName=str(stacks["database"]["StackId"]),
            ClientRequestToken=f"expiry-{config['session_id']}-database",
        )
        state = "delete-database"
    elif states["database"] == "deleting":
        state = "wait-database"
    else:
        events.disable_rule(Name=str(config["rule_name"]))
        state = "cleanup-verified-stacks-absent"

    print(json.dumps({"state": state, "sessionId": config["session_id"], "stacks": states}))
    return {"state": state}
