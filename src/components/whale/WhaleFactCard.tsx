import { useEffect, useState } from "react";
import type { WhaleFactEntry } from "@/data/whaleFacts";
import WhaleFabIcon from "@/components/ui/WhaleFabIcon";
import { whaleImageUrl } from "@/lib/whaleFactDay";

export function FactBody({ text, highlight }: { text: string; highlight: string }) {
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

interface Props {
  fact: WhaleFactEntry;
  dayLabel?: string;
  showClose?: boolean;
  onClose?: () => void;
  className?: string;
}

export default function WhaleFactCard({ fact, dayLabel, showClose, onClose, className = "" }: Props) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const imgSrc = whaleImageUrl(fact.image);

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
    const img = new Image();
    img.onload = () => setImgLoaded(true);
    img.onerror = () => setImgError(true);
    img.src = imgSrc;
  }, [imgSrc]);

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_16px_48px_rgba(15,28,46,0.2)] ${className}`}
    >
      {showClose && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#1a3d6b] text-sm font-bold text-white shadow-md"
        >
          ✕
        </button>
      )}

      <div className="px-6 pb-2 pt-10 text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#1a3d6b]/70">
          {dayLabel ?? "whale of the day"}
        </p>
        <h2 className="mt-2 font-serif text-[2.75rem] font-bold uppercase leading-[1.05] tracking-tight text-[#1a3d6b]">
          {fact.species}
        </h2>
        <span className="mt-3 inline-block rounded-full bg-[#2a6dad] px-5 py-2 font-mono text-sm font-semibold text-white">
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
            <p className="font-mono text-sm text-white/80">image unavailable</p>
          </div>
        ) : (
          <img
            src={imgSrc}
            alt={fact.species}
            referrerPolicy="no-referrer"
            className={`h-full w-full object-cover transition-opacity duration-300 ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        )}
        <WaveDivider />
      </div>

      <div className="px-6 pb-8 pt-6 text-center">
        <p className="font-mono text-base leading-relaxed text-[#1a3d6b]/90">
          <FactBody text={fact.fact} highlight={fact.highlight} />
        </p>
        <p className="mt-5 flex items-center justify-center gap-1.5 font-mono text-xs text-[#1a3d6b]/50">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          {fact.credit}
        </p>
      </div>
    </article>
  );
}
