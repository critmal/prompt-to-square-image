import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import generateHandler from "./api/generate.js";

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(projectDirectory, "public");

await loadLocalEnv();

const port = Number(process.env.PORT || 3000);
const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
]);

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);
  addVercelResponseHelpers(res);

  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/api/generate") {
      if (req.method === "POST") {
        try {
          req.body = await readJsonBody(req, 32 * 1024);
        } catch (error) {
          return res.status(error.statusCode || 400).json({
            error: error.message || "Invalid request body.",
          });
        }
      }

      return await generateHandler(req, res);
    }

    if (req.method === "GET" || req.method === "HEAD") {
      return await serveStatic(requestUrl.pathname, req.method === "HEAD", res);
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unexpected server error." });
  }
});

server.listen(port, () => {
  console.log(`Thermal square image generator running at http://localhost:${port}`);
});

async function serveStatic(pathname, isHeadRequest, res) {
  const relativePath =
    pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const normalizedPath = path.normalize(relativePath);

  if (normalizedPath.startsWith("..") || path.isAbsolute(normalizedPath)) {
    return res.status(403).json({ error: "Forbidden." });
  }

  const filePath = path.join(publicDirectory, normalizedPath);

  try {
    const file = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();

    res.writeHead(200, {
      "Content-Type": contentTypes.get(extension) || "application/octet-stream",
      "Cache-Control": process.env.NODE_ENV === "production" ? "public, max-age=3600" : "no-cache",
    });

    return res.end(isHeadRequest ? undefined : file);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      return res.status(404).json({ error: "Not found." });
    }

    throw error;
  }
}

function addVercelResponseHelpers(res) {
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };

  res.json = (payload) => {
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }

    res.end(JSON.stringify(payload));
    return res;
  };
}

function readJsonBody(req, maximumBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let receivedBytes = 0;
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) return;

      receivedBytes += chunk.length;
      if (receivedBytes > maximumBytes) {
        settled = true;
        const error = new Error("Request body is too large.");
        error.statusCode = 413;
        reject(error);
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;

      try {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        settled = true;
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch {
        settled = true;
        const error = new Error("Request body must be valid JSON.");
        error.statusCode = 400;
        reject(error);
      }
    });

    req.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'"
  );
}

async function loadLocalEnv() {
  try {
    const contents = await readFile(path.join(projectDirectory, ".env"), "utf8");

    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator < 1) continue;

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
