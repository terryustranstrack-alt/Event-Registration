import { describe, expect, it } from "vitest";
import type { FormField } from "@/lib/domain-types";
import { validateCustomFields, validateField, validateFixedFields } from "./registration-validation";

function field(partial: Partial<FormField>): FormField {
  return {
    id: "f1",
    event_id: "e",
    org_id: "o",
    position: 0,
    type: "short_text",
    label_en: "Q",
    label_id: null,
    help_en: null,
    help_id: null,
    placeholder_en: null,
    placeholder_id: null,
    required: false,
    min_value: null,
    max_value: null,
    options: [],
    archived_at: null,
    ...partial,
  };
}

describe("registration validation", () => {
  it("validates fixed fields", () => {
    expect(validateFixedFields({ fullName: "", email: "bad" })).toEqual({
      full_name: { key: "error.required" },
      email: { key: "error.email" },
    });
    expect(validateFixedFields({ fullName: "Budi", email: "budi@example.co.id" })).toEqual({});
  });

  it("enforces required and length", () => {
    expect(validateField(field({ required: true }), "").error?.key).toBe("error.required");
    expect(validateField(field({ min_value: 5 }), "abc").error?.key).toBe("error.minLength");
    expect(validateField(field({}), "  hello ").value).toBe("hello");
  });

  it("validates Indonesian phone numbers", () => {
    const phone = field({ type: "phone" });
    expect(validateField(phone, "0812-3456-7890").value).toBe("081234567890");
    expect(validateField(phone, "+62 812 3456 7890").error).toBeUndefined();
    expect(validateField(phone, "12345").error?.key).toBe("error.phone");
  });

  it("validates numbers with bounds", () => {
    const num = field({ type: "number", min_value: 1, max_value: 10 });
    expect(validateField(num, "5").value).toBe(5);
    expect(validateField(num, "11").error?.key).toBe("error.maxValue");
    expect(validateField(num, "abc").error?.key).toBe("error.number");
  });

  it("only accepts listed options", () => {
    const options = [{ value: "a" }, { value: "b" }];
    expect(validateField(field({ type: "radio", options }), "a").value).toBe("a");
    expect(validateField(field({ type: "radio", options }), "z").error?.key).toBe("error.option");
    expect(validateField(field({ type: "checkbox", options }), ["a", "b"]).value).toEqual(["a", "b"]);
  });

  it("checks uploaded files", () => {
    const f = field({ type: "file" });
    expect(validateField(f, { name: "a.pdf", size: 1000, type: "application/pdf" }).error).toBeUndefined();
    expect(validateField(f, { name: "a.exe", size: 1000, type: "application/x-msdownload" }).error?.key).toBe("error.file");
    expect(validateField(f, { name: "a.pdf", size: 6 * 1024 * 1024, type: "application/pdf" }).error?.key).toBe("error.file");
  });

  it("skips archived fields", () => {
    const { errors } = validateCustomFields([field({ required: true, archived_at: "2026-01-01" })], {});
    expect(errors).toEqual({});
  });
});
