// Servidor estático mínimo para conferir dist/ localmente.
// Uso: node scripts/serve.mjs   ->  http://localhost:4173
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

http
  .createServer(async (req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = path.join(ROOT, url);
    // Impede escapar de dist/ com ../
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end("403");
      return;
    }
    try {
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, "index.html");
    } catch {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }).end("<h1>404</h1>");
      return;
    }
    try {
      const body = await fs.readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }).end("<h1>404</h1>");
    }
  })
  .listen(PORT, () => console.log(`dist/ em http://localhost:${PORT}`));
