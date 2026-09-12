import { describe, expect, it } from "vitest";

import { daysUntilSeptember30 } from "@/lib/deadline";

describe("daysUntilSeptember30", () => {
  it("counts forward within the same year", () => {
    expect(daysUntilSeptember30(new Date("2026-09-01T00:00:00Z"))).toBe(29);
  });

  it("returns zero on the day itself, rather than rolling to next year", () => {
    expect(daysUntilSeptember30(new Date("2026-09-30T00:00:00Z"))).toBe(0);
  });

  it("rolls to next year the day after", () => {
    expect(daysUntilSeptember30(new Date("2026-10-01T00:00:00Z"))).toBe(364);
  });

  it("is unaffected by the time of day", () => {
    const morning = daysUntilSeptember30(new Date("2026-09-01T01:00:00Z"));
    const evening = daysUntilSeptember30(new Date("2026-09-01T23:00:00Z"));
    expect(morning).toBe(evening);
  });

  it("handles a leap year correctly", () => {
    // 2027-09-30 to 2028-09-30 spans 29 Feb 2028.
    expect(daysUntilSeptember30(new Date("2027-10-01T00:00:00Z"))).toBe(365);
  });
});
