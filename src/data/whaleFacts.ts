export interface WhaleFactEntry {
  dayIndex: number;
  slug: string;
  species: string;
  fact: string;
  image: string;
  credit: string;
}

/** v1 test: 1 entry. Expand to 60 unique photo+fact days. */
export const WHALE_FACTS: WhaleFactEntry[] = [
  {
    dayIndex: 0,
    slug: "blue-whale-size",
    species: "Blue whale",
    fact: "The blue whale is the largest animal ever known to have lived — even the biggest dinosaurs were smaller. Its heart alone can weigh as much as a small car.",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Anim1754_-_Museum_of_Natural_History_-_Blue_Whale.jpg/1280px-Anim1754_-_Museum_of_Natural_History_-_Blue_Whale.jpg",
    credit: "Photo: NOAA / Wikimedia Commons (public domain)",
  },
];
