# Marathi number audit — required before the first Leaving Certificate

**Status: NOT YET AUDITED.** Blocks production issuance of any LC.

## Why this document exists

`src/lib/marathi/data.ts` contains a hand-written table of Marathi number words.
It was written by an AI assistant that is not a native Marathi speaker, and it
is printed **verbatim onto leaving certificates** — legal documents a child
carries for the rest of their life and produces at every subsequent admission.

The failure mode here is not a crash. It is a certificate that reads fluently
and is wrong. Nobody will notice at issue time; it surfaces years later when a
college registrar rejects the document. So it needs a human who reads Marathi
to sign off, once, before the pilot goes live.

118 automated tests pass — but they only prove the code matches the table.
They cannot prove the table is right. That is what this review is for.

## How to do the review

Ask any Marathi-reading teacher or clerk at the pilot school — this needs about
ten minutes, not a linguist. For each row: is this how you would write it by
hand on a certificate? Mark ✓ or write the correction.

Return the marked-up file and the corrections go straight into `data.ts`, with
the tests updated to match.

### A. Date of birth, as printed on the LC

| तारीख | अक्षरी (in words) | ✓ / correction |
|---|---|---|
| १४/०३/२०११ | चौदा मार्च दोन हजार अकरा | |
| ०१/०१/१९९२ | एक जानेवारी एक हजार नऊशे ब्याण्णव | |
| ३१/१२/२००८ | एकतीस डिसेंबर दोन हजार आठ | |
| १५/०६/१९९९ | पंधरा जून एक हजार नऊशे नव्याण्णव | |
| २८/०२/२०१५ | अठ्ठावीस फेब्रुवारी दोन हजार पंधरा | |
| २९/०२/२०१६ | एकोणतीस फेब्रुवारी दोन हजार सोळा | |
| ०९/०९/२००४ | नऊ सप्टेंबर दोन हजार चार | |
| २०/११/२०२० | वीस नोव्हेंबर दोन हजार वीस | |
| १९/०४/१९९६ | एकोणीस एप्रिल एक हजार नऊशे शहाण्णव | |
| ०५/०५/२००१ | पाच मे दोन हजार एक | |
| ०७/०७/२०१३ | सात जुलै दोन हजार तेरा | |
| ३०/०८/१९९० | तीस ऑगस्ट एक हजार नऊशे नव्वद | |
| २५/१०/२०१८ | पंचवीस ऑक्टोबर दोन हजार अठरा | |
| २९/०३/२००९ | एकोणतीस मार्च दोन हजार नऊ | |
| १९/०७/२०१९ | एकोणीस जुलै दोन हजार एकोणीस | |

### B. The एकोण- forms (numbers ending in nine)

These are built from the *following* decade — २९ is literally "one less than
thirty" — and are the forms most often written incorrectly.

| # | शब्द | ✓ / correction |
|---|---|---|
| 29 | एकोणतीस | |
| 39 | एकोणचाळीस | |
| 49 | एकोणपन्नास | |
| 59 | एकोणसाठ | |
| 69 | एकोणसत्तर | |
| 79 | एकोणऐंशी | |
| 89 | एकोणनव्वद | |
| 99 | नव्याण्णव | |

Note that 99 breaks the pattern — it is नव्याण्णव, not *एकोणशंभर. Please
confirm this is right.

## Open questions I could not resolve

These are places where I made a judgement call. Each needs a decision, not just
a tick.

1. **1100 — `एक हजार शंभर` or `एक हजार एकशे`?**
   The code treats `एकशे` as a *combining* form used only when a remainder
   follows (एकशे एक = 101), and `शंभर` as the bare hundred. So 1100 prints as
   `एक हजार शंभर`. Is that right, or would a clerk write `अकराशे`?
   Low impact — no date of birth reaches this path — but fee amounts might.

2. **Month names.** These are the common Gregorian transliterations
   (जानेवारी, फेब्रुवारी, …). Does this school's LC format use these, or the
   Marathi calendar months? Check against an existing certificate.

3. **Date word order.** The code prints day–month–year
   (`चौदा मार्च दोन हजार अकरा`). Confirm against a real LC — some formats
   place the year first.

4. **`सत्याहत्तर` (77) vs `सत्त्याहत्तर`.** I used the single-त form for 77
   but the double-त form for 87 (`सत्त्याऐंशी`) and 97 (`सत्त्याण्णव`).
   Please check whether 77 should also be doubled — this inconsistency may be
   an error in my table.

## After sign-off

Replace the status line at the top with the reviewer's name and the date, and
delete the ⚠ AUDIT REQUIRED banner from `src/lib/marathi/data.ts`.
