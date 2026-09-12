import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  academicYears,
  auditLog,
  documents,
  enrollments,
  lcDetails,
  schools,
  students,
} from "@/db/schema";
import { scoped, type Ctx } from "@/lib/tenant";
import { dateToMarathiWords, numberToMarathiWords } from "@/lib/marathi/numbers";

import { allocateSerial } from "./serial";
import { originalFor, type DocType } from "./repo";

export type BonafidePurpose =
  | "scholarship"
  | "bank"
  | "passport"
  | "caste"
  | "domicile"
  | "other";

export type IssueInput = {
  studentId: string;
  docType: DocType;
  /** Reprint of an already-issued document. Reuses the original serial. */
  duplicate?: boolean;
  issuedOn?: string;

  // Leaving certificate
  dateOfLeaving?: string;
  lastAttended?: string;
  reasonMr?: string;
  progress?: string;
  conduct?: string;
  duesCleared?: boolean;
  remarksMr?: string;

  // Bonafide
  purpose?: BonafidePurpose;
};

/**
 * Everything printed on a certificate, frozen at the moment of issue.
 *
 * This is the whole reason the documents table carries a jsonb column rather
 * than joining back to the student at print time: a certificate is a statement
 * about what was true when it was signed. If a clerk corrects a spelling next
 * year, the certificate already in a parent's file must not silently disagree
 * with the school's copy.
 */
export type DocumentPayload = {
  version: 1;
  docType: DocType;
  issuedOn: string;
  serialNo: number;
  isDuplicate: boolean;

  schoolNameMr: string;
  schoolNameEn: string;
  udiseCode: string;
  boardIndex: string | null;
  schoolAddress: string | null;
  taluka: string | null;
  district: string | null;
  principalNameMr: string | null;

  grNumber: string;
  grNumberMr: string;
  apaarId: string | null;
  studentNameMr: string;
  studentNameEn: string;
  motherNameMr: string | null;
  fatherNameMr: string | null;

  dob: string;
  dobInWordsMr: string;
  birthVillage: string | null;
  birthTaluka: string | null;
  birthDistrict: string | null;
  birthState: string | null;

  caste: string | null;
  subCaste: string | null;
  category: string | null;
  religion: string | null;
  nationality: string | null;
  motherTongue: string | null;
  bloodGroup: string | null;

  admissionDate: string;
  admissionClass: string | null;
  lastClassPassed: string | null;
  currentClass: string | null;
  currentDivision: string | null;
  academicYear: string | null;

  // LC only
  dateOfLeaving?: string;
  lastAttended?: string | null;
  reasonMr?: string | null;
  progress?: string | null;
  conduct?: string | null;
  duesCleared?: boolean;
  remarksMr?: string | null;

  // Bonafide only
  purpose?: BonafidePurpose;
};

export type IssuedDocument = {
  id: string;
  serialNo: number;
  docType: DocType;
  issuedOn: string;
  isDuplicate: boolean;
  payloadJson: DocumentPayload;
};

function fullName(...parts: Array<string | null>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Issues a document.
 *
 * Everything happens in one transaction: serial allocation, the snapshot, the
 * document row, the LC detail row, the student's status change and the audit
 * entry. A partial issue — a serial consumed with no document, or a status
 * flipped with no certificate — is worse than a failed one.
 *
 * The PDF is deliberately not rendered here. It is generated on demand from
 * the snapshot, which is deterministic, so the file is reproducible rather
 * than stored. That keeps the legal record independent of a rendering failure
 * and removes a file store from the backup surface.
 */
export async function issueDocument(
  ctx: Ctx,
  input: IssueInput,
): Promise<IssuedDocument> {
  const issuedOn = input.issuedOn ?? new Date().toISOString().slice(0, 10);

  if (input.docType === "lc" && !input.dateOfLeaving) {
    throw new Error(
      "A leaving certificate requires a date of leaving — it is the field the whole document exists to record.",
    );
  }

  // Resolve the serial for a reprint before opening the transaction, so a
  // duplicate never touches the counter at all.
  let reusedSerial: number | null = null;
  if (input.duplicate) {
    const original = await originalFor(ctx, input.studentId, input.docType);
    if (!original) {
      throw new Error(
        "Cannot issue a duplicate: no original of this document type exists for this student.",
      );
    }
    reusedSerial = original.serialNo;
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        student: students,
        school: schools,
        enrollment: enrollments,
        year: academicYears,
      })
      .from(students)
      .innerJoin(schools, eq(schools.id, students.schoolId))
      .leftJoin(
        enrollments,
        and(
          eq(enrollments.studentId, students.id),
          eq(enrollments.academicYearId, ctx.academicYearId),
        ),
      )
      .leftJoin(academicYears, eq(academicYears.id, ctx.academicYearId))
      .where(scoped(students, ctx, eq(students.id, input.studentId)))
      .limit(1);

    // Also the tenant check: a student belonging to another school simply
    // does not appear here.
    if (!row) {
      throw new Error("Student not found in this school.");
    }

    const { student: s, school, enrollment, year } = row;

    const serialNo =
      reusedSerial ?? (await allocateSerial(tx as never, ctx, input.docType));

    const payload: DocumentPayload = {
      version: 1,
      docType: input.docType,
      issuedOn,
      serialNo,
      isDuplicate: Boolean(input.duplicate),

      schoolNameMr: school.nameMr,
      schoolNameEn: school.nameEn,
      udiseCode: school.udiseCode,
      boardIndex: school.boardIndex,
      schoolAddress: school.address,
      taluka: school.taluka,
      district: school.district,
      principalNameMr: school.principalNameMr,

      grNumber: s.grNumber,
      grNumberMr: (() => {
        const n = Number.parseInt(s.grNumber.replace(/\D/g, ""), 10);
        return Number.isFinite(n) ? numberToMarathiWords(n) : s.grNumber;
      })(),
      apaarId: s.apaarId,
      studentNameMr: fullName(s.firstNameMr, s.middleNameMr, s.lastNameMr),
      studentNameEn: fullName(s.firstNameEn, s.middleNameEn, s.lastNameEn),
      motherNameMr: s.motherNameMr,
      fatherNameMr: s.fatherNameMr,

      dob: s.dob,
      // Prefer the stored words if a clerk has corrected them by hand;
      // otherwise generate. Either way the result is frozen here.
      dobInWordsMr: s.dobInWordsMr ?? dateToMarathiWords(new Date(`${s.dob}T00:00:00Z`)),
      birthVillage: s.birthVillage,
      birthTaluka: s.birthTaluka,
      birthDistrict: s.birthDistrict,
      birthState: s.birthState,

      caste: s.caste,
      subCaste: s.subCaste,
      category: s.category,
      religion: s.religion,
      nationality: s.nationality,
      motherTongue: s.motherTongue,
      bloodGroup: s.bloodGroup,

      admissionDate: s.admissionDate,
      admissionClass: s.admissionClass,
      lastClassPassed: s.lastClassPassed,
      currentClass: enrollment?.class ?? null,
      currentDivision: enrollment?.division ?? null,
      academicYear: year?.label ?? null,

      ...(input.docType === "lc"
        ? {
            dateOfLeaving: input.dateOfLeaving,
            lastAttended: input.lastAttended ?? null,
            reasonMr: input.reasonMr ?? null,
            progress: input.progress ?? null,
            conduct: input.conduct ?? null,
            duesCleared: input.duesCleared ?? true,
            remarksMr: input.remarksMr ?? null,
          }
        : {}),
      ...(input.docType === "bonafide" ? { purpose: input.purpose ?? "other" } : {}),
    };

    const [doc] = await tx
      .insert(documents)
      .values({
        schoolId: ctx.schoolId,
        studentId: s.id,
        docType: input.docType,
        serialNo,
        issuedOn,
        issuedByUserId: ctx.userId,
        isDuplicate: Boolean(input.duplicate),
        payloadJson: payload as never,
      })
      .returning();

    if (input.docType === "lc") {
      await tx.insert(lcDetails).values({
        documentId: doc.id,
        schoolId: ctx.schoolId,
        dateOfLeaving: input.dateOfLeaving!,
        lastAttended: input.lastAttended ?? null,
        reasonMr: input.reasonMr ?? null,
        progress: input.progress ?? null,
        conduct: input.conduct ?? null,
        duesCleared: input.duesCleared ?? true,
        remarksMr: input.remarksMr ?? null,
      });

      // A leaving certificate is the act of leaving. Recording one without
      // changing the student's status would leave the register self-
      // contradictory.
      if (!input.duplicate) {
        await tx
          .update(students)
          .set({ status: "tc_issued", updatedAt: new Date() })
          .where(scoped(students, ctx, eq(students.id, s.id)));
      }
    }

    await tx.insert(auditLog).values({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      entity: "document",
      entityId: doc.id,
      action: input.duplicate ? `issue:${input.docType}:duplicate` : `issue:${input.docType}`,
      after: { serialNo, docType: input.docType, studentId: s.id } as never,
    });

    return {
      id: doc.id,
      serialNo,
      docType: input.docType,
      issuedOn,
      isDuplicate: Boolean(input.duplicate),
      payloadJson: payload,
    };
  });
}
