"use strict";

// Tests for shortly. They run against the COMPILED app in ../dist, so the
// Dockerfile builds first (npm run build) and then tests (npm test).
// Uses node's built-in test runner — no test framework to install.
// (Slides' break-it demo: line 39 is the `assert.equal(res.status, 201)`.)
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createApp } = require("../dist/app.js");

const TOKEN = "test-token-123";
let server;
let base;
let dataDir;

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "shortly-test-"));
  server = createApp({ dataDir, adminToken: TOKEN });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  rmSync(dataDir, { recursive: true, force: true });
});

async function req(method, path, opts = {}) {
  const res = await fetch(base + path, { method, body: opts.body, headers: opts.headers, redirect: "manual" });
  return { status: res.status, text: await res.text(), location: res.headers.get("location") };
}

test("POST /links (JSON) creates a link and returns 201", async () => {
  const body = JSON.stringify({ url: "https://example.com/spring-sale" });
  const res = await req("POST", "/links", { headers: { "content-type": "application/json" }, body });
  assert.equal(res.status, 201);
  const created = JSON.parse(res.text);
  assert.match(created.code, /^[A-Za-z0-9]{6}$/);
});

test("GET /healthz is ok when the data dir is writable", async () => {
  const res = await req("GET", "/healthz");
  assert.equal(res.status, 200);
  assert.match(res.text, /ok/);
});

test("a short code redirects to its target", async () => {
  const body = JSON.stringify({ url: "https://example.com/another" });
  const made = await req("POST", "/links", { headers: { "content-type": "application/json" }, body });
  const { code } = JSON.parse(made.text);
  const res = await req("GET", "/" + code);
  assert.equal(res.status, 302);
  assert.equal(res.location, "https://example.com/another");
});

test("admin stats with the right token returns counts", async () => {
  const res = await req("GET", "/api/admin/stats", { headers: { authorization: "Bearer " + TOKEN } });
  assert.equal(res.status, 200);
  const stats = JSON.parse(res.text);
  assert.ok(stats.links >= 1);
  assert.equal(typeof stats.totalHits, "number");
  assert.ok(String(stats.version).startsWith("v1.0.0"));
});

test("admin stats without a token is rejected", async () => {
  const res = await req("GET", "/api/admin/stats");
  assert.equal(res.status, 401);
  assert.match(res.text, /unauthorized/);
});

test("an unknown short code is a 404", async () => {
  const res = await req("GET", "/does-not-exist-xyz");
  assert.equal(res.status, 404);
});

test("a target with HTML is escaped on the page (no stored XSS)", async () => {
  const body = JSON.stringify({ url: "https://evil.example/<script>alert(1)</script>" });
  await req("POST", "/links", { headers: { "content-type": "application/json" }, body });
  const page = await req("GET", "/");
  assert.equal(page.status, 200);
  assert.ok(!page.text.includes("<script>alert(1)"));
  assert.ok(page.text.includes("&lt;script&gt;"));
});
