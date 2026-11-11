import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SubmitButton } from "@/components/submit-button";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { isConfirmOtpType, nextFromConfirmParams } from "@/lib/auth-redirect";
import { confirmEmailAction } from "./actions";

export const metadata: Metadata = { title: "Confirm email", robots: { index: false } };

/**
 * Target of the Supabase email templates:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&redirect_to={{ .RedirectTo }}
 * Shows a button instead of verifying on load (see confirmEmailAction).
 */
export default async function ConfirmEmailPage({ searchParams }: PageProps<"/auth/confirm">) {
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
  const tokenHash = str(sp.token_hash);
  const type = str(sp.type);
  const next = nextFromConfirmParams({ next: str(sp.next), redirect_to: str(sp.redirect_to) });
  const { t } = await getServerTranslator();
  const valid = Boolean(tokenHash) && isConfirmOtpType(type);

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="card w-full max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold">{t("auth.confirmTitle")}</h1>
          {valid ? (
            <form action={confirmEmailAction} className="space-y-4">
              <input type="hidden" name="token_hash" value={tokenHash!} />
              <input type="hidden" name="type" value={type!} />
              <input type="hidden" name="next" value={next} />
              <p className="text-sm text-zinc-700">{t("auth.confirmHelp")}</p>
              <SubmitButton className="btn-primary w-full" pendingLabel={t("common.loading")}>
                {t("auth.confirmButton")}
              </SubmitButton>
            </form>
          ) : (
            <p role="alert" className="field-error">{t("auth.confirmExpired")}</p>
          )}
        </div>
      </main>
    </>
  );
}
