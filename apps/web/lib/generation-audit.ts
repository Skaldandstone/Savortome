import type { GenerationAudit } from "@seconds/core";

/**
 * Server-only, content-free generation telemetry. Never log prompts, source
 * text, images, account data, API keys, or the generated answer itself.
 */
export function recordGenerationAudit(audit: GenerationAudit): void {
  console.info("savortome.generated_content", JSON.stringify(audit));
}
