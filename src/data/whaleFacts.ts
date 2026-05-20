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

/** v1 test: 1 entry. Expand to 60 unique photo+fact days. */
export const WHALE_FACTS: WhaleFactEntry[] = [
  {
    dayIndex: 0,
    slug: "blue-whale-size",
    species: "Blue whale",
    tagline: "Nature's gentle giant",
    fact: "The blue whale is the largest animal ever known to have lived — even the biggest dinosaurs were smaller. Its heart alone can weigh as much as a small car!",
    highlight: "as much as a small car!",
    image: "blue-whale-size",
    credit: "Photo: NOAA / Wikimedia Commons (public domain)",
  },
];
