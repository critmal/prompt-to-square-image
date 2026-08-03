const ALLOWED_QUALITIES = new Set(["low", "medium", "high", "auto"]);
const MAX_PROMPT_LENGTH = 3000;
const MAX_RESPONSE_BYTES = 4_300_000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const body = parseBody(req.body);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const quality = ALLOWED_QUALITIES.has(body.quality) ? body.quality : "medium";

  if (!prompt) {
    return res.status(400).json({ error: "Please enter an image prompt." });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({
      error: `Keep the prompt under ${MAX_PROMPT_LENGTH.toLocaleString()} characters.`,
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is missing from the Vercel environment variables.",
    });
  }

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

  try {
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
        output_format: "jpeg",
        output_compression: 85,
        n: 1,
      }),
    });

    const payload = await openAIResponse.json().catch(() => null);

    if (!openAIResponse.ok) {
      const message =
        payload?.error?.message || `OpenAI returned HTTP ${openAIResponse.status}.`;

      return res
        .status(openAIResponse.status >= 500 ? 502 : openAIResponse.status)
        .json({ error: message });
    }

    const base64Image = payload?.data?.[0]?.b64_json;

    if (!base64Image) {
      return res.status(502).json({
        error: "OpenAI did not return image data.",
      });
    }

    const responseBytes = Buffer.byteLength(base64Image, "utf8") + 1024;
    if (responseBytes > MAX_RESPONSE_BYTES) {
      return res.status(502).json({
        error: "The generated image was too large to return through Vercel. Try medium or low quality.",
      });
    }

    return res.status(200).json({
      image: `data:image/jpeg;base64,${base64Image}`,
      model,
      size: "1024x1024",
      format: "jpeg",
      extension: "jpg",
    });
  } catch (error) {
    console.error("Image generation failed:", error);
    return res.status(502).json({
      error: "Could not reach OpenAI. Try again shortly.",
    });
  }
}

function parseBody(body) {
  if (body && typeof body === "object") {
    return body;
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }

  return {};
}
