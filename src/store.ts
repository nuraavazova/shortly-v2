import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface Link {
  code: string;
  target: string;
  hits: number;
  created: string;
}

// A tiny JSON-file store. Everything lives in DATA_DIR/links.json so it can be
// kept in a Docker volume and survive a redeploy.
export class Store {
  private file: string;
  private links = new Map<string, Link>();

  constructor(private dataDir: string) {
    this.file = join(dataDir, "links.json");
    mkdirSync(dataDir, { recursive: true });
    this.load();
  }

  private load(): void {
    if (!existsSync(this.file)) return;
    try {
      const arr = JSON.parse(readFileSync(this.file, "utf8")) as Link[];
      for (const l of arr) this.links.set(l.code, l);
    } catch {
      // Corrupt or empty file: start clean rather than crash.
    }
  }

  private persist(): void {
    writeFileSync(this.file, JSON.stringify([...this.links.values()], null, 2));
  }

  list(): Link[] {
    return [...this.links.values()];
  }

  add(target: string): Link {
    const link: Link = { code: this.newCode(), target, hits: 0, created: new Date().toISOString() };
    this.links.set(link.code, link);
    this.persist();
    return link;
  }

  hit(code: string): Link | undefined {
    const link = this.links.get(code);
    if (link) {
      link.hits += 1;
      this.persist();
    }
    return link;
  }

  counts(): { links: number; totalHits: number } {
    let totalHits = 0;
    for (const l of this.links.values()) totalHits += l.hits;
    return { links: this.links.size, totalHits };
  }

  // Health = "can I actually do my job?" We prove the data dir is writable by
  // writing a probe file. On a --read-only container with no volume this fails,
  // and /healthz returns 503 (the container goes unhealthy).
  writable(): boolean {
    try {
      writeFileSync(join(this.dataDir, ".health"), String(Date.now()));
      return true;
    } catch {
      return false;
    }
  }

  private newCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let code: string;
    do {
      code = "";
      for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    } while (this.links.has(code));
    return code;
  }
}
