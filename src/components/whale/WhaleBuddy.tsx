import { useEffect, useState } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import WhaleFabIcon from "@/components/ui/WhaleFabIcon";
import {
  getTodayWhaleFact,
  hasSeenTodayWhale,
  isWhaleFactsEnabled,
  markSeenTodayWhale,
  whaleImageUrl,
} from "@/lib/whaleFactDay";

function FactBody({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight || !text.includes(highlight)) {
    return <>{text}</>;
  }
  const [before, after] = text.split(highlight);
  return (
    <>
      {before}
      <span className="font-semibold text-[#3d7ab8]">{highlight}</span>
      {after}
    </>
  );
}

function WaveDivider() {
  return (
    <svg
      className="absolute -bottom-px left-0 w-full text-white"
      viewBox="0 0 400 32"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M0,20 C50,32 100,8 150,18 C200,28 250,4 300,16 C350,28 380,12 400,20 L400,32 L0,32 Z"
      />
    </svg>
  );
}

export default function WhaleBuddy() {
  const { dbUser } = useHousehold();
  const [open, setOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const enabled = isWhaleFactsEnabled(dbUser);
  const fact = getTodayWhaleFact();
  const userId = dbUser?.id ?? "";
  const imgSrc = whaleImageUrl(fact.image);

  useEffect(() => {
    if (!enabled || !userId) return;
    if (!hasSeenTodayWhale(userId)) setOpen(true);
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled) return;
    setImgLoaded(false);
    setImgError(false);
    const img = new Image();
    img.onload = () => setImgLoaded(true);
    img.onerror = () => setImgError(true);
    img.src = imgSrc;
  }, [enabled, imgSrc]);

  if (!enabled || !dbUser) return null;

  function dismiss() {
    markSeenTodayWhale(userId);
    setOpen(false);
  }

  function openModal() {
    setOpen(true);
    setImgLoaded(false);
    setImgError(false);
  }

  const unseen = !hasSeenTodayWhale(userId);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
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
            className="relative flex max-h-[90vh] w-full max-w-[380px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(15,28,46,0.35)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="whale-fact-title"
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#1a3d6b] text-sm font-bold text-white shadow-md"
            >
              ✕
            </button>

            <div className="overflow-y-auto">
              <div className="px-6 pb-2 pt-10 text-center">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1a3d6b]/70">
                  whale of the day
                </p>
                <h2
                  id="whale-fact-title"
                  className="mt-2 font-serif text-[2rem] font-bold leading-tight text-[#1a3d6b]"
                >
                  {fact.species}
                </h2>
                <span className="mt-3 inline-block rounded-full bg-[#2a6dad] px-4 py-1.5 font-mono text-xs font-semibold text-white">
                  {fact.tagline}
                </span>
              </div>

              <div className="relative mx-4 mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-[#1a4a7a]">
                {!imgLoaded && !imgError && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-white/20" />
                  </div>
                )}
                {imgError ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#2a6dad] to-[#1a3d6b] p-6 text-center">
                    <WhaleFabIcon className="h-16 w-16 opacity-90" />
                    <p className="font-mono text-xs text-white/80">image loading — try again later</p>
                  </div>
                ) : (
                  <img
                    src={imgSrc}
                    alt={fact.species}
                    className={`h-full w-full object-cover transition-opacity duration-300 ${
                      imgLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                  />
                )}
                <WaveDivider />
              </div>

              <div className="px-6 pb-8 pt-5 text-center">
                <svg
                  className="mx-auto mb-3 h-5 w-5 text-[#2a6dad]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <p className="font-mono text-sm leading-relaxed text-[#1a3d6b]/90">
                  <FactBody text={fact.fact} highlight={fact.highlight} />
                </p>
                <p className="mt-5 flex items-center justify-center gap-1.5 font-mono text-[10px] text-[#1a3d6b]/50">
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {fact.credit}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
