#!/usr/bin/env node
/**
 * Converts all images in public/demo to JPG so previews work in all browsers.
 * Skips README and non-image files. Leaves originals in place; writes .jpg alongside.
 */
import { readdir, mkdir, writeFile } from "fs/promises";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEMO_ROOT = join(__dirname, "..", "public", "demo");

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".heic", ".webp"]);

async function* walk(dir, base = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      yield* walk(join(dir, e.name), rel);
    } else if (e.isFile() && IMAGE_EXT.has(extname(e.name).toLowerCase())) {
      yield { fullPath: join(dir, e.name), relPath: rel, name: e.name };
    }
  }
}

async function main() {
  let converted = 0;
  let skipped = 0;
  let failed = 0;
  for await (const { fullPath, relPath, name } of walk(DEMO_ROOT)) {
    const ext = extname(name).toLowerCase();
    const baseName = name.slice(0, -ext.length);
    const outRel = relPath.slice(0, -ext.length) + ".jpg";
    const outPath = join(DEMO_ROOT, outRel);
    if (ext === ".jpg" || ext === ".jpeg") {
      skipped++;
      continue;
    }
    try {
      await mkdir(dirname(outPath), { recursive: true });
      await sharp(fullPath)
        .jpeg({ quality: 90 })
        .toFile(outPath);
      console.log(`OK ${relPath} -> ${outRel}`);
      converted++;
    } catch (err) {
      console.warn(`SKIP ${relPath}: ${err.message}`);
      failed++;
    }
  }
  console.log(`Done: ${converted} converted, ${skipped} already jpg, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
