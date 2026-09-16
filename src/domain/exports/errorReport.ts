/**
 * Round trip for the portal's rejection file.
 *
 * When UDISE+ rejects rows it returns a workbook listing them — but it
 * identifies them by its own row numbers and whatever identifier columns it
 * echoes back, not by anything the school recognises. A clerk holding that
 * file has to map it back to children by hand.
 *
 * This does that mapping, then re-exports only the failed rows, so the second
 * upload is small and the successful rows are not resubmitted.
 *
 * Pure: the parsing and matching logic is testable without a database.
 */

export type PortalError = {
  /** 1-based row in the portal's file, for referring back to it. */
  rowNumber: number;
  identifier: string;
  reason: string;
};

export type MatchedError = PortalError & {
  studentId: string | null;
  grNumber: string | null;
  studentName: string | null;
  matchedBy: "apaar" | "gr" | "name" | null;
};

export type ExportedRowIndex = {
  studentId: string;
  grNumber: string;
  studentName: string;
  apaarId: string | null;
  nameEn: string;
};

/** Header names the portal is known to use for each concept. Matched
 *  case-insensitively and ignoring spaces, because they vary between years. */
const HEADER_ALIASES = {
  identifier: ["apaar id", "apaarid", "pen", "student id", "admission number", "admissionno"],
  reason: ["error", "error description", "reason", "remarks", "message", "errormessage"],
  row: ["row", "row no", "rowno", "sr no", "srno", "line"],
};

function normalise(s: string): string {
  return s.toLowerCase().replace(/[\s_.-]/g, "");
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalised = headers.map(normalise);
  for (const alias of aliases) {
    const i = normalised.indexOf(normalise(alias));
    if (i >= 0) return i;
  }
  // Fall back to a substring match — headers often carry extra words.
  for (const alias of aliases) {
    const i = normalised.findIndex((h) => h.includes(normalise(alias)));
    if (i >= 0) return i;
  }
  return -1;
}

export class ErrorReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorReportError";
  }
}

/** Extracts the rejected rows from a parsed portal workbook. */
export function parseErrorReport(
  headers: string[],
  rows: string[][],
): PortalError[] {
  const idCol = findColumn(headers, HEADER_ALIASES.identifier);
  const reasonCol = findColumn(headers, HEADER_ALIASES.reason);
  const rowCol = findColumn(headers, HEADER_ALIASES.row);

  if (reasonCol < 0) {
    throw new ErrorReportError(
      `Could not find an error column in the uploaded file. Headers seen: ${headers.join(", ")}`,
    );
  }
  if (idCol < 0) {
    throw new ErrorReportError(
      `Could not find a student identifier column (APAAR ID, PEN or admission number). Headers seen: ${headers.join(", ")}`,
    );
  }

  return rows
    .map((r, i) => ({
      rowNumber: rowCol >= 0 && r[rowCol] ? Number(r[rowCol]) || i + 2 : i + 2,
      identifier: (r[idCol] ?? "").trim(),
      reason: (r[reasonCol] ?? "").trim(),
    }))
    .filter((e) => e.reason);
}

/**
 * Matches rejected rows back to students.
 *
 * Tries APAAR, then GR number, then an exact English name. A row that matches
 * nothing is still returned, with studentId null — silently dropping it would
 * leave a child unfixed and nobody would know.
 */
export function matchToStudents(
  errors: PortalError[],
  index: ExportedRowIndex[],
): MatchedError[] {
  const byApaar = new Map(index.filter((r) => r.apaarId).map((r) => [r.apaarId!, r]));
  const byGr = new Map(index.map((r) => [r.grNumber, r]));
  const byName = new Map(index.map((r) => [normalise(r.nameEn), r]));

  return errors.map((e) => {
    const id = e.identifier.trim();
    const hit =
      byApaar.get(id) ??
      byGr.get(id) ??
      byName.get(normalise(id)) ??
      null;

    const matchedBy = !hit
      ? null
      : byApaar.get(id) === hit
        ? ("apaar" as const)
        : byGr.get(id) === hit
          ? ("gr" as const)
          : ("name" as const);

    return {
      ...e,
      studentId: hit?.studentId ?? null,
      grNumber: hit?.grNumber ?? null,
      studentName: hit?.studentName ?? null,
      matchedBy,
    };
  });
}

export type ErrorReportSummary = {
  total: number;
  matched: number;
  unmatched: number;
  /** Grouped by the portal's reason text, which repeats across rows. */
  groups: Array<{ reason: string; count: number; students: MatchedError[] }>;
};

export function summariseErrors(matched: MatchedError[]): ErrorReportSummary {
  const byReason = new Map<string, MatchedError[]>();
  for (const m of matched) {
    // The portal often appends the offending value to the message; strip
    // trailing quoted or bracketed values so identical problems group.
    const key = m.reason.replace(/["'(\[].*?["')\]]\s*$/, "").trim() || m.reason;
    byReason.set(key, [...(byReason.get(key) ?? []), m]);
  }

  return {
    total: matched.length,
    matched: matched.filter((m) => m.studentId).length,
    unmatched: matched.filter((m) => !m.studentId).length,
    groups: [...byReason.entries()]
      .map(([reason, students]) => ({ reason, count: students.length, students }))
      .sort((a, b) => b.count - a.count),
  };
}

/** The student ids to include in a corrective re-export. */
export function studentIdsToReexport(matched: MatchedError[]): string[] {
  return [...new Set(matched.map((m) => m.studentId).filter((x): x is string => Boolean(x)))];
}

/** Builds the index the matcher needs, from the same rows the export used. */
export function buildIndex(
  rows: Array<{ studentId: string; grNumber: string; student: Record<string, unknown> }>,
): ExportedRowIndex[] {
  return rows.map((r) => ({
    studentId: r.studentId,
    grNumber: r.grNumber,
    studentName: String(r.student.nameMr ?? r.student.nameEn ?? r.grNumber),
    apaarId: r.student.apaarId ? String(r.student.apaarId) : null,
    nameEn: String(r.student.nameEn ?? ""),
  }));
}
