import { NextResponse } from "next/server";

import { requireCtx } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/tenant";
import { printDocument, renderPdf } from "@/lib/pdf";
import { demographicCells } from "@/domain/reports/repo";
import { buildDemographicTable } from "@/domain/reports/pivot";
import { school as loadSchool } from "@/domain/settings/repo";
import { currentYearLabel } from "@/domain/exports/repo";
import { DEMOGRAPHIC_CSS, DemographicRegister } from "@/templates/demographic";

/** The demographic register as a landscape A4 PDF, in inspection format. */
export async function GET() {
  let ctx;
  try {
    ctx = await requireCtx();
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const [cells, school, yearLabel] = await Promise.all([
    demographicCells(ctx),
    loadSchool(ctx),
    currentYearLabel(ctx),
  ]);
  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  // Same deferred import as render.tsx: Next refuses a static react-dom/server
  // import in the app graph, and a route handler cannot use JSX in a .ts file.
  const [{ renderToStaticMarkup }, { createElement }] = await Promise.all([
    import("react-dom/server"),
    import("react"),
  ]);

  const markup = renderToStaticMarkup(
    createElement(DemographicRegister, {
      school,
      yearLabel,
      table: buildDemographicTable(cells),
      generatedOn: new Date().toISOString().slice(0, 10),
    }),
  );

  const pdf = await renderPdf(await printDocument(markup, DEMOGRAPHIC_CSS), {
    format: "A4",
    landscape: true,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="demographic-register-${yearLabel ?? "current"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
