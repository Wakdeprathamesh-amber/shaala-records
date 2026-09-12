/**
 * The UDISE+ student data deadline is 30 September each year. Counting down to
 * it sits on the dashboard because missing it is the failure the whole product
 * exists to prevent — it withholds the school's grant.
 *
 * Pure and UTC-based so it is directly testable and does not shift with the
 * server's timezone.
 */
export function daysUntilSeptember30(now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  const thisYear = Date.UTC(year, 8, 30); // month 8 = September
  const startOfToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const target = startOfToday <= thisYear ? thisYear : Date.UTC(year + 1, 8, 30);
  return Math.round((target - startOfToday) / 86_400_000);
}
