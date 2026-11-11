"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RegistrationFormFields } from "@/components/registration-form-fields";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { getTranslator, type Locale } from "@/lib/i18n/translate";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import type { ClosedReason } from "@/lib/event-availability";
import type { FormField } from "@/lib/domain-types";
import {
  validateCustomFields,
  validateFixedFields,
  type FieldError,
  type RawValue,
} from "@/lib/registration-validation";

interface Availability {
  seatsLeft: number;
  capacity: number | null;
  closedReason: ClosedReason | null;
}

/** Seats-left counter (live) + registration form or closed reason (FR-4.3, FR-4.4, FR-5). */
export function PublicRegistrationPanel({
  eventId,
  locale,
  fields,
  orgName,
  privacyUrl,
  consentEnabled,
  initial,
  opensAt,
  timezone,
  turnstileSiteKey,
}: {
  eventId: string;
  locale: Locale;
  fields: FormField[];
  orgName: string;
  privacyUrl: string | null;
  consentEnabled: boolean;
  initial: Availability;
  opensAt: string | null;
  timezone: string;
  turnstileSiteKey: string;
}) {
  const t = getTranslator(locale);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [availability, setAvailability] = useState<Availability>(initial);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch(`/api/events/${eventId}/availability`, { cache: "no-store" });
        if (res.ok && active) setAvailability(await res.json());
      } catch {
        // offline: keep last known value
      }
    }
    const id = setInterval(poll, 10000);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [eventId]);

  function clientValidate(data: FormData) {
    const values: Record<string, RawValue> = {};
    for (const f of fields) {
      const key = `field_${f.id}`;
      if (f.type === "checkbox") values[f.id] = data.getAll(key).map(String);
      else if (f.type === "file") values[f.id] = (data.get(key) as File | null) ?? null;
      else values[f.id] = (data.get(key) as string | null) ?? null;
    }
    const errs: Record<string, FieldError> = {
      ...validateFixedFields({ fullName: String(data.get("full_name") ?? ""), email: String(data.get("email") ?? "") }),
      ...validateCustomFields(fields, values).errors,
    };
    if (consentEnabled && data.get("consent") !== "on") errs.consent = { key: "error.consent_required" };
    return errs;
  }

  function focusFirstError(errs: Record<string, FieldError>) {
    const first = Object.keys(errs)[0];
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"], [name="field_${first}"]`);
    el?.focus();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const data = new FormData(e.currentTarget);
    const errs = clientValidate(data);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setFormError(t("error.fixBelow"));
      focusFirstError(errs);
      return;
    }
    if (turnstileSiteKey) {
      if (!captchaToken) return setFormError(t("error.captcha"));
      data.set("cf-turnstile-response", captchaToken);
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/register`, { method: "POST", body: data });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ticketCode) {
        router.push(`/t/${body.ticketCode}?new=1`);
        return;
      }
      if (body.fieldErrors) {
        setErrors(body.fieldErrors);
        focusFirstError(body.fieldErrors);
      }
      const code = body.error as string | undefined;
      if (code === "rate_limited") setFormError(t("error.rateLimited"));
      else if (code === "captcha") setFormError(t("error.captcha"));
      else if (code === "already_registered") setFormError(t("error.already_registered"));
      else if (code && ["sold_out", "registration_closed", "event_closed", "not_open_yet", "ended"].includes(code)) {
        setAvailability((a) => ({ ...a, closedReason: code as ClosedReason, seatsLeft: code === "sold_out" ? 0 : a.seatsLeft }));
      } else if (code !== "validation") setFormError(t("error.generic"));
      else setFormError(t("error.fixBelow"));
      setCaptchaReset((n) => n + 1);
      setCaptchaToken(null);
    } catch {
      setFormError(t("error.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  const { seatsLeft, capacity, closedReason } = availability;
  const seatsText =
    capacity !== null
      ? t("public.seatsLeft", { left: formatNumber(seatsLeft, locale), total: formatNumber(capacity, locale) })
      : t("public.seatsLeftOnly", { left: formatNumber(seatsLeft, locale) });

  return (
    <section aria-labelledby="register-heading" className="card border-0 p-6 shadow-2xl shadow-brand-800/20 ring-1 ring-brand-100">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="register-heading" className="text-2xl font-extrabold tracking-tight">{t("public.registerNow")}</h2>
        {closedReason !== "ended" && (
          <p className={`badge px-3 py-1 ${seatsLeft === 0 ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"}`} aria-live="polite">
            {seatsText}
          </p>
        )}
      </div>
      {closedReason ? (
        <p role="status" className="rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">
          {closedReason === "not_open_yet" && opensAt
            ? t("public.closed.not_open_yet", { date: formatDateTime(opensAt, locale, timezone) })
            : t(`public.closed.${closedReason}`)}
        </p>
      ) : (
        <form ref={formRef} onSubmit={onSubmit} noValidate encType="multipart/form-data">
          <RegistrationFormFields
            fields={fields}
            locale={locale}
            t={t}
            errors={errors}
            orgName={orgName}
            privacyUrl={privacyUrl}
            consentEnabled={consentEnabled}
            disabled={submitting}
          />
          <div className="mt-5">
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={setCaptchaToken} resetSignal={captchaReset} language={locale} />
          </div>
          {formError && <p role="alert" className="field-error mt-4">{formError}</p>}
          <button type="submit" className="btn-primary mt-6 w-full py-3.5 text-base" disabled={submitting}>
            {submitting ? t("public.submitting") : t("public.submit")}
          </button>
        </form>
      )}
    </section>
  );
}
