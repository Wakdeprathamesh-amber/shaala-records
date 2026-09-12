/**
 * Guards against the two dictionaries drifting apart. A key added to Marathi
 * and forgotten in English renders the raw key on screen for English users —
 * visible, but only to whoever happens to toggle.
 */
import { describe, expect, it } from "vitest";

import mr from "@/lib/i18n/mr.json";
import en from "@/lib/i18n/en.json";
import { translator, otherLocale, isLocale } from "@/lib/i18n";

describe("dictionaries", () => {
  it("have identical key sets", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(mr).sort());
  });

  it("have no empty strings", () => {
    const empties = [...Object.entries(mr), ...Object.entries(en)]
      .filter(([, v]) => !v || !String(v).trim())
      .map(([k]) => k);
    expect(empties).toEqual([]);
  });

  it("keep Marathi actually in Devanagari", () => {
    // Catches an English string pasted into mr.json by mistake. Keys whose
    // value is legitimately Latin in both are excluded.
    const latinOnly = Object.entries(mr)
      .filter(([, v]) => /^[\x00-\x7F]+$/.test(String(v)))
      .map(([k]) => k);
    expect(latinOnly).toEqual([]);
  });
});

describe("translator", () => {
  it("returns Marathi for mr", () => {
    expect(translator("mr")("nav.students")).toBe("विद्यार्थी");
  });

  it("returns English for en", () => {
    expect(translator("en")("nav.students")).toBe("Students");
  });

  it("falls back to the key rather than blank", () => {
    // @ts-expect-error deliberately unknown key
    expect(translator("mr")("no.such.key")).toBe("no.such.key");
  });
});

describe("locale helpers", () => {
  it("toggles", () => {
    expect(otherLocale("mr")).toBe("en");
    expect(otherLocale("en")).toBe("mr");
  });
  it("validates", () => {
    expect(isLocale("mr")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
