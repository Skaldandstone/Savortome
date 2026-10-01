# OpenAI receipt extraction, 2026-09-30

James selected OpenAI for receipt scanning. This source change replaces the
receipt extractor's Anthropic call with the official OpenAI Responses SDK and
strict structured output. The pinned model is `gpt-4.1-mini-2025-04-14` and the
prompt version is `savortome-receipt-extraction-v3`.

Requests use `store: false`, a 45-second timeout and no automatic SDK retries.
This disables stored Responses; it is not a claim of provider zero retention.
Only the receipt photo goes to the provider, not the user's pantry, dietary
profile or health information. Application storage/audits omit the image and
base64. Refused, incomplete, malformed and empty results fail safely. Accepted
food names and stated quantities still require explicit human review before
pantry confirmation. Audit metadata correctly identifies OpenAI.

## Server configuration and rollout

- Set server-only `OPENAI_API_KEY` and retain explicit `RECEIPT_SCAN_ENABLED=true`.
  An Anthropic key alone no longer enables this endpoint.
- The review infrastructure template accepts optional `OpenAISecretArn` for an
  account-local `dev/secondbreakfast/openai-*` secret containing JSON key
  `OPENAI_API_KEY`. Both task definitions use exact secret-key injection and the
  execution role grants access to only that ARN. The key never belongs in EAS,
  browser build arguments, public variables or Git.
- No secret, provider funding or cloud/runtime configuration was changed in this
  pass. Before release, configure the authorized secret via the established
  secure route, review the immutable image and privacy-v3 rollback, then exercise
  an authenticated receipt request and explicit review/confirmation. Existing
  installed mobile apps use the same unchanged API contract.
- Keep the prior deployed revision and its provider mapping intact until the new
  candidate is verified. A missing OpenAI key in the new candidate fails closed;
  deployment is not acceptance.

## Verification

- 692 core tests passed, including a real OpenAI SDK parser driven by a mocked
  fetch (no provider request), refusal/incomplete handling, invalid quantities,
  structured image format, provider audit and no photo in audit metadata.
- All four workspace TypeScript checks passed.
- Five receipt route checks passed, including authentication before body/model,
  rejection of old-provider/blank keys, review-only storage and camera permission.
- `cfn-lint infra/secondbreakfast-private-runtime.yaml` passed.
- Production web build passed (Next.js 15.5.25); this is compilation, not hosted provider acceptance.

Recipe import, open-web search, conditional pantry query and nutrition estimation
still have separate Anthropic implementations. This is a receipt migration, not
a claim that every generated feature has switched providers. No paid request,
receipt-device acceptance or deployment is claimed.

Official API references: [image inputs](https://developers.openai.com/api/docs/guides/images-vision),
[structured output](https://developers.openai.com/api/docs/guides/structured-outputs),
[model](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
