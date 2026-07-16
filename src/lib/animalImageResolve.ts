import { ANIMAL_IMAGE_CATALOG } from "@/data/animalImageCatalog";
import { animalImageUrl } from "@/lib/animalFactDay";

export function resolveAnimalImageSrc(slug: string): string {
  const cat = ANIMAL_IMAGE_CATALOG[slug];
  if (cat) return animalImageUrl(cat.local);
  return "";
}

export function nextAnimalImageFallback(_slug: string, _currentSrc: string): string | null {
  return null;
}
