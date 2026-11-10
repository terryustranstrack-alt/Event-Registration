import { AuthForm } from "@/components/auth-form";
import { getRequestLocale } from "@/lib/i18n/server-locale";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const locale = await getRequestLocale();
  return <AuthForm mode="signup" locale={locale} next={typeof next === "string" ? next : undefined} />;
}
