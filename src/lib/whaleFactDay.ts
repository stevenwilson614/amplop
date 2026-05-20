import { WHALE_FACTS } from "@/data/whaleFacts";

const EPOCH = new Date("2024-01-01T00:00:00Z").getTime();

export function whaleFactCount(): number {
  return WHALE_FACTS.length;
}

export function getTodayDayIndex(): number {
  const days = Math.floor((Date.now() - EPOCH) / 86_400_000);
  const n = WHALE_FACTS.length;
  return ((days % n) + n) % n;
}

/** offset 0 = today, -1 = yesterday, -2 = two days ago, etc. */
export function getDayIndexWithOffset(offset: number): number {
  const n = WHALE_FACTS.length;
  const today = getTodayDayIndex();
  return ((today + offset) % n + n) % n;
}

export function getWhaleFactWithOffset(offset: number) {
  return WHALE_FACTS[getDayIndexWithOffset(offset)];
}

export function getTodayWhaleFact() {
  return getWhaleFactWithOffset(0);
}

export function dayLabelForOffset(offset: number): string {
  if (offset === 0) return "whale of the day";
  if (offset === -1) return "yesterday's whale";
  return `${-offset} days ago`;
}

export function whaleImageUrl(filename: string): string {
  if (filename.startsWith("http://") || filename.startsWith("https://")) return filename;
  return `${import.meta.env.BASE_URL}whales/${filename}`;
}

export function seenStorageKey(userId: string): string {
  const d = new Date().toLocaleDateString("en-CA");
  return `amplop_whale_seen_${userId}_${d}`;
}

export function hasSeenTodayWhale(userId: string): boolean {
  try {
    return localStorage.getItem(seenStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markSeenTodayWhale(userId: string): void {
  try {
    localStorage.setItem(seenStorageKey(userId), "1");
  } catch {
    /* ignore */
  }
}

export function isWhaleFactsEnabled(dbUser: { whale_facts_enabled?: boolean } | null): boolean {
  return dbUser?.whale_facts_enabled !== false;
}
