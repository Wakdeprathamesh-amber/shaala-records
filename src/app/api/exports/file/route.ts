import { NextResponse } from "next/server";

import { requireCtx } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/tenant";
import { loadTemplate, listTemplates } from "@/domain/exports/mapper";
import { recordRun, rowsForExport } from "@/domain/exports/repo";
import { summarise, validateForExport } from "@/domain/exports/validate";
import { writeWorkbook } from "@/domain/exports/workbook";

/**
 * Generates the government workbook.
 *
 * Re-validates server-side before writing anything. The UI hides the button
 * when errors remain, but a hidden button is not a control — a stale tab or a
 * typed URL must not be able to produce a file the portal will reject.
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
  const template = loadTemplate(url.searchParams.get("template") ?? listTemplates()[0].id);

  const rows = await rowsForExport(ctx);
  const summary = summarise(validateForExport(rows, template));

  if (summary.blocked) {
    return NextResponse.json(
      {
        error: "Export blocked by validation errors",
        errorCount: summary.errorCount,
        affectedStudents: summary.affectedStudents,
      },
      { status: 409 },
    );
  }

  const buffer = await writeWorkbook(rows, template);

  await recordRun(ctx, {
    target: "udise",
    templateVersion: template.id,
    validationSummaryJson: {
      students: rows.length,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
    },
  });

  const filename = `${template.id}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
