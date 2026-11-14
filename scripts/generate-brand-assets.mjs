import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const directory = new URL("../frontend/public/logo/", import.meta.url);
const defs =
  '<defs><linearGradient id="blue" x2="1" y2="1"><stop stop-color="#2563EB"/><stop offset="1" stop-color="#101828"/></linearGradient></defs>';
// The TS monogram and orange arrow carry the Tech Solutions brand.
const symbol =
  '<rect x="10" y="10" width="180" height="180" rx="48" fill="url(#blue)"/><text x="96" y="134" text-anchor="middle" font-family="Arial, sans-serif" font-size="76" font-weight="700" fill="white">TS</text><path d="M144 56H170V30M170 30L137 63" fill="none" stroke="#F97316" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>';
function svg(body, box = "0 0 200 200") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" role="img" aria-labelledby="title"><title id="title">Tech Solutions</title>${defs}${body}</svg>\n`;
}
function full(dark = false) {
  const ink = dark ? "#f1f6ff" : "#101828";
  return svg(
    symbol +
      `<g font-family="Arial, sans-serif"><text x="224" y="108" font-size="57" font-weight="700" letter-spacing="-2" fill="${ink}">Tech Solutions</text><text x="227" y="150" font-size="25" letter-spacing="11" fill="${dark ? "#92baff" : "#2563EB"}">TECHNOLOGY</text></g>`,
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
const logoImage = new URL("../tech-solutions-logo.jpeg", directory);
async function faviconImage(size) {
  return sharp(fileURLToPath(logoImage))
    .extract({ left: 260, top: 150, width: 560, height: 450 })
    .resize(size, size, { fit: "contain", background: "#101828" })
    .png()
    .toBuffer();
}
for (const size of [32, 180, 192, 512])
  await fs.writeFile(
    fileURLToPath(new URL(`icon-${size}.png`, directory)),
    await faviconImage(size),
  );
const png = await faviconImage(32);
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
console.log("Generated Tech Solutions logos and icons.");
