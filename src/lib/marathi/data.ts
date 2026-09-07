/**
 * Marathi numerals and calendar words.
 *
 * ⚠ AUDIT REQUIRED — this table has not yet been reviewed by a native Marathi
 * reader. It is printed verbatim onto leaving certificates, which are legal
 * documents a child carries for life. See docs/MARATHI-AUDIT.md before the
 * first LC is issued in production.
 *
 * Why a table and not an algorithm: Marathi 1–99 is irregular in a way Hindi
 * and English are not. The tens are fused with the units and the resulting
 * form is frequently unpredictable — ४१ is एक्केचाळीस, not *एकचाळीस; ५६ is
 * छप्पन्न, not *सहापन्नास. Worse, the numbers ending in 9 are built from the
 * NEXT decade: २९ is एकोणतीस, literally "one less than thirty". Any attempt to
 * generate these from parts produces words that are wrong but plausible, which
 * is the most dangerous kind of wrong on a statutory document.
 */

/** 0–99, indexed by value. */
export const ONES_TO_NINETY_NINE: readonly string[] = [
  "शून्य", "एक", "दोन", "तीन", "चार", "पाच", "सहा", "सात", "आठ", "नऊ",
  "दहा", "अकरा", "बारा", "तेरा", "चौदा", "पंधरा", "सोळा", "सतरा", "अठरा", "एकोणीस",
  "वीस", "एकवीस", "बावीस", "तेवीस", "चोवीस", "पंचवीस", "सव्वीस", "सत्तावीस", "अठ्ठावीस", "एकोणतीस",
  "तीस", "एकतीस", "बत्तीस", "तेहतीस", "चौतीस", "पस्तीस", "छत्तीस", "सदतीस", "अडतीस", "एकोणचाळीस",
  "चाळीस", "एक्केचाळीस", "बेचाळीस", "त्रेचाळीस", "चव्वेचाळीस", "पंचेचाळीस", "सेहेचाळीस", "सत्तेचाळीस", "अठ्ठेचाळीस", "एकोणपन्नास",
  "पन्नास", "एक्कावन्न", "बावन्न", "त्रेपन्न", "चोपन्न", "पंचावन्न", "छप्पन्न", "सत्तावन्न", "अठ्ठावन्न", "एकोणसाठ",
  "साठ", "एकसष्ट", "बासष्ट", "त्रेसष्ट", "चौसष्ट", "पासष्ट", "सहासष्ट", "सदुसष्ट", "अडुसष्ट", "एकोणसत्तर",
  "सत्तर", "एकाहत्तर", "बाहत्तर", "त्र्याहत्तर", "चौऱ्याहत्तर", "पंच्याहत्तर", "शहात्तर", "सत्याहत्तर", "अठ्ठ्याहत्तर", "एकोणऐंशी",
  "ऐंशी", "एक्याऐंशी", "ब्याऐंशी", "त्र्याऐंशी", "चौऱ्याऐंशी", "पंच्याऐंशी", "शहाऐंशी", "सत्त्याऐंशी", "अठ्ठ्याऐंशी", "एकोणनव्वद",
  "नव्वद", "एक्याण्णव", "ब्याण्णव", "त्र्याण्णव", "चौऱ्याण्णव", "पंच्याण्णव", "शहाण्णव", "सत्त्याण्णव", "अठ्ठ्याण्णव", "नव्याण्णव",
];

/** Hundreds, indexed by the hundreds digit. Index 1 is the *combining* form:
 *  a bare 100 is शंभर, but 101 is एकशे एक. */
export const HUNDREDS: readonly string[] = [
  "", "एकशे", "दोनशे", "तीनशे", "चारशे", "पाचशे", "सहाशे", "सातशे", "आठशे", "नऊशे",
];

/** Standalone 100. */
export const ONE_HUNDRED = "शंभर";

export const THOUSAND = "हजार";
export const LAKH = "लाख";

/** Gregorian months as written on Maharashtra school records. */
export const MONTHS: readonly string[] = [
  "जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून",
  "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर",
];

/** Devanagari digits, for printing numerals rather than words. */
export const DIGITS: readonly string[] = [
  "०", "१", "२", "३", "४", "५", "६", "७", "८", "९",
];
