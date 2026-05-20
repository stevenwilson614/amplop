import { useEffect, useState } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import WhaleFabIcon from "@/components/ui/WhaleFabIcon";
import WhaleFactCard from "@/components/whale/WhaleFactCard";
import {
  dayLabelForOffset,
  getWhaleFactWithOffset,
  hasSeenTodayWhale,
  isWhaleFactsEnabled,
  markSeenTodayWhale,
} from "@/lib/whaleFactDay";

export default function WhaleBuddy() {
  const { dbUser } = useHousehold();
  const [open, setOpen] = useState(false);
  const [viewOffset, setViewOffset] = useState(0);

  const enabled = isWhaleFactsEnabled(dbUser);
  const userId = dbUser?.id ?? "";
  const fact = getWhaleFactWithOffset(viewOffset);
  const canGoBack = viewOffset === 0;
  const canGoForward = viewOffset === -1;

  useEffect(() => {
    if (!enabled || !userId) return;
    if (!hasSeenTodayWhale(userId)) {
      setViewOffset(0);
      setOpen(true);
    }
  }, [enabled, userId]);

  if (!enabled || !dbUser) return null;

  function dismiss() {
    if (viewOffset === 0) markSeenTodayWhale(userId);
    setOpen(false);
    setViewOffset(0);
  }

  function openToday() {
    setViewOffset(0);
    setOpen(true);
  }

  const unseen = !hasSeenTodayWhale(userId);

  return (
    <>
      <button
        type="button"
        onClick={openToday}
        aria-label="Today's whale fact"
        className={`absolute bottom-[7.5rem] right-3 z-[65] flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 ${
          unseen
            ? "bg-gradient-to-br from-[#2a6dad] to-[#1a3d6b] ring-2 ring-[#5eb3e8] ring-offset-2 ring-offset-[rgba(235,238,242,0.9)] animate-bounce"
            : "bg-gradient-to-br from-[#3579b8] to-[#1e4a7a] ring-1 ring-white/40"
        }`}
      >
        <WhaleFabIcon className="h-9 w-9 drop-shadow-sm" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f1c2e]/55 p-4 backdrop-blur-[2px]"
          onClick={dismiss}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-[380px] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="whale-fact-title"
          >
            <WhaleFactCard
              fact={fact}
              dayLabel={dayLabelForOffset(viewOffset)}
              showClose
              onClose={dismiss}
              showBack={canGoBack}
              onBack={() => setViewOffset((o) => o - 1)}
              showForward={canGoForward}
              onForward={() => setViewOffset(0)}
              forwardLabel="today →"
            />
          </div>
        </div>
      )}
    </>
  );
}
