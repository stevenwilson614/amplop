"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  householdId: string;
  userId: string;
}

// Invisible component that lives in the app layout.
// Subscribes to postgres_changes for the household and calls
// router.refresh() when another household member makes a change,
// keeping all server-rendered data (spentIdr, transaction list,
// envelope list) in sync within ~1 second.
export default function RealtimeSync({ householdId, userId }: Props) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce refreshes: batch events that arrive within 600ms into one refresh.
  function scheduleRefresh() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => router.refresh(), 600);
  }

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`household-sync:${householdId}`)

      // Transactions: the primary sync event.
      // Only refresh when another user adds/removes a transaction
      // (self-mutations are already handled by optimistic state updates).
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const changedByUserId =
            payload.eventType !== "DELETE" &&
            payload.new &&
            "user_id" in payload.new
              ? (payload.new.user_id as string)
              : null;

          // Refresh for other users' changes, and also for deletes
          // (can't tell who deleted, so always refresh)
          if (changedByUserId !== userId || payload.eventType === "DELETE") {
            scheduleRefresh();
          }
        }
      )

      // Envelopes: refresh when the other person creates/renames/deletes
      // an envelope. Self-changes are optimistic so the refresh just confirms.
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "envelopes",
          filter: `household_id=eq.${householdId}`,
        },
        () => scheduleRefresh()
      )

      // Trips: refresh when a trip is created or ended by either user.
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `household_id=eq.${householdId}`,
        },
        () => scheduleRefresh()
      )

      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, userId]);

  return null;
}
