import { WHALE_IMAGE_CATALOG } from "@/data/whaleImageCatalog";
import { whaleImageUrl } from "@/lib/whaleFactDay";

export function resolveWhaleImageSrc(slug: string, legacyImage?: string): string {
  const cat = WHALE_IMAGE_CATALOG[slug];
  if (cat) return whaleImageUrl(cat.local);
  if (legacyImage?.startsWith("http")) return legacyImage;
  if (legacyImage) return whaleImageUrl(legacyImage);
  return "";
}

export function nextWhaleImageFallback(_slug: string, _currentSrc: string): string | null {
  return null;
}
