"use client";
import { pickLocalized, type Locale, type Translate } from "@/lib/i18n/translate";
import type { FieldError } from "@/lib/registration-validation";
import type { FormField } from "@/lib/domain-types";

/**
 * Renders the registration form inputs (fixed + custom fields). Shared by the
 * public page and the form builder's live preview (FR-3.4) so both look the
 * same. Accessible: every input has a label, help/error text is linked with
 * aria-describedby, invalid inputs get aria-invalid (WCAG 2.1 AA).
 */
export function RegistrationFormFields({
  fields,
  locale,
  t,
  errors = {},
  orgName,
  privacyUrl,
  consentEnabled,
  disabled,
  idPrefix = "reg",
}: {
  fields: FormField[];
  locale: Locale;
  t: Translate;
  errors?: Record<string, FieldError>;
  orgName: string;
  privacyUrl?: string | null;
  consentEnabled: boolean;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const err = (key: string) => (errors[key] ? t(errors[key].key, errors[key].vars) : null);
  const describe = (key: string, hasHelp: boolean) =>
    [hasHelp ? `${idPrefix}-${key}-help` : null, errors[key] ? `${idPrefix}-${key}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset disabled={disabled} className="space-y-5">
      <legend className="sr-only">{t("public.register")}</legend>
      <div>
        <label htmlFor={`${idPrefix}-full_name`} className="field-label">
          {t("public.fullName")} <span aria-hidden="true" className="text-red-700">*</span>
        </label>
        <input
          id={`${idPrefix}-full_name`}
          name="full_name"
          required
          autoComplete="name"
          maxLength={120}
          className="input"
          aria-invalid={Boolean(errors.full_name) || undefined}
          aria-describedby={describe("full_name", false)}
        />
        {err("full_name") && <p id={`${idPrefix}-full_name-error`} className="field-error">{err("full_name")}</p>}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-email`} className="field-label">
          {t("public.email")} <span aria-hidden="true" className="text-red-700">*</span>
        </label>
        <input
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          inputMode="email"
          required
          autoComplete="email"
          className="input"
          aria-invalid={Boolean(errors.email) || undefined}
          aria-describedby={describe("email", false)}
        />
        {err("email") && <p id={`${idPrefix}-email-error`} className="field-error">{err("email")}</p>}
      </div>
      {/* Bahasa tiket & email ikut bahasa halaman yang dipilih lewat tombol bahasa di pojok kanan atas. */}
      <input type="hidden" name="language" value={locale} />

      {fields.map((field) => (
        <CustomField key={field.id} field={field} locale={locale} error={err(field.id)} idPrefix={idPrefix} describe={describe} />
      ))}

      {consentEnabled && (
        <div>
          <label className="flex items-start gap-2 text-sm text-ink-800">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-0.5 h-4 w-4"
              aria-invalid={Boolean(errors.consent) || undefined}
              aria-describedby={errors.consent ? `${idPrefix}-consent-error` : undefined}
            />
            <span>
              {t("public.consent", { org: orgName })}{" "}
              {privacyUrl && (
                <a href={privacyUrl} target="_blank" rel="noreferrer" className="text-brand-700 underline">
                  {t("public.privacy")}
                </a>
              )}
            </span>
          </label>
          {err("consent") && <p id={`${idPrefix}-consent-error`} className="field-error">{err("consent")}</p>}
        </div>
      )}
    </fieldset>
  );
}

function CustomField({
  field,
  locale,
  error,
  idPrefix,
  describe,
}: {
  field: FormField;
  locale: Locale;
  error: string | null;
  idPrefix: string;
  describe: (key: string, hasHelp: boolean) => string | undefined;
}) {
  const id = `${idPrefix}-${field.id}`;
  const label = pickLocalized(locale, field.label_en, field.label_id);
  const help = pickLocalized(locale, field.help_en, field.help_id);
  const placeholder = pickLocalized(locale, field.placeholder_en, field.placeholder_id) || undefined;
  const name = `field_${field.id}`;
  const common = {
    id,
    name,
    required: field.required,
    placeholder,
    "aria-invalid": Boolean(error) || undefined,
    "aria-describedby": describe(field.id, Boolean(help)),
    className: "input",
  };
  const requiredMark = field.required ? <span aria-hidden="true" className="text-red-700"> *</span> : null;
  const helpText = help ? <p id={`${id}-help`} className="field-help">{help}</p> : null;
  const errorText = error ? <p id={`${id}-error`} className="field-error">{error}</p> : null;
  const optionLabel = (o: FormField["options"][number]) => pickLocalized(locale, o.label_en, o.label_id) || o.value;

  if (field.type === "radio" || field.type === "checkbox") {
    return (
      <fieldset aria-describedby={describe(field.id, Boolean(help))}>
        <legend className="field-label">{label}{requiredMark}</legend>
        <div className="space-y-2">
          {field.options.map((o, i) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input
                type={field.type}
                name={name}
                value={o.value}
                required={field.type === "radio" && field.required && i === 0 ? true : undefined}
                className="h-4 w-4"
              />
              {optionLabel(o)}
            </label>
          ))}
        </div>
        {helpText}
        {errorText}
      </fieldset>
    );
  }

  let input: React.ReactNode;
  switch (field.type) {
    case "long_text":
      input = <textarea {...common} rows={4} minLength={field.min_value ?? undefined} maxLength={field.max_value ?? 5000} />;
      break;
    case "phone":
      input = <input {...common} type="tel" inputMode="tel" autoComplete="tel" placeholder={placeholder ?? "0812 3456 7890"} />;
      break;
    case "number":
      input = <input {...common} type="number" inputMode="decimal" step="any" min={field.min_value ?? undefined} max={field.max_value ?? undefined} />;
      break;
    case "date":
      input = <input {...common} type="date" />;
      break;
    case "dropdown":
      input = (
        <select {...common} defaultValue="">
          <option value="" disabled>{placeholder ?? "—"}</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>{optionLabel(o)}</option>
          ))}
        </select>
      );
      break;
    case "file":
      input = <input {...common} type="file" accept="application/pdf,image/jpeg,image/png" className="block text-sm" />;
      break;
    default:
      input = <input {...common} type="text" minLength={field.min_value ?? undefined} maxLength={field.max_value ?? 500} />;
  }

  return (
    <div>
      <label htmlFor={id} className="field-label">{label}{requiredMark}</label>
      {input}
      {helpText}
      {errorText}
    </div>
  );
}
