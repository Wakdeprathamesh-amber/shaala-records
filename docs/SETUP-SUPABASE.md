# Supabase setup — 10 minutes, one time

You do steps 1–4 (they need an account and a password, which I can't create for you).
I do everything after that.

---

## 1. Create the account

Go to **https://supabase.com** → **Start your project** → sign in with GitHub or email.

Free tier is enough for the pilot: 500 MB database, 5 GB bandwidth. No card required.

## 2. Create the project

Click **New project** and set:

| Field | Value |
|---|---|
| **Name** | `shaala-records` |
| **Database Password** | Click *Generate a password* — **then copy it somewhere safe** |
| **Region** | **South Asia (Mumbai)** `ap-south-1` |
| **Plan** | Free |

Two things that matter here:

- **Save the password before leaving the page.** Supabase only shows it once. If you
  lose it you can reset it under *Settings → Database → Reset database password* —
  not fatal, just annoying.
- **Region must be Mumbai.** The school is in Maharashtra; a US region adds ~250 ms
  to every single query. This cannot be changed later without recreating the project.

Provisioning takes about two minutes.

## 3. Copy the connection string

Click **Connect** in the top bar of the project (older dashboards: *Settings → Database
→ Connection string*).

You'll see several options. **Choose `Session pooler`** — the one on port **5432**
whose host looks like `aws-0-ap-south-1.pooler.supabase.com`.

> Why Session pooler and not the others:
> - **Direct connection** is IPv6-only now — it will fail on most Indian home/office ISPs.
> - **Transaction pooler** (port 6543) can't run schema migrations properly.
> - **Session pooler** works over IPv4 and supports migrations. This is the one we want.

It looks like this:

```
postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

## 4. Put it in `.env.local`

Open `.env.local` in the project root and replace the `DATABASE_URL` line.
Swap `[YOUR-PASSWORD]` for the password from step 2 — **including the brackets**, they
are a placeholder, not part of the value.

```
DATABASE_URL="postgresql://postgres.abcdefghijklmnop:your-real-password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
```

If your password contains `@`, `:`, `/`, `#` or `?`, it must be percent-encoded.
Tell me the password has special characters and I'll encode it for you — don't paste
the password itself into the chat.

`SESSION_SECRET` is already generated and filled in. Leave it alone.

---

## 5. Tell me it's done

I'll then run, and verify:

- connection check against your database
- `drizzle-kit generate` — build the migration from the schema
- `drizzle-kit migrate` — create the 13 tables
- `npm run db:seed` — pilot school, 2 users, 25 sample students
- `npm run dev` — and confirm login works end to end

---

## Notes for later

- **This is a real database on the internet.** `.env.local` is gitignored and must
  never be committed. The Supabase dashboard also shows a `service_role` key — we
  don't use it and you shouldn't paste it anywhere.
- **We use Supabase only as managed Postgres.** Not Supabase Auth, not their client
  SDK, not Row Level Security. Auth is our own bcrypt + server-side session table, per
  PRD principle 7 — so the app stays portable. Moving to a plain Postgres box later is
  a one-line change to `DATABASE_URL`, nothing else.
- **Free tier pauses after 7 days idle.** It resumes on the next request, taking about
  30 seconds. Fine for a pilot; upgrade to Pro ($25/mo) before real school use.
- **Backups:** free tier keeps none. Before the pilot goes live, either upgrade to Pro
  (daily backups) or schedule `pg_dump` — the register is a legal record.
