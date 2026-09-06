# PRD — Shaala Records
### A digital General Register and document engine for Maharashtra State Board schools

**Version** 0.1 (draft) · **Date** 6 September 2026 · **Owner** Rishabh · **Status** Pre-build

---

## 1. The thesis, in one sentence

Maharashtra schools already hold every fact the government asks for — it just lives in a paper General Register in a format no portal can consume, so a clerk retypes it, student by student, for weeks, every year.

**We are not building a School ERP. We are building a document factory.** The register becomes a database once; after that the paperwork prints itself and the government files export themselves.

This distinction governs every decision in this document. When a feature does not make a document print or a government file export, it is out of scope.

---

## 2. Why now

| Signal | Detail |
|---|---|
| Segment is growing | Private unaided schools: **339,583**, +8,475 in a year. Private enrolment reached **9.89 crore — 40% of all Indian students**, gaining 88 lakh in two years while government schools lost 86 lakh. |
| Annual forced deadline | **UDISE+ freeze: 30 September**, every year. Missing it zeroes out PM POSHAN / Samagra Shiksha / RTE allocations. |
| New mandatory workload | **APAAR ID is now compulsory for every student, Class 1–12**, via SDMS, requiring Aadhaar verification and parent consent. |
| Documented pain | Over 60% of schools in one city missed a SARAL deadline; teachers report per-student dropdown entry, portal crashes, weeks of typing. |
| Calendar shift | Maharashtra moves to an **April 1 – March 31 academic year from AY 2026–27**, aligning with CBSE. Sets our selling and onboarding windows precisely. |
| Curriculum churn | SCF/NEP rollout: new textbooks in Classes 2, 3, 4, 6 this year; 5, 7, 9, 11 next; competency-based assessment replacing rote. **Report card formats are unstable — a reason to stay out of them.** |
| Market shape | Price barbell: junk at ₹9,000/yr, Teachmint/Fedena ₹20–30k, Entab ₹1.8–2.8 lakh. Nothing credible and Maharashtra-specific in the middle. |

**Why the incumbents don't win here:** generic multi-state ERPs cannot afford to be perfectly correct about one state's statutory paperwork. That correctness is the entire product.

---

## 3. Users and segments

### Primary users (3–5 people per school, all in the office)

| Role | What they do | Access |
|---|---|---|
| **Clerk / Head Clerk** | Owns the General Register. Enters admissions, issues LC and bonafide, does portal data entry. **The real daily user.** | Full data entry, document issue |
| **Principal** | Signs documents, answers to the trust and the DEO, feels deadline risk. **The buyer.** | Everything + user management + reports |
| **Teacher** | Not a user in v1. Added only if/when timetable ships. | None in v1 |

Explicitly **not** users in v1: parents, students, accountants, transport staff.

### Two different schools

| | **Pilot / design partner** | **Paying customer** |
|---|---|---|
| Example | Father's school, Bhor, Pune dist. | Private unaided schools across Pune district |
| Type | Trust-run, aided | Private unaided, Marathi/English medium |
| Size | 200 students | 300–800 students |
| Fee | < ₹1,000/yr | ₹8,000–25,000/yr |
| Role | Design partner, reference site, format source | Revenue |
| Price | ₹10,000/yr token — real invoice, real renewal date | ₹20,000–45,000/yr |

**The pilot is the worst-paying school in the Indian market.** It is where we learn the paperwork; it is not where we earn. Both schools use the same board, same LC format, same portal, same language — so the product built for one sells to the other unchanged.

---

## 4. Problem statement

> The clerk opens the portal and types, student by student, for weeks — even though the school already has that data, just in a format the portal cannot consume.

Four concrete jobs:

1. **"A parent needs a bonafide certificate by evening."** Handwritten from the register, in Marathi, with correct GR number and date of birth in words. Every one is a manual transcription with a fresh chance of error.
2. **"A student is leaving and needs a Leaving Certificate."** A statutory document (*शाळा सोडल्याचा दाखला*). Wrong data on an LC follows a child for life and cannot be quietly fixed.
3. **"UDISE+ freezes on 30 September."** Every student's details, plus APAAR, entered or re-verified. Weeks of work, hard deadline, financial penalty for missing it.
4. **"Where is the register?"** One physical book, one copy, no backup, no search. Fire, water, or a misplaced volume is an unrecoverable loss of a legal record.

---

## 5. Product principles

1. **The GR is sacred.** GR numbers are never reused, never deleted, only superseded. Every issued document is serialised and permanently logged.
2. **Everything ends in paper or a file.** If a screen doesn't lead to a printed document or a government-format export, cut it.
3. **Two names for every person.** Marathi for documents, English matching Aadhaar for portals. This single decision prevents most APAAR failures.
4. **Formats are configuration, not code.** Portal templates and document layouts change yearly by government resolution. They live in versioned config files, editable without a deploy.
5. **We never log into a government portal.** We produce a validated file the clerk uploads. No automation, no scraping, no credential handling — ever.
6. **Support load is the real cost ceiling.** Every feature roughly doubles ticket volume. A feature must be worth a permanent support obligation, not just a build week.
7. **Boring technology.** Solo maintainer for years. No cleverness, no framework churn, no service we can't replace in a weekend.

---

## 6. Scope

### v1 — ships by end October 2026

**A. School & Users**
- School profile: name, UDISE code, SARAL/board index, management type, medium, address, taluka/district, logo, principal name and signature image
- Academic years with a designated current year (April–March from 2026–27)
- Users: principal, clerk. Phone/email + password. No OAuth, no SSO.
- Full audit log — who created, edited, or issued what, and when

**B. Student Master (the digital General Register)**
- Per-student record with **dual-script names** (Marathi + English), GR number, APAAR ID
- Full statutory field set: date of birth (numeric **and** in Marathi words), place of birth with village/taluka/district/state, mother's name, father's name, caste, sub-caste, category, religion, nationality, mother tongue, blood group, admission date, admission class, previous school, last class passed
- Enrollment history per academic year: class, division, roll number
- Status lifecycle: `studying` → `left` / `tc_issued`, never deleted
- Search by name (either script), GR number, class, APAAR ID
- **Never store the Aadhaar number itself** — store APAAR ID and a verified-flag only

**C. Document Engine** *(the reason schools buy)*
- **Leaving Certificate** (*शाळा सोडल्याचा दाखला*) — exact statutory layout, own serial register, DOB rendered in Marathi words, duplicate copies clearly marked *द्वितीय प्रत*
- **Bonafide Certificate** — with purpose variants (scholarship, bank, passport, caste certificate, domicile)
- **Student ID Card** — with photo, batch-printable by class
- Preview → confirm → serial number assigned and record locked → PDF
- Batch printing: whole class at once
- Every issued document permanently archived and re-downloadable

**D. Government Export**
- **UDISE+ / Integrated SARAL bulk-import file** generated to the exact current template: correct headers, one student per row, `.xlsx`, under 5MB
- **Pre-flight validation report** before export: missing APAAR, name-format problems, DOB implausible for class, invalid category codes, malformed mobile numbers, duplicates
- **Error-report round trip**: paste back the portal's failure report, we highlight the failing students, fix in-app, re-export only those rows
- Field mappings stored as versioned config per portal per year

**E. Onboarding (delivered as a paid service, not self-serve)**
- Bulk import from Excel where a school already has one
- Photograph GR pages → AI extraction → human verification screen → committed records
- Priced ₹5,000–15,000 one-time by student count

### v1.5 — only after a school that is not your father's has paid

- Daily attendance (register-style, class-wise, one screen)
- Fee receipts and a defaulter list — **receipts and tracking only, no payment gateway, no financing**
- More document types: caste/income certificate annexures, scholarship forms

### v2 — only on repeated paid demand

- Timetable and substitution *(the only trigger that justifies giving teachers logins)*
- MahaDBT scholarship verification support — **note: pre-matric schemes require government or aided institutions, so this helps the pilot but not most paying customers**
- Board exam form data export (MSBSHSE Class 10/12)

### Will not build

Library · hostel · inventory · transport/GPS · payroll · biometric devices · LMS/content · parent app · student app · alumni · admissions CRM · online fee payment · fee financing · report cards · WhatsApp broadcast · SMS blasts · multi-state support · anything outside Maharashtra State Board before 2029

> Print this list. When a principal asks for a library module, the answer is "that's not what this is," not "we'll consider it."

---

## 7. Data model (core)

```
schools          id, name_mr, name_en, udise_code, board_index, management_type,
                 medium, address, taluka, district, logo_path, principal_name_mr,
                 signature_path, created_at

academic_years   id, school_id, label, start_date, end_date, is_current

students         id, school_id, gr_number, apaar_id, aadhaar_verified,
                 first_name_mr/mid/last, first_name_en/mid/last,
                 dob, dob_in_words_mr, gender, mother_name_mr/en, father_name_mr/en,
                 caste, sub_caste, category, religion, nationality, mother_tongue,
                 birth_village, birth_taluka, birth_district, birth_state,
                 blood_group, admission_date, admission_class, previous_school,
                 last_class_passed, photo_path, status

enrollments      id, student_id, academic_year_id, class, division, roll_no

documents        id, school_id, student_id, doc_type, serial_no, issued_on,
                 issued_by_user_id, is_duplicate, payload_json, pdf_path

lc_details       document_id, date_of_leaving, last_attended, reason_mr,
                 progress, conduct, dues_cleared, remarks_mr

users            id, school_id, name, phone, email, role, password_hash, last_login

export_runs      id, school_id, academic_year_id, target, template_version,
                 generated_at, file_path, validation_summary_json

audit_log        id, school_id, user_id, entity, entity_id, action, before, after, at
```

**Key constraints**
- `UNIQUE(school_id, gr_number)` — the register's integrity
- `UNIQUE(school_id, doc_type, serial_no)` — statutory serial continuity
- Students are never hard-deleted; `documents` rows are immutable once issued
- `school_id` on every table; all reads and writes go through a tenant-scoped repository layer

---

## 8. Architecture

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router) + TypeScript | One codebase, best AI-assisted development support, easy to hire into later |
| UI | Tailwind + shadcn/ui | Fast, plain, no design debt |
| DB | PostgreSQL on the same box | One dependency. At 25 schools × 800 students this is ~20k rows. |
| ORM | Drizzle | Typed, thin, no magic |
| Auth | Session cookie, bcrypt, phone/email + password | No third party in the login path |
| PDF | Chromium (Playwright) rendering HTML → PDF, Noto Sans Devanagari | Pixel-exact statutory layouts, iterable in CSS |
| Excel | ExcelJS | UDISE+ templates are `.xlsx` and header-sensitive |
| i18n | JSON dictionaries, `mr` + `en` | Bilingual UI without a framework |
| Hosting | Docker Compose on a **DigitalOcean Bangalore** droplet, Caddy for TLS | Cheap, Indian data residency, Chromium runs natively |
| Backups | Nightly `pg_dump` → Cloudflare R2, weekly restore test | Free tier, and a restore you've never tested is not a backup |

**Multi-tenancy:** single database, `school_id` column everywhere, enforced in a repository layer. No row-level security in v1 — one fewer thing to debug at 3am.

**Why not Vercel + Supabase:** ~₹4,000/month on paid tiers (₹48k/year — over two schools' revenue), and serverless fights you on Chromium plus Devanagari fonts. This product is a printer; it wants a real Linux box.

### Running cost — all schools combined

| Item | Monthly |
|---|---|
| DigitalOcean Bangalore droplet (1 vCPU / 2GB) | ₹1,060 |
| Postgres, TLS, backups (R2 free tier), Sentry, UptimeRobot | ₹0 |
| `.in` domain | ₹65 |
| **Total** | **₹600 – ₹1,150** |

At 20 schools: **~₹58/school/month ≈ 3% of a ₹20,000 contract.**

---

## 9. Non-functional requirements

- **Marathi correctness is a P0 bug class.** Devanagari must render identically on screen and in PDF. Date-of-birth-in-words needs a dedicated, unit-tested Marathi number-to-words function.
- **Print fidelity.** Statutory documents must match the official layout on the school's own pre-printed stationery where used. Millimetre-level CSS, tested on a real printer at the pilot.
- **Works on a bad connection.** Rural Pune district. Server-rendered pages, small payloads, no heavy client bundles. **No offline sync** — it is a desktop tool in an office with a connection.
- **Restore under 30 minutes.** Documented runbook, tested monthly.
- **DPDP posture.** We are a Data Processor; the school is the Data Fiduciary. Data stays in India. No Aadhaar numbers stored. A written data-processing agreement in every contract. Full export and deletion on termination. Rule 11 exempts educational institutions from verifiable parental consent for school-purpose processing, but most obligations bite around mid-2027 — build for it now, it's cheap at this stage and expensive later.

---

## 10. Pricing

| Tier | Students | Annual |
|---|---|---|
| Small | ≤ 300 | ₹20,000 |
| Medium | 301 – 600 | ₹30,000 |
| Large | 601 – 1,000 | ₹45,000 |
| XL | 1,000+ | ₹60,000 |
| Onboarding / digitisation | any | ₹5,000 – 15,000 one-time |

Flat per school, tiered by size. **Never per student** — it penalises the school for growing and turns every renewal into a negotiation.

**Billing timed to the pain:** contracts renew in **August**, six weeks before the 30 September UDISE+ freeze. Nobody cancels the thing that files their UDISE+ data three weeks before the deadline.

### Unit economics at 20 schools

```
Revenue      20 × ₹27,000 avg                     ₹5,40,000/yr
Onboarding   20 × ₹8,000 (year one only)          ₹1,60,000
Infra        ₹1,000 × 12                          ₹  12,000
Gross                                             ₹5,28,000/yr  ≈ ₹44,000/month
```

Exceeds the ₹30–40k/month target. **The binding constraint is support:** budget 1.5 hours per school per month — 30 hours/month at 20 schools. That is the real reason scope stays small.

---

## 11. Timeline

Maharashtra AY 2027–28 begins **1 April 2027**. Everything works backwards from that.

| Window | Work | Gate |
|---|---|---|
| **Sept–Oct 2026** (8 weeks) | Build v1 — W1–2 data model, auth, student master, dual-script names · W3–4 Excel import + AI GR digitisation · W5–6 document engine (LC, bonafide, ID, serials, Marathi words) · W7 UDISE+ export mapper + validation · W8 harden, backups, deploy | Deployed, pilot data loaded |
| **Nov 2026** | Pilot live. All 200 students digitised. Real LCs and bonafides issued from the system. | Father says, unprompted, "I would pay for this" |
| **Dec 2026 – Feb 2027** | Sell. 12–15 demos through the principal network. Board exam forms and scholarship verification are happening — demo into live pain. | **≥1 non-father school signs a paid contract by 15 Feb 2027** |
| **Mar 2027** | Onboard signed schools — digitise their registers before the year starts | Signed schools live before 1 April |
| **Apr 2027** | AY 2027–28 opens with them on the system | — |
| **Aug–Sept 2027** | **UDISE+ freeze — the renewal event.** The export feature earns its keep and the contract renews. | Renewal rate |

**Kill criterion:** if no school outside your father's network has paid by **15 February 2027**, stop building and reassess. Written down now, while it is still cheap to be honest.

---

## 12. Success metrics

**Pilot (by 31 Dec 2026)**
- 100% of students digitised
- ≥ 20 documents issued from the system, zero handwritten
- SARAL/UDISE+ data prepared in under 2 hours versus weeks
- Clerk uses it unprompted, without being told to

**Commercial (by 31 Mar 2027)**
- ≥ 3 paying schools that are not your father's
- ≥ ₹60,000 contracted for AY 2027–28

**Year two (by 31 Mar 2028)**
- 20 paying schools
- ≥ 90% renewal
- ≤ 1.5 support hours per school per month

---

## 13. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Government changes the portal template | **High** | Mappings are versioned config, not code. Budget one week each August. |
| Integrated SARAL+UDISE has already reduced the pain | **High** | **Verify with your father this week before building.** If entry is now genuinely quick, the export feature weakens and documents must carry the product alone. |
| Registers never get digitised → product dies in month 3 | **High** | We do the digitisation, and charge for it. Never leave it to school staff. |
| Support load exceeds your available hours | **High** | Ruthless scope. Bilingual self-serve help. Refuse custom work. |
| Aided schools can't afford ₹20k | Medium | Target private unaided for revenue; pilot is a reference site, not a customer. |
| SchoolDeck and similar already sell this | Medium | **Go look at their demo and pricing before writing code.** Validates the niche; check where they're weak. |
| DPDP obligations from mid-2027 | Medium | Minimal data, India residency, DPA in contract, no Aadhaar storage. |
| Solo maintainer, no bus factor | Medium | Boring stack, tested backups, written runbook. |
| SCF/competency-based assessment churn | Low | We deliberately do not build report cards. |

---

## 14. Open items — get these from your father this week

Facts we cannot look up. Ranked by how much they unblock:

1. **A downloaded UDISE+ / Integrated SARAL bulk-import template (`.xlsx`)** — the single most valuable artifact. Everything in Section 6D depends on its exact headers.
2. **What the portal workflow actually looks like today**, post-integration — screenshots or a screen recording of the student entry screen. This confirms or kills the export feature.
3. **A blank current LC form and one filled example** (redacted) — the statutory layout we must reproduce exactly.
4. **Photographs of 2–3 General Register pages** — the real field set, and the input for the digitisation flow.
5. **A blank bonafide certificate**, plus the variants parents actually ask for.
6. School identifiers: **UDISE code, SARAL/board index number, management type**.
7. **How many hours the clerk spent on portal data entry last cycle** — this is the number that goes on the first slide of every sales conversation.
8. **How many bonafide/LC requests per month**, and the current turnaround.
9. **Every register and form maintained by hand** — the honest list, including the ones we will refuse to build.
10. A shortlist of **8–10 private unaided schools** in the district he can introduce you to in December.

---

*Draft for discussion. Nothing here is committed until the Section 14 items come back — particularly #1 and #2.*
