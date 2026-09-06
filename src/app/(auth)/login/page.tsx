import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "प्रवेश — Sign in · Shaala Records" };

export default async function LoginPage({
  searchParams,
}: {
  // Next 15+ passes searchParams as a Promise.
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            शाळा रेकॉर्ड्स
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Shaala Records — जनरल रजिस्टर
          </p>
        </header>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          अडचण आल्यास मुख्याध्यापकांशी संपर्क साधा
          <br />
          Contact your principal if you cannot sign in
        </p>
      </div>
    </main>
  );
}
