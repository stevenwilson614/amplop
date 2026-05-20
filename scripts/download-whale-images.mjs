#!/usr/bin/env node
/**
 * Download whale photos into public/whales/ using URLs from whaleImageCatalog.
 * Usage: node scripts/download-whale-images.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/whales");

// Import catalog (dynamic read as text to avoid TS)
const catalogPath = path.join(__dirname, "../src/data/whaleImageCatalog.ts");
const catalogSrc = fs.readFileSync(catalogPath, "utf8");
const entries = [...catalogSrc.matchAll(/"([^"]+)":\s*\{\s*local:\s*"([^"]+)",\s*primary:\s*"([^"]+)"/g)];

const UA = "AmplopWhaleBot/1.0";

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  let ok = 0;
  let fail = 0;

  for (const [, slug, local, primary] of entries) {
    const dest = path.join(outDir, local);
    try {
      process.stdout.write(`${slug} → ${local} … `);
      await download(primary, dest);
      console.log(`ok (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
      ok++;
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      fail++;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n${ok} saved, ${fail} failed. Update BUNDLED_LOCAL in whaleImageResolve.ts if bundling all.`);
}

main();
