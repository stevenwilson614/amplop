export interface Household {
  id: string;
  name: string;
  created_at: string;
}

export interface DbUser {
  id: string;
  household_id: string;
  email: string;
  display_name: string;
  display_currency: string;
  whale_facts_enabled?: boolean;
  created_at: string;
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
  trip_id: string | null;
  parent_envelope_id: string | null;
  name: string;
  budget_amount: number;
  budget_currency: string;
  sort_order: number;
  drawn_idr_snapshot: number;
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

export interface TripDraw {
  id: string;
  trip_id: string;
  envelope_id: string;
  daily_amount: number;
  label: string;
  created_at: string;
}

export type TxType = "expense" | "income" | "transfer";

export interface Transaction {
  id: string;
  household_id: string;
  user_id: string;
  tx_type?: TxType;
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
  user?: { display_name: string };
  allocations?: TransactionAllocation[];
}

export interface TransactionAllocation {
  id: string;
  transaction_id: string;
  envelope_id: string;
  amount: number;
}

export interface FxRate {
  id: string;
  currency_pair: string;
  rate: number;
  fetched_at: string;
}

export type FxRates = Record<string, number>;

export interface EnvelopeSpent {
  envelope_id: string;
  spent_idr: number;
}
