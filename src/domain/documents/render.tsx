import "server-only";

import { printDocument, renderPdf } from "@/lib/pdf";
import type { DocumentPayload } from "./issue";
import { LeavingCertificate, LC_CSS } from "@/templates/lc";
import { BonafideCertificate, BONAFIDE_CSS } from "@/templates/bonafide";
import { IdCardSheet, ID_CARD_CSS } from "@/templates/id-card";
import { CharacterCertificate, CHARACTER_CSS } from "@/templates/character";
import { NocCertificate, NOC_CSS } from "@/templates/noc";

/**
 * Loaded at call time, not imported at the top.
 *
 * Next.js refuses a static `react-dom/server` import anywhere reachable from
 * the app bundle — it cannot tell that this module only ever runs inside a
 * Route Handler. Deferring the import keeps it out of the module graph the
 * bundler analyses, while still running on the server where it belongs.
 */
async function renderMarkup(node: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(node);
}

export type RenderChoices = {
  /** A5 halves the paper cost for a bonafide; the LC is usually A4. */
  format?: "A4" | "A5";
  /** For schools printing onto pre-printed letterhead stationery. */
  suppressHeader?: boolean;
  /** Leaving certificate only: English gloss on every label. */
  bilingual?: boolean;
};

/** HTML for one document, from its frozen snapshot. */
export async function documentHtml(
  payload: DocumentPayload,
  choices: RenderChoices = {},
): Promise<string> {
  switch (payload.docType) {
    case "lc":
      return printDocument(
        await renderMarkup(
          <LeavingCertificate
            p={payload}
            suppressHeader={choices.suppressHeader}
            bilingual={choices.bilingual}
          />,
        ),
        LC_CSS,
      );
    case "bonafide":
      return printDocument(
        await renderMarkup(
          <BonafideCertificate p={payload} suppressHeader={choices.suppressHeader} />,
        ),
        BONAFIDE_CSS,
      );
    case "id_card":
      return printDocument(
        await renderMarkup(<IdCardSheet cards={[payload]} />),
        ID_CARD_CSS,
      );
    case "character":
      return printDocument(
        await renderMarkup(
          <CharacterCertificate p={payload} suppressHeader={choices.suppressHeader} />,
        ),
        CHARACTER_CSS,
      );
    case "noc":
      return printDocument(
        await renderMarkup(<NocCertificate p={payload} suppressHeader={choices.suppressHeader} />),
        NOC_CSS,
      );
  }
}

const DEFAULT_FORMAT: Record<DocumentPayload["docType"], "A4" | "A5"> = {
  lc: "A4",
  bonafide: "A5",
  id_card: "A4",
  character: "A5",
  noc: "A5",
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

  const markup = await Promise.all(
    pages.map((page, i) =>
      renderMarkup(
        <div
          key={i}
          style={i < pages.length - 1 ? { pageBreakAfter: "always" } : undefined}
        >
          <IdCardSheet cards={page} />
        </div>,
      ),
    ),
  );

  const html = await printDocument(markup.join(""), ID_CARD_CSS);

  return renderPdf(html, { format: "A4" });
}
