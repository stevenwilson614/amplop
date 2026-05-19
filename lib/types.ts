export interface Household {
  id: string;
  name: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  household_id: string;
  email: string;
  display_name: string;
  display_currency: string;
  created_at: string;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Envelope {
  id: string;
  household_id: string;
  category_id: string | null;
  trip_id: string | null;
  parent_envelope_id: string | null;
  name: string;
  budget_amount: number;  // minor units of budget_currency
  budget_currency: string;
  sort_order: number;
  created_at: string;
}

export interface Trip {
  id: string;
  household_id: string;
  name: string;
  start_date: string;
  end_date: string;
  currency: string;
  status: "active" | "ended";
  created_at: string;
}

export interface Transaction {
  id: string;
  household_id: string;
  user_id: string;
  amount: number;
  currency: string;
  amount_idr_snapshot: number;
  fx_rate_snapshot: number;
  date: string;
  merchant_name: string | null;
  notes: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  created_at: string;
}

export interface TransactionAllocation {
  id: string;
  transaction_id: string;
  envelope_id: string;
  amount: number;
  created_at: string;
}

export interface FxRate {
  id: string;
  currency_pair: string;
  rate: number;
  fetched_at: string;
}

export interface VoiceCommand {
  id: string;
  household_id: string;
  user_id: string;
  transcript: string;
  parsed_action: Record<string, unknown> | null;
  confirmed: boolean;
  created_at: string;
}
