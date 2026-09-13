import { NextResponse } from "next/server";

import { requireCtx } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/tenant";
import { imageEtag, readImage } from "@/lib/uploads/store";

/**
 * Serves an uploaded image.
 *
 * Behind the session gate, and scoped: readImage refuses a path whose school
 * segment is not the caller's own, so one school cannot fetch another's
 * student photographs by guessing a URL. Children's photographs are exactly
 * the thing that must not sit on a public path.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  let ctx;
  try {
    ctx = await requireCtx();
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const { path } = await params;
  const file = await readImage(path.join("/"), ctx.schoolId);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const etag = imageEtag(file.bytes);
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.bytes.length),
      ETag: etag,
      // private: a shared proxy must never hold a child's photograph.
      // The filename is a uuid that changes on replace, so a long max-age is
      // safe and keeps a class list of forty photos off the disk each time.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
