export interface WhaleFactEntry {
  dayIndex: number;
  slug: string;
  species: string;
  tagline: string;
  fact: string;
  /** Phrase from fact to emphasize in accent color */
  highlight: string;
  image: string;
  credit: string;
}

export { WHALE_FACT_MOCKUPS as WHALE_FACTS } from "@/data/whaleFactsMockups";
