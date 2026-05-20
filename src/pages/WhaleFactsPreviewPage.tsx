import { Link } from "react-router-dom";
import WhaleFactCard from "@/components/whale/WhaleFactCard";
import { WHALE_FACT_MOCKUPS } from "@/data/whaleFactsMockups";

export default function WhaleFactsPreviewPage() {
  return (
    <div className="min-h-screen bg-[#0f1c2e]/40 px-4 py-6">
      <div className="mx-auto max-w-[400px]">
        <div className="mb-6 rounded-xl border border-brand-border bg-brand-surface p-4">
          <h1 className="font-mono text-lg font-bold text-brand-text">whale card mockups</h1>
          <p className="mt-2 font-mono text-xs leading-relaxed text-brand-text-muted">
            15 preview cards with real Wikimedia photos. If one fails, a backup photo loads automatically.
            For fully offline use, run <span className="text-brand-text">npm run whales:download</span> on your Mac.
          </p>
          <Link
            to="/envelopes"
            className="mt-3 inline-block font-mono text-xs text-brand-accent underline"
          >
            ← back to app
          </Link>
        </div>

        <div className="space-y-10 pb-12">
          {WHALE_FACT_MOCKUPS.map((fact, i) => (
            <div key={fact.slug}>
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#1a3d6b]">
                day {i + 1} · {fact.slug}
              </p>
              <WhaleFactCard fact={fact} dayLabel={`whale of the day · preview ${i + 1}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
