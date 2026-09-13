import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local-disk storage for the two images the school uploads: student
 * photographs and the school's logo.
 *
 * Deliberately not object storage. The whole system already runs on one Linux
 * box with a volume, the total volume is a few hundred megabytes for a school
 * of eight hundred, and a second service is a second thing that can be down
 * when a clerk is trying to print a certificate. The path is a single
 * environment variable, so moving to a bucket later is one adapter, not a
 * rewrite.
 *
 * Files are namespaced by school. A path traversal here would let one school
 * read another's photographs, so the only caller-supplied part of the filename
 * is validated to a strict pattern and never joined raw.
 */
export const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

/** 2MB. A phone photo is 3-6MB; we downscale before this point. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageKind = "student-photo" | "school-logo";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** Magic-number check. A file is what its bytes say, not what its name or its
 *  Content-Type header claims — both are attacker-controlled. */
export function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  return null;
}

/** Stored paths look like `student-photo/<schoolId>/<uuid>.jpg`. */
const STORED_PATH = /^(student-photo|school-logo)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export function isStoredPath(p: string): boolean {
  return STORED_PATH.test(p);
}

export async function saveImage(
  kind: ImageKind,
  schoolId: string,
  bytes: Buffer,
): Promise<{ storedPath: string; contentType: string; bytes: number }> {
  if (bytes.length === 0) throw new UploadError("The file is empty.");
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new UploadError(
      `Image is ${(bytes.length / 1024 / 1024).toFixed(1)}MB; the limit is ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`,
    );
  }

  const contentType = sniffImageType(bytes);
  if (!contentType) {
    throw new UploadError("That file is not a JPEG, PNG or WebP image.");
  }

  const ext = ALLOWED[contentType];
  const dir = path.join(UPLOAD_ROOT, kind, schoolId);
  await mkdir(dir, { recursive: true });

  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), bytes);

  return { storedPath: `${kind}/${schoolId}/${name}`, contentType, bytes: bytes.length };
}

export async function readImage(
  storedPath: string,
  schoolId: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  // Two independent checks: the shape must be exactly what we write, and the
  // school segment must match the caller's own tenant.
  if (!isStoredPath(storedPath)) return null;
  const [, pathSchoolId] = storedPath.split("/");
  if (pathSchoolId !== schoolId) return null;

  try {
    const bytes = await readFile(path.join(UPLOAD_ROOT, storedPath));
    const contentType = sniffImageType(bytes);
    return contentType ? { bytes, contentType } : null;
  } catch {
    return null;
  }
}

/** Removes a file if it is still there. A missing file is not an error —
 *  replacing a photo should not fail because a backup restore lost the old one. */
export async function deleteImage(storedPath: string, schoolId: string): Promise<void> {
  if (!isStoredPath(storedPath)) return;
  const [, pathSchoolId] = storedPath.split("/");
  if (pathSchoolId !== schoolId) return;
  await unlink(path.join(UPLOAD_ROOT, storedPath)).catch(() => undefined);
}

/** For embedding in a PDF: Chromium never reads our filesystem. */
export async function imageDataUri(
  storedPath: string | null | undefined,
  schoolId: string,
): Promise<string | null> {
  if (!storedPath) return null;
  const file = await readImage(storedPath, schoolId);
  if (!file) return null;
  return `data:${file.contentType};base64,${file.bytes.toString("base64")}`;
}

/** Stable identifier for cache-busting a replaced image at the same URL. */
export function imageEtag(bytes: Buffer): string {
  return `"${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}"`;
}
