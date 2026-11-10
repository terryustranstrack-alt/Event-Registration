"use client";
import { useActionState } from "react";
import { inviteMemberAction, type FormState } from "@/app/actions/organization-actions";
import { SubmitButton } from "@/components/submit-button";
import { getTranslator, type Locale } from "@/lib/i18n/translate";

export function InviteMemberForm({ locale, orgSlug }: { locale: Locale; orgSlug: string }) {
  const t = getTranslator(locale);
  const [state, formAction] = useActionState<FormState, FormData>(inviteMemberAction, {});
  const link = state.ok && state.message ? `${typeof window !== "undefined" ? window.location.origin : ""}${state.message}` : null;
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="org_slug" value={orgSlug} />
      <div className="min-w-56 flex-1">
        <label htmlFor="invite-email" className="field-label">{t("auth.email")}</label>
        <input id="invite-email" name="email" type="email" required className="input" />
      </div>
      <div>
        <label htmlFor="invite-role" className="field-label">{t("team.role")}</label>
        <select id="invite-role" name="role" className="input" defaultValue="staff">
          <option value="staff">{t("team.role.staff")}</option>
          <option value="admin">{t("team.role.admin")}</option>
        </select>
      </div>
      <SubmitButton pendingLabel={t("common.loading")}>{t("team.invite")}</SubmitButton>
      {state.error && <p role="alert" className="field-error w-full">{state.error}</p>}
      {link && (
        <p role="status" className="w-full text-sm text-green-800">
          {t("team.inviteSent")} {t("team.inviteLink")}: <code className="break-all">{link}</code>
        </p>
      )}
    </form>
  );
}
