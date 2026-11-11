"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { getTranslator, type Locale } from "@/lib/i18n/translate";
import { slugify } from "@/lib/slug-utils";
import type { FormState } from "@/app/actions/organization-actions";
import type { Organization } from "@/lib/domain-types";

export function OrganizationForm({
  locale,
  action,
  org,
}: {
  locale: Locale;
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  org?: Organization;
}) {
  const t = getTranslator(locale);
  const [state, formAction] = useActionState(action, {});
  const [name, setName] = useState(org?.name ?? "");
  const [slug, setSlug] = useState(org?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(org));

  return (
    <form action={formAction} className="space-y-4">
      {org && <input type="hidden" name="org_slug" value={org.slug} />}
      <div>
        <label htmlFor="name" className="field-label">{t("org.name")}</label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          className="input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </div>
      {!org && (
        <div>
          <label htmlFor="slug" className="field-label">{t("org.slug")}</label>
          <input
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]"
            className="input font-mono"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            aria-describedby="slug-help"
          />
          <p id="slug-help" className="field-help">{t("org.slugHelp")} …/{slug || "my-org"}/event</p>
        </div>
      )}
      <div>
        <label htmlFor="logo" className="field-label">{t("org.logo")}</label>
        {org?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logo_url} alt="" className="mb-2 h-12 w-auto rounded" />
        )}
        <input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
      </div>
      <div>
        <label htmlFor="default_language" className="field-label">{t("org.defaultLanguage")}</label>
        <select id="default_language" name="default_language" className="input" defaultValue={org?.default_language ?? "en"}>
          <option value="en">{t("lang.en")}</option>
          <option value="id">{t("lang.id")}</option>
        </select>
      </div>
      <div>
        <label htmlFor="contact_email" className="field-label">{t("org.contactEmail")}</label>
        <input id="contact_email" name="contact_email" type="email" className="input" defaultValue={org?.contact_email ?? ""} />
      </div>
      {org && (
        <div>
          <label htmlFor="privacy_policy_url" className="field-label">{t("org.privacyUrl")}</label>
          <input id="privacy_policy_url" name="privacy_policy_url" type="url" className="input" defaultValue={org.privacy_policy_url ?? ""} />
        </div>
      )}
      {state.error && <p role="alert" className="field-error">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-green-700">{t("event.saved")}</p>}
      <SubmitButton pendingLabel={t("common.loading")}>{t(org ? "org.save" : "org.create")}</SubmitButton>
    </form>
  );
}
