import { PageHeader } from "@/components/PageHeader";
import { SchoolForm, UserForm, YearForm } from "@/components/SettingsForms";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import * as repo from "@/domain/settings/repo";
import { addUser, addYear, makeYearCurrent, saveSchool } from "@/domain/settings/actions";
import { hasRole } from "@/lib/tenant";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

export const metadata = { title: "सेटिंग्ज — Settings" };

export default async function SettingsPage() {
  const ctx = await requireCtx();
  const t = await getT();
  const isPrincipal = hasRole(ctx, "principal");

  const [school, users, years] = await Promise.all([
    repo.school(ctx),
    repo.listUsers(ctx),
    repo.listYears(ctx),
  ]);

  return (
    <>
      <PageHeader title={t("settings.title")} />

      {!isPrincipal ? (
        <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm
                      text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          हे बदल फक्त मुख्याध्यापक करू शकतात — only the principal can change these settings.
          The UDISE code here appears on every certificate and every government upload.
        </p>
      ) : null}

      <div className="grid gap-5">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t("settings.school")}
          </h2>
          {isPrincipal && school ? (
            <SchoolForm
              action={saveSchool}
              school={school as unknown as Record<string, unknown>}
              labels={{
                name: "शाळेचे नाव — Name",
                taluka: t("field.birthTaluka"),
                district: t("field.birthDistrict"),
                address: "पत्ता — Address",
                principal: "मुख्याध्यापक — Principal",
                save: t("action.save"),
              }}
            />
          ) : (
            <dl className="grid gap-1 text-sm">
              {[
                ["शाळा", school?.nameMr],
                ["School", school?.nameEn],
                ["UDISE", school?.udiseCode ? toDevanagariDigits(school.udiseCode) : null],
                ["मुख्याध्यापक", school?.principalNameMr],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3 border-b border-slate-100 py-1 last:border-0 dark:border-slate-800/60">
                  <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                  <dd className="text-right text-slate-900 dark:text-slate-50">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t("settings.users")}
          </h2>
          <ul className="mb-4 divide-y divide-slate-100 dark:divide-slate-800/60">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="text-slate-900 dark:text-slate-50">{u.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {u.email ?? u.phone ?? "—"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {u.role === "principal" ? "मुख्याध्यापक" : "लिपिक"}
                </span>
              </li>
            ))}
          </ul>
          {isPrincipal ? (
            <UserForm
              action={addUser}
              labels={{
                name: "नाव — Name",
                role: "भूमिका — Role",
                clerk: "लिपिक — Clerk",
                principal: "मुख्याध्यापक — Principal",
                phone: "फोन — Phone",
                email: "ईमेल — Email",
                password: "पासवर्ड — Password",
                passwordNote:
                  "किमान ८ अक्षरे. मराठीत पासवर्ड चालेल, पण २४ अक्षरांपेक्षा लहान हवा. — At least 8 characters; a Marathi password works but must be under 24 characters.",
                add: t("action.add"),
              }}
            />
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t("settings.years")}
          </h2>
          <ul className="mb-4 divide-y divide-slate-100 dark:divide-slate-800/60">
            {years.map((y) => (
              <li key={y.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="text-slate-900 dark:text-slate-50">
                  {toDevanagariDigits(y.label)}
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    {y.startDate} → {y.endDate}
                  </span>
                </span>
                {y.isCurrent ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    चालू — current
                  </span>
                ) : isPrincipal ? (
                  <form action={makeYearCurrent}>
                    <input type="hidden" name="yearId" value={y.id} />
                    <button
                      type="submit"
                      className="min-h-[36px] rounded-lg border border-slate-300 px-2.5 text-xs
                                 text-slate-700 hover:bg-slate-100 dark:border-slate-700
                                 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      चालू करा
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {isPrincipal ? (
            <YearForm
              action={addYear}
              labels={{
                year: "वर्ष — Year",
                from: "पासून — From",
                to: "पर्यंत — To",
                makeCurrent: "हे चालू वर्ष करा — Make this the current year",
                add: t("action.add"),
              }}
            />
          ) : null}
        </section>
      </div>
    </>
  );
}
