"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { getTranslator, type Locale } from "@/lib/i18n/translate";
import { slugify } from "@/lib/slug-utils";
import { COMMON_TIMEZONES, utcIsoToZonedLocal } from "@/lib/timezone-utils";
import type { EventRow } from "@/lib/domain-types";
import type { FormState } from "@/app/actions/organization-actions";

/** Event setup form (FR-2). Used for both create and edit. */
export function EventEditorForm({
  locale,
  orgSlug,
  event,
  action,
}: {
  locale: Locale;
  orgSlug: string;
  event?: EventRow;
  action: (prev: FormState, data: FormData) => Promise<FormState>;
}) {
  const t = getTranslator(locale);
  const [state, formAction] = useActionState(action, {});
  const [timezone, setTimezone] = useState(event?.timezone ?? "Asia/Jakarta");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(event));
  const [bannerPreview, setBannerPreview] = useState<string | null>(event?.banner_url ?? null);
  const slugLocked = Boolean(event && event.status !== "draft");
  const local = (iso: string | null | undefined) => utcIsoToZonedLocal(iso, timezone);
  const links = [...(event?.extra_links ?? []), ...Array(5).fill(null)].slice(0, 5);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="org_slug" value={orgSlug} />
      {event && <input type="hidden" name="event_id" value={event.id} />}

      <fieldset className="card grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">{t("event.tabs.details")}</legend>
        <div>
          <label htmlFor="title_en" className="field-label">{t("event.titleEn")}</label>
          <input
            id="title_en"
            name="title_en"
            className="input"
            maxLength={200}
            defaultValue={event?.title_en ?? ""}
            onChange={(e) => !slugTouched && setSlug(slugify(e.target.value, 80))}
          />
        </div>
        <div>
          <label htmlFor="title_id" className="field-label">{t("event.titleId")}</label>
          <input
            id="title_id"
            name="title_id"
            className="input"
            maxLength={200}
            defaultValue={event?.title_id ?? ""}
            onChange={(e) => !slugTouched && !slug && setSlug(slugify(e.target.value, 80))}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="slug" className="field-label">{t("event.slug")}</label>
          <div className="flex items-center gap-1 text-sm text-zinc-500">
            <span className="shrink-0">/{orgSlug}/</span>
            <input
              id="slug"
              name="slug"
              className="input font-mono"
              value={slug}
              readOnly={slugLocked}
              aria-describedby="slug-help"
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value, 80));
              }}
            />
          </div>
          {slugLocked && <p id="slug-help" className="field-help">{t("event.slugLocked")}</p>}
        </div>
        <div>
          <label htmlFor="description_en" className="field-label">{t("event.descriptionEn")}</label>
          <textarea id="description_en" name="description_en" rows={8} className="input" defaultValue={event?.description_en ?? ""} aria-describedby="desc-help" />
        </div>
        <div>
          <label htmlFor="description_id" className="field-label">{t("event.descriptionId")}</label>
          <textarea id="description_id" name="description_id" rows={8} className="input" defaultValue={event?.description_id ?? ""} aria-describedby="desc-help" />
        </div>
        <p id="desc-help" className="field-help sm:col-span-2">{t("event.descriptionHelp")}</p>

        <div className="sm:col-span-2">
          <label htmlFor="banner" className="field-label">{t("event.banner")}</label>
          <div className="mb-2 aspect-video w-full max-w-xl overflow-hidden rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-100">
            {bannerPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerPreview} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <input
            id="banner"
            name="banner"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm"
            aria-describedby="banner-help"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setBannerPreview(URL.createObjectURL(file));
            }}
          />
          <p id="banner-help" className="field-help">{t("event.bannerHelp")}</p>
          {event?.banner_url && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="remove_banner" /> {t("form.delete")}
            </label>
          )}
        </div>
      </fieldset>

      <fieldset className="card grid gap-4 sm:grid-cols-3">
        <legend className="sr-only">{t("event.startsAt")}</legend>
        <div>
          <label htmlFor="starts_at" className="field-label">{t("event.startsAt")}</label>
          <input id="starts_at" name="starts_at" type="datetime-local" required className="input" defaultValue={local(event?.starts_at)} />
        </div>
        <div>
          <label htmlFor="ends_at" className="field-label">{t("event.endsAt")}</label>
          <input id="ends_at" name="ends_at" type="datetime-local" required className="input" defaultValue={local(event?.ends_at)} />
        </div>
        <div>
          <label htmlFor="timezone" className="field-label">{t("event.timezone")}</label>
          <select id="timezone" name="timezone" className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="registration_opens_at" className="field-label">{t("event.opensAt")}</label>
          <input id="registration_opens_at" name="registration_opens_at" type="datetime-local" className="input" defaultValue={local(event?.registration_opens_at)} />
        </div>
        <div>
          <label htmlFor="registration_closes_at" className="field-label">{t("event.closesAt")}</label>
          <input id="registration_closes_at" name="registration_closes_at" type="datetime-local" className="input" defaultValue={local(event?.registration_closes_at)} />
        </div>
        <div>
          <label htmlFor="capacity" className="field-label">{t("event.capacity")}</label>
          <input id="capacity" name="capacity" type="number" min={1} max={100000} required className="input" defaultValue={event?.capacity ?? 100} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" name="hide_capacity_total" defaultChecked={event?.hide_capacity_total} /> {t("event.hideTotal")}
        </label>
      </fieldset>

      <fieldset className="card grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">{t("event.venueName")}</legend>
        <div>
          <label htmlFor="venue_name" className="field-label">{t("event.venueName")}</label>
          <input id="venue_name" name="venue_name" className="input" defaultValue={event?.venue_name ?? ""} />
        </div>
        <div>
          <label htmlFor="maps_url" className="field-label">{t("event.mapsUrl")}</label>
          <input id="maps_url" name="maps_url" type="url" className="input" placeholder="https://maps.app.goo.gl/…" defaultValue={event?.maps_url ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="venue_address" className="field-label">{t("event.venueAddress")}</label>
          <input id="venue_address" name="venue_address" className="input" defaultValue={event?.venue_address ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="online_url" className="field-label">{t("event.onlineUrl")}</label>
          <input id="online_url" name="online_url" type="url" className="input" defaultValue={event?.online_url ?? ""} aria-describedby="online-help" />
          <p id="online-help" className="field-help">{t("event.onlineUrlHelp")}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="field-label">{t("event.extraLinks")}</p>
          <div className="space-y-2">
            {links.map((link, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3">
                <input name={`link_label_en_${i}`} aria-label={`${t("event.linkLabel")} EN ${i + 1}`} placeholder={`${t("event.linkLabel")} (EN)`} className="input" defaultValue={link?.label_en ?? ""} />
                <input name={`link_label_id_${i}`} aria-label={`${t("event.linkLabel")} ID ${i + 1}`} placeholder={`${t("event.linkLabel")} (ID)`} className="input" defaultValue={link?.label_id ?? ""} />
                <input name={`link_url_${i}`} type="url" aria-label={`${t("event.linkUrl")} ${i + 1}`} placeholder="https://" className="input" defaultValue={link?.url ?? ""} />
              </div>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="card space-y-3">
        <legend className="sr-only">{t("nav.settings")}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="consent_enabled" defaultChecked={event?.consent_enabled ?? true} /> {t("event.consent")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allow_multiple_per_email" defaultChecked={event?.allow_multiple_per_email} /> {t("event.allowMultiple")}
        </label>
        <div className="max-w-xs">
          <label htmlFor="retention_months" className="field-label">{t("event.retention")}</label>
          <input id="retention_months" name="retention_months" type="number" min={1} max={120} className="input" defaultValue={event?.retention_months ?? 12} />
        </div>
      </fieldset>

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-zinc-200 bg-zinc-50/95 py-3 backdrop-blur">
        <SubmitButton pendingLabel={t("common.loading")}>{t("event.save")}</SubmitButton>
        {state.error && <p role="alert" className="field-error mt-0">{state.error}</p>}
        {state.ok && <p role="status" className="text-sm text-green-700">{t("event.saved")}</p>}
      </div>
    </form>
  );
}
