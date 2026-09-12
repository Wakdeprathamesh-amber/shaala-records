#!/bin/sh
# Nightly database backup.
#
# The General Register is a legal record. A school that loses it cannot
# reconstruct it — the paper original is exactly what this replaced.
#
# Requires in .env.production:
#   DATABASE_URL          the same connection string the app uses
#   R2_BUCKET             e.g. shaala-backups
#   R2_ENDPOINT           https://<account>.r2.cloudflarestorage.com
#   AWS_ACCESS_KEY_ID     R2 token id
#   AWS_SECRET_ACCESS_KEY R2 token secret
#
# Retention is 30 days. Tested restores matter more than backup count — see
# docs/RUNBOOK.md, which requires a restore drill before the pilot goes live.

set -eu

: "${DATABASE_URL:?DATABASE_URL is not set}"

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
DIR="${BACKUP_DIR:-/backups}"
FILE="${DIR}/shaala-${STAMP}.sql.gz"

mkdir -p "$DIR"

echo "[backup] dumping to ${FILE}"

# --no-owner and --no-acl so the dump restores into a fresh database whose
# roles differ from production's — which is exactly the situation during a
# real recovery, and the one people discover too late.
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  | gzip -9 > "$FILE"

SIZE=$(wc -c < "$FILE")
if [ "$SIZE" -lt 10000 ]; then
  echo "[backup] FAILED: dump is only ${SIZE} bytes — refusing to upload or rotate" >&2
  rm -f "$FILE"
  exit 1
fi

# Verify the archive is readable before trusting it. A corrupt gzip that
# uploads successfully is the worst outcome: it looks like a backup.
gzip -t "$FILE"
echo "[backup] ok — ${SIZE} bytes, archive verified"

if [ -n "${R2_BUCKET:-}" ] && [ -n "${R2_ENDPOINT:-}" ]; then
  echo "[backup] uploading to R2"
  aws s3 cp "$FILE" "s3://${R2_BUCKET}/$(basename "$FILE")" \
    --endpoint-url "$R2_ENDPOINT" \
    --only-show-errors
  echo "[backup] uploaded"
else
  echo "[backup] R2 not configured — keeping local copy only" >&2
fi

# Rotate local copies. Remote retention is set as an R2 lifecycle rule, not
# here, so a compromised app server cannot delete the off-site history.
find "$DIR" -name 'shaala-*.sql.gz' -mtime +30 -delete
echo "[backup] done"
