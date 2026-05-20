import { WHALE_FACTS } from "@/data/whaleFacts";

const EPOCH = new Date("2024-01-01T00:00:00Z").getTime();

export function getTodayDayIndex(): number {
  const days = Math.floor((Date.now() - EPOCH) / 86_400_000);
  const n = WHALE_FACTS.length;
  return ((days % n) + n) % n;
}

export function getTodayWhaleFact() {
  return WHALE_FACTS[getTodayDayIndex()];
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
