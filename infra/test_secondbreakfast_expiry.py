import importlib.util
import os
import pathlib
import sys
import types
import unittest
from unittest.mock import patch


PATH = pathlib.Path(__file__).with_name("secondbreakfast-expiry-handler.py")
SPEC = importlib.util.spec_from_file_location("secondbreakfast_expiry", PATH)
expiry = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(expiry)


class ExpiryTests(unittest.TestCase):
    def setUp(self):
        self.environment = {
            "SESSION_ID": "sb-0123456789abcdef0123456789abcdef",
            "CREATED_AT_EPOCH": "1000",
            "EXPIRES_AT_EPOCH": "8200",
            "EXPECTED_ACCOUNT": "051722405355",
            "EXPECTED_REGION": "us-east-2",
            "RULE_NAME": "secondbreakfast-expiry-sb-0123456789abcdef0123456789abcdef",
        }
        self.config = expiry._config(self.environment)

    def stack(self, name="skaldandstone-development-secondbreakfast-runtime"):
        return {
            "StackId": f"arn:aws:cloudformation:us-east-2:051722405355:stack/{name}/uuid",
            "StackStatus": "CREATE_COMPLETE",
            "Tags": [
                {"Key": "SkaldAndStone:ManagedBy", "Value": "secondbreakfast-session-expiry-v1"},
                {"Key": "SkaldAndStone:SessionId", "Value": self.environment["SESSION_ID"]},
                {"Key": "SkaldAndStone:ExpiresAtEpoch", "Value": "8200"},
            ],
        }

    def test_accepts_exact_stable_runtime_and_database(self):
        self.assertEqual(expiry._evaluate_stack(self.stack(), expiry.STACK_NAMES["runtime"], self.config), "ready")
        database = self.stack(expiry.STACK_NAMES["database"])
        self.assertEqual(expiry._evaluate_stack(database, expiry.STACK_NAMES["database"], self.config), "ready")

    def test_accepts_existing_delete(self):
        stack = self.stack()
        stack["StackStatus"] = "DELETE_IN_PROGRESS"
        self.assertEqual(expiry._evaluate_stack(stack, expiry.STACK_NAMES["runtime"], self.config), "deleting")

    def test_rejects_excessive_lifetime(self):
        with self.assertRaises(RuntimeError):
            expiry._config(dict(self.environment, EXPIRES_AT_EPOCH="8201"))

    def test_rejects_wrong_identity_and_tags(self):
        wrong = self.stack()
        wrong["StackId"] = wrong["StackId"].replace("051722405355", "000000000000")
        with self.assertRaises(RuntimeError):
            expiry._evaluate_stack(wrong, expiry.STACK_NAMES["runtime"], self.config)
        wrong = self.stack()
        wrong["Tags"][1]["Value"] = "sb-ffffffffffffffffffffffffffffffff"
        with self.assertRaises(RuntimeError):
            expiry._evaluate_stack(wrong, expiry.STACK_NAMES["runtime"], self.config)

    def test_rejects_unstable_or_unknown_stack(self):
        for status in ("UPDATE_IN_PROGRESS", "UPDATE_ROLLBACK_COMPLETE", "CREATE_FAILED"):
            with self.subTest(status=status):
                stack = self.stack()
                stack["StackStatus"] = status
                with self.assertRaises(RuntimeError):
                    expiry._evaluate_stack(stack, expiry.STACK_NAMES["runtime"], self.config)
        with self.assertRaises(RuntimeError):
            expiry._evaluate_stack(self.stack(), "some-other-stack", self.config)

    def run_handler(self, runtime, database, now=8200):
        class CloudFormation:
            def __init__(self):
                self.deleted = []

            def describe_stacks(inner, StackName):
                stack = runtime if StackName == expiry.STACK_NAMES["runtime"] else database
                return {"Stacks": [stack]}

            def delete_stack(inner, **kwargs):
                inner.deleted.append(kwargs)

        class Events:
            def __init__(self):
                self.disabled = []

            def disable_rule(inner, **kwargs):
                inner.disabled.append(kwargs)

        cloudformation = CloudFormation()
        events = Events()
        boto3 = types.SimpleNamespace(
            client=lambda service, region_name=None: cloudformation if service == "cloudformation" else events
        )
        with patch.dict(sys.modules, {"boto3": boto3}), patch.dict(os.environ, self.environment, clear=True), patch.object(expiry.time, "time", return_value=now):
            result = expiry.handler({}, None)
        return result, cloudformation, events

    def test_handler_deletes_runtime_before_database(self):
        result, cloudformation, events = self.run_handler(
            self.stack(), self.stack(expiry.STACK_NAMES["database"])
        )
        self.assertEqual(result["state"], "delete-runtime")
        self.assertIn("secondbreakfast-runtime", cloudformation.deleted[0]["StackName"])
        self.assertEqual(events.disabled, [])

    def test_handler_deletes_database_after_runtime_is_absent(self):
        with patch.object(expiry, "_describe", side_effect=[None, self.stack(expiry.STACK_NAMES["database"])]):
            result, cloudformation, events = self.run_handler(None, None)
        self.assertEqual(result["state"], "delete-database")
        self.assertIn("secondbreakfast-database", cloudformation.deleted[0]["StackName"])
        self.assertEqual(events.disabled, [])

    def test_handler_disables_schedule_only_after_both_are_absent(self):
        with patch.object(expiry, "_describe", side_effect=[None, None]):
            result, cloudformation, events = self.run_handler(None, None)
        self.assertEqual(result["state"], "cleanup-verified-stacks-absent")
        self.assertEqual(cloudformation.deleted, [])
        self.assertEqual(events.disabled, [{"Name": self.environment["RULE_NAME"]}])


if __name__ == "__main__":
    unittest.main()
