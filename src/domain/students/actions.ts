"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod";

import { requireCtx } from "@/lib/auth/session";
import { StatusSchema, StudentCreateSchema } from "./schema";
import * as repo from "./repo";

export type StudentFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /**
   * What the user actually typed, echoed back on failure.
   *
   * React 19 resets an uncontrolled form once its action completes, so without
   * this a clerk who mistypes one field loses all twenty-five. Returning the
   * submitted values and re-seeding defaultValue from them is what makes a
   * validation error a correction rather than a re-entry.
   */
  values?: Record<string, string>;
};

/** Collects every non-empty form value. Zod strips anything the schema does
 *  not declare, which is what keeps an `aadhaar` field from ever reaching the
 *  database even if someone adds the input to the HTML. */
function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function flatten(error: z.ZodError): Record<string, string> {
  const fieldErrors = z.flattenError(error).fieldErrors as Record<string, string[]>;
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([, v]) => v?.length)
      .map(([k, v]) => [k, v[0]]),
  );
}

export async function createStudent(
  _prev: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const ctx = await requireCtx();

  const submitted = formToObject(formData) as Record<string, string>;

  const parsed = StudentCreateSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "काही माहिती तपासा — Please check the highlighted fields",
      fieldErrors: flatten(parsed.error),
      values: submitted,
    };
  }

  const grNumber = String(formData.get("grNumber") ?? "").trim();
  if (grNumber) {
    const clash = await repo.byGr(ctx, grNumber);
    if (clash) {
      return {
        error: "हा जीआर क्रमांक आधीच वापरला आहे — That GR number is already in use",
        fieldErrors: { grNumber: "Already used" },
        values: submitted,
      };
    }
  }

  const student = await repo.create(ctx, { ...parsed.data, grNumber: grNumber || undefined });

  const cls = String(formData.get("class") ?? "").trim();
  if (cls) {
    await repo.upsertEnrollment(ctx, student.id, {
      class: cls,
      division: String(formData.get("division") ?? "").trim() || null,
      rollNo: Number(formData.get("rollNo")) || null,
    });
  }

  revalidatePath("/students");
  redirect(`/students/${student.id}`);
}

export async function updateStudent(
  _prev: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const ctx = await requireCtx();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing student id" };

  const submitted = formToObject(formData) as Record<string, string>;

  const parsed = StudentCreateSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "काही माहिती तपासा — Please check the highlighted fields",
      fieldErrors: flatten(parsed.error),
      values: submitted,
    };
  }

  const updated = await repo.update(ctx, id, parsed.data);
  if (!updated) {
    return { error: "विद्यार्थी सापडला नाही — Student not found", values: submitted };
  }

  const cls = String(formData.get("class") ?? "").trim();
  if (cls) {
    await repo.upsertEnrollment(ctx, id, {
      class: cls,
      division: String(formData.get("division") ?? "").trim() || null,
      rollNo: Number(formData.get("rollNo")) || null,
    });
  }

  revalidatePath(`/students/${id}`);
  revalidatePath("/students");
  redirect(`/students/${id}`);
}

/** Status only. There is no delete action, here or anywhere. */
export async function setStudentStatus(formData: FormData): Promise<void> {
  const ctx = await requireCtx();
  const id = String(formData.get("id") ?? "");
  const status = StatusSchema.safeParse(formData.get("status"));
  if (!id || !status.success) return;

  await repo.setStatus(ctx, id, status.data);
  revalidatePath(`/students/${id}`);
  revalidatePath("/students");
}
