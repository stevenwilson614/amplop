import { INDONESIA_ANIMALS } from "@/data/indonesiaAnimals";

const EPOCH = new Date("2024-01-01T00:00:00Z").getTime();

export function animalFactCount(): number {
  return INDONESIA_ANIMALS.length;
}

export function getTodayDayIndex(): number {
  const days = Math.floor((Date.now() - EPOCH) / 86_400_000);
  const n = INDONESIA_ANIMALS.length;
  return ((days % n) + n) % n;
}

/** offset 0 = today, -1 = yesterday, -2 = two days ago, etc. */
export function getDayIndexWithOffset(offset: number): number {
  const n = INDONESIA_ANIMALS.length;
  const today = getTodayDayIndex();
  return ((today + offset) % n + n) % n;
}

export function getAnimalFactWithOffset(offset: number) {
  return INDONESIA_ANIMALS[getDayIndexWithOffset(offset)];
}

export function getTodayAnimalFact() {
  return getAnimalFactWithOffset(0);
}

export function dayLabelForOffset(offset: number): string {
  if (offset === 0) return "animal of the day";
  if (offset === -1) return "yesterday's animal";
  return `${-offset} days ago`;
}

export function seenStorageKey(userId: string): string {
  const d = new Date().toLocaleDateString("en-CA");
  return `amplop_animal_seen_${userId}_${d}`;
}

export function hasSeenTodayAnimal(userId: string): boolean {
  try {
    return localStorage.getItem(seenStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markSeenTodayAnimal(userId: string): void {
  try {
    localStorage.setItem(seenStorageKey(userId), "1");
  } catch {
    /* ignore */
  }
}

/** Reuses the existing users.whale_facts_enabled column. */
export function isAnimalFactsEnabled(dbUser: { whale_facts_enabled?: boolean } | null): boolean {
  return dbUser?.whale_facts_enabled !== false;
}
