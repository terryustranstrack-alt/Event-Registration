"use client";
import { useMemo, useState, useTransition } from "react";
import { saveFormFieldsAction } from "@/app/actions/event-actions";
import { RegistrationFormFields } from "@/components/registration-form-fields";
import { TranslateButton } from "@/components/translate-button";
import { GripIcon, LanguagesIcon, PlusIcon } from "@/components/icons";
import { getTranslator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CHOICE_FIELD_TYPES, FORM_FIELD_TYPES, type FieldOption, type FormField, type FormFieldType } from "@/lib/domain-types";
import { slugify } from "@/lib/slug-utils";

type DraftField = Omit<FormField, "event_id" | "org_id" | "position" | "archived_at"> & { key: string; isNew?: boolean };

function newField(type: FormFieldType): DraftField {
  return {
    key: crypto.randomUUID(),
    id: "",
    isNew: true,
    type,
    label_en: "",
    label_id: "",
    help_en: null,
    help_id: null,
    placeholder_en: null,
    placeholder_id: null,
    required: false,
    min_value: null,
    max_value: null,
    options: CHOICE_FIELD_TYPES.includes(type) ? [{ value: "option-1", label_en: "Option 1", label_id: null }] : [],
  };
}

/** English option labels, one per line, for the options box. */
function optionsToText(options: FieldOption[]): string {
  return options.map((o) => o.label_en ?? "").join("\n");
}

/** Indonesian option labels, one per line, in the same order. */
function optionsToIndonesianText(options: FieldOption[]): string {
  return options.map((o) => o.label_id ?? "").join("\n");
}

/**
 * Turn the English options box back into options. Indonesian labels stay by
 * position. Saved questions also keep their stored values (keepValues), so
 * past answers still match; new questions get values from their labels.
 */
function textToOptions(text: string, previous: FieldOption[], keepValues: boolean): FieldOption[] {
  const used = new Set<string>();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label, i) => {
      let value = (keepValues ? previous[i]?.value : undefined) ?? (slugify(label, 60) || `option-${i + 1}`);
      while (used.has(value)) value = `${value}-${i + 1}`;
      used.add(value);
      return { value, label_en: label, label_id: previous[i]?.label_id ?? null };
    });
}

/** Put Indonesian labels (one per line) onto the existing options by position. */
function applyIndonesianOptions(text: string, options: FieldOption[]): FieldOption[] {
  const lines = text.split("\n").map((l) => l.trim());
  return options.map((o, i) => ({ ...o, label_id: lines[i] || null }));
}

/** All English texts of the form, in a fixed order, for one translation request. */
function collectEnglishTexts(fields: DraftField[]): string[] {
  return fields.flatMap((f) => [f.label_en ?? "", f.help_en ?? "", f.placeholder_en ?? "", ...f.options.map((o) => o.label_en ?? "")]);
}

/** Put translated texts back in the same order collectEnglishTexts used. */
function applyTranslations(fields: DraftField[], texts: string[]): DraftField[] {
  let i = 0;
  const next = () => texts[i++] || null;
  return fields.map((f) => {
    const label = next();
    const help = next();
    const placeholder = next();
    const options = f.options.map((o) => ({ ...o, label_id: next() ?? o.label_id ?? null }));
    return {
      ...f,
      label_id: label ?? f.label_id,
      help_id: help ?? f.help_id,
      placeholder_id: placeholder ?? f.placeholder_id,
      options,
    };
  });
}

/** Drag-and-drop form builder with live preview (FR-3). Questions are written in English. */
export function FormBuilder({
  locale,
  orgSlug,
  orgName,
  eventId,
  consentEnabled,
  initialFields,
}: {
  locale: Locale;
  orgSlug: string;
  orgName: string;
  eventId: string;
  consentEnabled: boolean;
  initialFields: FormField[];
}) {
  const t = getTranslator(locale);
  const [fields, setFields] = useState<DraftField[]>(() => initialFields.map((f) => ({ ...f, key: f.id })));
  const [optionText, setOptionText] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialFields.map((f) => [f.id, optionsToText(f.options)])),
  );
  const [openIndonesian, setOpenIndonesian] = useState<Record<string, boolean>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [previewLocale, setPreviewLocale] = useState<Locale>("en");
  const [status, setStatus] = useState<{ error?: string; ok?: boolean }>({});
  const [pending, startTransition] = useTransition();
  const [newType, setNewType] = useState<FormFieldType>("short_text");

  const update = (key: string, patch: Partial<DraftField>) =>
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  const move = (from: number, to: number) =>
    setFields((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  const previewFields = useMemo<FormField[]>(
    () =>
      fields.map((f, i) => ({
        ...f,
        id: f.key,
        event_id: eventId,
        org_id: "",
        position: i,
        archived_at: null,
        label_en: f.label_en || "…",
      })),
    [fields, eventId],
  );

  function addField() {
    const f = newField(newType);
    setFields((prev) => [...prev, f]);
    setOptionText((prev) => ({ ...prev, [f.key]: optionsToText(f.options) }));
  }

  function duplicateField(index: number) {
    const source = fields[index];
    const copy = { ...source, key: crypto.randomUUID(), id: "", isNew: true };
    setFields((prev) => [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]);
    setOptionText((prev) => ({ ...prev, [copy.key]: prev[source.key] ?? optionsToText(source.options) }));
  }

  function translateAll(texts: string[]) {
    setFields((prev) => applyTranslations(prev, texts));
    setOpenIndonesian(Object.fromEntries(fields.map((f) => [f.key, true])));
  }

  function save() {
    setStatus({});
    startTransition(async () => {
      const result = await saveFormFieldsAction({
        orgSlug,
        eventId,
        fields: fields.map((f) => ({
          id: f.isNew ? undefined : f.id,
          type: f.type,
          label_en: f.label_en?.trim() || null,
          label_id: f.label_id?.trim() || null,
          help_en: f.help_en?.trim() || null,
          help_id: f.help_id?.trim() || null,
          placeholder_en: f.placeholder_en?.trim() || null,
          placeholder_id: f.placeholder_id?.trim() || null,
          required: f.required,
          min_value: f.min_value,
          max_value: f.max_value,
          options: CHOICE_FIELD_TYPES.includes(f.type) ? f.options : [],
        })),
      });
      setStatus(result);
    });
  }

  const numberOrNull = (v: string) => (v === "" ? null : Number(v));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div className="card flex flex-wrap items-center justify-between gap-3 bg-brand-50/60">
          <p className="text-sm font-semibold text-ink-800">{t("form.fixedFields")}</p>
          {fields.length > 0 && (
            <TranslateButton orgSlug={orgSlug} t={t} label={t("translate.buttonAll")} getTexts={() => collectEnglishTexts(fields)} onTranslated={translateAll} />
          )}
        </div>

        {fields.length === 0 && <p className="card text-center text-ink-700">{t("form.empty")}</p>}

        <ol className="space-y-4">
          {fields.map((f, index) => (
            <li
              key={f.key}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              className={`card space-y-4 border-l-4 border-l-brand-500 ${dragIndex === index ? "opacity-50" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="cursor-grab text-ink-700/50"><GripIcon size={18} /></span>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">{index + 1}</span>
                <select
                  aria-label={t("form.typeLabel")}
                  className="rounded-lg border-2 border-brand-100 bg-white px-2 py-1 text-sm font-semibold"
                  value={f.type}
                  onChange={(e) => {
                    const type = e.target.value as FormFieldType;
                    const options = CHOICE_FIELD_TYPES.includes(type) && f.options.length === 0 ? newField(type).options : f.options;
                    update(f.key, { type, options });
                    setOptionText((prev) => ({ ...prev, [f.key]: prev[f.key] ?? optionsToText(options) }));
                  }}
                >
                  {FORM_FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>{t(`form.type.${type}`)}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-sm font-semibold">
                  <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.required} onChange={(e) => update(f.key, { required: e.target.checked })} />
                  {t("form.required")}
                </label>
                <div className="ml-auto flex gap-1">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => move(index, index - 1)} aria-label={t("form.moveUp")} disabled={index === 0}>↑</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => move(index, index + 1)} aria-label={t("form.moveDown")} disabled={index === fields.length - 1}>↓</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => duplicateField(index)}>{t("form.duplicate")}</button>
                  <button type="button" className="btn-danger btn-sm" onClick={() => setFields((prev) => prev.filter((x) => x.key !== f.key))}>
                    {t("form.delete")}
                  </button>
                </div>
              </div>

              <TextInput label={t("form.label")} value={f.label_en ?? ""} onChange={(v) => update(f.key, { label_en: v })} large />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput label={t("form.help")} value={f.help_en ?? ""} onChange={(v) => update(f.key, { help_en: v })} />
                {!["radio", "checkbox", "file", "date"].includes(f.type) && (
                  <TextInput label={t("form.placeholder")} value={f.placeholder_en ?? ""} onChange={(v) => update(f.key, { placeholder_en: v })} />
                )}
                {["short_text", "long_text", "number", "checkbox"].includes(f.type) && (
                  <>
                    <TextInput type="number" label={t("form.min")} value={f.min_value?.toString() ?? ""} onChange={(v) => update(f.key, { min_value: numberOrNull(v) })} />
                    <TextInput type="number" label={t("form.max")} value={f.max_value?.toString() ?? ""} onChange={(v) => update(f.key, { max_value: numberOrNull(v) })} />
                  </>
                )}
              </div>
              {CHOICE_FIELD_TYPES.includes(f.type) && (
                <label className="block">
                  <span className="field-label">{t("form.options")}</span>
                  <textarea
                    rows={4}
                    className="input"
                    value={optionText[f.key] ?? optionsToText(f.options)}
                    onChange={(e) => {
                      setOptionText((prev) => ({ ...prev, [f.key]: e.target.value }));
                      update(f.key, { options: textToOptions(e.target.value, f.options, !f.isNew) });
                    }}
                  />
                </label>
              )}

              <IndonesianFields
                field={f}
                t={t}
                open={Boolean(openIndonesian[f.key])}
                onToggle={() => setOpenIndonesian((prev) => ({ ...prev, [f.key]: !prev[f.key] }))}
                onChange={(patch) => update(f.key, patch)}
              />
            </li>
          ))}
        </ol>

        <div className="card flex flex-wrap items-center gap-2 border-2 border-dashed border-brand-200 bg-transparent shadow-none">
          <select aria-label={t("form.typeLabel")} className="input w-auto" value={newType} onChange={(e) => setNewType(e.target.value as FormFieldType)}>
            {FORM_FIELD_TYPES.map((type) => (
              <option key={type} value={type}>{t(`form.type.${type}`)}</option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={addField}>
            <PlusIcon size={17} /> {t("form.addField")}
          </button>
        </div>
        <p className="text-xs text-ink-700/75">{t("form.deleteNote")}</p>

        <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-brand-100 bg-canvas/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <button type="button" className="btn-primary" disabled={pending} onClick={save}>
            {pending ? t("common.loading") : t("form.save")}
          </button>
          {status.error && <p role="alert" className="field-error mt-0">{status.error}</p>}
          {status.ok && <p role="status" className="text-sm font-semibold text-emerald-700">{t("event.saved")}</p>}
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-extrabold">{t("form.preview")}</h2>
          <div className="inline-flex rounded-full bg-brand-50 p-0.5 text-xs font-bold ring-1 ring-brand-100">
            {(["en", "id"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setPreviewLocale(l)}
                aria-pressed={previewLocale === l}
                className={`rounded-full px-3 py-1 uppercase ${previewLocale === l ? "bg-white text-brand-700 shadow-sm" : "text-ink-700"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="card max-h-[75vh] overflow-y-auto">
          <RegistrationFormFields
            fields={previewFields}
            locale={previewLocale}
            t={getTranslator(previewLocale)}
            orgName={orgName}
            consentEnabled={consentEnabled}
            idPrefix="preview"
          />
          <button type="button" className="btn-primary mt-5 w-full" disabled>
            {getTranslator(previewLocale)("public.submit")}
          </button>
        </div>
      </aside>
    </div>
  );
}

/** Collapsible Indonesian wording for one question. */
function IndonesianFields({
  field,
  t,
  open,
  onToggle,
  onChange,
}: {
  field: DraftField;
  t: Translate;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<DraftField>) => void;
}) {
  const hasTranslation = Boolean(field.label_id);
  return (
    <div className="rounded-xl bg-pink-50/70 p-3">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 text-left text-sm font-bold text-pop-600">
        <LanguagesIcon size={16} /> {t("translate.section")}
        {hasTranslation && <span className="badge bg-white text-emerald-700">✓</span>}
        <span className="ml-auto">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextInput label={t("form.labelId")} value={field.label_id ?? ""} onChange={(v) => onChange({ label_id: v })} />
          </div>
          <TextInput label={t("form.helpId")} value={field.help_id ?? ""} onChange={(v) => onChange({ help_id: v })} />
          {!["radio", "checkbox", "file", "date"].includes(field.type) && (
            <TextInput label={t("form.placeholderId")} value={field.placeholder_id ?? ""} onChange={(v) => onChange({ placeholder_id: v })} />
          )}
          {CHOICE_FIELD_TYPES.includes(field.type) && (
            <label className="block sm:col-span-2">
              <span className="field-label">{t("form.optionsId")}</span>
              <textarea
                rows={Math.max(3, field.options.length)}
                className="input"
                placeholder={optionsToText(field.options)}
                defaultValue={optionsToIndonesianText(field.options)}
                key={optionsToIndonesianText(field.options)}
                onBlur={(e) => onChange({ options: applyIndonesianOptions(e.target.value, field.options) })}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  large = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  large?: boolean;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input type={type} className={`input ${large ? "font-semibold" : ""}`} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
