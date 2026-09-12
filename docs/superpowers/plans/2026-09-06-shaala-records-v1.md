# Shaala Records v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A multi-tenant web app that turns a Maharashtra school's paper General Register into a database, prints statutory documents (Leaving Certificate, Bonafide, ID card) from it, and exports government-format bulk-upload files for UDISE+ / Integrated SARAL.

**Architecture:** Next.js App Router monolith, server-rendered, Postgres via Drizzle. Every table carries `school_id`; all data access flows through a tenant-scoped repository layer that makes an unscoped query a type error. Document issuance is transactional and snapshots its payload, so an issued certificate never changes when the student record is later edited. Government export column mappings live in versioned JSON config, not code, because the templates change by government resolution. PDFs are rendered by a long-lived headless Chromium from React-rendered HTML — which is why this deploys to a Linux box, not a serverless platform.

**Tech Stack:** Next.js 16 (App Router) · TypeScript strict · Tailwind v4 + shadcn/ui · Drizzle ORM · PostgreSQL 17.6 (Supabase managed) · Zod 4 · Playwright (PDF + E2E) · ExcelJS · Vitest

**Reference:** [PRD.md](../../../PRD.md) — Section 6 defines scope, Section 7 the data model, Section 9 the non-functional bar.

---

## Environment corrections (2026-09-06)

Three things differ from this plan as first written, discovered during Milestone 0:

- **Next.js 16, not 15.** `middleware.ts` is renamed `proxy.ts` (same behaviour,
  same `config.matcher`). Verified in `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- **Postgres is Supabase, not Docker.** The build host had no disk for a Docker VM
  and its 28 GB image store. Supabase's Session pooler (port 5432, IPv4) is used —
  the direct connection is IPv6-only and the transaction pooler cannot migrate.
  Supabase provides *only* Postgres: auth remains our own, per PRD principle 7.
- **Zod 4.** Syntax differs from v3: `z.email()` not `z.string().email()`, and
  `{ error: ... }` not `{ message: ... }`.
- **Postgres 17.6, not 18.** Supabase's current managed version. The schema uses
  no 18-only features, so this costs nothing — but `uuidv7()` is unavailable if
  we ever want it, and `gen_random_uuid()` stays the id default.

---

## Deviation from the standard plan format, and why

The standard format inlines complete code in every step. For a build of this size that produces a document nobody reads and agents skim. Instead:

- **Exact file paths, function signatures, and type names are specified everywhere** — these are the contract that lets parallel agents avoid collisions.
- **Full code is inlined for the parts that are easy to get wrong**: tenant scoping, serial allocation, Marathi number-to-words, the export mapper config shape.
- **Routine CRUD is specified precisely but compactly** — exact routes, exact fields, exact test names, no code dump.
- Shared conventions live in `AGENTS.md` at the repo root; every task assumes it has been read.

---

## File structure

```
drizzle/                     Generated migrations (committed)
Dockerfile                   Production image: node:22-slim + Chromium
AGENTS.md                    Conventions every worker reads first
drizzle.config.ts

src/db/
  schema.ts                  All tables. Single source of truth. OWNED BY FOUNDATION.
  client.ts                  Drizzle client + pool
  seed.ts                    Pilot school + 25 sample students

src/lib/
  tenant.ts                  Ctx type, scoped() helper, requireCtx()
  auth/session.ts            Session create/verify/destroy
  auth/password.ts           bcrypt wrappers
  pdf.ts                     renderPdf() — shared Chromium instance
  i18n/index.ts              t(), locale cookie
  i18n/mr.json, en.json      UI strings
  marathi/numbers.ts         numberToMarathiWords(), dateToMarathiWords()
  marathi/data.ts            Digit and word tables
  format.ts                  Dates, classes, roll numbers

src/domain/
  students/repo.ts           Tenant-scoped queries. NO other file queries students.
  students/schema.ts         Zod schemas for create/update
  students/actions.ts        Server Actions
  documents/issue.ts         issueDocument() — the transactional core
  documents/serial.ts        allocateSerial()
  documents/repo.ts
  exports/mapper.ts          Config-driven column mapper
  exports/validate.ts        Pre-flight validation
  exports/templates/udise-2026-27.json
  import/parse.ts            Excel → staged rows
  import/commit.ts           Staged rows → students

src/templates/
  lc.tsx                     Leaving Certificate — statutory layout
  bonafide.tsx
  id-card.tsx
  shared.tsx                 Page frame, school header, fonts

src/app/
  (auth)/login/page.tsx
  (app)/layout.tsx           Responsive shell: sidebar → bottom sheet on mobile
  (app)/page.tsx             Dashboard
  (app)/students/...         List, new, [id] detail/edit
  (app)/documents/...        Issue flow, register of issued documents
  (app)/exports/...          Generate, validate, error round-trip
  (app)/import/...           Upload, map, verify, commit
  (app)/settings/...         School profile, users, academic years
  api/documents/[id]/pdf     PDF download
  api/exports/[id]/file      xlsx download

src/components/ui/           shadcn primitives
src/components/              App components: DataTable, FieldPair, PageHeader

tests/unit/                  Vitest
tests/e2e/                   Playwright
```

**Ownership rule for parallel work:** `src/db/schema.ts` and everything in `src/lib/` except `marathi/` is written by the foundation and is **read-only** to feature workers. A worker needing a schema change requests it rather than editing.

---

## Milestone 0 — Foundation *(sequential, not parallelisable)*

### Task 0.1: Repo, tooling, Postgres

**Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `.gitignore`

- [x] Scaffold Next.js 16 App Router, TypeScript strict, Tailwind v4, ESLint
- [ ] Add: `drizzle-orm`, `drizzle-kit`, `postgres`, `zod`, `bcryptjs`, `exceljs`, `playwright`, `vitest`, `@testing-library/react`
- [x] Supabase (South Asia / Mumbai) as managed Postgres — see `docs/SETUP-SUPABASE.md`
- [ ] `.env.example` with `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV`
- [ ] Verify: `docker compose up -d && npm run dev` serves on :3000
- [ ] Commit: `chore: scaffold next.js app with postgres and tooling`

### Task 0.2: Database schema

**Files:** Create `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`

Implements PRD Section 7 exactly. Tables: `schools`, `academicYears`, `users`, `sessions`, `students`, `enrollments`, `documents`, `lcDetails`, `documentCounters`, `exportRuns`, `importBatches`, `importRows`, `auditLog`.

Constraints that carry legal weight — these are not optional:
- `unique(students.schoolId, students.grNumber)`
- `unique(documents.schoolId, documents.docType, documents.serialNo)`
- `unique(documentCounters.schoolId, documentCounters.docType)`
- `students.status` enum: `studying` | `left` | `tc_issued` — no delete path exists
- `documents.payloadJson` is `jsonb NOT NULL` — the snapshot
- Every table except `schools` has `schoolId` with an FK and an index

- [ ] Write schema, generate migration with `npx drizzle-kit generate`
- [ ] Apply with `npx drizzle-kit migrate`
- [ ] Verify: `psql -c '\dt'` lists 13 tables
- [ ] Commit: `feat(db): add core schema for register, documents and exports`

### Task 0.3: Tenant scoping

**Files:** Create `src/lib/tenant.ts`, `tests/unit/tenant.test.ts`

The single most important piece of infrastructure. A missing `WHERE school_id = ?` leaks one school's students into another's leaving certificates.

```ts
export type Role = "principal" | "clerk";

export type Ctx = {
  schoolId: string;
  userId: string;
  role: Role;
  academicYearId: string;
};

/** Every domain read/write takes Ctx first. Repos call scoped() to get a
 *  pre-filtered condition; they never build a where clause by hand. */
export function scoped<T extends { schoolId: PgColumn }>(
  table: T,
  ctx: Ctx,
  extra?: SQL,
): SQL {
  const base = eq(table.schoolId, ctx.schoolId);
  return extra ? and(base, extra)! : base;
}

/** Throws if the session is absent or the role is insufficient.
 *  Server Actions and route handlers call this first, always. */
export async function requireCtx(minRole?: Role): Promise<Ctx>;
```

- [ ] **Step 1:** Write `tests/unit/tenant.test.ts` — `scoped()` always includes the schoolId predicate; `scoped()` with `extra` ANDs them; `requireCtx("principal")` rejects a clerk session
- [ ] **Step 2:** Run `npx vitest run tests/unit/tenant.test.ts` — expect FAIL, module not found
- [ ] **Step 3:** Implement `src/lib/tenant.ts`
- [ ] **Step 4:** Run tests — expect PASS
- [ ] **Step 5:** Add `tests/unit/no-unscoped-queries.test.ts` — greps `src/` for `db.select().from(` outside `src/db/` and `src/domain/**/repo.ts`, fails if found. This is the guardrail that survives future agents.
- [ ] **Step 6:** Commit: `feat(core): add tenant context and scoped query guardrail`

### Task 0.4: Auth

**Files:** Create `src/lib/auth/session.ts`, `src/lib/auth/password.ts`, `src/app/(auth)/login/page.tsx`, `src/proxy.ts`

Server-side sessions in Postgres, httpOnly SameSite=Lax cookie, bcrypt cost 12. No OAuth, no third-party auth service — PRD principle 7.

- [ ] `createSession(userId)`, `getSession()`, `destroySession()`, 30-day expiry, rolling refresh
- [ ] Login page: phone or email + password, bilingual labels, error states that say what to fix
- [ ] `proxy.ts` redirects unauthenticated requests under `/(app)` to `/login`
- [ ] Test: `tests/unit/auth.test.ts` — hash round-trip, expired session rejected, session bound to one school
- [ ] Commit: `feat(auth): add password sessions and login`

### Task 0.5: App shell — responsive

**Files:** Create `src/app/(app)/layout.tsx`, `src/components/AppShell.tsx`, `src/components/ui/*` (shadcn), `src/lib/i18n/*`

Mobile-friendly is a real requirement, not a nice-to-have. The clerk is on a desktop; the principal checks things on a phone.

- [ ] Desktop ≥1024px: fixed left sidebar, 240px, sections Dashboard / Students / Documents / Exports / Import / Settings
- [ ] Tablet and mobile <1024px: sidebar collapses to a slide-over sheet, triggered from a top bar
- [ ] Tables become stacked cards below 640px — a `<DataTable>` component that takes a `mobileCard` renderer
- [ ] Minimum touch target 44px; no hover-only affordances
- [ ] i18n: `t()` reading `mr.json` by default, `en.json` on toggle, locale in a cookie
- [ ] Commit: `feat(ui): add responsive app shell with bilingual navigation`

### Task 0.6: Seed data and AGENTS.md

**Files:** Create `src/db/seed.ts`, `AGENTS.md`

- [ ] Seed: one school (the pilot's real profile), one principal, one clerk, current academic year 2026–27, 25 students with realistic Marathi and English names, castes, categories, birth places, GR numbers 1–25
- [ ] `AGENTS.md`: conventions — tenant rule, no unscoped queries, Server Actions for mutations and route handlers only for file downloads, Zod at every boundary, no `any`, no barrel files, test naming, commit format
- [ ] Verify: `npm run seed && npm run dev` shows 25 students
- [ ] Commit: `chore: add seed data and agent conventions`

---

## Milestone 1 — Marathi primitives *(parallelisable, zero dependencies)*

### Task 1.1: Number to Marathi words

**Files:** Create `src/lib/marathi/numbers.ts`, `src/lib/marathi/data.ts`, `tests/unit/marathi-numbers.test.ts`

A leaving certificate prints the date of birth in words. Getting this wrong is the bug that loses a school, because the certificate is a legal document a child carries for life. Marathi has irregular forms for 1–100 that cannot be composed algorithmically — they must be tabled.

```ts
/** 1992 → "एक हजार नऊशे ब्याण्णव" */
export function numberToMarathiWords(n: number): string;

/** 2011-03-14 → "चौदा मार्च दोन हजार अकरा" */
export function dateToMarathiWords(d: Date): string;
```

- [x] **Step 1:** Write the failing test with at least 40 cases, including every irregular decade boundary (२९ एकोणतीस, ३९ एकोणचाळीस, ४९ एकोणपन्नास, ५९ एकोणसाठ, ६९ एकोणसत्तर, ७९ एकोणऐंशी, ८९ एकोणनव्वद, ९९ नव्याण्णव), zero, and years 1990–2020 inclusive
- [x] **Step 2:** Run `npx vitest run tests/unit/marathi-numbers.test.ts` — expect FAIL
- [x] **Step 3:** Build the 0–99 lookup table in `data.ts`, compose hundreds and thousands in `numbers.ts`
- [x] **Step 4:** Run tests — expect all PASS (118 cases)
- [x] **Step 5:** Commit: `feat(marathi): add number and date to words for statutory documents`

**Verification beyond tests:** ⚠ OUTSTANDING. 15 sample dates and the eight
`एकोण-` forms are laid out for sign-off in [docs/MARATHI-AUDIT.md](../../MARATHI-AUDIT.md),
along with four open questions I could not resolve. The 118 passing tests prove
only that the code matches the table — they cannot prove the table is right.
**This blocks production issuance of any LC.**

---

## Milestone 2 — Student master *(depends on M0)*

### Task 2.1: Repository and validation
**Files:** `src/domain/students/repo.ts`, `src/domain/students/schema.ts`, `tests/unit/students-repo.test.ts`

- [ ] `list(ctx, {search, class, division, status, page})`, `byId(ctx, id)`, `byGr(ctx, grNumber)`, `create(ctx, input)`, `update(ctx, id, patch)`, `setStatus(ctx, id, status)`
- [ ] `nextGrNumber(ctx)` — max + 1, inside a transaction, never reusing a number
- [ ] Zod schemas enforcing: both name scripts required, DOB in the past and plausible for the admission class, category from the fixed Maharashtra list (`OPEN`, `SC`, `ST`, `OBC`, `VJNT`, `SBC`, `EWS`), APAAR ID exactly 12 digits when present
- [ ] **Aadhaar numbers are never accepted or stored** — assert this in a test
- [ ] Test: create allocates sequential GR; cross-tenant `byId` returns null; status never deletes
- [ ] Commit: `feat(students): add tenant-scoped repository and validation`

### Task 2.2: Student UI
**Files:** `src/app/(app)/students/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`, `src/components/FieldPair.tsx`, `src/domain/students/actions.ts`

- [ ] List: search across both scripts and GR number, filter by class/division/status, paginated, card layout under 640px
- [ ] `<FieldPair>` renders the Marathi and English inputs for one logical name side by side on desktop, stacked on mobile — used for student, mother, father
- [ ] Detail page groups fields as the register does: Identity, Birth, Family, Social, Admission, Enrollment history
- [ ] Server Actions call `requireCtx()` first, validate with Zod, write an `auditLog` row
- [ ] Commit: `feat(students): add register list, detail and entry screens`

---

## Milestone 3 — Document engine *(depends on M0, M1)*

### Task 3.1: PDF renderer
**Files:** `src/lib/pdf.ts`, `tests/unit/pdf.test.ts`

One Chromium instance for the process lifetime — launching per request costs ~800ms and will time out a batch of 40 ID cards.

```ts
/** Renders HTML to PDF at an exact paper size. Chromium is launched once
 *  and reused; callers never manage the browser. */
export async function renderPdf(
  html: string,
  opts: { format: "A4" | "A5"; landscape?: boolean; marginMm?: number },
): Promise<Buffer>;
```

- [ ] Devanagari fonts (Noto Sans Devanagari) bundled locally and referenced by `@font-face`, never from a CDN — the box may be offline to the internet at print time
- [ ] Test: renders Devanagari without tofu; A4 output measures 210×297mm; two concurrent calls reuse one browser
- [ ] Commit: `feat(pdf): add shared chromium renderer with devanagari fonts`

### Task 3.2: Serial allocation and issuance
**Files:** `src/domain/documents/serial.ts`, `src/domain/documents/issue.ts`, `tests/unit/document-issue.test.ts`

The transactional core of the product.

```ts
/** Allocates the next serial for a document type under row lock.
 *  MUST run inside the same transaction as the document insert. */
export async function allocateSerial(tx: Tx, ctx: Ctx, docType: DocType): Promise<number>;

/** Issues a document: allocates a serial, snapshots the student's current
 *  field values into payloadJson, renders the PDF, writes the row.
 *  The snapshot is why a later edit to the student never alters an issued
 *  certificate — the document is a record of what was true when signed. */
export async function issueDocument(ctx: Ctx, input: IssueInput): Promise<IssuedDocument>;
```

- [ ] **Step 1:** Write failing tests — concurrent issuance never duplicates a serial (fire 20 in parallel, assert 20 distinct); editing a student after issuance leaves `payloadJson` unchanged; a duplicate reprint gets `isDuplicate: true` and reuses the original serial
- [ ] **Step 2:** Run tests, expect FAIL
- [ ] **Step 3:** Implement with `SELECT ... FOR UPDATE` on `documentCounters`
- [ ] **Step 4:** Run tests, expect PASS
- [ ] **Step 5:** Commit: `feat(documents): add transactional issuance with payload snapshot`

### Task 3.3: Leaving Certificate template
**Files:** `src/templates/lc.tsx`, `src/templates/shared.tsx`, `tests/e2e/lc-render.spec.ts`

- [ ] Reproduce the statutory layout: school header with UDISE code and board index, serial number, GR number, full name in Marathi, mother's and father's names, caste and sub-caste, nationality, birth place to village level, DOB in figures **and** Marathi words, admission date, class on leaving, date of leaving, reason, progress, conduct, dues cleared, place and date of issue, signature blocks for class teacher, clerk and principal
- [ ] Duplicates print `द्वितीय प्रत` prominently
- [ ] A5 and A4 variants; a setting for schools printing onto pre-printed stationery that suppresses the header
- [ ] Commit: `feat(documents): add statutory leaving certificate template`

### Task 3.4: Bonafide and ID card
**Files:** `src/templates/bonafide.tsx`, `src/templates/id-card.tsx`

- [ ] Bonafide purpose variants: scholarship, bank account, passport, caste certificate, domicile — each with the sentence that purpose requires
- [ ] ID card: photo, name both scripts, class and division, GR number, blood group, school contact; batch-printable 8-up on A4
- [ ] Commit: `feat(documents): add bonafide and id card templates`

### Task 3.5: Issue flow and document register
**Files:** `src/app/(app)/documents/**`, `src/app/api/documents/[id]/pdf/route.ts`

- [ ] Pick student → pick document type → fill type-specific fields → **preview the rendered PDF** → confirm → serial assigned and record locked
- [ ] Register view: every document ever issued, filterable by type and date, each re-downloadable, duplicates visibly marked
- [ ] Batch: select a class, issue ID cards for all of them, one PDF
- [ ] Commit: `feat(documents): add issue flow and issued-document register`

---

## Milestone 4 — Government export *(depends on M0, M2)*

### Task 4.1: Config-driven mapper
**Files:** `src/domain/exports/mapper.ts`, `src/domain/exports/templates/udise-2026-27.json`, `tests/unit/export-mapper.test.ts`

The template changes by government resolution. It must be data, not code, or every September becomes a deploy.

```jsonc
{
  "id": "udise-2026-27",
  "label": "UDISE+ / Integrated SARAL — Student, 2026-27",
  "sheet": "Students",
  "headerRow": 1,
  "columns": [
    { "header": "APAAR ID",       "source": "student.apaarId",     "required": true,  "rule": "digits:12" },
    { "header": "Student Name",   "source": "student.nameEn",      "required": true,  "rule": "upper|maxlen:100" },
    { "header": "Date of Birth",  "source": "student.dob",         "required": true,  "transform": "date:DD/MM/YYYY" },
    { "header": "Social Category","source": "student.category",    "required": true,  "transform": "map:categoryCodes" }
  ]
}
```

- [ ] `loadTemplate(id)`, `mapRows(students, template)`, `writeWorkbook(rows, template)` producing `.xlsx` under 5MB with headers matching byte-for-byte
- [ ] Transforms: `date:*`, `upper`, `map:*`, `maxlen:*`, `digits:*`
- [ ] Test: a template with an unknown transform throws at load, not at export; headers match the fixture exactly; 800 students produce 800 rows plus one header
- [ ] Commit: `feat(exports): add config-driven government file mapper`

### Task 4.2: Pre-flight validation
**Files:** `src/domain/exports/validate.ts`, `src/app/(app)/exports/**`

The feature that saves the weeks. Catch it here, not in the portal's rejection.

- [ ] Checks: missing APAAR; English name absent or containing Devanagari; DOB implausible for the enrolled class; invalid category code; malformed mobile; duplicate APAAR within the school; missing mandatory statutory fields
- [ ] Report groups by problem, links each row to the student's edit page, and offers "fix and re-check"
- [ ] Export is blocked while blocking errors remain; warnings do not block
- [ ] Commit: `feat(exports): add pre-flight validation with fix-and-recheck`

### Task 4.3: Error-report round trip
**Files:** `src/domain/exports/errorReport.ts`, `src/app/(app)/exports/[id]/errors/page.tsx`

- [ ] Accept the portal's rejection file (CSV or xlsx), match rows back to students, show exactly which students failed and why
- [ ] Re-export **only** the failed rows into a fresh template file
- [ ] Commit: `feat(exports): add portal error report round trip`

---

## Milestone 5 — Import and digitisation *(depends on M0, M2)*

### Task 5.1: Excel import
**Files:** `src/domain/import/parse.ts`, `src/domain/import/commit.ts`, `src/app/(app)/import/**`

- [ ] Upload xlsx or csv → column mapping UI that guesses by header similarity → staged rows in `importRows`
- [ ] Row-level validation before commit; bad rows are fixable inline without re-uploading
- [ ] Commit is transactional and idempotent by GR number — re-running never duplicates
- [ ] Test: a file with 3 bad rows out of 200 commits 197 and reports 3; re-import commits 0
- [ ] Commit: `feat(import): add staged excel import with inline correction`

### Task 5.2: Photo-to-record digitisation
**Files:** `src/domain/import/extract.ts`, `src/app/(app)/import/photos/**`

- [ ] Upload photographs of General Register pages
- [ ] Extract fields per student into the same staging table as Task 5.1, with a per-field confidence flag
- [ ] Side-by-side verification screen: page image on the left, extracted fields on the right, keyboard-first correction
- [ ] Nothing commits without a human confirming the row
- [ ] Commit: `feat(import): add register photo extraction with human verification`

---

## Milestone 6 — Settings, dashboard, deployment

### Task 6.1: School profile, users, academic years
**Files:** `src/app/(app)/settings/**`

- [ ] School profile: name both scripts, UDISE code, board index, management type, medium, address, taluka, district, logo upload, principal name and signature image
- [ ] Users: principal invites clerks, deactivates them; a deactivated user's issued documents remain valid and attributed
- [ ] Academic years: create, set current, never delete
- [ ] Commit: `feat(settings): add school profile, users and academic years`

### Task 6.2: Dashboard
**Files:** `src/app/(app)/page.tsx`

Answers, in this order: how many students, how many documents issued this month, **how many students are export-blocked right now**, and how many days until 30 September.

- [ ] Commit: `feat(dashboard): add register summary with export readiness`

### Task 6.3: Deployment
**Files:** `Dockerfile`, `docker-compose.prod.yml`, `Caddyfile`, `scripts/backup.sh`, `docs/RUNBOOK.md`

- [ ] Multi-stage Dockerfile: `node:22-slim`, Chromium and Noto Devanagari installed, non-root user
- [ ] Compose: app + Postgres + Caddy with automatic TLS
- [ ] `backup.sh`: nightly `pg_dump | gzip` → Cloudflare R2, 30-day retention
- [ ] `RUNBOOK.md`: deploy, rollback, **restore from backup with a tested time-to-restore under 30 minutes**
- [ ] Commit: `chore(deploy): add production image, compose stack and backup runbook`

---

## Self-review against the PRD

| PRD requirement | Task |
|---|---|
| §6A School, users, academic years, audit | 0.2, 0.4, 6.1 |
| §6B Student master, dual-script, GR, no Aadhaar | 0.2, 2.1, 2.2 |
| §6C LC, bonafide, ID, serials, duplicates, batch | 3.1–3.5 |
| §6D Export, validation, error round trip | 4.1–4.3 |
| §6E Onboarding — Excel and photo digitisation | 5.1, 5.2 |
| §7 Data model and legal constraints | 0.2 |
| §8 Architecture, hosting, backups | 0.1, 6.3 |
| §9 Marathi correctness | 1.1, 3.1 |
| §9 Print fidelity | 3.3, 3.4 |
| §9 Bad connection | 0.5 (server-rendered, small payloads) |
| §9 Restore under 30 min | 6.3 |
| §9 DPDP — no Aadhaar, India residency, audit | 2.1, 0.2, 6.3 |
| Mobile-friendly | 0.5, 2.2 |

**Gaps accepted for v1:** MahaDBT and board exam exports are v2 per PRD §6. Fee and attendance are v1.5 and deliberately absent.

**Open dependency:** Task 4.1's template JSON is a best-guess shape until the real UDISE+ `.xlsx` arrives (PRD §14 item 1). The mapper is built config-driven precisely so that swapping in the real headers is a data change, not a rewrite.
