/* Shared client-side image helpers.
   Photos travel to the server as base64 data URLs (same storage pattern as
   the existing maintenance/mess photo tables). The server enforces strict
   size limits, so images are compressed here first — small enough to send,
   large enough to look good, and persisted across refresh/re-login. */

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode this image"));
    img.src = src;
  });
}

function drawScaled(img: HTMLImageElement, scale: number, quality: number): string {
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export type CompressOptions = {
  /** Longest edge in pixels after resizing (default 1400). */
  maxDim?: number;
  /** Starting JPEG quality, lowered on each retry (default 0.8). */
  quality?: number;
  /** Maximum base64 length — must stay under the server's limits. */
  maxChars?: number;
};

export async function compressImage(file: File, options: CompressOptions = {}): Promise<string> {
  const { maxDim = 1400, quality: startQuality = 0.8, maxChars = 300000 } = options;

  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Image must be under 20 MB");
  }

  const original = await loadImage(await readFileAsDataURL(file));
  const longest = Math.max(original.width, original.height) || 1;
  let scale = Math.min(1, maxDim / longest);
  let quality = startQuality;

  for (let attempt = 0; attempt < 8; attempt++) {
    const out = drawScaled(original, scale, quality);
    if (out && out.length <= maxChars) return out;
    if (quality > 0.35) {
      quality = Math.max(0.35, quality - 0.12);
    } else {
      scale *= 0.7;
      quality = startQuality;
    }
  }

  throw new Error("Image is too large — please choose a smaller photo");
}