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

/**
 * Parses CSV text into rows.
 *
 * Hand-written rather than pulled from a library because the grammar is small
 * and the failure we care about is specific: a school's address contains a
 * comma ("जिल्हा परिषद शाळा, रावडी"), so quoted fields and escaped quotes
 * inside them have to be right, or every column after that one shifts by one
 * and the wrong data lands in the wrong field without any error.
 */
export function parseCsv(text: string): string[][] {
  // Excel writes a UTF-8 BOM; left in place it becomes part of the first
  // header and that column stops matching any alias.
  let src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  src = src.replace(/\r\n?/g, "\n");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop trailing blank lines, which every editor adds.
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop();
  return rows;
}

/** A zip local-file header — every .xlsx is a zip, no CSV ever is. */
function isZip(data: Buffer): boolean {
  return data.length > 4 && data[0] === 0x50 && data[1] === 0x4b;
}

/**
 * Reads an uploaded spreadsheet: a portal error report, or a school's filled-in
 * student collection sheet.
 *
 * Handles CSV as well as xlsx because the upload path has always advertised
 * `.csv` — and until this was added, a CSV reached ExcelJS, failed as "not a
 * zip file", and the clerk was told to save it as .xlsx from Excel. The one
 * format a school is most likely to send back was the one that bounced.
 *
 * The format is decided by the bytes, not the file extension: a sheet emailed
 * around a school office is renamed more than once on the way.
 */
export async function readWorkbook(
  data: Buffer,
): Promise<{ sheet: string; headers: string[]; rows: string[][] }> {
  if (!isZip(data)) {
    const rows = parseCsv(data.toString("utf8"));
    if (rows.length === 0) throw new Error("The uploaded file is empty.");
    return { sheet: "CSV", headers: rows[0], rows: rows.slice(1) };
  }

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
