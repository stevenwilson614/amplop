#!/usr/bin/env node
/**
 * Search Wikimedia Commons for photos of each Indonesian animal,
 * write src/data/animalImageCatalog.ts with local + primary URLs.
 *
 * Usage: node scripts/gen-animal-image-catalog.mjs
 * Then:  node scripts/download-animal-images.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UA = "AmplopAnimalBot/1.0 (https://github.com; Indonesian wildlife education app)";

/** slug → [local filename stem, Commons search query, optional preferred File: title] */
const ANIMALS = [
  ["orangutan", "001-orangutan", "Pongo pygmaeus orangutan", "File:Bornean orangutan (Pongo pygmaeus), Tanjung Putting National Park 02.jpg"],
  ["komodo-dragon", "002-komodo-dragon", "Varanus komodoensis", "File:Komodo dragon Varanus komodoensis.jpg"],
  ["sumatran-tiger", "003-sumatran-tiger", "Panthera tigris sumatrae", "File:Panthera tigris sumatrae.jpg"],
  ["javan-rhino", "004-javan-rhino", "Rhinoceros sondaicus", "File:Rhinoceros sondaicus in London Zoo.jpg"],
  ["bali-myna", "005-bali-myna", "Leucopsar rothschildi", "File:Bali Myna.jpg"],
  ["proboscis-monkey", "006-proboscis-monkey", "Nasalis larvatus", "File:Proboscis Monkey in Borneo.jpg"],
  ["babirusa", "007-babirusa", "Babyrousa babyrussa", "File:Babyrousa celebensis.jpg"],
  ["anoa", "008-anoa", "Bubalus depressicornis anoa", "File:Lowland Anoa.jpg"],
  ["sumatran-elephant", "009-sumatran-elephant", "Elephas maximus sumatranus", "File:Sumatran elephant.jpg"],
  ["sun-bear", "010-sun-bear", "Helarctos malayanus", "File:Sun Bear Helarctos malayanus.jpg"],
  ["sunda-clouded-leopard", "011-sunda-clouded-leopard", "Neofelis diardi", "File:Neofelis diardi -Sarawak Cultural Village -01.jpg"],
  ["tarsier", "012-tarsier", "Tarsius spectrum Sulawesi", "File:Tarsius tarsier -Singapore Zoo-8a.jpg"],
  ["slow-loris", "013-slow-loris", "Nycticebus coucang", "File:Nycticebus coucang 002.jpg"],
  ["maleo", "014-maleo", "Macrocephalon maleo", "File:Maleo at Bronx Zoo.jpg"],
  ["cenderawasih", "015-cenderawasih", "Paradisaea apoda bird of paradise", "File:Paradisaea apoda -Pairi Daiza-8a.jpg"],
  ["cassowary", "016-cassowary", "Casuarius casuarius", "File:Casuarius casuarius -Melbourne Zoo-8a.jpg"],
  ["saltwater-crocodile", "017-saltwater-crocodile", "Crocodylus porosus", "File:Crocodylus porosus.jpg"],
  ["hawksbill-turtle", "018-hawksbill-turtle", "Eretmochelys imbricata", "File:Eretmochelys imbricata Maldives.jpg"],
  ["dugong", "019-dugong", "Dugong dugon", "File:Dugong Marsa Alam.jpg"],
  ["whale-shark", "020-whale-shark", "Rhincodon typus", "File:Whale shark Georgia aquarium.jpg"],
  ["manta-ray", "021-manta-ray", "Manta birostris", "File:Manta alfredi (cropped).jpg"],
  ["clownfish", "022-clownfish", "Amphiprion ocellaris", "File:Amphiprion ocellaris (Clown anemonefish) JEL.jpg"],
  ["napoleon-wrasse", "023-napoleon-wrasse", "Cheilinus undulatus", "File:Cheilinus undulatus Great Barrier Reef.jpg"],
  ["mandarinfish", "024-mandarinfish", "Synchiropus splendidus", "File:Synchiropus splendidus -Aquarium-8a.jpg"],
  ["mola-mola", "025-mola-mola", "Mola mola ocean sunfish", "File:Mola mola.jpg"],
  ["irrawaddy-dolphin", "026-irrawaddy-dolphin", "Orcaella brevirostris", "File:Irrawaddy Dolphin (Orcaella brevirostris) (15657932290).jpg"],
  ["celebes-crested-macaque", "027-celebes-crested-macaque", "Macaca nigra", "File:Macaca nigra self-portrait.jpg"],
  ["javan-gibbon", "028-javan-gibbon", "Hylobates moloch", "File:Hylobates moloch.jpg"],
  ["siamang", "029-siamang", "Symphalangus syndactylus", "File:Siamang Symphalangus syndactylus.jpg"],
  ["banteng", "030-banteng", "Bos javanicus", "File:Bos javanicus.jpg"],
  ["mouse-deer", "031-mouse-deer", "Tragulus javanicus", "File:Tragulus napu.jpg"],
  ["binturong", "032-binturong", "Arctictis binturong", "File:Binturong in Overloon.jpg"],
  ["leopard-cat", "033-leopard-cat", "Prionailurus bengalensis", "File:Prionailurus bengalensis.jpg"],
  ["javan-leopard", "034-javan-leopard", "Panthera pardus melas", "File:Javan Leopard-Macan Tutul Jawa.jpg"],
  ["hornbill", "035-hornbill", "Buceros rhinoceros", "File:Buceros rhinoceros -Singapore Zoo-8a.jpg"],
  ["yellow-crested-cockatoo", "036-yellow-crested-cockatoo", "Cacatua sulphurea", "File:Cacatua sulphurea -Birdworld Farnham-8a.jpg"],
  ["eclectus-parrot", "037-eclectus-parrot", "Eclectus roratus", "File:Eclectus roratus -male-8a.jpg"],
  ["victoria-crowned-pigeon", "038-victoria-crowned-pigeon", "Goura victoria", "File:Goura victoria -Birdworld-8a.jpg"],
  ["helmeted-hornbill", "039-helmeted-hornbill", "Rhinoplax vigil", "File:Rhinoplax vigil.jpg"],
  ["flying-dragon", "040-flying-dragon", "Draco volans", "File:Draco volans.jpg"],
  ["tokay-gecko", "041-tokay-gecko", "Gekko gecko", "File:Gekko gecko.jpg"],
  ["water-monitor", "042-water-monitor", "Varanus salvator", "File:Varanus salvator -Singapore Zoo-8a.jpg"],
  ["reticulated-python", "043-reticulated-python", "Malayopython reticulatus", "File:Python reticulatus.jpg"],
  ["king-cobra", "044-king-cobra", "Ophiophagus hannah", "File:Ophiophagus hannah.jpg"],
  ["wallaces-flying-frog", "045-wallaces-flying-frog", "Rhacophorus nigropalmatus", "File:Rhacophorus nigropalmatus.jpg"],
  ["cuscus", "046-cuscus", "Spilocuscus maculatus", "File:Spilocuscus maculatus.jpg"],
  ["tree-kangaroo", "047-tree-kangaroo", "Dendrolagus goodfellowi", "File:Dendrolagus goodfellowi.jpg"],
  ["flying-fox", "048-flying-fox", "Pteropus vampyrus", "File:Pteropus vampyrus.jpg"],
  ["coconut-crab", "049-coconut-crab", "Birgus latro", "File:Birgus latro.jpg"],
  ["mudskipper", "050-mudskipper", "Periophthalmus", "File:Periophthalmus modestus.jpg"],
  ["archerfish", "051-archerfish", "Toxotes jaculatrix", "File:Toxotes jaculatrix.jpg"],
  ["arowana", "052-arowana", "Scleropages formosus", "File:Scleropages formosus.jpg"],
  ["blue-ringed-octopus", "053-blue-ringed-octopus", "Hapalochlaena", "File:Hapalochlaena lunulata.jpg"],
  ["giant-clam", "054-giant-clam", "Tridacna gigas", "File:Tridacna gigas.jpg"],
  ["spinner-dolphin", "055-spinner-dolphin", "Stenella longirostris", "File:Spinner dolphin.jpg"],
  ["javan-surili", "056-javan-surili", "Presbytis comata", "File:Presbytis comata.jpg"],
  ["bawean-deer", "057-bawean-deer", "Axis kuhlii", "File:Axis kuhlii.jpg"],
  ["timor-deer", "058-timor-deer", "Rusa timorensis", "File:Rusa timorensis.jpg"],
  ["banded-linsang", "059-banded-linsang", "Prionodon linsang", "File:Prionodon linsang.jpg"],
  ["sumatran-serow", "060-sumatran-serow", "Capricornis sumatraensis", "File:Sumatran Serow (Capricornis sumatraensis), December 2006.JPG"],
];

async function api(params) {
  const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  return res.json();
}

async function imageInfo(title) {
  const data = await api({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "1200",
  });
  const page = Object.values(data.query?.pages || {})[0];
  if (!page || page.missing != null || !page.imageinfo?.[0]) return null;
  const ii = page.imageinfo[0];
  if (!ii.mime?.startsWith("image/") || ii.mime === "image/svg+xml") return null;
  return {
    title: page.title,
    url: ii.thumburl || ii.url,
    mime: ii.mime,
    size: ii.size,
  };
}

async function searchFile(query) {
  const data = await api({
    action: "query",
    list: "search",
    srsearch: query,
    srnamespace: "6",
    srlimit: "12",
  });
  return (data.query?.search || []).map((s) => s.title);
}

function extFromMime(mime, url) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (url.includes(".png")) return ".png";
  return ".jpg";
}

async function resolveAnimal([slug, stem, query, preferred]) {
  const candidates = [];
  if (preferred) candidates.push(preferred);
  try {
    const found = await searchFile(query);
    for (const t of found) {
      if (!candidates.includes(t)) candidates.push(t);
    }
  } catch (e) {
    console.warn(`  search fail for ${slug}: ${e.message}`);
  }

  for (const title of candidates) {
    try {
      const info = await imageInfo(title);
      if (!info) continue;
      // Prefer photos over tiny icons
      if (info.size && info.size < 20_000) continue;
      const ext = extFromMime(info.mime, info.url);
      return {
        slug,
        local: `${stem}${ext}`,
        primary: info.url,
        sourceTitle: info.title,
      };
    } catch {
      /* try next */
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}

async function main() {
  const results = [];
  let fail = 0;

  for (const row of ANIMALS) {
    process.stdout.write(`${row[0]} … `);
    const hit = await resolveAnimal(row);
    if (hit) {
      console.log(`ok → ${hit.sourceTitle}`);
      results.push(hit);
    } else {
      console.log("FAIL");
      fail++;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  let out = `/** Auto-generated — run: node scripts/gen-animal-image-catalog.mjs */\n\n`;
  out += `export interface AnimalImageSource {\n  local: string;\n  primary: string;\n  fallback: string;\n}\n\n`;
  out += `export const ANIMAL_IMAGE_CATALOG: Record<string, AnimalImageSource> = {\n`;
  for (const r of results) {
    out += `  "${r.slug}": { local: "${r.local}", primary: "${r.primary}", fallback: "${r.primary}" },\n`;
  }
  out += "};\n";

  const dest = path.join(__dirname, "../src/data/animalImageCatalog.ts");
  fs.writeFileSync(dest, out);
  console.log(`\nWrote ${results.length} entries (${fail} failed) → ${dest}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
