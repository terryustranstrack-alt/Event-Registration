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
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(true)}>{t("reg.edit")}</button>
      <form action={resendTicketAction}>
        {hidden}
        <SubmitButton className="btn-secondary btn-sm">{t("reg.resend")}</SubmitButton>
      </form>
      {registration.checked_in_at && (
        <form action={undoCheckInAction}>
          {hidden}
          <SubmitButton className="btn-secondary btn-sm">{t("reg.undoCheckIn")}</SubmitButton>
        </form>
      )}
      <form
        action={cancelRegistrationAction}
        onSubmit={(e) => {
          if (!confirm(t("reg.confirmCancel"))) e.preventDefault();
        }}
      >
        {hidden}
        <SubmitButton className="btn-danger btn-sm">{t("reg.cancel")}</SubmitButton>
      </form>
    </div>
  );
}
