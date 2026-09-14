/**
 * The upload path has always accepted .csv. Until a CSV branch existed it
 * reached ExcelJS, failed as "not a zip file", and the clerk was told to save
 * it as .xlsx — so the one format a school is most likely to send back was the
 * one that bounced.
 */
import { describe, expect, it } from "vitest";

import { parseCsv } from "@/domain/exports/workbook";

describe("parseCsv", () => {
  it("reads a plain row", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps a comma inside a quoted field", () => {
    // A school's previous-school name has one. Getting this wrong shifts every
    // later column by one, silently, and the wrong data lands in the wrong field.
    expect(parseCsv('gr,school,class\n1,"जिल्हा परिषद शाळा, रावडी",8')).toEqual([
      ["gr", "school", "class"],
      ["1", "जिल्हा परिषद शाळा, रावडी", "8"],
    ]);
  });

  it("unescapes a doubled quote inside a quoted field", () => {
    expect(parseCsv('a\n"He said ""yes"""')).toEqual([["a"], ['He said "yes"']]);
  });

  it("strips the UTF-8 BOM Excel writes", () => {
    // Left in place it becomes part of the first header, which then matches
    // no alias and the GR number column goes unmapped.
    const [header] = parseCsv("﻿जनरल रजिस्टर क्र.,नाव");
    expect(header[0]).toBe("जनरल रजिस्टर क्र.");
    expect(header[0].charCodeAt(0)).not.toBe(0xfeff);
  });

  it("handles CRLF from Windows Excel", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps empty cells, so column positions do not shift", () => {
    expect(parseCsv("a,b,c\n1,,3")).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
    ]);
  });

  it("keeps a newline inside a quoted field", () => {
    expect(parseCsv('a,b\n"line1\nline2",x')).toEqual([
      ["a", "b"],
      ["line1\nline2", "x"],
    ]);
  });

  it("drops trailing blank lines every editor adds", () => {
    expect(parseCsv("a,b\n1,2\n\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns nothing for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
