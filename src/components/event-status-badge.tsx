import type { EventStatus } from "@/lib/domain-types";
import type { Translate } from "@/lib/i18n/translate";

const styles: Record<EventStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  published: "bg-emerald-100 text-emerald-800",
  closed: "bg-amber-100 text-amber-900",
};

const dots: Record<EventStatus, string> = {
  draft: "bg-zinc-400",
  published: "bg-emerald-500",
  closed: "bg-amber-500",
};

export function EventStatusBadge({ status, t }: { status: EventStatus; t: Translate }) {
  return (
    <span className={`badge ${styles[status]}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dots[status]}`} />
      {t(`event.status.${status}`)}
    </span>
  );
}
