// Zero-dependency server for local use or any Node host (Render, Railway, Fly...).
// On Vercel the files in /api and /public are picked up automatically and this file is unused.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import config from "./api/config.js";
import token from "./api/token.js";

// Load .env if present (KEY=value lines).
try {
  const env = await readFile(new URL("./.env", import.meta.url), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const root = fileURLToPath(new URL("./public/", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
const routes = { "/api/config": config, "/api/token": token };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (routes[url.pathname]) {
    try { return await routes[url.pathname](req, res); }
    catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ error: e.message })); }
  }
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (p === "/" || p === "\\") p = "/index.html";
  try {
    const body = await readFile(join(root, p));
    res.setHeader("Content-Type", types[extname(p)] || "application/octet-stream");
    res.end(body);
  } catch {
    res.statusCode = 404; res.end("Not found");
  }
}).listen(process.env.PORT || 3000, () => console.log(`KOMfirmed on http://localhost:${process.env.PORT || 3000}`));
