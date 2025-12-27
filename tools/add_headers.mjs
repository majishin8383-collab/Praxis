import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const JS_DIR = path.join(ROOT, "js");

// Banner to add to the top of each JS file
const BANNER = `/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */
`;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function alreadyHasBanner(text) {
  return text.startsWith("/*!\n * Praxis\n * © 2025 Joseph Satmary.");
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");

  // Skip non-js just in case
  if (!filePath.endsWith(".js")) return;

  // Avoid double-inserting if you run it again
  if (alreadyHasBanner(original)) return;

  // Preserve shebang if any (rare in front-end, but safe)
  if (original.startsWith("#!")) {
    const firstLineEnd = original.indexOf("\n");
    const shebang = original.slice(0, firstLineEnd + 1);
    const rest = original.slice(firstLineEnd + 1);
    fs.writeFileSync(filePath, shebang + "\n" + BANNER + "\n" + rest, "utf8");
    return;
  }

  fs.writeFileSync(filePath, BANNER + "\n" + original, "utf8");
}

function main() {
  if (!fs.existsSync(JS_DIR)) {
    console.error(`Could not find /js folder at: ${JS_DIR}`);
    process.exit(1);
  }

  const files = walk(JS_DIR).filter((p) => p.endsWith(".js"));
  for (const f of files) processFile(f);

  console.log(`Updated ${files.length} .js files under /js`);
  console.log("Done. Commit the changes to GitHub.");
}

main();
