import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertPublicHttpUrl, UnsafeUrlError } from "../src/sources/url-guard.js";

const rejects = async (url: string) => {
  await assert.rejects(() => assertPublicHttpUrl(url), UnsafeUrlError, `${url} should be rejected`);
};

describe("assertPublicHttpUrl", () => {
  it("rejects non-http schemes", async () => {
    await rejects("file:///etc/passwd");
    await rejects("ftp://example.com/x");
    await rejects("javascript:alert(1)");
  });

  it("rejects loopback and link-local hosts", async () => {
    await rejects("http://localhost:3000/");
    await rejects("http://127.0.0.1/");
    await rejects("http://[::1]/");
    // The cloud metadata endpoint is the one that actually matters.
    await rejects("http://169.254.169.254/latest/meta-data/");
  });

  it("rejects private network ranges", async () => {
    await rejects("http://10.0.0.5/");
    await rejects("http://192.168.1.1/");
    await rejects("http://172.16.0.1/");
    await rejects("http://172.31.255.254/");
  });

  it("rejects IPv4-mapped IPv6 loopback", async () => {
    await rejects("http://[::ffff:127.0.0.1]/");
  });

  it("rejects malformed input", async () => {
    await rejects("not a url");
    await rejects("");
  });

  it("allows a public IP literal", async () => {
    const url = await assertPublicHttpUrl("https://93.184.216.34/some/page");
    assert.equal(url.hostname, "93.184.216.34");
  });

  it("allows a public hostname that resolves", async () => {
    const url = await assertPublicHttpUrl("https://example.com/recipes/chili");
    assert.equal(url.hostname, "example.com");
    assert.equal(url.pathname, "/recipes/chili");
  });

  it("allows a host outside the private 172.16/12 block", async () => {
    const url = await assertPublicHttpUrl("http://172.32.0.1/");
    assert.equal(url.hostname, "172.32.0.1");
  });
});
