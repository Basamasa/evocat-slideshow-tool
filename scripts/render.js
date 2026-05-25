#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Resvg } from "@resvg/resvg-js";
import * as fontkit from "fontkit";

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
const usesScreenTime = slides.some(parseScreenTimeSlide);
const cjkFont = usesCjk || usesScreenTime ? await readRequiredFont(CJK_FONT_PATH) : null;
const written = [];

for (let index = 0; index < slides.length; index += 1) {
  const filename = `evocat-slide-${String(index + 1).padStart(2, "0")}.png`;
  const output = path.join(outDir, filename);
  const svg = renderSvg({
    text: slides[index],
    brand,
    iconBase64,
    cjkFont,
    size,
  });
  await renderPng(svg, output);
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
console.log(`Renderer: ${usesCjk || usesScreenTime ? "resvg + vectorized text paths" : "resvg"}`);
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

async function readRequiredFont(filePath) {
  try {
    return fontkit.create(await fs.readFile(filePath));
  } catch (error) {
    throw new Error(
      `Chinese text detected, but the bundled CJK font could not be loaded at ${filePath}. Pull the latest repo, run npm install, and rerun.`
    );
  }
}

async function renderPng(svg, output) {
  const resvg = new Resvg(svg, {
    font: {
      loadSystemFonts: true,
    },
  });
  const pngData = resvg.render();
  await fs.writeFile(output, pngData.asPng());
}

function renderSvg({ text, brand, iconBase64, cjkFont, size }) {
  const screenTime = parseScreenTimeSlide(text);
  if (screenTime) return renderScreenTimeSvg({ spec: screenTime, font: cjkFont, size });

  const scale = size / 2048;
  const s = (value) => value * scale;
  const main = fitText(text, s(1240), s(650), s(134), s(66), 1.34);
  const dots = renderDots(size, scale);
  const fontFamily = displayFontFor(text);
  const mainText = hasCjk(text)
    ? renderTextPaths({
        lines: main.lines,
        font: cjkFont,
        fontSize: main.fontSize,
        lineHeight: main.lineHeight,
        x: s(344),
        y: s(570),
      })
    : renderTextElement({
        lines: main.lines,
        fontFamily,
        fontSize: main.fontSize,
        lineHeight: main.lineHeight,
        x: s(344),
        y: s(570),
      });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
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

  ${mainText}

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

function parseScreenTimeSlide(value) {
  const text = String(value || "").trim();
  const match = text.match(/^\[screen-time\]([\s\S]*?)(?:\[\/screen-time\])?$/i);
  if (!match) return null;

  const spec = {
    average: "10h 39m",
    change: "11%",
    direction: "up",
    total: "74h 38m",
    days: ["10h 5m", "12h 10m", "11h 20m", "7h 48m", "7h 42m", "8h 18m", "9h 4m"],
    categories: [
      { name: "Social", value: "62h 12m", color: "#168df4" },
      { name: "Entertainment", value: "5h 25m", color: "#55c8d9" },
      { name: "Shopping & Food", value: "2h 58m", color: "#f4a742" },
    ],
  };

  const colorByName = {
    social: "#168df4",
    entertainment: "#55c8d9",
    "shopping & food": "#f4a742",
    productivity: "#78d26d",
    games: "#b48cf6",
    other: "#6d6b74",
  };

  let readingCategories = false;
  const categories = [];
  for (const rawLine of match[1].split(/\n/g)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^categories\s*:/i.test(line)) {
      readingCategories = true;
      continue;
    }
    const pair = line.match(/^([^:]+):\s*(.+)$/);
    if (!pair) continue;
    const key = pair[1].trim();
    const val = pair[2].trim();
    if (readingCategories) {
      categories.push({
        name: key,
        value: val,
        color: colorByName[key.toLowerCase()] || colorByName.other,
      });
      continue;
    }
    if (/^average$/i.test(key)) spec.average = val;
    if (/^change$/i.test(key)) spec.change = val;
    if (/^direction$/i.test(key)) spec.direction = val.toLowerCase();
    if (/^total$/i.test(key)) spec.total = val;
    if (/^days$/i.test(key)) spec.days = val.split(/\s*,\s*/g).filter(Boolean);
  }

  if (categories.length) spec.categories = categories.slice(0, 3);
  return spec;
}

function renderScreenTimeSvg({ spec, font, size }) {
  const scale = size / 2048;
  const s = (value) => round(value * scale);
  const x = s(116);
  const y = s(78);
  const w = s(1816);
  const chart = renderScreenTimeChartSvg({
    spec,
    x,
    y: s(464),
    w: s(1576),
    h: s(628),
    font,
    scale,
  });
  const categories = renderScreenTimeCategoriesSvg({
    categories: spec.categories,
    x,
    y: s(1233),
    w,
    font,
    scale,
  });
  const trend = renderTrendBadgeSvg({
    spec,
    x: s(966),
    y: s(290),
    font,
    scale,
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="screenGlow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.035"/>
      <stop offset="48%" stop-color="#ffffff" stop-opacity="0.01"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.24"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="#17161a"/>
  <rect width="${size}" height="${size}" fill="url(#screenGlow)"/>

  ${renderSingleLineTextPath({ text: "Last Week's Average", font, fontSize: s(83), x, y: s(160), fill: "#aaa8b0" })}
  ${renderSingleLineTextPath({ text: spec.average, font, fontSize: s(176), x, y: s(370), fill: "#fbfbff" })}
  ${trend}
  ${chart}
  ${categories}
  <line x1="${x}" y1="${s(1488)}" x2="${s(1932)}" y2="${s(1488)}"
    stroke="#ffffff" stroke-opacity="0.13" stroke-width="${s(1.6)}"/>
  ${renderSingleLineTextPath({ text: "Total Screen Time", font, fontSize: s(72), x, y: s(1648), fill: "#f3f2f8" })}
  ${renderSingleLineTextPath({ text: spec.total, font, fontSize: s(72), x: s(1932), y: s(1648), fill: "#aaa8b0", anchor: "end" })}
</svg>`;
}

function renderTrendBadgeSvg({ spec, x, y, font, scale }) {
  const s = (value) => round(value * scale);
  const arrow =
    spec.direction === "down"
      ? `<path d="M ${x + s(43)} ${y - s(17)} L ${x + s(43)} ${y + s(17)} M ${x + s(22)} ${y} L ${x + s(43)} ${y + s(22)} L ${x + s(64)} ${y}" fill="none" stroke="#17161a" stroke-width="${s(9)}" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="M ${x + s(43)} ${y + s(17)} L ${x + s(43)} ${y - s(17)} M ${x + s(22)} ${y} L ${x + s(43)} ${y - s(22)} L ${x + s(64)} ${y}" fill="none" stroke="#17161a" stroke-width="${s(9)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<g>
    <circle cx="${x + s(43)}" cy="${y}" r="${s(38)}" fill="#a7a5ad"/>
    ${arrow}
    ${renderSingleLineTextPath({ text: `${spec.change} from last week`, font, fontSize: s(74), x: x + s(100), y: y + s(27), fill: "#aaa8b0" })}
  </g>`;
}

function renderScreenTimeChartSvg({ spec, x, y, w, h, font, scale }) {
  const s = (value) => round(value * scale);
  const chartRight = x + w;
  const chartBottom = y + h;
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  const dayValues = spec.days.map(parseDurationToHours);
  while (dayValues.length < 7) dayValues.push(dayValues[dayValues.length - 1] || 8);
  const maxHours = Math.max(14, ...dayValues, parseDurationToHours(spec.average) + 2);
  const avgHours = parseDurationToHours(spec.average);
  const slot = w / 7;
  const barW = Math.min(s(125), slot - s(66));
  const avgY = chartBottom - (avgHours / maxHours) * h;

  const horizontal = [];
  for (let i = 0; i <= 4; i += 1) {
    const gy = y + (h * i) / 4;
    horizontal.push(`<line x1="${x}" y1="${round(gy)}" x2="${chartRight}" y2="${round(gy)}"/>`);
  }

  const vertical = [];
  for (let i = 0; i <= 7; i += 1) {
    const gx = x + slot * i;
    vertical.push(`<line x1="${round(gx)}" y1="${y}" x2="${round(gx)}" y2="${chartBottom + s(114)}"/>`);
  }

  const bars = spec.days.slice(0, 7).map((day, index) => {
    const hours = parseDurationToHours(day);
    const barH = Math.max(s(74), (hours / maxHours) * h);
    const bx = x + slot * index + (slot - barW) / 2;
    const by = chartBottom - barH;
    return `${renderStackedBarSvg({
      x: round(bx),
      y: round(by),
      w: round(barW),
      h: round(barH),
      index,
      scale,
    })}
    ${renderSingleLineTextPath({ text: labels[index], font, fontSize: s(60), x: round(bx - s(12)), y: chartBottom + s(82), fill: "#74717a" })}`;
  });

  return `<g>
    <g stroke="#ffffff" stroke-opacity="0.18" stroke-width="${s(1.3)}">${horizontal.join("")}</g>
    <g stroke="#ffffff" stroke-opacity="0.18" stroke-width="${s(1.3)}" stroke-dasharray="${s(14)} ${s(13)}">${vertical.join("")}</g>
    <line x1="${x}" y1="${round(avgY)}" x2="${chartRight}" y2="${round(avgY)}"
      stroke="#6ade82" stroke-width="${s(6)}" stroke-dasharray="${s(14)} ${s(24)}"/>
    ${bars.join("")}
    ${renderSingleLineTextPath({ text: "14h", font, fontSize: s(64), x: chartRight + s(24), y: y + s(22), fill: "#74717a" })}
    ${renderSingleLineTextPath({ text: "7h", font, fontSize: s(64), x: chartRight + s(24), y: y + h * 0.52, fill: "#74717a" })}
    ${renderSingleLineTextPath({ text: "0", font, fontSize: s(64), x: chartRight + s(24), y: chartBottom + s(20), fill: "#74717a" })}
    ${renderSingleLineTextPath({ text: "avg", font, fontSize: s(64), x: chartRight + s(24), y: round(avgY + s(22)), fill: "#6ade82" })}
  </g>`;
}

function renderStackedBarSvg({ x, y, w, h, index, scale }) {
  const s = (value) => round(value * scale);
  const social = h * (0.75 + (index % 3) * 0.025);
  const entertainment = h * (0.17 - (index % 2) * 0.025);
  const shopping = h * 0.045;
  const other = Math.max(s(12), h - social - entertainment - shopping);
  const clipId = `barClip${index}`;
  let cy = y + h;
  const socialY = cy - social;
  cy -= social;
  const entertainmentY = cy - entertainment;
  cy -= entertainment;
  const shoppingY = cy - shopping;
  cy -= shopping;
  const otherY = y;
  return `<g>
    <clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${round(h)}" rx="${s(12)}"/></clipPath>
    <g clip-path="url(#${clipId})">
      <rect x="${x}" y="${round(socialY)}" width="${w}" height="${round(social)}" fill="#168df4"/>
      <rect x="${x}" y="${round(entertainmentY)}" width="${w}" height="${round(entertainment)}" fill="#55c8d9"/>
      <rect x="${x}" y="${round(shoppingY)}" width="${w}" height="${round(shopping)}" fill="#f4a742"/>
      <rect x="${x}" y="${round(otherY)}" width="${w}" height="${round(other)}" fill="#434248"/>
    </g>
  </g>`;
}

function renderScreenTimeCategoriesSvg({ categories, x, y, w, font, scale }) {
  const s = (value) => round(value * scale);
  const col = w / 3;
  return categories
    .slice(0, 3)
    .map((category, index) => {
      const cx = x + col * index;
      return `<g>
        ${renderSingleLineTextPath({ text: category.name, font, fontSize: s(62), x: round(cx), y, fill: category.color })}
        ${renderSingleLineTextPath({ text: category.value, font, fontSize: s(72), x: round(cx), y: y + s(112), fill: "#fbfbff" })}
      </g>`;
    })
    .join("");
}

function renderSingleLineTextPath({ text, font, fontSize, x, y, fill, anchor = "start" }) {
  if (!font) throw new Error("Screen Time text requires the bundled font to be loaded.");

  const fontScale = fontSize / font.unitsPerEm;
  const run = font.layout(String(text));
  const width = run.positions.reduce((sum, position) => sum + position.xAdvance, 0) * fontScale;
  const startX = anchor === "end" ? x - width : x;
  const paths = [];
  let cursor = 0;

  for (let i = 0; i < run.glyphs.length; i += 1) {
    const glyph = run.glyphs[i];
    const position = run.positions[i];
    const glyphPath = glyph.path?.toSVG();
    if (glyphPath) {
      paths.push(
        `<path d="${glyphPath}" transform="translate(${round(cursor + position.xOffset)} ${round(position.yOffset)})"/>`
      );
    }
    cursor += position.xAdvance;
  }

  return `<g fill="${fill}" transform="translate(${round(startX)} ${round(y)}) scale(${round(fontScale)} ${round(-fontScale)})">${paths.join("")}</g>`;
}

function renderTextElement({ lines, fontFamily, fontSize, lineHeight, x, y }) {
  return `<text x="${x}" y="${y}" fill="#fffdf7"
    font-family="${fontFamily}" font-weight="900"
    font-size="${fontSize}" dominant-baseline="text-before-edge">
    ${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join("")}
  </text>`;
}

function renderTextPaths({ lines, font, fontSize, lineHeight, x, y }) {
  if (!font) throw new Error("Chinese text detected, but the CJK font was not loaded.");

  const fontScale = fontSize / font.unitsPerEm;
  const renderedLines = lines.map((line, index) => {
    const run = font.layout(line);
    const glyphs = [];
    let cursor = 0;
    let lineMaxY = 0;

    for (let i = 0; i < run.glyphs.length; i += 1) {
      const glyph = run.glyphs[i];
      const position = run.positions[i];
      const glyphPath = glyph.path;
      if (glyphPath?.bbox) lineMaxY = Math.max(lineMaxY, glyphPath.bbox.maxY + position.yOffset);
      glyphs.push({
        path: glyphPath?.toSVG() || "",
        x: cursor + position.xOffset,
        y: position.yOffset,
      });
      cursor += position.xAdvance;
    }

    const baseline = y + index * lineHeight + lineMaxY * fontScale;
    const paths = glyphs
      .filter((glyph) => glyph.path)
      .map(
        (glyph) =>
          `<path d="${glyph.path}" transform="translate(${round(glyph.x)} ${round(glyph.y)})"/>`
      )
      .join("");

    return `<g transform="translate(${round(x)} ${round(baseline)}) scale(${round(fontScale)} ${round(-fontScale)})">${paths}</g>`;
  });

  return `<g fill="#fffdf7">${renderedLines.join("")}</g>`;
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

function parseDurationToHours(value) {
  const text = String(value || "");
  const hours = Number(text.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] || 0);
  const minutes = Number(text.match(/(\d+(?:\.\d+)?)\s*m/i)?.[1] || 0);
  return hours + minutes / 60;
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

function round(value) {
  return Number(value.toFixed(4));
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
