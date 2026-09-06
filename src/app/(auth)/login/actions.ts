"use server";

import { redirect } from "next/navigation";
import * as z from "zod";

import { createSession, pruneExpiredSessions } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { findByIdentifierForLogin, touchLastLogin } from "@/domain/users/repo";

const LoginSchema = z.object({
  identifier: z.string().trim().min(1, { error: "फोन किंवा ईमेल टाका — Enter phone or email" }),
  password: z.string().min(1, { error: "पासवर्ड टाका — Enter password" }),
  next: z.string().optional(),
});

export type LoginState = {
  error?: string;
  fieldErrors?: { identifier?: string; password?: string };
};

/** Only ever redirect within this app — an open redirect here would let a
 *  phishing link bounce a logged-in clerk to an attacker's page. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    const f = z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: {
        identifier: f.identifier?.[0],
        password: f.password?.[0],
      },
    };
  }

  const { identifier, password, next } = parsed.data;
  const user = await findByIdentifierForLogin(identifier);

  // One message for both "no such user" and "wrong password", so the form
  // cannot be used to discover which phone numbers are registered.
  const INVALID = "फोन/ईमेल किंवा पासवर्ड चुकीचा आहे — Incorrect phone/email or password";

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: INVALID };
  }

  await pruneExpiredSessions();
  await createSession(user.id, user.schoolId);
  await touchLastLogin(user.id);

  redirect(safeNext(next));
}
