#!/usr/bin/env node
/** Regenerate src/data/whaleImageCatalog.ts with direct upload.wikimedia.org URLs */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const catalog = [
  ["blue-whale-size", "001-blue-whale-size.jpg", "Anim1754_-_Museum_of_Natural_History_-_Blue_Whale.jpg", "Blue_Whale_underwater.jpg", "8/8e"],
  ["humpback-song", "002-humpback-song.jpg", "Humpback_stellwagen_edit.jpg", "Humpback_Whale_underwater_shot.jpg"],
  ["sperm-deep", "003-sperm-deep.jpg", "Physeter_macrocephalus_display.jpg", "Mother_sperm_whale_and_calve.jpg"],
  ["beluga-voice", "004-beluga-voice.jpg", "Beluga_whale_Delphinapterus_leucas.jpg", "Beluga_whale.jpg"],
  ["narwhal-tusk", "005-narwhal-tusk.jpg", "Narwhal,_Tavaniutit,_Baffin_Island.jpg", "Narwhal.jpg"],
  ["fin-speed", "006-fin-speed.jpg", "Fin_whale_from_the_vessel_Pacific_Identity.jpg", "Fin_whale.jpg"],
  ["gray-migration", "007-gray-migration.jpg", "Eschrichtius_robustus.jpg", "Gray_whale.jpg"],
  ["bowhead-age", "008-bowhead-age.jpg", "Bowhead_Whale_up-close.jpg", "Bowhead_whale.jpg"],
  ["right-plankton", "009-right-plankton.jpg", "North_Atlantic_Right_Whale_with_Calf.jpg", "Eubalaena_glacialis_with_calf.jpg"],
  ["minke-small", "010-minke-small.jpg", "Minke_Whale_(NOAA).jpg", "Minke_whale_aka.jpg"],
  ["sei-streamlined", "011-sei-streamlined.jpg", "Sei_whale.jpg", "Balaenoptera_borealis.jpg"],
  ["brydes-tropical", "012-brydes-tropical.jpg", "Brydes_whale.jpg", "Bryde's_whale.jpg"],
  ["pygmy-sperm", "013-pygmy-sperm.jpg", "Kogia_breviceps.jpg", "Pygmy_sperm_whale.jpg"],
  ["cuvier-beaked", "014-cuvier-beaked.jpg", "Ziphius_cavirostris.jpg", "Cuviers_beaked_whale.jpg"],
  ["blue-whale-heart", "015-blue-whale-heart.jpg", "Blue_Whale_underwater.jpg", "Anim1754_-_Museum_of_Natural_History_-_Blue_Whale.jpg", "8/8e"],
];

function thumb(file, w = 1200, hashOverride) {
  if (hashOverride) {
    const enc = encodeURIComponent(file);
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${hashOverride}/${enc}/${w}px-${enc}`;
  }
  const md5 = crypto.createHash("md5").update(file).digest("hex");
  const enc = encodeURIComponent(file);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${enc}/${w}px-${enc}`;
}

let out = `/** Auto-generated — run: node scripts/gen-whale-image-catalog.mjs */\n\nexport interface WhaleImageSource {\n  local: string;\n  primary: string;\n  fallback: string;\n}\n\nexport const WHALE_IMAGE_CATALOG: Record<string, WhaleImageSource> = {\n`;

for (const row of catalog) {
  const [slug, local, primary, fallback, override] = row;
  const primaryUrl = thumb(primary, slug.startsWith("blue-whale-size") ? 1280 : 1200, override);
  const fallbackFile = slug === "blue-whale-size" ? "Blue_Whale_underwater.jpg" : fallback;
  const fallbackUrl =
    slug === "blue-whale-heart"
      ? thumb("Anim1754_-_Museum_of_Natural_History_-_Blue_Whale.jpg", 1280, "8/8e")
      : thumb(fallbackFile);
  out += `  "${slug}": { local: "${local}", primary: "${primaryUrl}", fallback: "${fallbackUrl}" },\n`;
}

out += "};\n";
fs.writeFileSync(path.join(__dirname, "../src/data/whaleImageCatalog.ts"), out);
console.log("Updated whaleImageCatalog.ts");
