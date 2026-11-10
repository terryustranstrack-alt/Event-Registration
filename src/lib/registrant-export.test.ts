import { describe, expect, it } from "vitest";
import { buildRegistrantTable, toCsv } from "./registrant-export";
import type { FormField } from "@/lib/domain-types";

const base = {
  event_id: "e", org_id: "o", position: 0, help_en: null, help_id: null, placeholder_en: null, placeholder_id: null,
  required: false, min_value: null, max_value: null, archived_at: null,
};
const fields: FormField[] = [
  { ...base, id: "a", type: "radio", label_en: "Size", label_id: "Ukuran", options: [{ value: "s", label_en: "Small", label_id: "Kecil" }] },
  { ...base, id: "b", type: "short_text", label_en: "Old", label_id: null, options: [], archived_at: "2026-01-01" },
];

describe("registrant export", () => {
  it("includes archived fields and option labels", () => {
    const { header, rows } = buildRegistrantTable(
      fields,
      [{ full_name: "Budi", email: "b@x.id", language: "id", status: "registered", created_at: "t", checked_in_at: null, ticket_code: "c", consent_at: null, answers: { a: "s", b: "kept" } }],
      "id",
    );
    expect(header.slice(-2)).toEqual(["Ukuran", "Old (deleted)"]);
    expect(rows[0].slice(-2)).toEqual(["Kecil", "kept"]);
  });

  it("escapes CSV and blocks formula injection", () => {
    const csv = toCsv(["a"], [["=HYPERLINK(1)"], ['x,"y"']]);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain('"x,""y"""');
    expect(csv.startsWith("﻿")).toBe(true);
  });
});
