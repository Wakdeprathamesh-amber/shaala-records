/**
 * Downscales an image in the browser before it is uploaded.
 *
 * Two reasons, and the second is the important one:
 *
 * 1. A phone photo is 3-6MB and the server caps uploads at 2MB, so without
 *    this a clerk photographing a student is simply told "too large" with no
 *    way forward.
 * 2. The school is on a rural connection. Uploading 6MB so the server can
 *    throw away 98% of it is the wrong shape — a photograph printed at 24mm
 *    x 30mm needs about 283 x 354 pixels at 300dpi, and we keep roughly twice
 *    that so a future reprint at a larger size still looks right.
 *
 * Doing it client-side also avoids a native image dependency in the container,
 * which on ARM hosts is its own small adventure.
 *
 * The server still enforces its own cap and its own magic-number check. This
 * is a convenience, never a control — anything here can be bypassed.
 */

/** Roughly 2x what the 24mm x 30mm certificate box needs at 300dpi. */
export const MAX_PHOTO_EDGE = 800;

/** Logos print about 16mm tall but may be wide. */
export const MAX_LOGO_EDGE = 1000;

export type Downscaled = { file: File; dataUrl: string; before: number; after: number };

/**
 * Returns the original untouched when it is already small enough, so a
 * carefully prepared logo is not silently re-encoded and softened.
 */
export async function downscaleImage(
  file: File,
  maxEdge: number,
  quality = 0.85,
): Promise<Downscaled> {
  const dataUrl = await readAsDataUrl(file);

  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));

  // Already small enough and already a reasonable size on disk: leave it be.
  if (scale === 1 && file.size <= 400 * 1024) {
    return { file, dataUrl, before: file.size, after: file.size };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return { file, dataUrl, before: file.size, after: file.size };
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // PNG for anything with transparency — a logo on a transparent background
  // re-encoded as JPEG gains a black box.
  const hasAlpha = file.type === "image/png" || file.type === "image/webp";
  const type = hasAlpha && (await isTransparent(ctx, canvas)) ? "image/png" : "image/jpeg";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
  if (!blob || blob.size >= file.size) {
    // Re-encoding made it bigger — keep the original.
    return { file, dataUrl, before: file.size, after: file.size };
  }

  const ext = type === "image/png" ? "png" : "jpg";
  const out = new File([blob], `${baseName(file.name)}.${ext}`, { type });
  return {
    file: out,
    dataUrl: canvas.toDataURL(type, quality),
    before: file.size,
    after: out.size,
  };
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "").slice(0, 40) || "image";
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file is not an image we can read."));
    img.src = src;
  });
}

/** Samples the alpha channel rather than reading every pixel of a large image. */
async function isTransparent(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
): Promise<boolean> {
  try {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4 * 97) {
      if (data[i] < 250) return true;
    }
    return false;
  } catch {
    // A tainted canvas cannot be read; assume transparency and keep PNG.
    return true;
  }
}

export function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}
