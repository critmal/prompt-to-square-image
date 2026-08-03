# Prompt to Square Image

A small, dependency-free Node.js web app that:

1. accepts a text prompt,
2. generates a **1024 × 1024** PNG through the OpenAI Image API,
3. lets you download the PNG, and
4. opens a **square print page** so the browser can save a square PDF.

The OpenAI API key stays on the Node.js server. It is never included in browser JavaScript or committed to GitHub.

## Security first

The API key previously pasted into chat should be treated as compromised. Revoke it in the OpenAI dashboard and create a new key before running this project.

## Run locally

Requirement: Node.js 20 or newer. No package installation is required.

```bash
git clone https://github.com/critmal/prompt-to-square-image.git
cd prompt-to-square-image
```

Copy the environment template:

### Windows Command Prompt

```bat
copy .env.example .env
```

### PowerShell, macOS, or Linux

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder:

```env
OPENAI_API_KEY=your_new_api_key_here
OPENAI_IMAGE_MODEL=gpt-image-1
PORT=3000
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Save a square PDF

1. Generate an image.
2. Choose 4 × 4, 5 × 5, 6 × 6, or 8 × 8 inches.
3. Select **Print square / Save PDF**.
4. In the print dialog, choose **Save as PDF**.
5. Use 100% scale and disable browser headers and footers.

The print page uses CSS `@page` with equal width and height, so Chromium-based browsers produce a square PDF page instead of an A4 page.

## Notes

- Generation is fixed to the square `1024x1024` API size.
- The default model is `gpt-image-1`; change `OPENAI_IMAGE_MODEL` in `.env` if your OpenAI project has access to another GPT Image model.
- Some GPT Image models may require organization verification.
- API usage is billed to the OpenAI project associated with your key.
