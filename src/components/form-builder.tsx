"use client";
import { useMemo, useState, useTransition } from "react";
import { saveFormFieldsAction } from "@/app/actions/event-actions";
import { RegistrationFormFields } from "@/components/registration-form-fields";
import { getTranslator, type Locale } from "@/lib/i18n/translate";
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
    options: CHOICE_FIELD_TYPES.includes(type) ? [{ value: "option-1", label_en: "Option 1", label_id: "Pilihan 1" }] : [],
  };
}

function optionsToText(options: FieldOption[]): string {
  return options.map((o) => [o.label_en ?? "", o.label_id ?? ""].filter(Boolean).join(" | ")).join("\n");
}

function textToOptions(text: string, previous: FieldOption[]): FieldOption[] {
  const used = new Set<string>();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [en, id] = line.split("|").map((s) => s.trim());
      // Keep stored values stable for existing rows so past answers still match.
      let value = previous[i]?.value ?? (slugify(en || id || `option-${i + 1}`, 60) || `option-${i + 1}`);
      while (used.has(value)) value = `${value}-${i + 1}`;
      used.add(value);
      return { value, label_en: en || null, label_id: id || en || null };
    });
}

/** Drag-and-drop form builder with live preview (FR-3). */
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [previewLocale, setPreviewLocale] = useState<Locale>(locale);
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
        label_en: f.label_en || f.label_id || "…",
      })),
    [fields, eventId],
  );

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
        <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">{t("form.fixedFields")}</p>
        <ol className="space-y-3">
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
              className={`card space-y-3 ${dragIndex === index ? "opacity-50" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="cursor-grab select-none text-zinc-400" aria-hidden="true">⠿</span>
                <select
                  aria-label="Type"
                  className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                  value={f.type}
                  onChange={(e) => {
                    const type = e.target.value as FormFieldType;
                    update(f.key, {
                      type,
                      options: CHOICE_FIELD_TYPES.includes(type) && f.options.length === 0 ? newField(type).options : f.options,
                    });
                  }}
                >
                  {FORM_FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>{t(`form.type.${type}`)}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={f.required} onChange={(e) => update(f.key, { required: e.target.checked })} />
                  {t("form.required")}
                </label>
                <div className="ml-auto flex gap-1">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => move(index, index - 1)} aria-label={t("form.moveUp")} disabled={index === 0}>↑</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => move(index, index + 1)} aria-label={t("form.moveDown")} disabled={index === fields.length - 1}>↓</button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      const copy = { ...f, key: crypto.randomUUID(), id: "", isNew: true };
                      setFields((prev) => [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]);
                      setOptionText((prev) => ({ ...prev, [copy.key]: prev[f.key] ?? optionsToText(f.options) }));
                    }}
                  >
                    {t("form.duplicate")}
                  </button>
                  <button type="button" className="btn-danger btn-sm" onClick={() => setFields((prev) => prev.filter((x) => x.key !== f.key))}>
                    {t("form.delete")}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput label={t("form.labelEn")} value={f.label_en ?? ""} onChange={(v) => update(f.key, { label_en: v })} />
                <TextInput label={t("form.labelId")} value={f.label_id ?? ""} onChange={(v) => update(f.key, { label_id: v })} />
                <TextInput label={t("form.helpEn")} value={f.help_en ?? ""} onChange={(v) => update(f.key, { help_en: v })} />
                <TextInput label={t("form.helpId")} value={f.help_id ?? ""} onChange={(v) => update(f.key, { help_id: v })} />
                {!["radio", "checkbox", "file", "date"].includes(f.type) && (
                  <>
                    <TextInput label={t("form.placeholderEn")} value={f.placeholder_en ?? ""} onChange={(v) => update(f.key, { placeholder_en: v })} />
                    <TextInput label={t("form.placeholderId")} value={f.placeholder_id ?? ""} onChange={(v) => update(f.key, { placeholder_id: v })} />
                  </>
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
                    className="input font-mono"
                    value={optionText[f.key] ?? optionsToText(f.options)}
                    onChange={(e) => {
                      setOptionText((prev) => ({ ...prev, [f.key]: e.target.value }));
                      // Saved questions keep option values stable so past answers still match.
                      update(f.key, { options: textToOptions(e.target.value, f.isNew ? [] : f.options) });
                    }}
                  />
                </label>
              )}
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <select aria-label={t("form.addField")} className="input w-auto" value={newType} onChange={(e) => setNewType(e.target.value as FormFieldType)}>
            {FORM_FIELD_TYPES.map((type) => (
              <option key={type} value={type}>{t(`form.type.${type}`)}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              const f = newField(newType);
              setFields((prev) => [...prev, f]);
              setOptionText((prev) => ({ ...prev, [f.key]: optionsToText(f.options) }));
            }}
          >
            + {t("form.addField")}
          </button>
        </div>
        <p className="text-xs text-zinc-600">{t("form.deleteNote")}</p>

        <div className="sticky bottom-0 flex items-center gap-3 border-t border-zinc-200 bg-zinc-50/95 py-3 backdrop-blur">
          <button type="button" className="btn-primary" disabled={pending} onClick={save}>
            {pending ? t("common.loading") : t("form.save")}
          </button>
          {status.error && <p role="alert" className="field-error mt-0">{status.error}</p>}
          {status.ok && <p role="status" className="text-sm text-green-700">{t("event.saved")}</p>}
        </div>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">{t("form.preview")}</h2>
          <div className="flex gap-1 text-xs">
            {(["id", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setPreviewLocale(l)}
                aria-pressed={previewLocale === l}
                className={`rounded px-2 py-1 uppercase ${previewLocale === l ? "bg-zinc-900 text-white" : "bg-zinc-200"}`}
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

function TextInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input type={type} className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
