import test from "node:test";
import assert from "node:assert/strict";
import { boundedBody, BodyTooLarge } from "../src/lib/request-body";

test("body limits count UTF-8 bytes and reject chunked overflow", async () => {
  const request = new Request("http://localhost", { method: "POST", body: "€€" });
  await assert.rejects(() => boundedBody(request, 5), BodyTooLarge);
  assert.equal(await boundedBody(new Request("http://localhost", { method: "POST", body: "abc" }), 3), "abc");
});

test("declared oversized bodies are rejected before reading", async () => {
  await assert.rejects(() => boundedBody(new Request("http://localhost", { method: "POST", headers: { "Content-Length": "500" }, body: "a" }), 10), BodyTooLarge);
});
