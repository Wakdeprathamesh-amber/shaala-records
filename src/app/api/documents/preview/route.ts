import { NextResponse } from "next/server";

import { requireCtx } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/tenant";
import { buildPreviewPayload } from "@/domain/documents/preview";
import { DOC_TYPES, type DocType } from "@/domain/documents/repo";
import { renderDocumentPdf } from "@/domain/documents/render";

/**
 * Renders what a document *would* look like, without issuing it.
 *
 * Crucially this allocates no serial. The clerk must be able to look at the
 * certificate before committing, and a preview that consumed a number would
 * leave gaps in the register every time someone changed their mind.
 */
export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await requireCtx();
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const url = new URL(request.url);
  const studentId = url.searchParams.get("student");
  const docType = url.searchParams.get("type");

  if (!studentId || !docType || !(DOC_TYPES as readonly string[]).includes(docType)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const payload = await buildPreviewPayload(ctx, {
    studentId,
    docType: docType as DocType,
    nocPurposeMr: url.searchParams.get("nocPurposeMr") ?? undefined,
    dateOfLeaving: url.searchParams.get("dateOfLeaving") ?? undefined,
    lastAttended: url.searchParams.get("lastAttended") ?? undefined,
    reasonMr: url.searchParams.get("reasonMr") ?? undefined,
    progress: url.searchParams.get("progress") ?? undefined,
    conduct: url.searchParams.get("conduct") ?? undefined,
    remarksMr: url.searchParams.get("remarksMr") ?? undefined,
    duesCleared: url.searchParams.get("duesCleared") !== "0",
    purpose: (url.searchParams.get("purpose") ?? undefined) as never,
  });

  if (!payload) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const pdf = await renderDocumentPdf(payload, {
    bilingual: url.searchParams.get("lang") === "bi",
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="preview.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
