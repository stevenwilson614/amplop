import { useEffect, useState } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import WhaleMood from "@/components/ui/WhaleMood";
import {
  getTodayWhaleFact,
  hasSeenTodayWhale,
  isWhaleFactsEnabled,
  markSeenTodayWhale,
  whaleImageUrl,
} from "@/lib/whaleFactDay";

export default function WhaleBuddy() {
  const { dbUser } = useHousehold();
  const [open, setOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const enabled = isWhaleFactsEnabled(dbUser);
  const fact = getTodayWhaleFact();
  const userId = dbUser?.id ?? "";

  useEffect(() => {
    if (!enabled || !userId) return;
    if (!hasSeenTodayWhale(userId)) setOpen(true);
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled) return;
    const img = new Image();
    img.src = whaleImageUrl(fact.image);
  }, [enabled, fact.image]);

  if (!enabled || !dbUser) return null;

  function dismiss() {
    markSeenTodayWhale(userId);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Today's whale fact"
        className={`absolute bottom-[7.5rem] right-4 z-[65] flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white/95 shadow-md ${
          !hasSeenTodayWhale(userId) ? "animate-pulse ring-2 ring-brand-accent/40" : ""
        }`}
      >
        <WhaleMood happy className="h-7 w-7" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-3"
          onClick={dismiss}
          role="presentation"
        >
          <div
            className="relative flex h-[92%] max-h-[820px] w-full max-w-[400px] flex-col overflow-hidden rounded-2xl bg-brand-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="whale-fact-title"
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-full bg-black/50 px-3 py-1.5 font-mono text-xs font-semibold text-white"
            >
              ✕
            </button>

            <div className="relative min-h-0 flex-[7] bg-brand-bg">
              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <WhaleMood happy className="h-16 w-16 opacity-40" />
                </div>
              )}
              <img
                src={whaleImageUrl(fact.image)}
                alt={fact.species}
                className={`h-full w-full object-cover transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setImgLoaded(true)}
              />
            </div>

            <div className="flex flex-[3] flex-col gap-2 overflow-auto p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-brand-text-muted">
                whale of the day
              </p>
              <h2 id="whale-fact-title" className="font-mono text-xl font-bold text-brand-text">
                {fact.species}
              </h2>
              <p className="font-mono text-sm leading-relaxed text-brand-text">{fact.fact}</p>
              <p className="mt-auto font-mono text-[10px] text-brand-text-muted">{fact.credit}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
