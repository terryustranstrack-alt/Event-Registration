import { describe, expect, it } from "vitest";
import { detectUploadType, fileContentMatchesType } from "./upload-file-signature";

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// Awal file program Windows (.exe): "MZ".
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00];

describe("detectUploadType", () => {
  it("recognizes PDF, JPG and PNG by their content", () => {
    expect(detectUploadType(new Uint8Array(PDF))).toBe("application/pdf");
    expect(detectUploadType(new Uint8Array(JPG))).toBe("image/jpeg");
    expect(detectUploadType(new Uint8Array(PNG))).toBe("image/png");
  });

  it("rejects anything else, including too-short files", () => {
    expect(detectUploadType(new Uint8Array(EXE))).toBeNull();
    expect(detectUploadType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(detectUploadType(new Uint8Array([]))).toBeNull();
  });
});

describe("fileContentMatchesType", () => {
  it("accepts a file whose content matches its claimed type", async () => {
    expect(await fileContentMatchesType(new Blob([new Uint8Array(PNG)], { type: "image/png" }))).toBe(true);
  });

  it("rejects a renamed program pretending to be a JPG", async () => {
    expect(await fileContentMatchesType(new Blob([new Uint8Array(EXE)], { type: "image/jpeg" }))).toBe(false);
  });

  it("rejects a real PNG that claims to be a PDF", async () => {
    expect(await fileContentMatchesType(new Blob([new Uint8Array(PNG)], { type: "application/pdf" }))).toBe(false);
  });
});
