import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@seconds/core/format";
import { actionFailure, signInReturnHref } from "./action-failure";

test("expired sessions get a recoverable, non-blaming message", () => {
  assert.deepEqual(actionFailure(new ApiError("Sign in to do that.", 401), "Failed."), {
    message: "Your sign-in may have ended. Sign in again, then retry this action.",
    signInRequired: true,
  });
});

test("useful domain errors survive and unknown failures use the local fallback", () => {
  assert.deepEqual(actionFailure(new Error("That pantry review did not save."), "Failed."), {
    message: "That pantry review did not save.",
    signInRequired: false,
  });
  assert.deepEqual(actionFailure(null, "Please try again."), {
    message: "Please try again.",
    signInRequired: false,
  });
});

test("sign-in return paths stay on this app", () => {
  assert.equal(signInReturnHref("/list"), "/sign-in?redirect_url=%2Flist");
  assert.equal(signInReturnHref("https://evil.example"), "/sign-in?redirect_url=%2F");
  assert.equal(signInReturnHref("//evil.example"), "/sign-in?redirect_url=%2F");
  assert.equal(signInReturnHref("/list\r\nLocation: https://evil.example"), "/sign-in?redirect_url=%2F");
});
