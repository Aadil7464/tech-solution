import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const directory = new URL("../frontend/public/logo/", import.meta.url);
const defs =
  '<defs><linearGradient id="blue" x2="1" y2="1"><stop stop-color="#2563EB"/><stop offset="1" stop-color="#101828"/></linearGradient></defs>';
// Connected D and M strokes suggest partnership; the cyan arrow signals growth.
const symbol =
  '<rect x="10" y="10" width="180" height="180" rx="48" fill="url(#blue)"/><path d="M44 139V61H63C101 61 111 139 63 139H44M108 139V83L133 110 158 83V139" fill="none" stroke="white" stroke-width="13" stroke-linejoin="round"/><path d="M132 60H163V29M163 29L127 65" fill="none" stroke="#06B6D4" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>';
function svg(body, box = "0 0 200 200") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" role="img" aria-labelledby="title"><title id="title">Digital Mitra Agency</title>${defs}${body}</svg>\n`;
}
function full(dark = false) {
  const ink = dark ? "#f1f6ff" : "#101828";
  return svg(
    symbol +
      `<g font-family="Arial, sans-serif"><text x="224" y="95" font-size="57" font-weight="700" letter-spacing="-2" fill="${ink}">Digital Mitra</text><text x="227" y="137" font-size="25" letter-spacing="11" fill="${dark ? "#92baff" : "#2563EB"}">AGENCY</text><text x="227" y="170" font-size="17" fill="${ink}">Your partner in digital growth</text></g>`,
    "0 0 680 200",
  );
}
await fs.mkdir(directory, { recursive: true });
const compact = svg(symbol);
const files = {
  "digital-mitra-agency.svg": full(),
  "digital-mitra-agency-dark.svg": full(true),
  "digital-mitra-monogram.svg": compact,
  "digital-mitra-circle.svg": compact,
  "horizontal.svg": full(),
  "monogram.svg": compact,
  "favicon.svg": compact,
  "tech-solution-agency.svg": full(),
  "tech-solution-agency-dark.svg": full(true),
  "tech-solution-monogram.svg": compact,
  "tech-solution-circle.svg": compact,
};
for (const [name, content] of Object.entries(files))
  await fs.writeFile(new URL(name, directory), content);
for (const size of [32, 180, 192, 512])
  await sharp(Buffer.from(compact))
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`icon-${size}.png`, directory)));
const png = await sharp(Buffer.from(compact)).resize(32, 32).png().toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico[6] = 32;
ico[7] = 32;
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
await fs.writeFile(
  new URL("../favicon.ico", directory),
  Buffer.concat([ico, png]),
);
console.log("Generated Digital Mitra Agency logos and icons.");
