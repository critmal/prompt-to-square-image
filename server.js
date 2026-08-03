import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

await loadLocalEnv();

const port = Number(process.env.PORT || 3000);
const publicDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "public"
);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
]);

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);

  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "POST" && requestUrl.pathname === "/api/generate") {
      return await handleGenerate(req, res);
    }

    if (req.method === "GET" || req.method === "HEAD") {
      return await serveStatic(requestUrl.pathname, req.method === "HEAD", res);
    }

    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: "Unexpected server error." });
  }
});

server.listen(port, () => {
  console.log(`Square image generator running at http://localhost:${port}`);
});

async function handleGenerate(req, res) {
  res.setHeader("Cache-Control", "no-store");

  let body;
  try {
    body = await readJsonBody(req, 32 * 1024);
  } catch (error) {
    return sendJson(res, error.statusCode || 400, {
      error: error.message || "Invalid request body.",
    });
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const allowedQualities = new Set(["low", "medium", "high", "auto"]);
  const quality = allowedQualities.has(body?.quality) ? body.quality : "medium";

  if (!prompt) {
    return sendJson(res, 400, { error: "Please enter an image prompt." });
  }

  if (prompt.length > 3000) {
    return sendJson(res, 400, { error: "Keep the prompt under 3,000 characters." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, {
      error: "OPENAI_API_KEY is missing. Add it to your local .env file and restart the server.",
    });
  }

  try {
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const openAIResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size: "1024x1024",
        quality,
        output_format: "png",
        n: 1,
      }),
    });

    const payload = await openAIResponse.json().catch(() => null);

    if (!openAIResponse.ok) {
      const message =
        payload?.error?.message ||
        `OpenAI returned HTTP ${openAIResponse.status}.`;

      return sendJson(
        res,
        openAIResponse.status >= 500 ? 502 : openAIResponse.status,
        { error: message }
      );
    }

    const base64Image = payload?.data?.[0]?.b64_json;

    if (!base64Image) {
      return sendJson(res, 502, {
        error: "OpenAI did not return image data.",
      });
    }

    return sendJson(res, 200, {
      image: `data:image/png;base64,${base64Image}`,
      model,
      size: "1024x1024",
    });
  } catch (error) {
    console.error("Image generation failed:", error);
    return sendJson(res, 502, {
      error: "Could not reach OpenAI. Check your internet connection and try again.",
    });
  }
}

async function serveStatic(pathname, isHeadRequest, res) {
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const normalizedPath = path.normalize(relativePath);

  if (normalizedPath.startsWith("..") || path.isAbsolute(normalizedPath)) {
    return sendJson(res, 403, { error: "Forbidden." });
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
      return sendJson(res, 404, { error: "Not found." });
    }

    throw error;
  }
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

function sendJson(res, statusCode, payload) {
  if (res.headersSent) return res.end();

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  return res.end(JSON.stringify(payload));
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
    const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), ".env");
    const contents = await readFile(envPath, "utf8");

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
