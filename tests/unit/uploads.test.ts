/**
 * The upload store is the one place where a caller-supplied string becomes a
 * filesystem path, so its validation is worth testing directly. A traversal
 * here would let one school read another's student photographs.
 */
import { describe, expect, it } from "vitest";

import { isStoredPath, sniffImageType } from "@/lib/uploads/store";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);

describe("sniffImageType", () => {
  it("identifies by magic number, not by name or header", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(WEBP)).toBe("image/webp");
  });

  it("rejects anything else, whatever it claims to be", () => {
    expect(sniffImageType(Buffer.from("<?php system($_GET[0]); ?>"))).toBeNull();
    expect(sniffImageType(Buffer.from("GIF89a and then some"))).toBeNull();
    expect(sniffImageType(Buffer.from("%PDF-1.4"))).toBeNull();
  });

  it("rejects a file too short to identify", () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe("isStoredPath", () => {
  const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  const other = "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

  it("accepts the shape we write", () => {
    expect(isStoredPath(`student-photo/${uuid}/${other}.jpg`)).toBe(true);
    expect(isStoredPath(`school-logo/${uuid}/${other}.png`)).toBe(true);
    expect(isStoredPath(`student-photo/${uuid}/${other}.webp`)).toBe(true);
  });

  it("rejects traversal in every segment", () => {
    for (const bad of [
      `student-photo/../../etc/passwd`,
      `student-photo/${uuid}/../../../etc/passwd`,
      `../student-photo/${uuid}/${other}.jpg`,
      `student-photo/${uuid}/..%2F..%2Fetc%2Fpasswd`,
    ]) {
      expect(isStoredPath(bad), bad).toBe(false);
    }
  });

  it("rejects an absolute path", () => {
    expect(isStoredPath(`/etc/passwd`)).toBe(false);
    expect(isStoredPath(`/student-photo/${uuid}/${other}.jpg`)).toBe(false);
  });

  it("rejects an unexpected kind or extension", () => {
    expect(isStoredPath(`secrets/${uuid}/${other}.jpg`)).toBe(false);
    expect(isStoredPath(`student-photo/${uuid}/${other}.svg`)).toBe(false);
    expect(isStoredPath(`student-photo/${uuid}/${other}.php`)).toBe(false);
  });

  it("rejects a school segment that is not a uuid", () => {
    expect(isStoredPath(`student-photo/all/${other}.jpg`)).toBe(false);
  });
});
