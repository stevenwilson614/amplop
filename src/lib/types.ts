export interface Household {
  id: string;
  name: string;
  display_currency: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  household_id: string;
  display_name: string;
  email: string;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  sort_order: number;
}

export interface Envelope {
  id: string;
  household_id: string;
  category_id: string | null;
  name: string;
  budget_idr: number;
  balance_idr: number;
  drawn_idr_snapshot: number;
  currency: string;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
}

export interface Trip {
  id: string;
  household_id: string;
  envelope_id: string;
  name: string;
  destination_currency: string;
  drawn_idr_snapshot: number;
  status: "active" | "ended";
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface TripWithEnvelopes extends Trip {
  envelope: Envelope;
}

export interface Transaction {
  id: string;
  household_id: string;
  trip_id: string | null;
  amount: number;
  amount_idr_snapshot: number;
  currency: string;
  description: string;
  date: string;
  location_lat: number | null;
  location_lng: number | null;
  created_by: string;
  created_at: string;
}

export interface TransactionAllocation {
  id: string;
  transaction_id: string;
  envelope_id: string;
  amount: number;
}

export interface FxRate {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  fetched_at: string;
}

export interface VoiceCommand {
  id: string;
  household_id: string;
  transcript: string;
  parsed_intent: Record<string, unknown> | null;
  created_at: string;
}
