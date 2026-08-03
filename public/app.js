const form = document.querySelector("#generator-form");
const promptInput = document.querySelector("#prompt");
const qualityInput = document.querySelector("#quality");
const printSizeInput = document.querySelector("#print-size");
const generateButton = document.querySelector("#generate-button");
const downloadButton = document.querySelector("#download-button");
const printButton = document.querySelector("#print-button");
const resultImage = document.querySelector("#result-image");
const placeholder = document.querySelector("#placeholder");
const status = document.querySelector("#status");

let currentImage = "";
let currentFormat = "png";
let currentExtension = "png";

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const prompt = promptInput.value.trim();
  if (!prompt) {
    setStatus("Enter a prompt first.", true);
    promptInput.focus();
    return;
  }

  setLoading(true);
  setStatus("Generating high-contrast thermal artwork and converting it to true black and white.");

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        quality: qualityInput.value,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Generation failed with HTTP ${response.status}.`);
    }

    currentImage = await convertToThermalBitmap(data.image);
    currentFormat = "png";
    currentExtension = "png";
    resultImage.src = currentImage;
    resultImage.alt = `Thermal-printer-ready black-and-white image for: ${prompt}`;
    resultImage.hidden = false;
    placeholder.hidden = true;
    downloadButton.disabled = false;
    printButton.disabled = false;
    setStatus(
      `Done — true black-and-white ${data.size} PNG prepared from ${data.model} output.`
    );
  } catch (error) {
    setStatus(error.message || "Image generation failed.", true);
  } finally {
    setLoading(false);
  }
});

downloadButton.addEventListener("click", () => {
  if (!currentImage) return;

  const link = document.createElement("a");
  link.href = currentImage;
  link.download = `thermal-square-image-${Date.now()}.${currentExtension}`;
  document.body.append(link);
  link.click();
  link.remove();
});

printButton.addEventListener("click", () => {
  if (!currentImage) return;

  const sideInches = Number(printSizeInput.value);
  if (![4, 5, 6, 8].includes(sideInches)) {
    setStatus("Choose a valid square print size.", true);
    return;
  }

  const printWindow = window.open("", "_blank", "popup,width=900,height=900");

  if (!printWindow) {
    setStatus("The print window was blocked. Allow pop-ups for this site and try again.", true);
    return;
  }

  const safeTitle = `Thermal square image — ${sideInches} × ${sideInches} inches`;

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <style>
    @page {
      size: ${sideInches}in ${sideInches}in;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: ${sideInches}in;
      height: ${sideInches}in;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #fff;
    }

    img {
      display: block;
      width: ${sideInches}in;
      height: ${sideInches}in;
      object-fit: cover;
      image-rendering: crisp-edges;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  </style>
</head>
<body>
  <img src="${currentImage}" alt="Square black-and-white thermal artwork">
  <script>
    const image = document.querySelector("img");
    const printWhenReady = () => {
      window.focus();
      setTimeout(() => window.print(), 200);
    };

    if (image.complete) {
      printWhenReady();
    } else {
      image.addEventListener("load", printWhenReady, { once: true });
    }
  <\/script>
</body>
</html>`);
  printWindow.document.close();

  setStatus(
    `Opened a ${sideInches} × ${sideInches} inch black-and-white page. Choose “Save as PDF” in the print dialog.`
  );
});

async function convertToThermalBitmap(source) {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || 1024;
  canvas.height = image.naturalHeight || 1024;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Your browser could not prepare the thermal bitmap.");
  }

  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const threshold = 168;

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance =
      pixels[index] * 0.2126 +
      pixels[index + 1] * 0.7152 +
      pixels[index + 2] * 0.0722;
    const value = luminance < threshold ? 0 : 255;

    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
    pixels[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The generated image could not be processed."));
    image.src = source;
  });
}

function setLoading(isLoading) {
  generateButton.disabled = isLoading;
  generateButton.textContent = isLoading ? "Generating…" : "Generate thermal-ready image";
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}
