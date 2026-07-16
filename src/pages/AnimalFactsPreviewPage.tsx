import AnimalFactCard from "@/components/animals/AnimalFactCard";
import { INDONESIA_ANIMALS } from "@/data/indonesiaAnimals";

export default function AnimalFactsPreviewPage() {
  return (
    <div className="min-h-screen bg-brand-bg px-4 py-8">
      <div className="mx-auto max-w-[420px]">
        <h1 className="font-mono text-lg font-bold text-brand-text">Indonesia animals</h1>
        <p className="mt-1 font-mono text-xs text-brand-text-muted">
          {INDONESIA_ANIMALS.length} cards · one new animal each day for ~2 months
        </p>
        <div className="mt-6 space-y-8">
          {INDONESIA_ANIMALS.map((fact, i) => (
            <AnimalFactCard
              key={fact.slug}
              fact={fact}
              dayLabel={`animal of the day · ${i + 1}/${INDONESIA_ANIMALS.length}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
