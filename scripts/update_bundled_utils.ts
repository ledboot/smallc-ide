import fs from "fs";
import path from "path";

const UTILS_DIR = path.join(process.cwd(), "src/utils");
const FILES = [
  "base58.ts",
  "packer.ts",
  "reader.ts",
  "defs.ts",
  "index.ts",
  "msgTools.ts",
];

const EXTERNAL_IMPORTS = new Set<string>();
let content = "";

EXTERNAL_IMPORTS.add(
  `import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';`
);
EXTERNAL_IMPORTS.add(`import bigInt from 'big-integer';`);

FILES.forEach((file) => {
  const filePath = path.join(UTILS_DIR, file);
  let fileContent = fs.readFileSync(filePath, "utf-8");

  // Remove imports
  fileContent = fileContent.replace(/^import .* from ['"]\..*['"];?\s*$/gm, "");
  fileContent = fileContent.replace(
    /^import .* from ['"]@noble.*['"];?\s*$/gm,
    ""
  );
  fileContent = fileContent.replace(
    /^import .* from ['"]big-integer['"];?\s*$/gm,
    ""
  );

  // Remove export default if any, to avoid conflicts/syntax issues in a single file
  // Ideally we keep named exports
  // base58.ts has `export default base58;`. We can comment it out.
  fileContent = fileContent.replace(/^export default .*;$/gm, "// $&");

  content += `\n// --- ${file} ---\n${fileContent}\n`;
});

const finalContent = `/**
 * AUTO-GENERATED FILE.
 * Contains bundled source code of utils.
 */

export const BUNDLED_UTILS_CODE = \`
${Array.from(EXTERNAL_IMPORTS).join("\n")}

${content.replace(/`/g, "\\`").replace(/\$/g, "\\$")}
\`;
`;

fs.writeFileSync(path.join(UTILS_DIR, "bundledUtils.ts"), finalContent);
console.log("bundledUtils.ts updated successfully.");
