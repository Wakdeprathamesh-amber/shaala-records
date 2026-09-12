import "server-only";

import { renderToStaticMarkup } from "react-dom/server";

import { printDocument, renderPdf } from "@/lib/pdf";
import type { DocumentPayload } from "./issue";
import { LeavingCertificate, LC_CSS } from "@/templates/lc";
import { BonafideCertificate, BONAFIDE_CSS } from "@/templates/bonafide";
import { IdCardSheet, ID_CARD_CSS } from "@/templates/id-card";

export type RenderChoices = {
  /** A5 halves the paper cost for a bonafide; the LC is usually A4. */
  format?: "A4" | "A5";
  /** For schools printing onto pre-printed letterhead stationery. */
  suppressHeader?: boolean;
};

/** HTML for one document, from its frozen snapshot. */
export async function documentHtml(
  payload: DocumentPayload,
  choices: RenderChoices = {},
): Promise<string> {
  switch (payload.docType) {
    case "lc":
      return printDocument(
        renderToStaticMarkup(
          <LeavingCertificate p={payload} suppressHeader={choices.suppressHeader} />,
        ),
        LC_CSS,
      );
    case "bonafide":
      return printDocument(
        renderToStaticMarkup(
          <BonafideCertificate p={payload} suppressHeader={choices.suppressHeader} />,
        ),
        BONAFIDE_CSS,
      );
    case "id_card":
      return printDocument(
        renderToStaticMarkup(<IdCardSheet cards={[payload]} />),
        ID_CARD_CSS,
      );
  }
}

const DEFAULT_FORMAT: Record<DocumentPayload["docType"], "A4" | "A5"> = {
  lc: "A4",
  bonafide: "A5",
  id_card: "A4",
};

/**
 * Renders a stored document to PDF.
 *
 * Deterministic: the same snapshot always produces the same certificate, which
 * is why the PDF is generated on demand rather than stored. A reprint years
 * later is byte-comparable to the original.
 */
export async function renderDocumentPdf(
  payload: DocumentPayload,
  choices: RenderChoices = {},
): Promise<Buffer> {
  const html = await documentHtml(payload, choices);
  return renderPdf(html, {
    format: choices.format ?? DEFAULT_FORMAT[payload.docType],
  });
}

/** Batch ID cards, eight to an A4 sheet. */
export async function renderIdCardSheets(cards: DocumentPayload[]): Promise<Buffer> {
  const pages: DocumentPayload[][] = [];
  for (let i = 0; i < cards.length; i += 8) pages.push(cards.slice(i, i + 8));

  const html = await printDocument(
    pages
      .map((page, i) =>
        renderToStaticMarkup(
          <div
            key={i}
            style={i < pages.length - 1 ? { pageBreakAfter: "always" } : undefined}
          >
            <IdCardSheet cards={page} />
          </div>,
        ),
      )
      .join(""),
    ID_CARD_CSS,
  );

  return renderPdf(html, { format: "A4" });
}
