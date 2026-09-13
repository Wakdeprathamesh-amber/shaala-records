"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";

import { requireCtx } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { UploadError, deleteImage, saveImage } from "@/lib/uploads/store";
import * as repo from "./repo";

export type SettingsState = {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back on failure — React 19 resets the form after its action, and
   *  a principal who mistypes a pincode should not re-enter twenty-five
   *  fields. Same reason as the student form. */
  values?: Record<string, string>;
};

/**
 * The school's identity, in both scripts.
 *
 * Only four things are required: the name in each script, the UDISE code, and
 * the taluka and district a certificate cannot be issued without. Everything
 * else is optional because a school onboarding at four in the afternoon should
 * not be blocked on finding a 1983 recognition order — they fill it in when
 * they have it, and the certificate simply omits what is missing.
 */
const SchoolSchema = z.object({
  // Identity
  sansthaNameMr: z.string().trim().max(160).optional().or(z.literal("")),
  sansthaNameEn: z.string().trim().max(160).optional().or(z.literal("")),
  mottoMr: z.string().trim().max(80).optional().or(z.literal("")),
  nameMr: z.string().trim().min(1, { error: "शाळेचे नाव आवश्यक — School name is required" }).max(160),
  nameEn: z.string().trim().min(1, { error: "School name in English is required" }).max(160),

  // Recognition
  udiseCode: z.string().trim().regex(/^\d{11}$/, { error: "UDISE code is exactly 11 digits" }),
  recognitionNo: z.string().trim().max(60).optional().or(z.literal("")),
  jrCollegeIndexNo: z.string().trim().max(60).optional().or(z.literal("")),
  boardIndex: z.string().trim().max(60).optional().or(z.literal("")),
  recognitionDetailsMr: z.string().trim().max(400).optional().or(z.literal("")),

  // Address
  address: z.string().trim().max(200).optional().or(z.literal("")),
  addressEn: z.string().trim().max(200).optional().or(z.literal("")),
  village: z.string().trim().max(80).optional().or(z.literal("")),
  postOffice: z.string().trim().max(80).optional().or(z.literal("")),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: "Pincode is six digits" })
    .optional()
    .or(z.literal("")),
  taluka: z.string().trim().min(1, { error: "तालुका आवश्यक — Taluka is required" }).max(80),
  talukaEn: z.string().trim().max(80).optional().or(z.literal("")),
  district: z.string().trim().min(1, { error: "जिल्हा आवश्यक — District is required" }).max(80),
  districtEn: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),

  // Contact and profile
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{6,20}$/, { error: "Use digits, spaces, + and - only" })
    .optional()
    .or(z.literal("")),
  email: z.email({ error: "Enter a valid email" }).optional().or(z.literal("")),
  managementType: z.string().trim().max(60).optional().or(z.literal("")),
  medium: z.string().trim().max(40).optional().or(z.literal("")),
  principalNameMr: z.string().trim().max(120).optional().or(z.literal("")),
  principalNameEn: z.string().trim().max(120).optional().or(z.literal("")),
});

function flatten(err: z.ZodError): Record<string, string> {
  const f = z.flattenError(err).fieldErrors as Record<string, string[]>;
  return Object.fromEntries(
    Object.entries(f).filter(([, v]) => v?.length).map(([k, v]) => [k, v[0]]),
  );
}

export async function saveSchool(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  // Only a principal edits the school's statutory identity — the UDISE code
  // on every certificate and every government upload comes from here.
  const ctx = await requireCtx("principal");

  const submitted = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;

  const parsed = SchoolSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "माहिती तपासा — Please check the form",
      fieldErrors: flatten(parsed.error),
      values: submitted,
    };
  }

  const values: Record<string, unknown> = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v]),
  );

  const existing = await repo.school(ctx);

  if (formData.get("removeLogo") === "1") {
    values.logoPath = null;
  } else {
    const file = formData.get("logo");
    if (file instanceof File && file.size > 0) {
      try {
        const saved = await saveImage("school-logo", ctx.schoolId, Buffer.from(await file.arrayBuffer()));
        values.logoPath = saved.storedPath;
      } catch (err) {
        return {
          error: err instanceof UploadError ? err.message : "Could not save that logo.",
          fieldErrors: { logo: err instanceof UploadError ? err.message : "Could not save that logo." },
        };
      }
    }
  }

  await repo.updateSchool(ctx, values);

  // Only after the new path is committed.
  if (values.logoPath !== undefined && existing?.logoPath && existing.logoPath !== values.logoPath) {
    await deleteImage(existing.logoPath, ctx.schoolId);
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: "जतन केले — Saved" };
}

const UserSchema = z
  .object({
    name: z.string().trim().min(1, { error: "नाव आवश्यक — Name is required" }),
    email: z.email({ error: "Enter a valid email" }).optional().or(z.literal("")),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, { error: "Ten-digit mobile" }).optional().or(z.literal("")),
    role: z.enum(["principal", "clerk"]),
    password: z.string().min(8, { error: "कमीत कमी ८ अक्षरे — At least 8 characters" }),
  })
  .refine((v) => v.email || v.phone, {
    error: "फोन किंवा ईमेल द्या — Provide a phone number or an email; it is how they sign in",
    path: ["email"],
  });

export async function addUser(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await requireCtx("principal");

  const parsed = UserSchema.safeParse(
    Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")),
  );
  if (!parsed.success) {
    return { error: "माहिती तपासा — Please check the form", fieldErrors: flatten(parsed.error) };
  }

  try {
    await repo.createUser(ctx, {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
    });
  } catch {
    return { error: "हा फोन किंवा ईमेल आधीच वापरात आहे — That phone or email is already in use" };
  }

  revalidatePath("/settings");
  return { ok: "वापरकर्ता जोडला — User added" };
}

const YearSchema = z.object({
  label: z.string().trim().regex(/^\d{4}-\d{2}$/, { error: "Use the form 2026-27" }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  makeCurrent: z.coerce.boolean().optional(),
});

export async function addYear(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await requireCtx("principal");

  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;

  const parsed = YearSchema.safeParse({ ...raw, makeCurrent: raw.makeCurrent === "on" });
  if (!parsed.success) {
    return { error: "माहिती तपासा — Please check the form", fieldErrors: flatten(parsed.error) };
  }
  if (parsed.data.endDate <= parsed.data.startDate) {
    return { error: "End date must be after the start date", fieldErrors: { endDate: "Too early" } };
  }

  try {
    await repo.createYear(ctx, {
      label: parsed.data.label,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      makeCurrent: Boolean(parsed.data.makeCurrent),
    });
  } catch {
    return { error: "हे वर्ष आधीच नोंदलेले आहे — That academic year already exists" };
  }

  revalidatePath("/settings");
  return { ok: "वर्ष जोडले — Year added" };
}

/** There is no delete. An academic year with enrolments against it is part of
 *  the register's history. */
export async function makeYearCurrent(formData: FormData): Promise<void> {
  const ctx = await requireCtx("principal");
  const id = String(formData.get("yearId") ?? "");
  if (!id) return;
  await repo.setCurrentYear(ctx, id);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}
