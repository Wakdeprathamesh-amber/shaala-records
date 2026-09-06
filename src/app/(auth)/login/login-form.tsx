"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { login, type LoginState } from "./actions";

const FIELD =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base " +
  "text-slate-900 outline-none placeholder:text-slate-400 " +
  "focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 " +
  "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:border-slate-400";

const LABEL = "block text-sm font-medium text-slate-700 dark:text-slate-300";
const ERROR = "mt-1.5 text-sm text-red-600 dark:text-red-400";

function SubmitButton() {
  // useFormStatus must be read from a child of the form, not the form itself.
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white
                 transition hover:bg-slate-800 focus:outline-none focus:ring-2
                 focus:ring-slate-900/20 disabled:opacity-60
                 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
    >
      {pending ? "प्रवेश करत आहे…" : "प्रवेश करा — Sign in"}
    </button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm
                     text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {state.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="identifier" className={LABEL}>
          फोन किंवा ईमेल <span className="font-normal text-slate-400">/ Phone or email</span>
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          aria-invalid={Boolean(state.fieldErrors?.identifier)}
          aria-describedby={state.fieldErrors?.identifier ? "identifier-error" : undefined}
          className={FIELD}
        />
        {state.fieldErrors?.identifier ? (
          <p id="identifier-error" className={ERROR}>
            {state.fieldErrors.identifier}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className={LABEL}>
          पासवर्ड <span className="font-normal text-slate-400">/ Password</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          className={FIELD}
        />
        {state.fieldErrors?.password ? (
          <p id="password-error" className={ERROR}>
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}
