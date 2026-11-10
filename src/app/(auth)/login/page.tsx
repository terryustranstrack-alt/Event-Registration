import { AuthForm } from "@/components/auth-form";
import { getRequestLocale } from "@/lib/i18n/server-locale";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const locale = await getRequestLocale();
  return <AuthForm mode="signin" locale={locale} next={typeof next === "string" ? next : undefined} />;
}
