"use client";
import { useState } from "react";
import {
  cancelRegistrationAction,
  editRegistrantAction,
  resendTicketAction,
  undoCheckInAction,
} from "@/app/actions/registration-admin-actions";
import { SubmitButton } from "@/components/submit-button";
import { getTranslator, type Locale } from "@/lib/i18n/translate";

export function RegistrantRowActions({
  locale,
  orgSlug,
  eventId,
  registration,
}: {
  locale: Locale;
  orgSlug: string;
  eventId: string;
  registration: { id: string; full_name: string; email: string; status: string; checked_in_at: string | null };
}) {
  const t = getTranslator(locale);
  const [editing, setEditing] = useState(false);
  const hidden = (
    <>
      <input type="hidden" name="org_slug" value={orgSlug} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="registration_id" value={registration.id} />
    </>
  );

  if (editing) {
    return (
      <form action={async (fd) => { await editRegistrantAction(fd); setEditing(false); }} className="ml-auto flex max-w-xs flex-col gap-2 text-left">
        {hidden}
        <input name="full_name" defaultValue={registration.full_name} aria-label={t("reg.table.name")} className="input" required minLength={2} />
        <input name="email" type="email" defaultValue={registration.email} aria-label={t("reg.table.email")} className="input" required />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="resend" defaultChecked /> {t("reg.resend")}</label>
        <div className="flex gap-2">
          <SubmitButton className="btn-primary btn-sm">{t("reg.save")}</SubmitButton>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(false)}>{t("common.cancel")}</button>
        </div>
      </form>
    );
  }

  if (registration.status !== "registered") return null;
  // A compact "Actions" menu keeps each table row one line tall.
  const menuItem = "block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-brand-50";
  return (
    <details className="group relative inline-block text-left">
      <summary className="btn-secondary btn-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {t("common.actions")} <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-56 space-y-0.5 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-brand-100">
        <button type="button" className={`${menuItem} text-ink-800`} onClick={() => setEditing(true)}>{t("reg.edit")}</button>
        <form action={resendTicketAction}>
          {hidden}
          <SubmitButton className={`${menuItem} text-ink-800`}>{t("reg.resend")}</SubmitButton>
        </form>
        {registration.checked_in_at && (
          <form action={undoCheckInAction}>
            {hidden}
            <SubmitButton className={`${menuItem} text-ink-800`}>{t("reg.undoCheckIn")}</SubmitButton>
          </form>
        )}
        <form
          action={cancelRegistrationAction}
          onSubmit={(e) => {
            if (!confirm(t("reg.confirmCancel"))) e.preventDefault();
          }}
        >
          {hidden}
          <SubmitButton className={`${menuItem} text-red-700 hover:bg-red-50`}>{t("reg.cancel")}</SubmitButton>
        </form>
      </div>
    </details>
  );
}
