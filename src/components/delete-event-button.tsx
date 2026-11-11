"use client";
import { useRef, useState } from "react";
import { deleteEventAction } from "@/app/actions/event-actions";
import { SubmitButton } from "@/components/submit-button";
import { EVENT_DELETE_CONFIRM_WORD } from "@/lib/event-delete";
import { getTranslator, type Locale } from "@/lib/i18n/translate";

/**
 * Tombol hapus acara dengan konfirmasi dua langkah:
 * 1) klik "Hapus acara" → muncul kotak peringatan,
 * 2) ketik kata DELETE → baru tombol hapus merah bisa ditekan.
 */
export function DeleteEventButton({
  orgSlug,
  eventId,
  eventTitle,
  registrations,
  locale,
}: {
  orgSlug: string;
  eventId: string;
  eventTitle: string;
  registrations: number;
  locale: Locale;
}) {
  const t = getTranslator(locale);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim() === EVENT_DELETE_CONFIRM_WORD;

  function close() {
    setTyped("");
    dialogRef.current?.close();
  }

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className="btn btn-sm text-white/85 hover:bg-red-600/80 hover:text-white">
        {t("event.delete")}
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setTyped("")}
        aria-labelledby="delete-event-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl p-0 text-ink-900 shadow-2xl backdrop:bg-ink-900/60"
      >
        <form action={deleteEventAction} className="space-y-4 p-6">
          <input type="hidden" name="org_slug" value={orgSlug} />
          <input type="hidden" name="event_id" value={eventId} />
          <h2 id="delete-event-title" className="text-xl font-extrabold">{t("event.deleteTitle")}</h2>
          <p className="text-ink-700">{t("event.deleteWarning", { title: eventTitle, count: registrations })}</p>
          <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{t("event.deleteIrreversible")}</p>
          <div>
            <label htmlFor="delete-event-confirm" className="field-label">
              {t("event.deleteTypeToConfirm", { word: EVENT_DELETE_CONFIRM_WORD })}
            </label>
            <input
              id="delete-event-confirm"
              name="confirm"
              autoComplete="off"
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} className="btn-secondary">{t("event.deleteCancel")}</button>
            <SubmitButton className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-40" disabled={!confirmed} pendingLabel={t("common.loading")}>
              {t("event.deleteConfirm")}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
