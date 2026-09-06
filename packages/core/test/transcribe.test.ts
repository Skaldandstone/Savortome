import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asrConfigFromEnv, ffmpegBin, ytDlpBin } from "../src/sources/transcribe.js";

describe("ytDlpBin", () => {
  it("defaults to the bare command name", () => {
    assert.equal(ytDlpBin({}), "yt-dlp");
  });

  it("prefers an explicit path — winget installs it without adding it to PATH", () => {
    assert.equal(ytDlpBin({ YT_DLP_PATH: "C:\\tools\\yt-dlp.exe" }), "C:\\tools\\yt-dlp.exe");
  });
});

describe("ffmpegBin", () => {
  it("is null when unset, unlike yt-dlp there's no bare-command fallback", () => {
    assert.equal(ffmpegBin({}), null);
  });

  it("uses the explicit path when set", () => {
    assert.equal(ffmpegBin({ FFMPEG_PATH: "C:\\tools\\ffmpeg.exe" }), "C:\\tools\\ffmpeg.exe");
  });
});

describe("asrConfigFromEnv", () => {
  it("returns null when neither provider key is set", () => {
    assert.equal(asrConfigFromEnv({}), null);
  });

  it("prefers Deepgram when both keys are set", () => {
    const config = asrConfigFromEnv({ DEEPGRAM_API_KEY: "dg", GROQ_API_KEY: "gq" });
    assert.equal(config?.provider, "deepgram");
    assert.equal(config?.apiKey, "dg");
  });

  it("falls back to Groq when only its key is set", () => {
    const config = asrConfigFromEnv({ GROQ_API_KEY: "gq" });
    assert.equal(config?.provider, "groq");
  });

  it("defaults to a 20-minute cap on what gets transcribed", () => {
    const config = asrConfigFromEnv({ DEEPGRAM_API_KEY: "dg" });
    assert.equal(config?.maxDurationSeconds, 1200);
  });

  it("honors an explicit override", () => {
    const config = asrConfigFromEnv({ DEEPGRAM_API_KEY: "dg", MAX_TRANSCRIBE_SECONDS: "600" });
    assert.equal(config?.maxDurationSeconds, 600);
  });
});
