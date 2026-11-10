"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signInWithGoogleAction, signUpAction, type AuthFormState } from "@/app/actions/auth-actions";
import { SubmitButton } from "@/components/submit-button";
import { getTranslator, type Locale } from "@/lib/i18n/translate";

export function AuthForm({ mode, locale, next }: { mode: "signin" | "signup"; locale: Locale; next?: string }) {
  const t = getTranslator(locale);
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    mode === "signin" ? signInAction : signUpAction,
    {},
  );

  return (
    <div className="card mx-auto w-full max-w-md">
      <h1 className="mb-6 text-2xl font-bold">{t(mode === "signin" ? "auth.signInTitle" : "auth.signUpTitle")}</h1>
      <form action={signInWithGoogleAction}>
        <input type="hidden" name="next" value={next ?? ""} />
        <SubmitButton className="btn-secondary w-full">{t("auth.withGoogle")}</SubmitButton>
      </form>
      <p className="my-4 text-center text-xs uppercase text-zinc-500">{t("auth.or")}</p>
      {state.checkEmail ? (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {t("auth.checkEmail")}
        </p>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          {mode === "signup" && (
            <div>
              <label htmlFor="full_name" className="field-label">{t("auth.fullName")}</label>
              <input id="full_name" name="full_name" required autoComplete="name" className="input" />
            </div>
          )}
          <div>
            <label htmlFor="email" className="field-label">{t("auth.email")}</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label htmlFor="password" className="field-label">{t("auth.password")}</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="input"
            />
          </div>
          {state.error && (
            <p role="alert" className="field-error">
              {state.error === "invalid" ? t("auth.invalid") : state.message ?? t("error.generic")}
            </p>
          )}
          <SubmitButton className="btn-primary w-full" pendingLabel={t("common.loading")}>
            {t(mode === "signin" ? "nav.signIn" : "nav.signUp")}
          </SubmitButton>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-zinc-600">
        {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
        <Link
          href={`${mode === "signin" ? "/signup" : "/login"}${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-brand-700 underline"
        >
          {t(mode === "signin" ? "nav.signUp" : "nav.signIn")}
        </Link>
      </p>
    </div>
  );
}
