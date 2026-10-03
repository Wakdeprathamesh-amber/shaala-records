# Runbook — Shaala Records

Operational procedures for whoever keeps this running. Written to be followed
under pressure by someone who did not build it.

---

## What this system is

A multi-tenant register for Maharashtra schools. It holds children's personal
data and produces legal documents. Two consequences shape everything below:

1. **The database is the product.** The app can be rebuilt from git in
   minutes. The register cannot be rebuilt at all — the paper original is what
   it replaced.
2. **Issued documents are immutable.** Never edit `documents` rows or their
   `payload_json`. A certificate is a statement about what was true when it
   was signed.

---

## Deploying

```bash
git pull
docker compose -f docker-compose.prod.yml build
npm run db:migrate            # run BEFORE switching traffic
docker compose -f docker-compose.prod.yml up -d
```

Migrations run separately and first, on purpose. Running them inside container
start means a failed migration takes the site down with it, and two replicas
starting together race each other.

Verify:

```bash
curl -fsS https://<domain>/api/health && echo OK
```

## First deployment — Oracle Cloud, Mumbai

Everything on one box: app, Postgres, Caddy, daily backup. One machine to
back up, restore, and reason about at 9pm.

Budget about two hours of hands-on work. The calendar time is hostage to two
things outside your control: Oracle's signup review, which for Indian cards
often goes manual, and ARM capacity in Mumbai, which is frequently exhausted.
If either blocks you for more than a day, an Indian VPS provisions in five
minutes and nothing below changes except the hostname.

### 1. The instance

Always Free gives 2 OCPU and 12GB of ARM (Ampere A1) plus 200GB of block
storage — Oracle [halved that from 4/24 in June 2026](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/)
without announcing it, so older guides overstate it. 12GB is still generous
here; the app and Postgres together idle well under 2GB.

- Shape **VM.Standard.A1.Flex**, 2 OCPU / 12GB, Ubuntu 24.04 (**aarch64**).
- Region **Mumbai** or **Hyderabad**. The app must sit next to its database;
  a hop to another continent costs ~150ms on every query and page loads make
  several.
- If the console says "out of capacity", retry at a different hour or switch
  availability domain. This is normal and not a problem with your account.

ARM is fine: the Dockerfile installs Debian's Chromium rather than
Playwright's bundled build, and Debian ships an arm64 Chromium. Nothing in
the stack is x86-only.

### 2. Open the ports — both places

Oracle blocks 80 and 443 in **two** independent layers, and missing either
leaves Caddy unable to get a certificate with no useful error:

1. **VCN → Security List → Ingress**: allow TCP 80 and 443 from 0.0.0.0/0.
2. **On the host**, Ubuntu images ship iptables rules that drop them:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Do **not** open 5432. Postgres has no `ports:` entry in the self-hosted
compose file and is reachable only from the compose network.

### 3. Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

### 4. DNS before TLS

Point an A record at the instance's public IP and wait for it to resolve
**before** starting the stack. Caddy asks Let's Encrypt for a certificate on
boot; if the name does not resolve yet the request fails and retries with a
backoff that can take an hour to clear.

```bash
dig +short shaala.yourschool.org    # must return the instance IP
```

### 5. Configure and start

```bash
git clone https://github.com/Wakdeprathamesh-amber/shaala-records.git
cd shaala-records
cp .env.production.example .env.production
chmod 600 .env.production
openssl rand -base64 32    # POSTGRES_PASSWORD
openssl rand -base64 48    # SESSION_SECRET
# fill in those two, SHAALA_DOMAIN, SHAALA_TLS_EMAIL, and the R2 block

docker compose --env-file .env.production \
               -f docker-compose.selfhosted.yml up -d --build
```

`--env-file` is not optional. The `env_file:` key passes variables into
containers; it does not feed the `${...}` substitutions the compose file
itself uses. Without the flag compose stops on a missing
`POSTGRES_PASSWORD`.

The first build takes 15-25 minutes on 2 ARM OCPUs — `npm ci`, `next build`
and a Chromium install.

### 6. Migrate and create the school

```bash
docker compose --env-file .env.production -f docker-compose.selfhosted.yml \
  exec app npm run db:migrate

docker compose --env-file .env.production -f docker-compose.selfhosted.yml \
  exec app npm run db:create-school -- --config docs/clients/<school>.json
```

The second command prints a principal password once and never writes it to
disk. Give it to them directly, not over email.

Never run `db:seed` here. It deletes and recreates its demo school.

### 7. Before anyone issues a certificate

- Set each document type's starting serial to continue the paper register.
  A school already at bonafide 446 must not restart at 1 — see
  **Things that must never be done**.
- Confirm backups reach R2, then do the restore drill below. A backup nobody
  has restored is a hope, not a backup — and Oracle terminates idle Always
  Free instances, boot volume included.

## Rolling back

The app is stateless; the database is not.

```bash
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

**A rollback does not undo a migration.** Drizzle migrations here are additive
(new tables, new columns, new indexes), so an older app runs against a newer
schema without noticing. If a migration ever drops or renames something, that
property is gone and the rollback becomes a restore — write the down-migration
in the same commit or do not merge it.

---

## Backups

Nightly `pg_dump | gzip` to Cloudflare R2, 30-day retention, via the `backup`
service in the compose file.

The script refuses to upload a dump under 10KB and verifies the gzip before
trusting it. A corrupt archive that uploads cleanly is the worst outcome,
because it looks like a backup.

Remote retention is an **R2 lifecycle rule**, not a `find -delete` on the
server. A compromised app server must not be able to erase the off-site
history.

Check backups are actually happening:

```bash
docker compose -f docker-compose.prod.yml logs backup --tail 50
aws s3 ls s3://$R2_BUCKET/ --endpoint-url $R2_ENDPOINT | tail -5
```

### Restore drill — required before the pilot goes live

**The requirement is a tested time-to-restore under 30 minutes.** An untested
backup is not a backup.

Do this against a scratch database, not production:

```bash
# 1. Fetch the most recent backup
aws s3 cp "s3://$R2_BUCKET/$(aws s3 ls s3://$R2_BUCKET/ --endpoint-url $R2_ENDPOINT | tail -1 | awk '{print $4}')" . \
  --endpoint-url $R2_ENDPOINT

# 2. Restore into a scratch database
./scripts/restore.sh shaala-<stamp>.sql.gz "postgres://.../shaala_restore_test"

# 3. Verify — these three numbers must match production
psql "$SCRATCH" -c 'SELECT count(*) FROM students;'
psql "$SCRATCH" -c 'SELECT doc_type, max(serial_no) FROM documents GROUP BY 1;'
psql "$SCRATCH" -c 'SELECT count(*) FROM documents;'
```

Record the wall-clock time. If it exceeds 30 minutes, find out why before a
real incident does it for you.

---

## Common problems

### Certificates print as empty boxes (tofu)

The Devanagari font is missing. The app embeds its own face as a data URI, so
this means the container was built wrong.

```bash
docker compose -f docker-compose.prod.yml exec app ls -la src/assets/fonts/
docker compose -f docker-compose.prod.yml exec app fc-list | grep -i devanagari
```

Both should return results. If `src/assets/fonts/` is empty, the `COPY` of
`src/assets` was dropped from the Dockerfile.

### PDF generation hangs or the container restarts under load

Chromium ran out of shared memory. Confirm `shm_size: "512mb"` is set on the
`app` service — the Docker default of 64MB is not enough for a batch of ID
cards.

### "Serial allocation failed" when issuing

The `document_counters` row is missing for that school and type. Allocation
inserts one on demand, so this indicates a permissions problem rather than
missing data. Check the app's database role can write to `document_counters`.

**Never fix this by setting `next_serial` by hand** without first checking the
existing maximum:

```sql
SELECT doc_type, max(serial_no) FROM documents WHERE school_id = '<id>' GROUP BY 1;
```

Setting it too low causes a unique-constraint failure on the next issue.
Setting it too high leaves a permanent gap in a statutory register.

### A student's name is wrong on an already-issued certificate

Fix the student record, then **issue a duplicate**. Do not edit `payload_json`.
The original stands as a record of what was signed; the reprint carries the
same serial and is marked द्वितीय प्रत.

### Export rejected by the portal

Upload the portal's rejection file at `/exports` — it matches the rows back to
students by APAAR, GR number or English name, and re-exports only the failures.
Do not resubmit the whole file.

### Everyone is logged out at once

Either `SESSION_SECRET` changed, or no academic year is marked current. The
second is more likely after settings changes:

```sql
SELECT id, label, is_current FROM academic_years WHERE school_id = '<id>';
```

Exactly one row per school must have `is_current = true`.

---

## Things that must never be done

- **Never delete a student.** Set `status`. Their leaving certificate must
  remain verifiable years later.
- **Never edit or delete a `documents` row.**
- **Never reuse or renumber a serial.**
- **Never store an Aadhaar number.** Not in a column, not in a JSON blob, not
  in an import staging row. The verification flag is all that is kept, and
  storing the number would make the school a data fiduciary under DPDP with
  obligations it cannot meet.
- **Never point a staging deployment at the production database.** The seed
  script deletes and recreates its school.

---

## Before the pilot goes live

- [ ] Marathi number table signed off — see `docs/MARATHI-AUDIT.md`.
      **Blocks issuing any real certificate.**
- [ ] Restore drill completed and timed under 30 minutes.
- [ ] R2 lifecycle rule configured for 30-day retention.
- [ ] Real UDISE+ workbook obtained and
      `src/domain/exports/templates/udise-2026-27.json` headers replaced with
      its actual column names. The current file is a documented best guess.
- [ ] Supabase upgraded off the free tier, or Postgres moved in-house — the
      free tier keeps no backups and pauses after 7 days idle.
- [ ] Seed users (`principal@wadgaon.test`, `clerk@wadgaon.test`) removed and
      real accounts created through Settings.
