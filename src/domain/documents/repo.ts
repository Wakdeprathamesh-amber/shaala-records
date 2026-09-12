import "server-only";

import { and, count, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, lcDetails, students, users } from "@/db/schema";
import { scoped, type Ctx } from "@/lib/tenant";

export type DocType = "lc" | "bonafide" | "id_card";

export async function documentsForStudent(ctx: Ctx, studentId: string) {
  return db
    .select({
      id: documents.id,
      docType: documents.docType,
      serialNo: documents.serialNo,
      issuedOn: documents.issuedOn,
      isDuplicate: documents.isDuplicate,
    })
    .from(documents)
    .where(scoped(documents, ctx, eq(documents.studentId, studentId)))
    .orderBy(desc(documents.issuedOn), desc(documents.serialNo));
}

export async function byId(ctx: Ctx, id: string) {
  const [row] = await db
    .select()
    .from(documents)
    .where(scoped(documents, ctx, eq(documents.id, id)))
    .limit(1);
  return row ?? null;
}

export type DocumentRegisterRow = {
  id: string;
  docType: DocType;
  serialNo: number;
  issuedOn: string;
  isDuplicate: boolean;
  studentId: string;
  grNumber: string;
  nameMr: string;
  issuedBy: string;
};

export async function register(
  ctx: Ctx,
  filter: { docType?: DocType; from?: string; to?: string; page?: number } = {},
): Promise<{ rows: DocumentRegisterRow[]; total: number; page: number; pageSize: number }> {
  const pageSize = 25;
  const page = filter.page ?? 1;

  const conditions = [scoped(documents, ctx)];
  if (filter.docType) conditions.push(eq(documents.docType, filter.docType));
  if (filter.from) conditions.push(gte(documents.issuedOn, filter.from));
  if (filter.to) conditions.push(lte(documents.issuedOn, filter.to));
  const where = and(...conditions);

  const rows = await db
    .select({
      id: documents.id,
      docType: documents.docType,
      serialNo: documents.serialNo,
      issuedOn: documents.issuedOn,
      isDuplicate: documents.isDuplicate,
      studentId: documents.studentId,
      grNumber: students.grNumber,
      firstNameMr: students.firstNameMr,
      middleNameMr: students.middleNameMr,
      lastNameMr: students.lastNameMr,
      issuedBy: users.name,
    })
    .from(documents)
    .innerJoin(students, eq(students.id, documents.studentId))
    .innerJoin(users, eq(users.id, documents.issuedByUserId))
    .where(where)
    .orderBy(desc(documents.issuedOn), desc(documents.serialNo))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await db.select({ n: count() }).from(documents).where(where);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      docType: r.docType,
      serialNo: r.serialNo,
      issuedOn: r.issuedOn,
      isDuplicate: r.isDuplicate,
      studentId: r.studentId,
      grNumber: r.grNumber,
      nameMr: [r.firstNameMr, r.middleNameMr, r.lastNameMr].filter(Boolean).join(" "),
      issuedBy: r.issuedBy,
    })),
    total: totalRow?.n ?? 0,
    page,
    pageSize,
  };
}

/** The original of a document type for a student, if one exists. A reprint
 *  reuses its serial rather than consuming a new one — the register must show
 *  one certificate, issued once, reprinted. */
export async function originalFor(ctx: Ctx, studentId: string, docType: DocType) {
  const [row] = await db
    .select()
    .from(documents)
    .where(
      and(
        scoped(documents, ctx),
        eq(documents.studentId, studentId),
        eq(documents.docType, docType),
        eq(documents.isDuplicate, false),
      )!,
    )
    .limit(1);
  return row ?? null;
}

export async function lcDetailFor(ctx: Ctx, documentId: string) {
  const [row] = await db
    .select()
    .from(lcDetails)
    .where(scoped(lcDetails, ctx, eq(lcDetails.documentId, documentId)))
    .limit(1);
  return row ?? null;
}
