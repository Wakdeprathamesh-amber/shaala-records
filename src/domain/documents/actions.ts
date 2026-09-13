"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod";

import { requireCtx } from "@/lib/auth/session";
import { issueDocument } from "./issue";

const IssueSchema = z
  .object({
    studentId: z.uuid({ error: "Pick a student" }),
    docType: z.enum(["lc", "bonafide", "id_card", "character", "noc"]),
    duplicate: z.coerce.boolean().optional(),
    issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

    dateOfLeaving: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    lastAttended: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    reasonMr: z.string().trim().max(200).optional().or(z.literal("")),
    progress: z.string().trim().max(60).optional().or(z.literal("")),
    conduct: z.string().trim().max(60).optional().or(z.literal("")),
    remarksMr: z.string().trim().max(300).optional().or(z.literal("")),
    duesCleared: z.coerce.boolean().optional(),

    purpose: z
      .enum(["scholarship", "bank", "passport", "caste", "domicile", "other"])
      .optional(),

    nocPurposeMr: z.string().trim().max(200).optional().or(z.literal("")),
  })
  .refine((v) => v.docType !== "lc" || Boolean(v.dateOfLeaving), {
    error: "शाळा सोडल्याचा दिनांक आवश्यक — Date of leaving is required",
    path: ["dateOfLeaving"],
  });

export type IssueFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

export async function issue(
  _prev: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const ctx = await requireCtx();

  const submitted = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;

  const parsed = IssueSchema.safeParse({
    ...submitted,
    duplicate: submitted.duplicate === "on" || submitted.duplicate === "true",
    duesCleared: submitted.duesCleared !== "0",
  });

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors as Record<string, string[]>;
    return {
      error: "माहिती तपासा — Please check the form",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).filter(([, v]) => v?.length).map(([k, v]) => [k, v[0]]),
      ),
      values: submitted,
    };
  }

  const d = parsed.data;

  try {
    const doc = await issueDocument(ctx, {
      studentId: d.studentId,
      docType: d.docType,
      duplicate: d.duplicate,
      issuedOn: d.issuedOn,
      dateOfLeaving: d.dateOfLeaving || undefined,
      lastAttended: d.lastAttended || undefined,
      reasonMr: d.reasonMr || undefined,
      progress: d.progress || undefined,
      conduct: d.conduct || undefined,
      remarksMr: d.remarksMr || undefined,
      duesCleared: d.duesCleared,
      purpose: d.purpose,
      nocPurposeMr: d.nocPurposeMr || undefined,
    });

    revalidatePath("/documents");
    revalidatePath(`/students/${d.studentId}`);
    redirect(`/documents/${doc.id}`);
  } catch (err) {
    // redirect() throws a control-flow signal; never swallow it.
    if (err && typeof err === "object" && "digest" in err) throw err;
    return {
      error: err instanceof Error ? err.message : "दाखला देता आला नाही — Could not issue",
      values: submitted,
    };
  }
}
