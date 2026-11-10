import type { EventStatus } from "@/lib/domain-types";
import type { Translate } from "@/lib/i18n/translate";

const styles: Record<EventStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  published: "bg-green-100 text-green-800",
  closed: "bg-amber-100 text-amber-800",
};

export function EventStatusBadge({ status, t }: { status: EventStatus; t: Translate }) {
  return <span className={`badge ${styles[status]}`}>{t(`event.status.${status}`)}</span>;
}
