<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Shaala Records — conventions

Read this before writing code. It is short because each rule exists to prevent
a specific failure that has legal or financial consequences for a school.

## The tenant rule

Every table except `schools` carries `school_id`. **Every** read and write goes
through a repository in `src/domain/<area>/repo.ts` that takes `Ctx` as its
first argument and builds its WHERE clause with `scoped()`.

Never write `db.select()` outside `src/db/` or a `repo.ts`.
`tests/unit/no-unscoped-queries.test.ts` fails the build if you do.

A missing `WHERE school_id = ?` does not throw and does not look wrong in
review. It puts one school's children on another school's certificates.

The one documented exception is `findByIdentifierForLogin`, because at login
there is no session yet — the school is established *from* the row it returns.

## Data that cannot be edited or deleted

- **Students are never hard-deleted.** Set `status` to `left` or `tc_issued`.
- **Issued documents are immutable.** `documents.payloadJson` snapshots what
  was printed. Editing a student afterwards must never change an issued
  certificate — it is a record of what was true when it was signed.
- **Serial numbers are never reused or skipped.** Allocation happens under
  `SELECT ... FOR UPDATE` inside the same transaction as the insert.
- **Aadhaar numbers are never accepted or stored.** Not in a column, not in a
  JSON blob, not in an import staging row. APAAR IDs are fine.

## Boundaries

- **Server Actions for mutations, Route Handlers only for file downloads.**
- **`requireCtx()` is the first line of every Server Action and Route Handler.**
  `proxy.ts` is an optimistic cookie check, not an authorization boundary.
- **Zod validates at every boundary** — form input, uploaded files, government
  error reports. Zod 4 syntax: `z.email()`, `{ error: ... }`.
- **No `any`.** No barrel files. No default exports except pages and layouts.

## Next.js 16 specifics

- Middleware is `proxy.ts`. `cookies()`, `headers()`, `params` and
  `searchParams` are all async — `await` them.
- A value imported from a `"use client"` module into a Server Component
  arrives as a client-reference proxy, not the value. Shared data (see
  `src/lib/nav.ts`) lives in a module that declares neither directive.
- Server Components cannot set cookies. Only Server Actions and Route
  Handlers can.

## Language

Marathi is the primary script; English is the fallback. UI strings live in
`src/lib/i18n/mr.json` with an exact-matching `en.json` — a test enforces that
the key sets are identical.

Numbers and dates printed on documents go through `src/lib/marathi/numbers.ts`.
That table is **not yet audited by a native reader** — see
`docs/MARATHI-AUDIT.md` before anything reaches a real certificate.

## Tests

- Vitest, `tests/unit/*.test.ts`. Name the behaviour, not the function:
  `"refuses a password bcrypt would silently truncate"`.
- Write expectations longhand. A test that derives its expected values from
  the same table it is testing proves nothing.
- TDD for anything transactional or statutory: failing test first.

## Commits

`type(scope): summary in the imperative`, then a body explaining *why*, and
what a reader would otherwise have to reconstruct. Note anything left
outstanding.
