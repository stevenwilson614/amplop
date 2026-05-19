"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Envelope, TripWithEnvelopes } from "@/lib/types";
import type { FxRates } from "@/lib/currency";
import TripCard from "./TripCard";
import TripSheet from "./TripSheet";

interface Props {
  initialTrips: TripWithEnvelopes[];
  parentEnvelopes: Envelope[];  // regular (non-trip) envelopes for parent selection
  spentIdr: Record<string, number>;
  displayCurrency: string;
  fxRates: FxRates;
  householdId: string;
}

export default function TripSection({
  initialTrips,
  parentEnvelopes,
  spentIdr,
  displayCurrency,
  fxRates,
  householdId,
}: Props) {
  const router = useRouter();
  const [trips, setTrips] = useState<TripWithEnvelopes[]>(initialTrips);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showEnded, setShowEnded] = useState(false);

  const activeTrips = trips.filter((t) => t.status === "active");
  const endedTrips  = trips.filter((t) => t.status === "ended");

  function handleTripSaved(trip: TripWithEnvelopes, isNew: boolean) {
    setTrips((prev) =>
      isNew ? [trip, ...prev] : prev.map((t) => (t.id === trip.id ? trip : t))
    );
    setSheetOpen(false);
  }

  function handleTripUpdated(trip: TripWithEnvelopes) {
    setTrips((prev) => prev.map((t) => (t.id === trip.id ? trip : t)));
    // Refresh server to recompute parent envelope balances
    router.refresh();
  }

  async function handleEndTrip(tripId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("trips")
      .update({ status: "ended" })
      .eq("id", tripId);
    if (!error) {
      setTrips((prev) =>
        prev.map((t) => (t.id === tripId ? { ...t, status: "ended" as const } : t))
      );
      // Refresh so parent envelope balances update (unspent returns)
      router.refresh();
    }
  }

  if (trips.length === 0 && !sheetOpen) {
    return (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-brand-text-muted uppercase tracking-widest">
            Trips
          </h2>
          <button
            onClick={() => setSheetOpen(true)}
            className="text-brand-accent text-sm font-medium flex items-center gap-1"
          >
            <PlusSmIcon />
            New trip
          </button>
        </div>
        <p className="text-brand-text-muted text-sm text-center py-6">
          No trips yet
        </p>
        <TripSheet
          key="new"
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          trip={null}
          householdId={householdId}
          onSaved={(t, isNew) => handleTripSaved({ ...t, envelopes: [] }, isNew)}
        />
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-brand-text-muted uppercase tracking-widest">
          Trips
        </h2>
        <button
          onClick={() => setSheetOpen(true)}
          className="text-brand-accent text-sm font-medium flex items-center gap-1"
        >
          <PlusSmIcon />
          New trip
        </button>
      </div>

      {/* Active trips */}
      <div className="space-y-3">
        {activeTrips.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            parentEnvelopes={parentEnvelopes}
            spentIdr={spentIdr}
            displayCurrency={displayCurrency}
            fxRates={fxRates}
            onTripUpdated={handleTripUpdated}
            onEndTrip={handleEndTrip}
          />
        ))}

        {activeTrips.length === 0 && (
          <p className="text-brand-text-muted text-sm">No active trips</p>
        )}
      </div>

      {/* Ended trips — collapsible */}
      {endedTrips.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowEnded((v) => !v)}
            className="flex items-center gap-1 text-brand-text-muted text-xs mb-2"
          >
            <ChevronIcon expanded={showEnded} />
            {endedTrips.length} past trip{endedTrips.length > 1 ? "s" : ""}
          </button>

          {showEnded && (
            <div className="space-y-3">
              {endedTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  parentEnvelopes={parentEnvelopes}
                  spentIdr={spentIdr}
                  displayCurrency={displayCurrency}
                  fxRates={fxRates}
                  onTripUpdated={handleTripUpdated}
                  onEndTrip={handleEndTrip}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <TripSheet
        key={`sheet-${sheetOpen}`}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        trip={null}
        householdId={householdId}
        onSaved={(t, isNew) => handleTripSaved({ ...t, envelopes: [] }, isNew)}
      />
    </section>
  );
}

function PlusSmIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
