"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTranslator, type Locale } from "@/lib/i18n/translate";
import { formatTime } from "@/lib/i18n/format";
import { extractTicketCode } from "@/lib/ticket-code-format";

interface Guest {
  ticket_code: string;
  full_name: string;
  email: string;
  status: "registered" | "cancelled";
  checked_in_at: string | null;
}

interface QueuedCheckIn {
  code: string;
  method: "scan" | "manual" | "offline_sync";
  at: string;
}

type ResultKind = "valid" | "already_checked_in" | "cancelled" | "wrong_event" | "not_found" | "invalid";
interface ScanResult {
  kind: ResultKind;
  name?: string | null;
  at?: string | null;
  by?: string | null;
  offline?: boolean;
}

const storageKey = (eventId: string, kind: "guests" | "queue") => `checkin:${eventId}:${kind}`;

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / private mode: scanning still works online
  }
}

/**
 * Phone scanner (FR-8). Camera scan + manual search, green/amber/red result,
 * guest list cached on the device, check-ins queued while offline and synced
 * when the connection returns.
 */
export function CheckInScanner({
  eventId,
  eventTitle,
  backHref,
  locale,
  timezone,
}: {
  eventId: string;
  eventTitle: string;
  backHref: string;
  locale: Locale;
  timezone: string;
}) {
  const t = getTranslator(locale);
  const [tab, setTab] = useState<"scan" | "search">("scan");
  // This component is rendered client-only (see check-in-scanner-loader), so
  // the device cache can be read synchronously on first render.
  const [guests, setGuests] = useState<Guest[]>(() => readStorage<Guest[]>(storageKey(eventId, "guests"), []));
  const [queue, setQueue] = useState<QueuedCheckIn[]>(() => readStorage<QueuedCheckIn[]>(storageKey(eventId, "queue"), []));
  const [online, setOnline] = useState(() => navigator.onLine);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [query, setQuery] = useState("");
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const busyRef = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  // ---- guest list cache ----------------------------------------------------
  const refreshGuests = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkin/${eventId}/guest-list`, { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { guests: Guest[] };
      const pending = readStorage<QueuedCheckIn[]>(storageKey(eventId, "queue"), []);
      const pendingCodes = new Map(pending.map((q) => [q.code, q.at]));
      const merged = body.guests.map((g) =>
        !g.checked_in_at && pendingCodes.has(g.ticket_code) ? { ...g, checked_in_at: pendingCodes.get(g.ticket_code)! } : g,
      );
      setGuests(merged);
      writeStorage(storageKey(eventId, "guests"), merged);
    } catch {
      // offline: keep cached list
    }
  }, [eventId]);

  const flushQueue = useCallback(async () => {
    const pending = readStorage<QueuedCheckIn[]>(storageKey(eventId, "queue"), []);
    if (pending.length === 0 || !navigator.onLine) return;
    try {
      const res = await fetch(`/api/checkin/${eventId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: pending.map((q) => ({ ...q, method: "offline_sync" })) }),
      });
      if (!res.ok) return;
      const remaining = readStorage<QueuedCheckIn[]>(storageKey(eventId, "queue"), []).filter(
        (q) => !pending.some((p) => p.code === q.code),
      );
      writeStorage(storageKey(eventId, "queue"), remaining);
      setQueue(remaining);
      void refreshGuests();
    } catch {
      // try again later
    }
  }, [eventId, refreshGuests]);

  useEffect(() => {
    // Both only set state after an awaited network call, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshGuests();
    void flushQueue();
    const goOnline = () => {
      setOnline(true);
      void flushQueue();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const id = setInterval(() => {
      void flushQueue();
      void refreshGuests();
    }, 20000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(id);
    };
  }, [eventId, refreshGuests, flushQueue]);

  const guestByCode = useMemo(() => new Map(guests.map((g) => [g.ticket_code, g])), [guests]);
  const registered = guests.filter((g) => g.status === "registered");
  const checkedCount = registered.filter((g) => g.checked_in_at).length;

  function markLocal(code: string, at: string) {
    setGuests((prev) => {
      const next = prev.map((g) => (g.ticket_code === code ? { ...g, checked_in_at: g.checked_in_at ?? at } : g));
      writeStorage(storageKey(eventId, "guests"), next);
      return next;
    });
  }

  function vibrate(kind: ResultKind) {
    try {
      navigator.vibrate?.(kind === "valid" ? 80 : [60, 60, 60]);
    } catch {
      // unsupported
    }
  }

  function offlineCheckIn(code: string, method: QueuedCheckIn["method"]): ScanResult {
    const guest = guestByCode.get(code);
    if (!guest) return { kind: "not_found", offline: true };
    if (guest.status === "cancelled") return { kind: "cancelled", name: guest.full_name, offline: true };
    if (guest.checked_in_at) return { kind: "already_checked_in", name: guest.full_name, at: guest.checked_in_at, offline: true };
    const at = new Date().toISOString();
    const next = [...readStorage<QueuedCheckIn[]>(storageKey(eventId, "queue"), []), { code, method, at }];
    writeStorage(storageKey(eventId, "queue"), next);
    setQueue(next);
    markLocal(code, at);
    return { kind: "valid", name: guest.full_name, offline: true };
  }

  async function checkIn(rawCode: string, method: QueuedCheckIn["method"]) {
    const code = extractTicketCode(rawCode);
    if (!code) return;
    let outcome: ScanResult;
    if (!navigator.onLine) {
      outcome = offlineCheckIn(code, method);
    } else {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500); // keep < 3 s at the door
        const res = await fetch(`/api/checkin/${eventId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, method }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(String(res.status));
        const { results } = (await res.json()) as {
          results: { result: ResultKind; fullName?: string; checkedInAt?: string; checkedInBy?: string }[];
        };
        const r = results[0];
        outcome = { kind: r.result, name: r.fullName, at: r.checkedInAt, by: r.checkedInBy };
        if (r.result === "valid" && r.checkedInAt) markLocal(code, r.checkedInAt);
      } catch {
        outcome = offlineCheckIn(code, method);
      }
    }
    vibrate(outcome.kind);
    setResult(outcome);
  }

  // ---- camera ---------------------------------------------------------------
  async function startCamera() {
    setCameraError(false);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader", { verbose: false });
      await scanner.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          const now = Date.now();
          if (busyRef.current) return;
          if (lastScanRef.current && lastScanRef.current.code === decoded && now - lastScanRef.current.at < 4000) return;
          lastScanRef.current = { code: decoded, at: now };
          busyRef.current = true;
          await checkIn(decoded, "scan");
          busyRef.current = false;
        },
        () => {},
      );
      scannerRef.current = scanner;
      setCameraOn(true);
    } catch {
      setCameraError(true);
    }
  }

  async function stopCamera() {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      // already stopped
    }
    scannerRef.current = null;
    setCameraOn(false);
  }

  useEffect(() => {
    return () => {
      void scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  // ---- search ---------------------------------------------------------------
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return guests
      .filter((g) => g.full_name.toLowerCase().includes(q) || g.email.toLowerCase().includes(q))
      .slice(0, 30);
  }, [guests, query]);

  const resultStyle: Record<ResultKind, string> = {
    valid: "bg-green-600 text-white",
    already_checked_in: "bg-amber-400 text-amber-950",
    cancelled: "bg-red-600 text-white",
    wrong_event: "bg-red-600 text-white",
    not_found: "bg-red-600 text-white",
    invalid: "bg-red-600 text-white",
  };

  return (
    <div className="flex min-h-full flex-1 flex-col bg-ink-900 text-white">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <Link href={backHref} className="text-sm text-white/75 underline">← {t("common.back")}</Link>
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-semibold">{eventTitle}</p>
          <p className="text-xs tabular-nums text-white/75" aria-live="polite">
            {t("checkin.counter", { checked: checkedCount, total: registered.length })}
          </p>
        </div>
      </header>

      {(!online || queue.length > 0) && (
        <div role="status" className="bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
          {!online && <p>{t("checkin.offline")}</p>}
          {queue.length > 0 && <p>{t("checkin.queued", { n: queue.length })}</p>}
        </div>
      )}

      <div className="flex border-b border-white/10" role="tablist">
        {(["scan", "search"] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              if (key !== "scan" && cameraOn) void stopCamera();
              setTab(key);
            }}
            className={`flex-1 py-3 text-sm font-semibold ${tab === key ? "border-b-2 border-white" : "text-white/65"}`}
          >
            {t(key === "scan" ? "checkin.scan" : "checkin.search")}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 py-4">
        {tab === "scan" ? (
          <div className="space-y-4">
            <div id="qr-reader" className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-ink-800" />
            {cameraError && <p role="alert" className="text-center text-sm text-red-300">{t("checkin.cameraError")}</p>}
            <div className="flex justify-center">
              {cameraOn ? (
                <button className="btn bg-ink-700 text-white" onClick={stopCamera}>{t("checkin.stopCamera")}</button>
              ) : (
                <button className="btn-primary px-6 py-3 text-base" onClick={startCamera}>📷 {t("checkin.startCamera")}</button>
              )}
            </div>
            <form
              className="mx-auto flex max-w-sm gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode.trim()) void checkIn(manualCode, "manual");
                setManualCode("");
              }}
            >
              <label htmlFor="manual-code" className="sr-only">{t("checkin.manualCode")}</label>
              <input
                id="manual-code"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={t("checkin.manualCode")}
                className="input border-white/15 bg-ink-800 text-white placeholder:text-white/45"
                autoCapitalize="off"
                autoCorrect="off"
              />
              <button className="btn shrink-0 whitespace-nowrap bg-ink-700 text-white">{t("checkin.checkIn")}</button>
            </form>
          </div>
        ) : (
          <div className="space-y-3">
            <label htmlFor="guest-search" className="sr-only">{t("checkin.searchPlaceholder")}</label>
            <input
              id="guest-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("checkin.searchPlaceholder")}
              className="input border-white/15 bg-ink-800 text-white placeholder:text-white/45"
              autoFocus
            />
            <ul className="divide-y divide-white/10">
              {matches.map((g) => (
                <li key={g.ticket_code} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{g.full_name}</p>
                    <p className="truncate text-xs text-white/65">{g.email}</p>
                  </div>
                  {g.status === "cancelled" ? (
                    <span className="badge bg-red-900 text-red-100">{t("reg.status.cancelled")}</span>
                  ) : g.checked_in_at ? (
                    <span className="badge bg-amber-300 text-amber-950">✓ {formatTime(g.checked_in_at, locale, timezone)}</span>
                  ) : (
                    <button className="btn-primary btn-sm" onClick={() => checkIn(g.ticket_code, "manual")}>
                      {t("checkin.checkIn")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {result && (
        <div
          role="alertdialog"
          aria-live="assertive"
          aria-label={result.kind}
          className={`fixed inset-x-0 bottom-0 z-50 p-6 pb-10 text-center shadow-2xl ${resultStyle[result.kind]}`}
        >
          <p className="text-4xl" aria-hidden="true">{result.kind === "valid" ? "✓" : result.kind === "already_checked_in" ? "!" : "✕"}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">
            {result.kind === "valid"
              ? t("checkin.valid")
              : result.kind === "already_checked_in"
                ? t("checkin.already")
                : result.kind === "invalid"
                  ? t("checkin.invalid")
                  : t(`checkin.result.${result.kind}`)}
          </p>
          {result.name && <p className="mt-1 text-xl">{result.name}</p>}
          {result.kind === "already_checked_in" && result.at && (
            <p className="mt-1">{t("checkin.alreadyAt", { time: formatTime(result.at, locale, timezone), by: result.by ?? "—" })}</p>
          )}
          {result.offline && <p className="mt-1 text-sm opacity-80">{t("checkin.offline")}</p>}
          <button className="btn mt-4 bg-black/20 px-8 py-3 text-base text-inherit" onClick={() => setResult(null)} autoFocus>
            {t("checkin.next")}
          </button>
        </div>
      )}
    </div>
  );
}
