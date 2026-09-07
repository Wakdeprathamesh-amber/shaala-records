/**
 * Numbers and dates in Marathi words, for statutory documents.
 *
 * The leaving certificate prints a child's date of birth in words as well as
 * figures — that redundancy is the point, since it makes the date hard to
 * alter after issue. So these functions throw rather than guess: a certificate
 * carrying "Invalid Date" is embarrassing, but one carrying a silently wrong
 * date is a legal problem for the school and the child both.
 */
import {
  HUNDREDS,
  LAKH,
  MONTHS,
  ONE_HUNDRED,
  ONES_TO_NINETY_NINE,
  THOUSAND,
} from "./data";

const MAX = 9_999_999; // one below a crore

/** Renders 1–999. Assumes n is in range. */
function underThousand(n: number): string {
  if (n < 100) return ONES_TO_NINETY_NINE[n];

  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  // A bare hundred is शंभर; combined with a remainder it becomes एकशे.
  const head = hundreds === 1 && rest === 0 ? ONE_HUNDRED : HUNDREDS[hundreds];
  return rest === 0 ? head : `${head} ${ONES_TO_NINETY_NINE[rest]}`;
}

/**
 * 1992 → "एक हजार नऊशे ब्याण्णव"
 *
 * Supports 0 to 99,99,999. Throws RangeError on anything it cannot render
 * exactly — negatives, fractions, NaN, or values a crore and above.
 */
export function numberToMarathiWords(n: number): string {
  if (!Number.isInteger(n)) {
    throw new RangeError(
      `numberToMarathiWords expects a whole number, received ${n}. ` +
        `Rounding is refused because these values are printed on legal documents.`,
    );
  }
  if (n < 0 || n > MAX) {
    throw new RangeError(
      `numberToMarathiWords supports 0 to ${MAX}, received ${n}.`,
    );
  }

  if (n === 0) return ONES_TO_NINETY_NINE[0];

  const parts: string[] = [];

  const lakhs = Math.floor(n / 100_000);
  if (lakhs > 0) parts.push(`${underThousand(lakhs)} ${LAKH}`);

  const thousands = Math.floor((n % 100_000) / 1000);
  if (thousands > 0) parts.push(`${underThousand(thousands)} ${THOUSAND}`);

  const rest = n % 1000;
  if (rest > 0) parts.push(underThousand(rest));

  return parts.join(" ");
}

/**
 * 2011-03-14 → "चौदा मार्च दोन हजार अकरा"
 *
 * Read in UTC on purpose. A date of birth is a calendar date, not an instant;
 * interpreting it in the local zone would print the wrong day for any value
 * stored near midnight, which for an IST server is a five-and-a-half hour
 * window every single day.
 */
export function dateToMarathiWords(d: Date): string {
  if (Number.isNaN(d.getTime())) {
    throw new RangeError("dateToMarathiWords received an invalid Date.");
  }

  const day = numberToMarathiWords(d.getUTCDate());
  const month = MONTHS[d.getUTCMonth()];
  const year = numberToMarathiWords(d.getUTCFullYear());

  return `${day} ${month} ${year}`;
}

/** Renders a number in Devanagari figures — "१९९२" — for the numeral half of
 *  the certificate, where the words carry the legal weight. */
export function toDevanagariDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => "०१२३४५६७८९"[Number(d)]);
}
