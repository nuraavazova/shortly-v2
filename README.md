# shortly

A tiny link shortener for campaigns. Paste a long URL, get a short `/code` that
redirects to it; an admin endpoint reports usage. Built for the DevSecOps course
(ticket **PLAT-482**).

Plain Node + TypeScript, **no runtime dependencies** — the only packages are the
TypeScript compiler and Node type definitions, used at build time.

## Run it locally

```bash
npm ci            # install from the lock file
npm run build     # compile TypeScript -> dist/
npm start         # node --env-file-if-exists=.env dist/server.js
# open http://localhost:3000
```

`npm test` runs the test suite with Node's built-in runner (`node --test`).

## Configuration

shortly is configured entirely through the environment (nothing secret is baked
into the code):

| Variable      | Default        | What it does                                             |
| ------------- | -------------- | -------------------------------------------------------- |
| `PORT`        | `3000`         | Port the server listens on.                              |
| `ADMIN_TOKEN` | *(none)*       | Bearer token for `GET /api/admin/stats`. Give it at run time (`--env-file`), never commit it. |
| `DATA_DIR`    | `./data`       | Where `links.json` is stored. Put this on a volume so links survive a redeploy. |
| `GIT_SHA`     | `dev`          | Stamped in at build time; shown in the footer and stats so you can tell which commit is live. |

Copy `.env.example` to `.env` for local runs.

## Endpoints

| Method | Path                  | Purpose                                                        |
| ------ | --------------------- | -------------------------------------------------------------- |
| `GET`  | `/`                   | The page: shorten a link, see your links.                      |
| `POST` | `/links`              | Create a link. Form post → redirects home; JSON body → `201`.  |
| `GET`  | `/:code`              | Redirect to the target (increments its hit count).             |
| `GET`  | `/api/admin/stats`    | `{links,totalHits,version,servedBy}` — requires the bearer token. |
| `GET`  | `/healthz`            | `200` when it can write data, `503` when it can't.             |

## Data

Links live in `DATA_DIR/links.json`. In a container, mount a volume at
`/app/data` so the campaign's links outlive any single container.
