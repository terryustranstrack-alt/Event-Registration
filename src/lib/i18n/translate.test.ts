import { describe, expect, it } from "vitest";
import { dictionaryEn } from "./dictionary-en";
import { dictionaryId } from "./dictionary-id";
import { getTranslator, pickLocalized } from "./translate";
import { formatDate, formatRupiah } from "./format";

describe("i18n", () => {
  it("has every English key in Indonesian", () => {
    expect(Object.keys(dictionaryId).sort()).toEqual(Object.keys(dictionaryEn).sort());
  });

  it("interpolates variables", () => {
    expect(getTranslator("en")("public.seatsLeft", { left: 3, total: 10 })).toBe("3 of 10 seats left");
    expect(getTranslator("id")("public.seatsLeft", { left: 3, total: 10 })).toBe("Sisa 3 dari 10 kursi");
  });

  it("falls back to the other language for org content", () => {
    expect(pickLocalized("id", "Hello", "")).toBe("Hello");
    expect(pickLocalized("id", "Hello", "Halo")).toBe("Halo");
    expect(pickLocalized("en", null, "Halo")).toBe("Halo");
  });


  it("formats dates and rupiah per PRD examples", () => {
    expect(formatDate("2026-12-20T03:00:00Z", "en")).toBe("Dec 20, 2026");
    expect(formatDate("2026-12-20T03:00:00Z", "id")).toBe("20 Des 2026");
    expect(formatRupiah(150000)).toBe("Rp 150.000");
  });
});
