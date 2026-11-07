import type { Business, Campaign } from "./a2p-rules";
export type Registration = {
  id: string;
  user_id: string;
  display_name: string;
  relationship: string;
  brand_id: string | null;
  campaign_id: string | null;
  brand_status: string;
  campaign_status: string;
  stage: string;
  blocker: string | null;
  suspended: boolean;
  submitted_at: string | null;
  synced_at: string | null;
  updated_at: string;
  agency_registration_id?: string | null;
};
export type LinkRow = {
  phone_number: string;
  campaign_id: string;
  status: string;
  verified_at: string | null;
};
export type Fees = {
  brand: number;
  review: number;
  monthly: number;
  upfront: number;
  currency: string;
  source: string;
  confirmed_at: string;
  usecase: string;
  quoted_at: string;
};
export type A2PView = {
  registration: Registration | null;
  business: Business;
  campaign: Campaign;
  enums: { entities: string[]; verticals: string[]; usecases: string[]; exchanges: string[] };
  capability: { ok: boolean; blocker: string | null };
  numbers: { phone_number: string }[];
  links: LinkRow[];
  fees: Fees | null;
  operations: {
    kind: string;
    state: string;
    detail: string | null;
    authorized_at: string;
    fee_snapshot: Fees | null;
  }[];
  otp: { deliveryStatus: string; verified: boolean } | null;
};
