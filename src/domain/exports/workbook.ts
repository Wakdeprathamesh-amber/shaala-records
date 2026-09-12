import ExcelJS from "exceljs";

import { headerRow, mapRows, type ExportRow, type ExportTemplate } from "./mapper";

/**
 * Writes the government workbook.
 *
 * Headers must match the portal's expected text exactly — it matches on the
 * header string, not position, and a stray space fails the whole file. They
 * are written verbatim from the template with no formatting applied that
 * could alter the stored string.
 */
export async function writeWorkbook(
  rows: ExportRow[],
  template: ExportTemplate,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Shaala Records";
  wb.created = new Date();

  const sheet = wb.addWorksheet(template.sheet);

  const headers = headerRow(template);
  sheet.addRow(headers);

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of mapRows(rows, template)) {
    // Every cell is written as text. Excel would otherwise coerce "01/01/2010"
    // to a date in the local format and a GR number like "0042" to 42 —
    // both of which the portal rejects.
    const added = sheet.addRow(row);
    added.eachCell((cell) => {
      cell.numFmt = "@";
      cell.value = cell.value === null || cell.value === undefined ? "" : String(cell.value);
    });
  }

  sheet.columns.forEach((col, i) => {
    const longest = Math.max(
      headers[i]?.length ?? 10,
      ...rows.slice(0, 200).map(() => 12),
    );
    col.width = Math.min(Math.max(longest + 2, 10), 40);
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

/** Reads a portal error report — the file the portal hands back on rejection. */
export async function readWorkbook(
  data: Buffer,
): Promise<{ sheet: string; headers: string[]; rows: string[][] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);

  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("The uploaded workbook has no sheets.");

  const rows: string[][] = [];
  let headers: string[] = [];

  sheet.eachRow((row, index) => {
    const values = (row.values as unknown[]).slice(1).map((v) => {
      if (v === null || v === undefined) return "";
      if (typeof v === "object" && v !== null && "text" in v) {
        return String((v as { text: unknown }).text);
      }
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v);
    });
    if (index === 1) headers = values;
    else rows.push(values);
  });

  return { sheet: sheet.name, headers, rows };
}
