import type { EventRow } from "@/lib/domain-types";

export type ClosedReason = "sold_out" | "registration_closed" | "event_closed" | "not_open_yet" | "ended";

type AvailabilityInput = Pick<
  EventRow,
  "status" | "capacity" | "seats_taken" | "registration_opens_at" | "registration_closes_at" | "ends_at"
>;

/** Why the form is closed, or null if registration is open (FR-4.4). */
export function getClosedReason(event: AvailabilityInput, now = new Date()): ClosedReason | null {
  if (new Date(event.ends_at) < now) return "ended";
  if (event.status !== "published") return "event_closed";
  if (event.registration_opens_at && new Date(event.registration_opens_at) > now) return "not_open_yet";
  if (event.registration_closes_at && new Date(event.registration_closes_at) < now) return "registration_closed";
  if (event.seats_taken >= event.capacity) return "sold_out";
  return null;
}

export function seatsLeft(event: Pick<EventRow, "capacity" | "seats_taken">): number {
  return Math.max(event.capacity - event.seats_taken, 0);
}
