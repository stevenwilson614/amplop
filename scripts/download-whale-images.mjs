#!/usr/bin/env node
/**
 * Download whale photos from Wikimedia Commons into public/whales/
 * Usage: node scripts/download-whale-images.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/whales");

/** filename -> Wikimedia Commons file title (matches whaleFactsMockups slugs) */
const FILES = {
  "001-blue-whale-size.jpg": "Anim1754_-_Museum_of_Natural_History_-_Blue_Whale.jpg",
  "002-humpback-song.jpg": "Humpback_stellwagen_edit.jpg",
  "003-sperm-deep.jpg": "Mother_sperm_whale_and_calve.jpg",
  "004-beluga-voice.jpg": "Beluga_whale_Delphinapterus_leucas.jpg",
  "005-narwhal-tusk.jpg": "Narwhal,_Tavaniutit,_Baffin_Island.jpg",
  "006-fin-speed.jpg": "Fin_whale_from_the_vessel_Pacific_Identity.jpg",
  "007-gray-migration.jpg": "Eschrichtius_robustus.jpg",
  "008-bowhead-age.jpg": "Bowhead_Whale_up-close.jpg",
  "009-right-plankton.jpg": "North_Atlantic_Right_Whale_with_Calf.jpg",
  "010-minke-small.jpg": "Minke_Whale_(NOAA).jpg",
  "011-sei-streamlined.jpg": "Sei_whale.jpg",
  "012-brydes-tropical.jpg": "Bryde's_whale.jpg",
  "013-pygmy-sperm.jpg": "Kogia_breviceps.jpg",
  "014-cuvier-beaked.jpg": "Cuviers_beaked_whale.jpg",
  "015-blue-whale-heart.jpg": "Blue_Whale_underwater.jpg",
};

const UA = "AmplopWhaleBot/1.0 (household budget app; contact: github.com/stevenwilson614/amplop)";

async function commonsImageUrl(fileTitle) {
  const title = fileTitle.startsWith("File:") ? fileTitle : `File:${fileTitle}`;
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.searchParams.set("action", "query");
  api.searchParams.set("titles", title);
  api.searchParams.set("prop", "imageinfo");
  api.searchParams.set("iiprop", "url");
  api.searchParams.set("iiurlwidth", "1200");
  api.searchParams.set("format", "json");

  const res = await fetch(api.toString(), { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`API ${res.status} for ${title}`);
  const json = await res.json();
  const pages = json.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (page?.missing) throw new Error(`Missing file: ${title}`);
  const info = page.imageinfo?.[0];
  return info?.thumburl ?? info?.url;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Download ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  let ok = 0;
  let fail = 0;

  for (const [filename, wikiFile] of Object.entries(FILES)) {
    const dest = path.join(outDir, filename);
    try {
      process.stdout.write(`${filename} … `);
      const url = await commonsImageUrl(wikiFile);
      await download(url, dest);
      const kb = Math.round(fs.statSync(dest).size / 1024);
      console.log(`ok (${kb} KB)`);
      ok++;
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      fail++;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed → ${outDir}`);
  if (fail) process.exit(1);
}

main();
