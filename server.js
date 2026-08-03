import "dotenv/config";
import express from "express";

const app = express();
const port = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(express.static("public", {
  extensions: ["html"],
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
}));

app.post("/api/generate", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const allowedQualities = new Set(["low", "medium", "high", "auto"]);
  const quality = allowedQualities.has(req.body?.quality) ? req.body.quality : "medium";

  if (!prompt) {
    return res.status(400).json({ error: "Please enter an image prompt." });
  }

  if (prompt.length > 3000) {
    return res.status(400).json({ error: "Keep the prompt under 3,000 characters." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is missing. Add it to your local .env file and restart the server.",
    });
  }

  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
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

      return res.status(openAIResponse.status >= 500 ? 502 : openAIResponse.status).json({
        error: message,
      });
    }

    const base64Image = payload?.data?.[0]?.b64_json;

    if (!base64Image) {
      return res.status(502).json({
        error: "OpenAI did not return image data.",
      });
    }

    return res.json({
      image: `data:image/png;base64,${base64Image}`,
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      size: "1024x1024",
    });
  } catch (error) {
    console.error("Image generation failed:", error);
    return res.status(502).json({
      error: "Could not reach OpenAI. Check your internet connection and try again.",
    });
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(port, () => {
  console.log(`Square image generator running at http://localhost:${port}`);
});
