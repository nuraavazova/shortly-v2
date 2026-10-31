import { createServer, Server } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Store } from "./store";
import { renderPage } from "./page";
import { VERSION, SERVED_BY } from "./version";

export interface AppOptions {
  dataDir?: string;
  adminToken?: string;
  publicDir?: string;
}

// Build the HTTP server but do NOT listen — server.ts (and the tests) decide
// the port. Keeping this separate is what lets the tests run it on a random
// port without touching the network config.
export function createApp(opts: AppOptions = {}): Server {
  const dataDir = opts.dataDir ?? process.env.DATA_DIR ?? join(process.cwd(), "data");
  const adminToken = opts.adminToken ?? process.env.ADMIN_TOKEN ?? "";
  const publicDir = opts.publicDir ?? join(__dirname, "..", "public");
  const store = new Store(dataDir);

  return createServer((req, res) => {
    const started = Date.now();
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname;

    const log = (status: number) =>
      console.log(`${new Date().toISOString()} ${req.method} ${path} ${status} ${Date.now() - started}ms`);
    const send = (status: number, type: string, body: string | Buffer) => {
      res.writeHead(status, { "Content-Type": type });
      res.end(body);
      log(status);
    };
    const json = (status: number, obj: unknown) => send(status, "application/json", JSON.stringify(obj));
    const redirect = (status: number, location: string) => {
      res.writeHead(status, { Location: location });
      res.end();
      log(status);
    };

    // Static stylesheet (served from disk so the "deface" demo shows up live).
    if (req.method === "GET" && path === "/style.css") {
      try {
        send(200, "text/css; charset=utf-8", readFileSync(join(publicDir, "style.css")));
      } catch {
        send(404, "text/plain; charset=utf-8", "not found");
      }
      return;
    }

    // Health: 200 only if we can write data; 503 otherwise.
    if (req.method === "GET" && path === "/healthz") {
      if (store.writable()) json(200, { status: "ok" });
      else json(503, { status: "degraded", reason: "data directory not writable" });
      return;
    }

    // Admin stats — requires the bearer token given at run time.
    if (req.method === "GET" && path === "/api/admin/stats") {
      const auth = (req.headers["authorization"] ?? "") as string;
      if (adminToken === "" || auth !== `Bearer ${adminToken}`) {
        json(401, { error: "unauthorized" });
        return;
      }
      const c = store.counts();
      json(200, { links: c.links, totalHits: c.totalHits, version: VERSION, servedBy: SERVED_BY });
      return;
    }

    // Create a short link. JSON -> 201 (the API/tests); a browser form -> 303.
    if (req.method === "POST" && path === "/links") {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 1_000_000) req.destroy();
      });
      req.on("end", () => {
        const ct = ((req.headers["content-type"] ?? "") as string).toLowerCase();
        const accept = ((req.headers["accept"] ?? "") as string).toLowerCase();
        const wantsJson = ct.includes("application/json") || accept.includes("application/json");
        let target = "";
        if (ct.includes("application/json")) {
          try {
            target = String(JSON.parse(raw || "{}").url ?? "").trim();
          } catch {
            /* leave target empty -> invalid below */
          }
        } else {
          target = (new URLSearchParams(raw).get("url") ?? "").trim();
        }
        if (!/^https?:\/\//i.test(target)) {
          if (wantsJson) json(400, { error: "invalid url" });
          else redirect(303, "/");
          return;
        }
        const link = store.add(target);
        if (wantsJson) json(201, { code: link.code, target: link.target });
        else redirect(303, "/");
      });
      return;
    }

    // Home page.
    if (req.method === "GET" && path === "/") {
      send(200, "text/html; charset=utf-8", renderPage(store.list(), VERSION, SERVED_BY, req.headers.host ?? ""));
      return;
    }

    // Follow a short code.
    if (req.method === "GET" && /^\/[A-Za-z0-9]+$/.test(path)) {
      const link = store.hit(path.slice(1));
      if (link) {
        redirect(302, link.target);
        return;
      }
    }

    send(404, "text/plain; charset=utf-8", "not found");
  });
}
