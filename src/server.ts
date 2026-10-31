import { join } from "node:path";
import { createApp } from "./app";
import { VERSION } from "./version";

// Entry point. Everything configurable comes from the environment:
//   PORT         the port to listen on (default 3000)
//   DATA_DIR     where links.json lives (default ./data)
//   ADMIN_TOKEN  the bearer token for /api/admin/stats (given at run time)
const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.DATA_DIR ?? join(process.cwd(), "data");

createApp().listen(port, "0.0.0.0", () => {
  console.log(`shortly ${VERSION} listening on port ${port} (data: ${dataDir})`);
});
