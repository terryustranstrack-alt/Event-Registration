import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SubmitButton } from "@/components/submit-button";
import { acceptInvitationAction } from "@/app/actions/organization-actions";
import { getCurrentUser } from "@/lib/auth-guards";
import { getServerTranslator } from "@/lib/i18n/server-locale";

export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const { error } = await searchParams;
  const { t } = await getServerTranslator();
  const user = await getCurrentUser();
  const here = `/invite/${token}`;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <div className="card space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight">{t("invite.title")}</h1>
          {typeof error === "string" && <p role="alert" className="field-error">{error.replaceAll("_", " ")}</p>}
          {user ? (
            <form action={acceptInvitationAction}>
              <input type="hidden" name="token" value={token} />
              <p className="mb-4 text-sm text-ink-700">{user.email}</p>
              <SubmitButton>{t("invite.accept")}</SubmitButton>
            </form>
          ) : (
            <>
              <p className="text-sm text-ink-700">{t("invite.signInFirst")}</p>
              <div className="flex gap-2">
                <Link className="btn-primary" href={`/login?next=${encodeURIComponent(here)}`}>{t("nav.signIn")}</Link>
                <Link className="btn-secondary" href={`/signup?next=${encodeURIComponent(here)}`}>{t("nav.signUp")}</Link>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
