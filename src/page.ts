import { Link } from "./store";

// Escape anything that goes into HTML. A short link's target is attacker-
// controlled text, so this is what stops a stored-XSS in the link list.
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPage(links: Link[], version: string, servedBy: string, host: string): string {
  const rows = links
    .map(
      (l) =>
        `    <li><a href="/${esc(l.code)}">${esc(host)}/${esc(l.code)}</a> &rarr; ` +
        `<span class="target">${esc(l.target)}</span> &middot; <span class="hits">${l.hits}</span></li>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>shortly</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <main class="card">
    <h1>shortly</h1>
    <p class="tagline">Short links for campaigns.</p>
    <form method="post" action="/links">
      <input type="url" name="url" placeholder="https://example.com/a/very/long/link" required autofocus>
      <button type="submit">Shorten</button>
    </form>
    <ul class="links">
${rows}
    </ul>
    <footer>shortly ${esc(version)} &middot; served by container ${esc(servedBy)}</footer>
  </main>
</body>
</html>
`;
}
