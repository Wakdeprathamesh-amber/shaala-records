/**
 * These expectations are the specification, not the implementation's output.
 *
 * Marathi 1–99 is irregular and cannot be composed algorithmically — each form
 * is tabled. Every case below is written out longhand deliberately, because
 * this table is what a Marathi reader must audit before the first leaving
 * certificate is issued, and a test that derives its expectations from the
 * same table it is testing would prove nothing.
 */
import { describe, expect, it } from "vitest";

import { dateToMarathiWords, numberToMarathiWords } from "@/lib/marathi/numbers";

describe("numberToMarathiWords — units and teens", () => {
  const cases: Array<[number, string]> = [
    [0, "शून्य"],
    [1, "एक"],
    [2, "दोन"],
    [3, "तीन"],
    [4, "चार"],
    [5, "पाच"],
    [6, "सहा"],
    [7, "सात"],
    [8, "आठ"],
    [9, "नऊ"],
    [10, "दहा"],
    [11, "अकरा"],
    [12, "बारा"],
    [13, "तेरा"],
    [14, "चौदा"],
    [15, "पंधरा"],
    [16, "सोळा"],
    [17, "सतरा"],
    [18, "अठरा"],
    [19, "एकोणीस"],
  ];
  it.each(cases)("%i → %s", (n, expected) => {
    expect(numberToMarathiWords(n)).toBe(expected);
  });
});

describe("numberToMarathiWords — the एकोण- decade boundaries", () => {
  // These are the forms most often got wrong: 29, 39, 49... are built from
  // the NEXT decade ("one less than thirty"), not the current one.
  const cases: Array<[number, string]> = [
    [29, "एकोणतीस"],
    [39, "एकोणचाळीस"],
    [49, "एकोणपन्नास"],
    [59, "एकोणसाठ"],
    [69, "एकोणसत्तर"],
    [79, "एकोणऐंशी"],
    [89, "एकोणनव्वद"],
    [99, "नव्याण्णव"], // the exception to the exception — not एकोणशंभर
  ];
  it.each(cases)("%i → %s", (n, expected) => {
    expect(numberToMarathiWords(n)).toBe(expected);
  });
});

describe("numberToMarathiWords — round decades", () => {
  const cases: Array<[number, string]> = [
    [20, "वीस"],
    [30, "तीस"],
    [40, "चाळीस"],
    [50, "पन्नास"],
    [60, "साठ"],
    [70, "सत्तर"],
    [80, "ऐंशी"],
    [90, "नव्वद"],
  ];
  it.each(cases)("%i → %s", (n, expected) => {
    expect(numberToMarathiWords(n)).toBe(expected);
  });
});

describe("numberToMarathiWords — sampled irregulars across each decade", () => {
  const cases: Array<[number, string]> = [
    [21, "एकवीस"],
    [25, "पंचवीस"],
    [28, "अठ्ठावीस"],
    [31, "एकतीस"],
    [36, "छत्तीस"],
    [41, "एक्केचाळीस"],
    [45, "पंचेचाळीस"],
    [52, "बावन्न"],
    [56, "छप्पन्न"],
    [64, "चौसष्ट"],
    [68, "अडुसष्ट"],
    [71, "एकाहत्तर"],
    [76, "शहात्तर"],
    [82, "ब्याऐंशी"],
    [86, "शहाऐंशी"],
    [91, "एक्याण्णव"],
    [96, "शहाण्णव"],
  ];
  it.each(cases)("%i → %s", (n, expected) => {
    expect(numberToMarathiWords(n)).toBe(expected);
  });
});

describe("numberToMarathiWords — hundreds", () => {
  const cases: Array<[number, string]> = [
    [100, "शंभर"], // standalone 100 is शंभर, not एकशे
    [101, "एकशे एक"],
    [115, "एकशे पंधरा"],
    [200, "दोनशे"],
    [365, "तीनशे पासष्ट"],
    [500, "पाचशे"],
    [900, "नऊशे"],
    [999, "नऊशे नव्याण्णव"],
  ];
  it.each(cases)("%i → %s", (n, expected) => {
    expect(numberToMarathiWords(n)).toBe(expected);
  });
});

describe("numberToMarathiWords — years 1990 to 2020 inclusive", () => {
  const cases: Array<[number, string]> = [
    [1990, "एक हजार नऊशे नव्वद"],
    [1991, "एक हजार नऊशे एक्याण्णव"],
    [1992, "एक हजार नऊशे ब्याण्णव"],
    [1993, "एक हजार नऊशे त्र्याण्णव"],
    [1994, "एक हजार नऊशे चौऱ्याण्णव"],
    [1995, "एक हजार नऊशे पंच्याण्णव"],
    [1996, "एक हजार नऊशे शहाण्णव"],
    [1997, "एक हजार नऊशे सत्त्याण्णव"],
    [1998, "एक हजार नऊशे अठ्ठ्याण्णव"],
    [1999, "एक हजार नऊशे नव्याण्णव"],
    [2000, "दोन हजार"],
    [2001, "दोन हजार एक"],
    [2002, "दोन हजार दोन"],
    [2003, "दोन हजार तीन"],
    [2004, "दोन हजार चार"],
    [2005, "दोन हजार पाच"],
    [2006, "दोन हजार सहा"],
    [2007, "दोन हजार सात"],
    [2008, "दोन हजार आठ"],
    [2009, "दोन हजार नऊ"],
    [2010, "दोन हजार दहा"],
    [2011, "दोन हजार अकरा"],
    [2012, "दोन हजार बारा"],
    [2013, "दोन हजार तेरा"],
    [2014, "दोन हजार चौदा"],
    [2015, "दोन हजार पंधरा"],
    [2016, "दोन हजार सोळा"],
    [2017, "दोन हजार सतरा"],
    [2018, "दोन हजार अठरा"],
    [2019, "दोन हजार एकोणीस"],
    [2020, "दोन हजार वीस"],
  ];
  it.each(cases)("%i → %s", (n, expected) => {
    expect(numberToMarathiWords(n)).toBe(expected);
  });
});

describe("numberToMarathiWords — larger magnitudes", () => {
  const cases: Array<[number, string]> = [
    [1000, "एक हजार"],
    [1100, "एक हजार शंभर"], // AUDIT: एकशे is the combining form (एकशे एक = 101); bare hundred is शंभर
    [2026, "दोन हजार सव्वीस"],
    [10000, "दहा हजार"],
    [25000, "पंचवीस हजार"],
    [100000, "एक लाख"],
    [150000, "एक लाख पन्नास हजार"],
  ];
  it.each(cases)("%i → %s", (n, expected) => {
    expect(numberToMarathiWords(n)).toBe(expected);
  });
});

describe("numberToMarathiWords — refuses input it cannot render correctly", () => {
  it("rejects negatives", () => {
    expect(() => numberToMarathiWords(-1)).toThrow(RangeError);
  });
  it("rejects fractions, rather than silently rounding a legal figure", () => {
    expect(() => numberToMarathiWords(3.5)).toThrow(RangeError);
  });
  it("rejects NaN", () => {
    expect(() => numberToMarathiWords(Number.NaN)).toThrow(RangeError);
  });
  it("rejects values above one crore", () => {
    expect(() => numberToMarathiWords(10_000_000)).toThrow(RangeError);
  });
});

describe("dateToMarathiWords", () => {
  const cases: Array<[string, string]> = [
    ["2011-03-14", "चौदा मार्च दोन हजार अकरा"],
    ["1992-01-01", "एक जानेवारी एक हजार नऊशे ब्याण्णव"],
    ["2008-12-31", "एकतीस डिसेंबर दोन हजार आठ"],
    ["1999-06-15", "पंधरा जून एक हजार नऊशे नव्याण्णव"],
    ["2015-02-28", "अठ्ठावीस फेब्रुवारी दोन हजार पंधरा"],
    ["2016-02-29", "एकोणतीस फेब्रुवारी दोन हजार सोळा"], // leap day
    ["2004-09-09", "नऊ सप्टेंबर दोन हजार चार"],
    ["2020-11-20", "वीस नोव्हेंबर दोन हजार वीस"],
    ["1996-04-19", "एकोणीस एप्रिल एक हजार नऊशे शहाण्णव"],
    ["2001-05-05", "पाच मे दोन हजार एक"],
    ["2013-07-07", "सात जुलै दोन हजार तेरा"],
    ["1990-08-30", "तीस ऑगस्ट एक हजार नऊशे नव्वद"],
    ["2018-10-25", "पंचवीस ऑक्टोबर दोन हजार अठरा"],
  ];
  it.each(cases)("%s → %s", (iso, expected) => {
    expect(dateToMarathiWords(new Date(`${iso}T00:00:00Z`))).toBe(expected);
  });

  it("reads the date in UTC, so a certificate does not shift by a day near midnight", () => {
    // 2011-03-14T23:30:00Z is still the 15th in IST but must print as the 14th,
    // because the stored value is a calendar date, not an instant.
    expect(dateToMarathiWords(new Date("2011-03-14T23:30:00Z"))).toBe(
      "चौदा मार्च दोन हजार अकरा",
    );
  });

  it("rejects an invalid date rather than printing 'Invalid Date'", () => {
    expect(() => dateToMarathiWords(new Date("nonsense"))).toThrow(RangeError);
  });
});
