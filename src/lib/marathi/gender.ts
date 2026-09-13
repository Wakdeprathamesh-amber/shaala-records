/**
 * Gendered Marathi forms for certificates.
 *
 * Marathi inflects for gender, so a certificate cannot be written once and
 * used for everyone. Pre-printed forms — including the first client's own
 * bonafide — solve this by printing both and having the clerk strike one out:
 *
 *     दाखला देण्यात येतो की, कुमार / कुमारी  ______
 *     त्याची / तिची वर्तणूक समाधानकारक आहे / होती
 *
 * We know the student's gender, so we can print the right one and leave no
 * strike-throughs on a legal document. Where gender is not recorded, we fall
 * back to the slashed pair rather than guessing — a wrong grammatical gender
 * on a child's certificate is worse than an unfilled form.
 *
 * ⚠ These pairs are part of what needs native review — see docs/MARATHI-AUDIT.md.
 */
export type Gendered = "male" | "female" | "other" | null | undefined;

/** Picks the masculine or feminine form, or prints both when unknown. */
export function g(gender: Gendered, masculine: string, feminine: string): string {
  if (gender === "male") return masculine;
  if (gender === "female") return feminine;
  // "other" and unrecorded both fall back: Marathi has no established
  // third form on statutory documents, and inventing one here is not our call.
  return `${masculine} / ${feminine}`;
}

/** कुमार / कुमारी — the honorific before a student's name. */
export const honorific = (gender: Gendered) => g(gender, "कुमार", "कुमारी");

/** हा / ही — "he" / "she". */
export const he = (gender: Gendered) => g(gender, "हा", "ही");

/** त्याचे / तिचे — "his" / "her" (neuter object). */
export const his = (gender: Gendered) => g(gender, "त्याचे", "तिचे");

/** त्याची / तिची — "his" / "her" (feminine object, e.g. वर्तणूक, जात). */
export const hisF = (gender: Gendered) => g(gender, "त्याची", "तिची");

/** त्यांना / तिला — dative. */
export const toThem = (gender: Gendered) => g(gender, "त्याला", "तिला");
