import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { academicYears, enrollments, schools, students } from "@/db/schema";
import { scoped, type Ctx } from "@/lib/tenant";
import { dateToMarathiWords, numberToMarathiWords } from "@/lib/marathi/numbers";
import { imageDataUri } from "@/lib/uploads/store";

import type { BonafidePurpose, DocumentPayload, IssueInput } from "./issue";

/** The serial a preview displays. Deliberately not a real number — see below. */
export const PREVIEW_SERIAL = 0;

/**
 * Builds the payload a document *would* carry, for preview only.
 *
 * Shares its shape with the issued payload so what the clerk sees is what
 * gets printed, but allocates nothing. The serial shows as 0, because
 * inventing a plausible-looking number here would let a clerk read a serial
 * off a preview, write it in a paper ledger, and then get a different one
 * when they actually confirm.
 */
export async function buildPreviewPayload(
  ctx: Ctx,
  input: Omit<IssueInput, "duplicate"> & { purpose?: BonafidePurpose },
): Promise<DocumentPayload | null> {
  const [row] = await db
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

  if (!row) return null;

  const { student: s, school, enrollment, year } = row;
  const issuedOn = input.issuedOn ?? new Date().toISOString().slice(0, 10);
  const [photoDataUri, logoDataUri] = await Promise.all([
    imageDataUri(s.photoPath, ctx.schoolId),
    imageDataUri(school.logoPath, ctx.schoolId),
  ]);
  const grDigits = Number.parseInt(s.grNumber.replace(/\D/g, ""), 10);

  return {
    version: 1,
    docType: input.docType,
    issuedOn,
    serialNo: PREVIEW_SERIAL,
    isDuplicate: false,

    sansthaNameMr: school.sansthaNameMr,
    mottoMr: school.mottoMr,
    schoolNameMr: school.nameMr,
    schoolNameEn: school.nameEn,
    udiseCode: school.udiseCode,
    boardIndex: school.boardIndex,
    recognitionNo: school.recognitionNo,
    jrCollegeIndexNo: school.jrCollegeIndexNo,
    recognitionDetailsMr: school.recognitionDetailsMr,
    schoolAddress: school.address,
    taluka: school.taluka,
    district: school.district,
    principalNameMr: school.principalNameMr,

    grNumber: s.grNumber,
    grNumberMr: Number.isFinite(grDigits) ? numberToMarathiWords(grDigits) : s.grNumber,
    apaarId: s.apaarId,
    studentId: s.studentId,
    studentNameMr: [s.firstNameMr, s.middleNameMr, s.lastNameMr].filter(Boolean).join(" "),
    studentNameEn: [s.firstNameEn, s.middleNameEn, s.lastNameEn].filter(Boolean).join(" "),
    gender: s.gender,
    photoDataUri,
    logoDataUri,
    motherNameMr: s.motherNameMr,
    fatherNameMr: s.fatherNameMr,

    dob: s.dob,
    dobInWordsMr: s.dobInWordsMr ?? dateToMarathiWords(new Date(`${s.dob}T00:00:00Z`)),
    birthVillage: s.birthVillage,
    birthTaluka: s.birthTaluka,
    birthDistrict: s.birthDistrict,
    birthState: s.birthState,

    caste: s.caste,
    subCaste: s.subCaste,
    casteCertNo: s.casteCertNo,
    category: s.category,
    religion: s.religion,
    nationality: s.nationality,
    motherTongue: s.motherTongue,
    bloodGroup: s.bloodGroup,

    admissionDate: s.admissionDate,
    admissionClass: s.admissionClass,
    previousSchool: s.previousSchool,
    lastClassPassed: s.lastClassPassed,
    currentClass: enrollment?.class ?? null,
    currentDivision: enrollment?.division ?? null,
    academicYear: year?.label ?? null,

    ...(input.docType === "lc"
      ? {
          dateOfLeaving: input.dateOfLeaving ?? issuedOn,
          lastAttended: input.lastAttended ?? null,
          reasonMr: input.reasonMr ?? null,
          progress: input.progress ?? null,
          conduct: input.conduct ?? null,
          duesCleared: input.duesCleared ?? true,
          remarksMr: input.remarksMr ?? null,
        }
      : {}),
    ...(input.docType === "bonafide" ? { purpose: input.purpose ?? "other", purposeOtherMr: input.purposeOtherMr ?? null } : {}),
    ...(input.docType === "noc" ? { nocPurposeMr: input.nocPurposeMr ?? null } : {}),
  };
}
