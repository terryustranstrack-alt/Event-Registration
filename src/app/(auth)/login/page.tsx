import { AuthForm } from "@/components/auth-form";
import { getServerTranslator } from "@/lib/i18n/server-locale";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const { locale, t } = await getServerTranslator();
  const notice =
    error === "confirm_expired" || error === "confirm_invalid" || error === "callback" ? t("auth.linkExpired") : null;
  return <AuthForm mode="signin" locale={locale} next={typeof next === "string" ? next : undefined} notice={notice} />;
}
