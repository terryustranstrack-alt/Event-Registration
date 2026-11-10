import type { DictionaryKey } from "@/lib/i18n/dictionary-en";
import { CHOICE_FIELD_TYPES, type FormField } from "@/lib/domain-types";

/**
 * Validation of the public registration form (FR-3, FR-5.1), shared by the
 * browser (instant feedback) and the server (source of truth).
 * Errors are dictionary keys + vars so they render in either language.
 */
export interface FieldError {
  key: DictionaryKey;
  vars?: Record<string, string | number>;
}

export type RawValue = string | string[] | FileLike | null | undefined;
export interface FileLike {
  name: string;
  size: number;
  type: string;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Indonesian numbers: 08xx / +628xx / 628xx, 9–13 digits after the prefix; spaces/dashes allowed.
const PHONE_RE = /^(?:\+?62|0)8\d{7,12}$/;

export function normalizePhone(value: string): string {
  return value.replace(/[\s\-().]/g, "");
}

export function isFileLike(value: unknown): value is FileLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "size" in value &&
    "type" in value &&
    "name" in value &&
    typeof (value as FileLike).size === "number"
  );
}

export function validateFixedFields(input: { fullName: string; email: string }) {
  const errors: Record<string, FieldError> = {};
  const name = input.fullName.trim();
  if (!name) errors.full_name = { key: "error.required" };
  else if (name.length < 2) errors.full_name = { key: "error.minLength", vars: { n: 2 } };
  else if (name.length > 120) errors.full_name = { key: "error.maxLength", vars: { n: 120 } };

  const email = input.email.trim();
  if (!email) errors.email = { key: "error.required" };
  else if (!EMAIL_RE.test(email) || email.length > 254) errors.email = { key: "error.email" };
  return errors;
}

/** Validate one custom field. Returns the cleaned value or an error. */
export function validateField(
  field: FormField,
  raw: RawValue,
): { value: unknown; error?: FieldError } {
  const isEmpty =
    raw === null ||
    raw === undefined ||
    (typeof raw === "string" && raw.trim() === "") ||
    (Array.isArray(raw) && raw.length === 0) ||
    (isFileLike(raw) && raw.size === 0);

  if (isEmpty) {
    return field.required ? { value: null, error: { key: "error.required" } } : { value: null };
  }

  const min = field.min_value;
  const max = field.max_value;
  const optionValues = new Set(field.options.map((o) => o.value));

  switch (field.type) {
    case "short_text":
    case "long_text": {
      const text = String(raw).trim();
      const limit = field.type === "short_text" ? 500 : 5000;
      if (min != null && text.length < min) return { value: text, error: { key: "error.minLength", vars: { n: min } } };
      const effectiveMax = max != null ? Math.min(max, limit) : limit;
      if (text.length > effectiveMax) return { value: text, error: { key: "error.maxLength", vars: { n: effectiveMax } } };
      return { value: text };
    }
    case "phone": {
      const phone = normalizePhone(String(raw));
      if (!PHONE_RE.test(phone)) return { value: phone, error: { key: "error.phone" } };
      return { value: phone };
    }
    case "number": {
      const text = String(raw).trim().replace(",", ".");
      const num = Number(text);
      if (!Number.isFinite(num) || text === "") return { value: text, error: { key: "error.number" } };
      if (min != null && num < min) return { value: num, error: { key: "error.minValue", vars: { n: min } } };
      if (max != null && num > max) return { value: num, error: { key: "error.maxValue", vars: { n: max } } };
      return { value: num };
    }
    case "date": {
      const text = String(raw).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
        return { value: text, error: { key: "error.date" } };
      }
      return { value: text };
    }
    case "dropdown":
    case "radio": {
      const choice = Array.isArray(raw) ? raw[0] : String(raw);
      if (!optionValues.has(choice)) return { value: choice, error: { key: "error.option" } };
      return { value: choice };
    }
    case "checkbox": {
      const choices = (Array.isArray(raw) ? raw : [String(raw)]).filter(Boolean);
      if (choices.some((c) => !optionValues.has(c))) return { value: choices, error: { key: "error.option" } };
      if (min != null && choices.length < min) return { value: choices, error: { key: "error.minValue", vars: { n: min } } };
      if (max != null && choices.length > max) return { value: choices, error: { key: "error.maxValue", vars: { n: max } } };
      return { value: choices };
    }
    case "file": {
      if (!isFileLike(raw) || raw.size > MAX_UPLOAD_BYTES || !ALLOWED_UPLOAD_TYPES.includes(raw.type)) {
        return { value: null, error: { key: "error.file" } };
      }
      return { value: raw };
    }
    default:
      return { value: null };
  }
}

export function validateCustomFields(fields: FormField[], values: Record<string, RawValue>) {
  const errors: Record<string, FieldError> = {};
  const cleaned: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.archived_at) continue;
    const { value, error } = validateField(field, values[field.id]);
    if (error) errors[field.id] = error;
    else if (value !== null) cleaned[field.id] = value;
  }
  return { errors, cleaned };
}

export function isChoiceField(field: Pick<FormField, "type">) {
  return CHOICE_FIELD_TYPES.includes(field.type);
}
