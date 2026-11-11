"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { TranslateButton } from "@/components/translate-button";
import { EventImagePicker } from "@/components/event-image-picker";
import { CalendarIcon, LanguagesIcon, MapPinIcon, ShieldIcon, SparklesIcon, TicketIcon } from "@/components/icons";
import { getTranslator, type Locale } from "@/lib/i18n/translate";
import { slugify } from "@/lib/slug-utils";
import { COMMON_TIMEZONES, utcIsoToZonedLocal } from "@/lib/timezone-utils";
import type { EventRow, ExtraLink } from "@/lib/domain-types";
import type { FormState } from "@/app/actions/organization-actions";

type LinkDraft = { label_en: string; label_id: string; url: string };

function toLinkDrafts(links: ExtraLink[] | undefined): LinkDraft[] {
  const filled = (links ?? []).map((l) => ({ label_en: l.label_en ?? "", label_id: l.label_id ?? "", url: l.url }));
  return [...filled, ...Array.from({ length: 5 - filled.length }, () => ({ label_en: "", label_id: "", url: "" }))].slice(0, 5);
}

/**
 * Event setup form (FR-2), used for both create and edit. Organizers write in
 * English; the Indonesian version sits in its own section and can be filled
 * with one click on "Translate to Indonesian", then edited.
 */
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
  const [titleEn, setTitleEn] = useState(event?.title_en ?? "");
  const [titleId, setTitleId] = useState(event?.title_id ?? "");
  const [descriptionEn, setDescriptionEn] = useState(event?.description_en ?? "");
  const [descriptionId, setDescriptionId] = useState(event?.description_id ?? "");
  const [links, setLinks] = useState<LinkDraft[]>(() => toLinkDrafts(event?.extra_links));
  const [showIndonesian, setShowIndonesian] = useState(Boolean(event?.title_id || event?.description_id));
  const slugLocked = Boolean(event && event.status !== "draft");
  // Show the filled link rows plus one empty row to add another (max 5).
  const lastFilledLink = links.reduce((last, l, i) => (l.url || l.label_en ? i : last), -1);
  const visibleLinkRows = Math.min(5, lastFilledLink + 2);
  const local = (iso: string | null | undefined) => utcIsoToZonedLocal(iso, timezone);

  const updateLink = (index: number, patch: Partial<LinkDraft>) =>
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  // Order matters: title, description, then each link label.
  const englishTexts = () => [titleEn, descriptionEn, ...links.map((l) => l.label_en)];
  function applyTranslation(texts: string[]) {
    const [title, description, ...labels] = texts;
    if (title) setTitleId(title);
    if (description) setDescriptionId(description);
    setLinks((prev) => prev.map((l, i) => (labels[i] ? { ...l, label_id: labels[i] } : l)));
    setShowIndonesian(true);
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="org_slug" value={orgSlug} />
      {event && <input type="hidden" name="event_id" value={event.id} />}

      <FormSection title={t("event.section.basics")} icon={<SparklesIcon size={18} />}>
        <div>
          <label htmlFor="title_en" className="field-label">{t("event.title")}</label>
          <input
            id="title_en"
            name="title_en"
            required
            className="input text-lg font-semibold"
            maxLength={200}
            value={titleEn}
            onChange={(e) => {
              setTitleEn(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value, 80));
            }}
          />
        </div>
        <div>
          <label htmlFor="slug" className="field-label">{t("event.slug")}</label>
          <div className="flex items-center rounded-xl border-2 border-brand-100 bg-brand-50/60 pl-3.5 focus-within:border-brand-500">
            <span className="shrink-0 text-sm text-ink-700/70">/{orgSlug}/</span>
            <input
              id="slug"
              name="slug"
              className="w-full bg-transparent py-2.5 pr-3 font-mono text-sm outline-none"
              value={slug}
              readOnly={slugLocked}
              aria-describedby={slugLocked ? "slug-help" : undefined}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value, 80));
              }}
            />
          </div>
          {slugLocked && <p id="slug-help" className="field-help">{t("event.slugLocked")}</p>}
        </div>
        <div>
          <label htmlFor="description_en" className="field-label">{t("event.description")}</label>
          <textarea
            id="description_en"
            name="description_en"
            rows={7}
            className="input"
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            aria-describedby="desc-help"
          />
          <p id="desc-help" className="field-help">{t("event.descriptionHelp")}</p>
        </div>
        <EventImagePicker
          name="banner"
          removeName="remove_banner"
          label={t("event.banner")}
          help={t("event.bannerHelp")}
          chooseLabel={t("event.bannerChoose")}
          deleteLabel={t("form.delete")}
          initialUrl={event?.banner_url ?? null}
        />
        <EventImagePicker
          name="about_image"
          removeName="remove_about_image"
          label={t("event.aboutImage")}
          help={t("event.aboutImageHelp")}
          chooseLabel={t("event.bannerChoose")}
          deleteLabel={t("form.delete")}
          initialUrl={event?.about_image_url ?? null}
        />
      </FormSection>

      <FormSection title={t("event.section.when")} icon={<CalendarIcon size={18} />}>
        <div className="grid gap-4 sm:grid-cols-3">
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
        </div>
      </FormSection>

      <FormSection title={t("event.section.where")} icon={<MapPinIcon size={18} />}>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
        <div>
          <p className="field-label">{t("event.extraLinks")}</p>
          <div className="space-y-2">
            {links.slice(0, visibleLinkRows).map((link, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
                <input
                  name={`link_label_en_${i}`}
                  aria-label={`${t("event.linkLabel")} ${i + 1}`}
                  placeholder={t("event.linkLabel")}
                  className="input"
                  value={link.label_en}
                  onChange={(e) => updateLink(i, { label_en: e.target.value })}
                />
                <input
                  name={`link_url_${i}`}
                  type="url"
                  aria-label={`${t("event.linkUrl")} ${i + 1}`}
                  placeholder="https://"
                  className="input"
                  value={link.url}
                  onChange={(e) => updateLink(i, { url: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      </FormSection>

      <FormSection title={t("event.section.registration")} icon={<TicketIcon size={18} />}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="capacity" className="field-label">{t("event.capacity")}</label>
            <input id="capacity" name="capacity" type="number" min={1} max={100000} required className="input" defaultValue={event?.capacity ?? 100} />
          </div>
          <div>
            <label htmlFor="registration_opens_at" className="field-label">{t("event.opensAt")}</label>
            <input id="registration_opens_at" name="registration_opens_at" type="datetime-local" className="input" defaultValue={local(event?.registration_opens_at)} />
          </div>
          <div>
            <label htmlFor="registration_closes_at" className="field-label">{t("event.closesAt")}</label>
            <input id="registration_closes_at" name="registration_closes_at" type="datetime-local" className="input" defaultValue={local(event?.registration_closes_at)} />
          </div>
        </div>
        {/* Rombongan: berapa orang boleh didaftarkan sekaligus dengan satu email (1 = hanya diri sendiri). */}
        <div className="max-w-xs">
          <label htmlFor="max_group_size" className="field-label">{t("event.maxGroupSize")}</label>
          <input id="max_group_size" name="max_group_size" type="number" min={1} max={20} required className="input" defaultValue={event?.max_group_size ?? 1} aria-describedby="max-group-help" />
          <p id="max-group-help" className="field-help">{t("event.maxGroupSizeHelp")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="hide_capacity_total" defaultChecked={event?.hide_capacity_total} className="h-4 w-4 accent-brand-600" /> {t("event.hideTotal")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allow_multiple_per_email" defaultChecked={event?.allow_multiple_per_email} className="h-4 w-4 accent-brand-600" /> {t("event.allowMultiple")}
        </label>
        {/* Daftar tunggu: saat kursi penuh, orang tetap bisa mendaftar dan otomatis dapat kursi kalau ada yang batal. */}
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="waitlist_enabled" defaultChecked={event?.waitlist_enabled} aria-describedby="waitlist-help" className="h-4 w-4 accent-brand-600" /> {t("event.waitlist")}
          </label>
          <p id="waitlist-help" className="field-help ml-6">{t("event.waitlistHelp")}</p>
        </div>
      </FormSection>

      <FormSection title={t("event.section.privacy")} icon={<ShieldIcon size={18} />}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="consent_enabled" defaultChecked={event?.consent_enabled ?? true} className="h-4 w-4 accent-brand-600" /> {t("event.consent")}
        </label>
        <div className="max-w-xs">
          <label htmlFor="retention_months" className="field-label">{t("event.retention")}</label>
          <input id="retention_months" name="retention_months" type="number" min={1} max={120} className="input" defaultValue={event?.retention_months ?? 12} />
        </div>
      </FormSection>

      {/* Indonesian version: hidden fields stay in the form even when collapsed. */}
      <section className="card border-pop-600/20 bg-linear-to-br from-white to-pink-50/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-pink-100 text-pop-600"><LanguagesIcon size={18} /></span>
              {t("translate.section")}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-ink-700">{t("translate.sectionHelp")}</p>
          </div>
          <button type="button" className="btn-ghost btn-sm" aria-expanded={showIndonesian} onClick={() => setShowIndonesian((v) => !v)}>
            {showIndonesian ? t("common.hide") : t("common.show")}
          </button>
        </div>
        <div className="mt-4">
          <TranslateButton orgSlug={orgSlug} t={t} getTexts={englishTexts} onTranslated={applyTranslation} />
        </div>
        <div className={showIndonesian ? "mt-5 space-y-4" : "hidden"}>
          <div>
            <label htmlFor="title_id" className="field-label">{t("event.titleId")}</label>
            <input id="title_id" name="title_id" className="input" maxLength={200} value={titleId} onChange={(e) => setTitleId(e.target.value)} />
          </div>
          <div>
            <label htmlFor="description_id" className="field-label">{t("event.descriptionId")}</label>
            <textarea id="description_id" name="description_id" rows={7} className="input" value={descriptionId} onChange={(e) => setDescriptionId(e.target.value)} />
          </div>
          {links.some((l) => l.url || l.label_en) && (
            <div className="space-y-2">
              <p className="field-label">{t("event.extraLinks")} (ID)</p>
              {links.map((link, i) =>
                link.url || link.label_en ? (
                  <input
                    key={i}
                    name={`link_label_id_${i}`}
                    aria-label={`${t("event.linkLabel")} ID ${i + 1}`}
                    placeholder={link.label_en || t("event.linkLabel")}
                    className="input"
                    value={link.label_id}
                    onChange={(e) => updateLink(i, { label_id: e.target.value })}
                  />
                ) : null,
              )}
            </div>
          )}
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-brand-100 bg-canvas/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <SubmitButton pendingLabel={t("common.loading")}>{t("event.save")}</SubmitButton>
        {state.error && <p role="alert" className="field-error mt-0">{state.error}</p>}
        {state.ok && <p role="status" className="text-sm font-semibold text-emerald-700">{t("event.saved")}</p>}
      </div>
    </form>
  );
}

function FormSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-100 text-brand-700">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
