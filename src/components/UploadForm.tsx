"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { UploadState } from "@/domain/import/actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-medium text-white
                 hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
    >
      {pending ? "वाचत आहे…" : label}
    </button>
  );
}

export function UploadForm({
  action,
  label,
}: {
  action: (prev: UploadState, fd: FormData) => Promise<UploadState>;
  label: string;
}) {
  const [state, formAction] = useActionState<UploadState, FormData>(action, {});

  return (
    <form action={formAction} className="grid gap-3">
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800
                     dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {state.error}
        </p>
      ) : null}

      <input
        type="file"
        name="file"
        accept=".xlsx,.xls,.csv"
        required
        className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2
                   text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3
                   file:py-1.5 file:text-sm dark:border-slate-700 dark:bg-slate-950
                   dark:text-slate-200 dark:file:bg-slate-800 dark:file:text-slate-200"
      />
      <div>
        <Submit label={label} />
      </div>
    </form>
  );
}
