import type { AnimalFactEntry } from "@/data/indonesiaAnimals";
import { ANIMAL_BIOME_STYLES } from "@/data/indonesiaAnimals";

export function FactBody({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight || !text.includes(highlight)) {
    return <>{text}</>;
  }
  const [before, after] = text.split(highlight);
  return (
    <>
      {before}
      <span className="font-semibold text-[#2a6dad]">{highlight}</span>
      {after}
    </>
  );
}

interface Props {
  fact: AnimalFactEntry;
  dayLabel?: string;
  showClose?: boolean;
  onClose?: () => void;
  showBack?: boolean;
  onBack?: () => void;
  showForward?: boolean;
  onForward?: () => void;
  forwardLabel?: string;
  className?: string;
}

export default function AnimalFactCard({
  fact,
  dayLabel,
  showClose,
  onClose,
  showBack,
  onBack,
  showForward,
  onForward,
  forwardLabel = "→",
  className = "",
}: Props) {
  const biome = ANIMAL_BIOME_STYLES[fact.biome];

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_16px_48px_rgba(15,28,46,0.2)] ${className}`}
    >
      {showBack && onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Previous day animal"
          className="absolute left-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#1a3d6b] text-lg font-bold text-white shadow-md"
        >
          ←
        </button>
      )}
      {showForward && onForward && (
        <button
          type="button"
          onClick={onForward}
          aria-label="Next day toward today"
          className="absolute left-14 top-4 z-20 flex h-9 items-center justify-center rounded-full bg-[#2a6dad] px-3 font-mono text-xs font-semibold text-white shadow-md"
        >
          {forwardLabel}
        </button>
      )}
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
          {dayLabel ?? "animal of the day"}
        </p>
        <h2 className="mt-2 font-serif text-[2.4rem] font-bold uppercase leading-[1.05] tracking-tight text-[#1a3d6b]">
          {fact.species}
        </h2>
        <span
          className="mt-3 inline-block rounded-full px-5 py-2 font-mono text-sm font-semibold text-white"
          style={{ backgroundColor: biome.accent }}
        >
          {fact.habitat}
        </span>
        <p className="mt-2 font-mono text-xs text-[#1a3d6b]/55">{fact.region}</p>
      </div>

      <div
        className="relative mx-4 mt-4 flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-2xl"
        style={{
          background: `linear-gradient(160deg, ${biome.from} 0%, ${biome.to} 100%)`,
        }}
      >
        <span className="select-none text-[5.5rem] leading-none drop-shadow-md" aria-hidden>
          {fact.emoji}
        </span>
        <span className="mt-3 rounded-full bg-white/15 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-white/90">
          {biome.label} · Indonesia
        </span>
      </div>

      <div className="px-6 pb-8 pt-6 text-center">
        <p className="font-mono text-base leading-relaxed text-[#1a3d6b]/90">
          <FactBody text={fact.fact} highlight={fact.highlight} />
        </p>
        <p className="mt-5 font-mono text-xs text-[#1a3d6b]/45">
          Indonesia wildlife · day {(fact.dayIndex % 60) + 1} of 60
        </p>
      </div>
    </article>
  );
}
