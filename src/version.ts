import { hostname } from "node:os";

// The app version. When CI builds the image it passes the commit SHA in
// (--build-arg GIT_SHA=...), so the footer and the admin stats show exactly
// which commit is live. By hand, with no GIT_SHA, it reads "(dev)".
const BASE = "v1.0.0";
const sha = process.env.GIT_SHA && process.env.GIT_SHA !== "dev"
  ? process.env.GIT_SHA.slice(0, 7)
  : "dev";

export const VERSION = `${BASE} (${sha})`;

// Inside a container the hostname is the short container id by default — handy
// for "which box served me?" in the page footer and the admin stats.
export const SERVED_BY = hostname();
