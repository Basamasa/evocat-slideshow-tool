#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DEFAULT_ICON = path.join(ROOT, "assets", "ironcat-app-icon.png");
const CJK_FONT_PATH = path.join(
  ROOT,
  "assets",
  "fonts",
  "noto-serif-sc-chinese-simplified-900-normal.woff2"
);

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.input) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const size = Number(args.size || 2048);
const brand = String(args.brand || "Evocat");
const topic = String(args.topic || path.basename(args.input, path.extname(args.input)));
const outDir = path.resolve(args.out || path.join("daily_posts", `${today()}-${slugify(topic)}`, "images"));
const zipPath = args.zip ? path.resolve(args.zip) : "";
const slides = await readSlides(args.input);

if (!slides.length) {
  throw new Error(`No slides found in ${args.input}`);
}

await fs.mkdir(outDir, { recursive: true });

const iconData = await fs.readFile(path.resolve(args.icon || DEFAULT_ICON));
const iconBase64 = iconData.toString("base64");
const usesCjk = slides.some(hasCjk);
const cjkFontBase64 = usesCjk ? await readRequiredBase64(CJK_FONT_PATH) : "";
const written = [];

for (let index = 0; index < slides.length; index += 1) {
  const filename = `evocat-slide-${String(index + 1).padStart(2, "0")}.png`;
  const output = path.join(outDir, filename);
  const svg = renderSvg({
    text: slides[index],
    brand,
    iconBase64,
    cjkFontBase64,
    size,
  });
  await sharp(Buffer.from(svg)).png().toFile(output);
  written.push(output);
}

if (zipPath) {
  const entries = [];
  for (const file of written) {
    entries.push({
      filename: path.basename(file),
      data: new Uint8Array(await fs.readFile(file)),
    });
  }
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  const zipBlob = await makeZip(entries);
  await fs.writeFile(zipPath, Buffer.from(await zipBlob.arrayBuffer()));
}

console.log(`Rendered ${written.length} slides`);
console.log(`Images: ${outDir}`);
if (zipPath) console.log(`ZIP: ${zipPath}`);

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      parsed[key] = argv[i + 1];
      i += 1;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage:
  npm run render -- --input examples/slides.json --out daily_posts/2026-05-18-screen-time/images

Options:
  --input   Path to .txt or .json slide text. Required.
  --out     Output directory for PNG images.
  --zip     Optional image-only ZIP path.
  --topic   Topic used for default output path.
  --brand   Footer brand. Default: Evocat.
  --size    PNG size. Default: 2048.
  --icon    Optional mascot PNG path.`);
}

async function readSlides(inputPath) {
  const absolute = path.resolve(inputPath);
  const raw = await fs.readFile(absolute, "utf8");
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (absolute.endsWith(".json")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("JSON input must be an array of slide strings");
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  }

  return trimmed
    .split(/\n\s*\n/g)
    .map((item) => item.trim().replace(/^(slide\s*)?\d+[\).:-]\s*/i, ""))
    .filter(Boolean);
}

async function readRequiredBase64(filePath) {
  try {
    return (await fs.readFile(filePath)).toString("base64");
  } catch (error) {
    throw new Error(
      `Chinese text detected, but the bundled CJK font is missing at ${filePath}. Pull the latest repo and rerun.`
    );
  }
}

function renderSvg({ text, brand, iconBase64, cjkFontBase64, size }) {
  const scale = size / 2048;
  const s = (value) => value * scale;
  const main = fitText(text, s(1240), s(650), s(134), s(66), 1.34);
  const dots = renderDots(size, scale);
  const fontFamily = displayFontFor(text);
  const fontFace = cjkFontBase64
    ? `@font-face{font-family:'Noto Serif SC';font-style:normal;font-weight:900;src:url(data:font/woff2;base64,${cjkFontBase64}) format('woff2');}`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <style>${fontFace}</style>
    <radialGradient id="bgGlow" cx="35%" cy="53%" r="48%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.045"/>
      <stop offset="36%" stop-color="#ffffff" stop-opacity="0.018"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <filter id="cardGlow" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="0" stdDeviation="${s(13)}" flood-color="#ffffff" flood-opacity="0.64"/>
    </filter>
    <filter id="iconGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="${s(22)}" flood-color="#37457d" flood-opacity="0.55"/>
    </filter>
  </defs>

  <rect width="${size}" height="${size}" fill="#171716"/>
  <rect width="${size}" height="${size}" fill="url(#bgGlow)"/>
  <g opacity="0.17">${dots}</g>

  <rect x="${s(210)}" y="${s(318)}" width="${s(1628)}" height="${s(1438)}" rx="${s(150)}"
    fill="#000000" stroke="#ffffff" stroke-opacity="0.82" stroke-width="${s(2.2)}" filter="url(#cardGlow)"/>
  <rect x="${s(210)}" y="${s(318)}" width="${s(1628)}" height="${s(1438)}" rx="${s(150)}"
    fill="none" stroke="#ffffff" stroke-opacity="0.92" stroke-width="${s(1.2)}"/>

  <text x="${s(344)}" y="${s(570)}" fill="#fffdf7"
    font-family="${fontFamily}" font-weight="900"
    font-size="${main.fontSize}" dominant-baseline="text-before-edge">
    ${main.lines.map((line, index) => `<tspan x="${s(344)}" dy="${index === 0 ? 0 : main.lineHeight}">${escapeXml(line)}</tspan>`).join("")}
  </text>

  <text x="${s(344)}" y="${s(1368)}" fill="#fffdf7"
    font-family="Georgia, 'Times New Roman', serif" font-weight="900"
    font-size="${s(42)}" dominant-baseline="text-before-edge">Focus Advice by</text>
  <text x="${s(344)}" y="${s(1440)}" fill="#fffdf7"
    font-family="Georgia, 'Times New Roman', serif" font-weight="900"
    font-size="${s(58)}" dominant-baseline="text-before-edge">${escapeXml(brand)}</text>

  <image x="${s(1185)}" y="${s(1216)}" width="${s(470)}" height="${s(470)}"
    opacity="0.9" filter="url(#iconGlow)" href="data:image/png;base64,${iconBase64}"/>
</svg>`;
}

function fitText(text, maxWidth, maxHeight, startSize, minSize, lineHeightRatio) {
  for (let fontSize = startSize; fontSize >= minSize; fontSize -= 4) {
    const lines = wrapText(text, maxWidth, fontSize);
    const lineHeight = fontSize * lineHeightRatio;
    if (lines.length * lineHeight <= maxHeight) return { fontSize, lineHeight, lines };
  }
  const lines = wrapText(text, maxWidth, minSize);
  return { fontSize: minSize, lineHeight: minSize * lineHeightRatio, lines };
}

function wrapText(text, maxWidth, fontSize) {
  const paragraphs = text.split(/\n+/g).map((line) => line.trim()).filter(Boolean);
  const lines = [];
  for (const paragraph of paragraphs) {
    let current = "";
    for (const word of tokenizeForWrap(paragraph)) {
      const next = joinWrapToken(current, word);
      if (estimateWidth(next, fontSize) <= maxWidth || !current) {
        current = next;
      } else if (isClosingPunctuation(word)) {
        current = next;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function tokenizeForWrap(text) {
  if (!hasCjk(text)) return text.split(/\s+/g);
  return text.match(/[\u3400-\u9fff\uf900-\ufaff]|[A-Za-z0-9]+(?:[.'-][A-Za-z0-9]+)*|\s+|./g) || [];
}

function joinWrapToken(current, token) {
  if (!current) return token;
  if (!hasCjk(current + token)) return `${current} ${token}`;
  if (/^\s+$/.test(token)) return `${current} `;
  return `${current}${token}`;
}

function estimateWidth(text, fontSize) {
  if (hasCjk(text)) return estimateCjkWidth(text, fontSize);
  let units = 0;
  for (const char of text) {
    if (char === " ") units += 0.36;
    else if ("il.,'!:;|".includes(char)) units += 0.32;
    else if ("“”\"".includes(char)) units += 0.42;
    else if ("mwMW".includes(char)) units += 1.02;
    else if (/[A-Z0-9]/.test(char)) units += 0.78;
    else units += 0.68;
  }
  return units * fontSize * 1.08;
}

function estimateCjkWidth(text, fontSize) {
  let units = 0;
  for (const char of text) {
    if (char === " ") units += 0.35;
    else if (/[\u3400-\u9fff\uf900-\ufaff]/.test(char)) units += 1;
    else if (/[A-Z0-9]/.test(char)) units += 0.72;
    else units += 0.62;
  }
  return units * fontSize * 1.04;
}

function hasCjk(text) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(text);
}

function isClosingPunctuation(token) {
  return /^[。！？；：，、）】》」』”’.,!?;:%)]$/.test(token);
}

function displayFontFor(text) {
  return hasCjk(text)
    ? "'Noto Serif SC', 'Songti SC', 'STSong', 'SimSun', serif"
    : "Georgia, 'Times New Roman', serif";
}

function renderDots(size, scale) {
  const dots = [];
  for (let y = 0; y < size; y += 11 * scale) {
    for (let x = (y / scale) % 22 === 0 ? 0 : 5 * scale; x < size; x += 17 * scale) {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      if (n - Math.floor(n) > 0.86) {
        dots.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${scale.toFixed(2)}" height="${scale.toFixed(2)}" fill="#fff"/>`);
      }
    }
  }
  return dots.join("");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function slugify(value) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return slug || "evocat-slides";
}

async function makeZip(entries) {
  const encoder = new TextEncoder();
  const files = [];
  const centralDirectory = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.filename);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, entry.data.length, true);
    view.setUint32(22, entry.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    files.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralDirectory.push(central);
    offset += local.length;
  }

  const centralSize = centralDirectory.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...files, ...centralDirectory, end], { type: "application/zip" });
}

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
