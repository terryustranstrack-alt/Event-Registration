// Row shapes mirrored from supabase/migrations (hand-maintained; regenerate
// with `supabase gen types typescript` once the project is linked).
import type { Locale } from "@/lib/i18n/translate";

export type OrgRole = "admin" | "staff";
export type EventStatus = "draft" | "published" | "closed";
export type RegistrationStatus = "registered" | "cancelled";
export type DeliveryStatus = "pending" | "sent" | "failed";
export type FormFieldType =
  | "short_text"
  | "long_text"
  | "phone"
  | "number"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "date"
  | "file";

export const FORM_FIELD_TYPES: FormFieldType[] = [
  "short_text",
  "long_text",
  "phone",
  "number",
  "dropdown",
  "radio",
  "checkbox",
  "date",
  "file",
];
export const CHOICE_FIELD_TYPES: FormFieldType[] = ["dropdown", "radio", "checkbox"];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  default_language: Locale;
  contact_email: string | null;
  privacy_policy_url: string | null;
  status: "active" | "suspended";
  suspended_reason: string | null;
  created_at: string;
}

export interface ExtraLink {
  label_en?: string | null;
  label_id?: string | null;
  url: string;
}

export interface EventRow {
  id: string;
  org_id: string;
  slug: string;
  title_en: string | null;
  title_id: string | null;
  description_en: string | null;
  description_id: string | null;
  banner_url: string | null;
  about_image_url: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue_name: string | null;
  venue_address: string | null;
  maps_url: string | null;
  online_url: string | null;
  extra_links: ExtraLink[];
  capacity: number;
  seats_taken: number;
  hide_capacity_total: boolean;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  status: EventStatus;
  allow_multiple_per_email: boolean;
  consent_enabled: boolean;
  retention_months: number;
  created_at: string;
}

export interface FieldOption {
  value: string;
  label_en?: string | null;
  label_id?: string | null;
}

export interface FormField {
  id: string;
  event_id: string;
  org_id: string;
  position: number;
  type: FormFieldType;
  label_en: string | null;
  label_id: string | null;
  help_en: string | null;
  help_id: string | null;
  placeholder_en: string | null;
  placeholder_id: string | null;
  required: boolean;
  min_value: number | null;
  max_value: number | null;
  options: FieldOption[];
  archived_at: string | null;
}

export interface Registration {
  id: string;
  event_id: string;
  org_id: string;
  full_name: string;
  email: string;
  language: Locale;
  answers: Record<string, unknown>;
  status: RegistrationStatus;
  ticket_code: string;
  consent_at: string | null;
  email_status: DeliveryStatus;
  email_error: string | null;
  email_sent_at: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
}

/** Uploaded-file answers are stored as this object. */
export interface FileAnswer {
  path: string;
  name: string;
  size: number;
  type: string;
}
