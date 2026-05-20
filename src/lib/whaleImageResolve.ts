import { WHALE_IMAGE_CATALOG } from "@/data/whaleImageCatalog";
import { whaleImageUrl } from "@/lib/whaleFactDay";

const BUNDLED_LOCAL = new Set(["blue-whale-size"]);

export function resolveWhaleImageSrc(slug: string, legacyImage?: string): string {
  const cat = WHALE_IMAGE_CATALOG[slug];
  if (cat) {
    if (BUNDLED_LOCAL.has(slug)) return whaleImageUrl(cat.local);
    return cat.primary;
  }
  if (legacyImage?.startsWith("http")) return legacyImage;
  if (legacyImage) return whaleImageUrl(legacyImage);
  return "";
}

export function nextWhaleImageFallback(slug: string, currentSrc: string): string | null {
  const cat = WHALE_IMAGE_CATALOG[slug];
  if (!cat) return null;

  const local = whaleImageUrl(cat.local);
  if (currentSrc === local || currentSrc.endsWith(cat.local)) return cat.primary;
  if (currentSrc === cat.primary) return cat.fallback !== cat.primary ? cat.fallback : null;
  return null;
}
