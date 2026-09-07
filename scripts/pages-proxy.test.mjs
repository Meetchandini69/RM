import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/[[path]].js";

test("Pages proxy preserves sessions and rejects unsafe requests", async () => {
  const env = {
    API_ORIGIN: "https://example.up.railway.app",
    API_PROXY_SECRET: "test-secret-with-at-least-32-characters",
  };
  const originalFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url.origin, env.API_ORIGIN);
      assert.equal(url.pathname, "/api/registration/login");
      assert.equal(url.search, "?check=1");
      assert.equal(
        options.headers.get("x-api-proxy-secret"),
        env.API_PROXY_SECRET,
      );
      assert.equal(options.headers.get("x-client-ip"), "192.0.2.10");
      assert.equal(options.headers.get("cookie"), "ram_session=test");
      assert.equal(options.redirect, "manual");
      const body = await new Response(options.body).text();
      assert.equal(body, '{"test":true}');
      return new Response('{"ok":true}', {
        headers: {
          "Set-Cookie":
            "ram_session=new; Path=/api/registration; HttpOnly; Secure; SameSite=Strict",
          "Content-Type": "application/json",
        },
      });
    };
    const makeRequest = (origin = "https://example.pages.dev") =>
      new Request("https://example.pages.dev/api/registration/login?check=1", {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: "ram_session=test",
          "CF-Connecting-IP": "192.0.2.10",
          "x-api-proxy-secret": "forged",
          "x-client-ip": "forged",
        },
        body: '{"test":true}',
      });
    const response = await onRequest({ request: makeRequest(), env });
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("set-cookie").includes("HttpOnly"));
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(
      (
        await onRequest({
          request: makeRequest("https://untrusted.example"),
          env,
        })
      ).status,
      403,
    );
    assert.equal(
      (await onRequest({ request: makeRequest(), env: {} })).status,
      503,
    );
    assert.equal(
      (
        await onRequest({
          request: makeRequest(),
          env: { ...env, API_ORIGIN: "http://example.com" },
        })
      ).status,
      503,
    );
    assert.equal(calls, 1);
    globalThis.fetch = async () => {
      throw new Error("Network unavailable");
    };
    assert.equal(
      (await onRequest({ request: makeRequest(), env })).status,
      502,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
