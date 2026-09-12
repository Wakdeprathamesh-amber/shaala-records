#!/bin/sh
# Restore from a backup. Run the drill in docs/RUNBOOK.md before you need this.
#
#   ./scripts/restore.sh shaala-2026-09-12T02-00-00Z.sql.gz "postgres://..."
#
# The target URL is a required argument rather than read from the environment,
# so restoring cannot silently overwrite production because a shell had the
# wrong variable exported.

set -eu

FILE="${1:?usage: restore.sh <backup.sql.gz> <target-database-url>}"
TARGET="${2:?usage: restore.sh <backup.sql.gz> <target-database-url>}"

[ -f "$FILE" ] || { echo "No such file: $FILE" >&2; exit 1; }
gzip -t "$FILE" || { echo "Archive is corrupt: $FILE" >&2; exit 1; }

echo "About to restore ${FILE}"
echo "         into    $(echo "$TARGET" | sed 's|://[^@]*@|://***@|')"
printf 'Type RESTORE to continue: '
read -r CONFIRM
[ "$CONFIRM" = "RESTORE" ] || { echo "Aborted."; exit 1; }

gunzip -c "$FILE" | psql "$TARGET" -v ON_ERROR_STOP=1

echo "Restored. Now verify:"
echo "  psql \"\$TARGET\" -c 'SELECT count(*) FROM students;'"
echo "  psql \"\$TARGET\" -c 'SELECT doc_type, max(serial_no) FROM documents GROUP BY 1;'"
