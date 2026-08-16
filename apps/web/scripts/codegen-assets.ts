/**
 * Build-time only. Inlines the cropped brand assets as base64 constants so
 * they compile into dist/ like any other source — no runtime file IO and no
 * path resolution that breaks once built (the same approach as the climate
 * dataset).
 *
 * The PNGs are cropped straight out of timeaway-brand-kit.png; the logo is
 * never redrawn. Re-crop and re-run if the kit changes:
 *
 *   pnpm --filter @timeaway/web assets:codegen
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(here, "..", "src", "assets");

const files = readdirSync(assetsDir).filter((f) => f.endsWith(".png")).sort();

const hash = createHash("sha256");
for (const file of files) hash.update(readFileSync(join(assetsDir, file)));
const version = hash.digest("hex").slice(0, 8);

const entries = files
  .map((file) => {
    const name = file.replace(/\.png$/, "").toUpperCase();
    const base64 = readFileSync(join(assetsDir, file)).toString("base64");
    return `export const ${name}_PNG_BASE64 =\n  "${base64}";`;
  })
  .join("\n\n");

writeFileSync(
  join(assetsDir, "generated.ts"),
  `// GENERATED FILE — do not edit by hand.
// Regenerate with: pnpm --filter @timeaway/web assets:codegen
//
// Source: timeaway-brand-kit.png (cropped, never redrawn).

${entries}

/** Content hash — cache-busts /assets URLs when the artwork changes. */
export const ASSETS_VERSION = "${version}";
`,
);

console.log(`inlined ${files.length} assets: ${files.join(", ")}`);
