import { createReadStream, statSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const portArgIndex = process.argv.findIndex((arg) => arg === "--port" || arg === "-p");
const port = Number(portArgIndex >= 0 ? process.argv[portArgIndex + 1] : process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".wasm", "application/wasm"]
]);

const headers = (type) => ({
  "Content-Type": type,
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Accept-Ranges": "bytes",
  "Cache-Control": "no-store"
});

const resolveRequestPath = async (urlPath) => {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0] || "/");
  const normalized = normalize(cleanPath === "/" ? "/test-sites/index.html" : cleanPath);
  const filePath = resolve(join(root, normalized));

  if (!filePath.startsWith(root + sep) && filePath !== root) {
    return null;
  }

  const info = await stat(filePath).catch(() => null);
  if (info?.isDirectory()) {
    return resolve(join(filePath, "index.html"));
  }
  return filePath;
};

const server = createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Type"
      });
      response.end();
      return;
    }

    const filePath = await resolveRequestPath(request.url || "/");
    if (!filePath) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const info = statSync(filePath, { throwIfNoEntry: false });
    if (!info?.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const rangeHeader = request.headers.range;
    if (rangeHeader) {
      const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
      if (!match) {
        response.writeHead(416, {
          ...headers(contentTypes.get(extname(filePath)) || "application/octet-stream"),
          "Content-Range": `bytes */${info.size}`
        });
        response.end();
        return;
      }

      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : info.size - 1;
      if (start >= info.size || end >= info.size || start > end) {
        response.writeHead(416, {
          ...headers(contentTypes.get(extname(filePath)) || "application/octet-stream"),
          "Content-Range": `bytes */${info.size}`
        });
        response.end();
        return;
      }

      response.writeHead(206, {
        ...headers(contentTypes.get(extname(filePath)) || "application/octet-stream"),
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${info.size}`
      });

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      createReadStream(filePath, { start, end }).pipe(response);
      return;
    }

    response.writeHead(200, {
      ...headers(contentTypes.get(extname(filePath)) || "application/octet-stream"),
      "Content-Length": info.size
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.stack : String(error));
  }
});

server.listen(port, host, () => {
  console.log(`RewriteLLM test server: http://${host}:${port}/test-sites/`);
  console.log(`Serving: ${root}`);
});
