# Prompt to Square Thermal Image

A small, dependency-free Node.js web app that:

1. accepts a text prompt,
2. instructs the OpenAI Image API to create **high-contrast black-and-white artwork for ESC/POS thermal printing**,
3. converts the result in the browser to a true two-colour black-and-white `1024 × 1024` PNG,
4. lets you download that thermal-ready PNG, and
5. keeps the **Print square / Save PDF** option for users who do not currently have a printer.

The OpenAI API key stays in a server-side environment variable. It is never included in browser JavaScript or committed to GitHub.

## Thermal mode

Thermal mode is always enabled. Before generation, the server adds instructions requiring:

- pure black and pure white artwork,
- a white background,
- high contrast,
- bold clean outlines,
- large simple shapes,
- no colour, gradients, soft shadows, subtle shading, or complex textures,
- no thin lines, tiny text, or fine details that may disappear on receipt paper.

Because an image model can still occasionally produce gray or coloured pixels, the browser applies a final threshold conversion. The downloadable and printable output contains only black and white pixels, which is more suitable for later conversion into an ESC/POS raster bitmap.

## Deploy on Vercel

1. Import `critmal/prompt-to-square-image` from GitHub into Vercel.
2. Choose **Other** as the Framework Preset if Vercel does not select it automatically.
3. Do not set a custom build command. The frontend is served from `public/` and the backend function is `api/generate.js`.
4. Add these Environment Variables for Production, Preview, and Development:

```env
OPENAI_API_KEY=your_new_api_key_here
OPENAI_IMAGE_MODEL=gpt-image-1
```

5. Deploy. If the repository is already connected, Vercel should create a new deployment after the GitHub commits. If it does not, select **Redeploy** from the Vercel dashboard.

The Vercel function is configured for a maximum duration of 300 seconds. The API initially returns a compressed JPEG to stay below Vercel's function response-size limit; the browser then converts it to the final black-and-white PNG.

## Security first

The API key previously pasted into chat should be treated as compromised. Revoke it in the OpenAI dashboard and create a new key before deploying this project.

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

The print page uses CSS `@page` with equal width and height, so Chromium-based browsers can produce a square PDF page instead of an A4 page.

## Notes

- Generation is fixed to the square `1024x1024` API size.
- The final downloadable file is a true black-and-white PNG.
- The current app prepares the image for ESC/POS printing, but direct USB/Bluetooth/network printer communication is not implemented yet.
- The default model is `gpt-image-1`; change `OPENAI_IMAGE_MODEL` if your OpenAI project uses another compatible GPT Image model.
- API usage is billed to the OpenAI project associated with your key.
