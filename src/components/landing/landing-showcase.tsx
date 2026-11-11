import { CheckIcon, LanguagesIcon } from "@/components/icons";
import type { Translate } from "@/lib/i18n/translate";

/** Three feature rows (form, check-in, reports), each with a small mock-up. */
export function LandingShowcase({ t }: { t: Translate }) {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl space-y-24 px-4">
        <ShowcaseRow eyebrow={t("landing.show1Eyebrow")} title={t("landing.show1Title")} text={t("landing.show1Text")} visual={<FormMock t={t} />} />
        <ShowcaseRow eyebrow={t("landing.show2Eyebrow")} title={t("landing.show2Title")} text={t("landing.show2Text")} visual={<ScannerMock t={t} />} flip />
        <ShowcaseRow eyebrow={t("landing.show3Eyebrow")} title={t("landing.show3Title")} text={t("landing.show3Text")} visual={<ReportMock t={t} />} />
      </div>
    </section>
  );
}

function ShowcaseRow({ eyebrow, title, text, visual, flip = false }: { eyebrow: string; title: string; text: string; visual: React.ReactNode; flip?: boolean }) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
        <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-700">{text}</p>
      </div>
      <div aria-hidden="true" className={`relative ${flip ? "lg:order-1" : ""}`}>
        <div className="absolute inset-6 -z-0 rounded-[2rem] bg-festival opacity-20 blur-2xl" />
        <div className="relative">{visual}</div>
      </div>
    </div>
  );
}

/** Mini registration form with the EN/ID switch and translate button. */
function FormMock({ t }: { t: Translate }) {
  return (
    <div className="card mx-auto max-w-md space-y-4 p-6">
      <div className="flex items-center justify-between">
        <span className="inline-flex rounded-full bg-brand-50 p-0.5 text-xs font-bold ring-1 ring-brand-100">
          <span className="rounded-full bg-white px-3 py-1 text-brand-700 shadow-sm">EN</span>
          <span className="px-3 py-1 text-ink-700">ID</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white">
          <LanguagesIcon size={14} /> {t("translate.button")}
        </span>
      </div>
      <div>
        <p className="field-label">{t("public.fullName")}</p>
        <div className="input text-ink-900">Budi Santoso</div>
      </div>
      <div>
        <p className="field-label">{t("landing.mockQuestion")}</p>
        <div className="space-y-2 text-sm">
          {["Instagram", "WhatsApp", t("landing.mockOptionFriend")].map((option, i) => (
            <p key={option} className="flex items-center gap-2">
              <span className={`grid h-4 w-4 place-items-center rounded-full border-2 ${i === 0 ? "border-brand-600" : "border-brand-200"}`}>
                {i === 0 && <span className="h-2 w-2 rounded-full bg-brand-600" />}
              </span>
              {option}
            </p>
          ))}
        </div>
      </div>
      <div className="btn-primary w-full">{t("public.submit")}</div>
    </div>
  );
}

/** Phone showing a green "Welcome!" scan result. */
function ScannerMock({ t }: { t: Translate }) {
  return (
    <div className="mx-auto w-64 rounded-[2.5rem] bg-ink-900 p-3 shadow-2xl shadow-brand-800/40">
      <div className="overflow-hidden rounded-[2rem] bg-ink-800">
        <div className="relative aspect-[3/4] bg-linear-to-br from-ink-700 to-ink-900">
          <div className="absolute inset-10 rounded-2xl border-4 border-white/70" />
          <div className="absolute inset-x-10 top-1/2 h-0.5 bg-pop-500 shadow-[0_0_12px_2px] shadow-pop-500" />
        </div>
        <div className="bg-emerald-500 px-4 py-5 text-center text-white">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white/25"><CheckIcon size={22} /></span>
          <p className="mt-2 text-lg font-extrabold">{t("landing.mockWelcome")}</p>
          <p className="text-sm font-semibold text-white/90">Budi Santoso</p>
        </div>
      </div>
    </div>
  );
}

/** Small dashboard: three numbers and a bar chart. */
function ReportMock({ t }: { t: Translate }) {
  const tiles = [
    { label: t("report.registered"), value: "148", accent: "from-brand-600 to-brand-500" },
    { label: t("report.checkedIn"), value: "121", accent: "from-emerald-500 to-emerald-400" },
    { label: t("report.attendanceRate"), value: "82%", accent: "from-pop-600 to-pop-500" },
  ];
  const bars = [18, 42, 76, 100, 64, 30, 12];
  return (
    <div className="card mx-auto max-w-md space-y-5 p-6">
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="relative overflow-hidden rounded-xl bg-canvas p-3 ring-1 ring-brand-100">
            <span className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${tile.accent}`} />
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-700/70">{tile.label}</p>
            <p className="mt-1 text-2xl font-extrabold">{tile.value}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-sm font-extrabold">{t("report.checkinsOverTime")}</p>
        <div className="mt-3 flex h-28 items-end gap-2">
          {bars.map((height, i) => (
            <span key={i} className="flex-1 rounded-t-lg bg-linear-to-t from-brand-600 to-pop-500" style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
