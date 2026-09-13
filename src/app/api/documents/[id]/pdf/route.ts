import { NextResponse } from "next/server";

import { requireCtx } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/tenant";
import { byId } from "@/domain/documents/repo";
import { renderDocumentPdf } from "@/domain/documents/render";
import type { DocumentPayload } from "@/domain/documents/issue";

/**
 * Downloads an issued document as PDF.
 *
 * A Route Handler rather than a Server Action because it returns a file.
 * Rendered on demand from the stored snapshot, so this is reproducible years
 * later and there is no file store to back up or lose.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const { id } = await params;
  const doc = await byId(ctx, id);

  // Scoped lookup: another school's document is indistinguishable from one
  // that does not exist.
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const suppressHeader = url.searchParams.get("plain") === "1";
  const bilingual = url.searchParams.get("lang") === "bi";

  const payload = doc.payloadJson as DocumentPayload;
  const pdf = await renderDocumentPdf(payload, {
    format: format === "A4" || format === "A5" ? format : undefined,
    suppressHeader,
    bilingual,
  });

  const name = [
    payload.docType,
    payload.grNumber,
    `sr${payload.serialNo}`,
    bilingual ? "bilingual" : null,
    payload.isDuplicate ? "duplicate" : null,
  ]
    .filter(Boolean)
    .join("-");

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline so the clerk previews before committing paper to the printer
      "Content-Disposition": `inline; filename="${name}.pdf"`,
      "Content-Length": String(pdf.length),
      // A certificate is a legal record; never let a proxy keep a copy.
      "Cache-Control": "private, no-store",
    },
  });
}
