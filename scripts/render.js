#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Resvg } from "@resvg/resvg-js";
import * as fontkit from "fontkit";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DEFAULT_ICON = path.join(ROOT, "assets", "ironcat-app-icon.png");
const DEFAULT_V2_CAT = path.join(ROOT, "assets", "ironcat_transparent_bg.png");
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
const inputDir = path.dirname(path.resolve(args.input));
const slides = await readSlides(args.input);

if (!slides.length) {
  throw new Error(`No slides found in ${args.input}`);
}

await fs.mkdir(outDir, { recursive: true });

const iconData = await fs.readFile(path.resolve(args.icon || DEFAULT_ICON));
const iconBase64 = iconData.toString("base64");
const v2CatData = await fs.readFile(path.resolve(args.v2Cat || DEFAULT_V2_CAT));
const v2CatBase64 = v2CatData.toString("base64");
const usesCjk = slides.some(hasCjk);
const usesScreenTime = slides.some(parseScreenTimeSlide);
const cjkFont = usesCjk || usesScreenTime ? await readRequiredFont(CJK_FONT_PATH) : null;
const written = [];

for (let index = 0; index < slides.length; index += 1) {
  const filename = `evocat-slide-${String(index + 1).padStart(2, "0")}.png`;
  const output = path.join(outDir, filename);
  const slideAssets = await loadSlideAssets(slides[index], inputDir);
  const svg = renderSvg({
    text: slides[index],
    brand,
    iconBase64,
    v2CatBase64,
    v2ImageDataUrl: slideAssets.v2ImageDataUrl,
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
  --icon    Optional mascot PNG path.
  --v2Cat   Optional Evocat v2 cat PNG path.`);
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

async function loadSlideAssets(slide, baseDir) {
  const evocatV2 = parseEvocatV2Slide(slide);
  if (!evocatV2?.image) return {};
  if (/^data:image\//i.test(evocatV2.image)) {
    return { v2ImageDataUrl: evocatV2.image };
  }

  const imagePath = resolveSlideAssetPath(evocatV2.image, baseDir);
  const data = await fs.readFile(imagePath);
  return {
    v2ImageDataUrl: `data:${mimeTypeFor(imagePath)};base64,${data.toString("base64")}`,
  };
}

function resolveSlideAssetPath(value, baseDir) {
  const raw = String(value || "").trim();
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(baseDir, raw);
}

function mimeTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
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

function renderSvg({
  text,
  brand,
  iconBase64,
  v2CatBase64,
  v2ImageDataUrl,
  cjkFont,
  size,
}) {
  const evocatV2 = parseEvocatV2Slide(text);
  if (evocatV2) {
    return renderEvocatV2Svg({
      spec: evocatV2,
      v2CatBase64,
      v2ImageDataUrl,
      size,
    });
  }

  const screenTime = parseScreenTimeSlide(text);
  if (screenTime) return renderScreenTimeSvg({ spec: screenTime, font: cjkFont, size });

  return renderEvocatV2Svg({
    spec: parsePlainTextV2Slide(text),
    v2CatBase64,
    v2ImageDataUrl: "",
    size,
  });
}

function parsePlainTextV2Slide(value) {
  const lines = splitV2TextLines(value);
  return {
    mode: "text",
    headline: lines[0] || "",
    highlight: "LIFE.",
    average: "8h 58m",
    change: "13%",
    direction: "up",
    total: "62h 46m",
    days: ["8h 11m", "9h 26m", "8h 41m", "8h 54m", "9h 50m", "8h 47m", "8h 19m"],
    appleApp: "Instagram",
    evocatApp: "Discord",
    evocatName: "Larry",
    body: lines.slice(1).join("|"),
    image: "",
    imageFit: "cover",
  };
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

function parseEvocatV2Slide(value) {
  const text = String(value || "").trim();
  const match = text.match(/^\[evocat-v2\]([\s\S]*?)(?:\[\/evocat-v2\])?$/i);
  if (!match) return null;

  const spec = {
    mode: "screen-time",
    headline: "",
    highlight: "LIFE.",
    average: "8h 58m",
    change: "13%",
    direction: "up",
    total: "62h 46m",
    days: ["8h 11m", "9h 26m", "8h 41m", "8h 54m", "9h 50m", "8h 47m", "8h 19m"],
    appleApp: "Instagram",
    evocatApp: "Discord",
    evocatName: "Larry",
    body: "",
    image: "",
    imageFit: "cover",
  };

  for (const rawLine of match[1].split(/\n/g)) {
    const line = rawLine.trim();
    if (!line) continue;
    const pair = line.match(/^([^:]+):\s*(.+)$/);
    if (!pair) continue;
    const key = pair[1].trim().toLowerCase().replace(/[ _]/g, "-");
    const val = pair[2].trim();
    if (key === "mode" || key === "type") spec.mode = val.toLowerCase();
    if (key === "headline" || key === "title" || key === "hook") spec.headline = val;
    if (key === "body" || key === "subtitle" || key === "subhead") spec.body = val;
    if (key === "image" || key === "photo" || key === "picture") spec.image = val;
    if (key === "image-fit" || key === "fit") spec.imageFit = val.toLowerCase();
    if (key === "highlight") spec.highlight = val;
    if (key === "average") spec.average = val;
    if (key === "change") spec.change = val;
    if (key === "direction") spec.direction = val.toLowerCase();
    if (key === "total") spec.total = val;
    if (key === "days") spec.days = val.split(/\s*,\s*/g).filter(Boolean);
    if (key === "apple-app" || key === "appleapp") spec.appleApp = val;
    if (key === "evocat-app" || key === "evocatapp") spec.evocatApp = val;
    if (key === "evocat-name" || key === "evocatname") spec.evocatName = val;
  }

  return spec;
}

function renderEvocatV2Svg({
  spec,
  v2CatBase64,
  v2ImageDataUrl,
  size,
}) {
  const scale = size / 2048;
  const s = (value) => round(value * scale);
  const scene = /compare|limit/i.test(spec.mode)
    ? renderV2ComparisonSceneSvg({ spec, v2CatBase64, scale })
    : /screen/i.test(spec.mode)
      ? renderV2ScreenTimeSceneSvg({ spec, scale })
      : renderV2TextSceneSvg({ spec, v2ImageDataUrl, scale });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <filter id="v2BubbleGlow" x="-9%" y="-9%" width="118%" height="126%">
      <feDropShadow dx="0" dy="0" stdDeviation="${s(16)}" flood-color="#ffffff" flood-opacity="0.94"/>
    </filter>
    <filter id="v2SoftGlow" x="-18%" y="-18%" width="136%" height="136%">
      <feDropShadow dx="0" dy="0" stdDeviation="${s(18)}" flood-color="#ffffff" flood-opacity="0.48"/>
    </filter>
    <filter id="v2CatGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="0" stdDeviation="${s(18)}" flood-color="#cddcff" flood-opacity="0.72"/>
    </filter>
    <style>
      .v2-sans { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif; }
      .v2-serif { font-family: Georgia, "Times New Roman", serif; }
      .v2-headline { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif; font-weight: 800; }
      .v2-hand { font-family: "Chalkboard SE", "Marker Felt", "Noteworthy", "Comic Sans MS", cursive; font-weight: 400; }
    </style>
  </defs>
  <rect width="${size}" height="${size}" fill="#000000"/>
  <image x="${s(704)}" y="${s(1360)}" width="${s(640)}" height="${s(640)}" preserveAspectRatio="xMidYMid meet"
    href="data:image/png;base64,${v2CatBase64}"/>
  ${scene}
</svg>`;
}

function renderV2ScreenTimeSceneSvg({ spec, scale }) {
  const s = (value) => round(value * scale);
  const hasHeadline = splitV2TextLines(spec.headline).length > 0;
  const content = hasHeadline
    ? `${renderV2StoryTextSvg({
        spec: { ...spec, body: "" },
        x: s(220),
        y: s(246),
        maxWidth: s(1628),
        maxHeight: s(210),
        scale,
        options: {
          headlineMax: 148,
          headlineMin: 108,
          lineRatio: 1.06,
        },
      })}
  ${renderV2ScreenTimeDashboardSvg({ spec, x: s(316), y: s(600), w: s(1416), h: s(672), scale })}`
    : renderV2ScreenTimeDashboardSvg({ spec, x: s(316), y: s(294), w: s(1416), h: s(788), scale });
  return `${renderV2BubbleSvg({ x: s(126), y: s(138), w: s(1796), h: s(1188), r: s(170), scale })}
  ${content}`;
}

function renderV2ComparisonSceneSvg({ spec, v2CatBase64, scale }) {
  const s = (value) => round(value * scale);
  const headline = spec.headline || "Apple gives you an exit.|EvoCat gives you friction.";
  const highlight = spec.highlight || "EvoCat";
  return `${renderV2BubbleSvg({ x: s(258), y: s(74), w: s(1532), h: s(1300), r: s(130), scale })}
  ${renderV2HeadlineSvg({ spec: { headline, highlight }, x: s(316), y: s(132), fontSize: s(76), lineHeight: s(92), maxWidth: s(1420) })}
  ${renderV2PhoneSvg({ x: s(386), y: s(448), w: s(514), h: s(842), kind: "apple", app: spec.appleApp, name: spec.evocatName, v2CatBase64, scale })}
  ${renderV2PhoneSvg({ x: s(1148), y: s(448), w: s(514), h: s(842), kind: "evocat", app: spec.evocatApp, name: spec.evocatName, v2CatBase64, scale })}`;
}

function renderV2TextSceneSvg({ spec, v2ImageDataUrl, scale }) {
  if (spec.image && v2ImageDataUrl) {
    return renderV2ImageTextSceneSvg({ spec, imageDataUrl: v2ImageDataUrl, scale });
  }

  const s = (value) => round(value * scale);
  return `${renderV2BubbleSvg({ x: s(132), y: s(96), w: s(1784), h: s(1268), r: s(166), scale })}
  ${renderV2StoryTextSvg({
    spec,
    x: s(270),
    y: s(248),
    maxWidth: s(1510),
    maxHeight: s(680),
    scale,
    options: {
      headlineMax: 148,
      headlineMin: 96,
      bodyMax: 86,
      bodyMin: 64,
      lineRatio: 1.1,
      bodyRatio: 1.16,
      gap: 68,
    },
  })}`;
}

function renderV2ImageTextSceneSvg({ spec, imageDataUrl, scale }) {
  const s = (value) => round(value * scale);
  const imageLayout = getV2ImageTextLayout(spec);
  return `${renderV2BubbleSvg({ x: s(132), y: s(96), w: s(1784), h: s(1268), r: s(166), scale })}
  ${renderV2StoryTextSvg({
    spec,
    x: s(270),
    y: s(194),
    maxWidth: s(1510),
        maxHeight: s(430),
    scale,
    options: {
      headlineMax: 132,
      headlineMin: 76,
      bodyMax: 76,
      bodyMin: 54,
      lineRatio: 1.1,
      bodyRatio: 1.16,
      gap: 54,
    },
  })}
  ${renderV2JobImageSvg({ imageDataUrl, x: s(imageLayout.x), y: s(imageLayout.y), w: s(imageLayout.w), h: s(imageLayout.h), fit: spec.imageFit, scale })}`;
}

function getV2ImageTextLayout(spec) {
  const headlineLines = Math.max(1, splitV2Headline(spec.headline).length);
  const bodyLines = splitV2TextLines(spec.body).length;
  let y = 540;
  if (bodyLines && headlineLines > 1) y = 624;
  else if (bodyLines) y = 548;
  else if (headlineLines <= 1) y = 520;
  return { x: 172, y, w: 1704, h: 1330 - y };
}

function renderV2JobImageSvg({ imageDataUrl, x, y, w, h, fit, scale }) {
  const s = (value) => round(value * scale);
  const aspect = String(fit || "").toLowerCase() === "contain" ? "xMidYMid meet" : "xMidYMid slice";
  return `<defs>
    <clipPath id="v2JobImageClip">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${s(48)}"/>
    </clipPath>
  </defs>
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${s(48)}" fill="#111116"/>
    <image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${aspect}"
      clip-path="url(#v2JobImageClip)" href="${imageDataUrl}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${s(48)}" fill="#000000" fill-opacity="0.18"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${s(48)}" fill="none"
      stroke="#ffffff" stroke-opacity="0.22" stroke-width="${s(2.2)}"/>
  </g>`;
}

function renderV2BubbleSvg({ x, y, w, h, r, scale }) {
  const s = (value) => round(value * scale);
  const d = [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + w * 0.64} ${y + h}`,
    `C ${x + w * 0.63} ${y + h + s(92)} ${x + w * 0.55} ${y + h + s(158)} ${x + w * 0.49} ${y + h + s(172)}`,
    `C ${x + w * 0.54} ${y + h + s(92)} ${x + w * 0.53} ${y + h + s(24)} ${x + w * 0.46} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");

  return `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity="0.82"
    stroke-width="${s(16)}" filter="url(#v2BubbleGlow)"/>
  <path d="${d}" fill="#050508" fill-opacity="0.96" stroke="#ffffff" stroke-opacity="0.98"
    stroke-width="${s(10.5)}"/>
  <path d="${d}" fill="none" stroke="#dce4ff" stroke-opacity="0.66" stroke-width="${s(2.2)}"/>`;
}

function renderV2ScreenTimeDashboardSvg({ spec, x, y, w, h, scale }) {
  const s = (value) => round(value * scale);
  const footerY = y + h - s(100);
  const chartY = y + s(252);
  const chartH = Math.min(s(410), Math.max(s(220), footerY - chartY - s(42)));
  return `<g>
    <text class="v2-serif" x="${x}" y="${y + s(58)}" font-size="${s(54)}" font-weight="700" fill="#a9a9b2">Last Week&apos;s Average</text>
    <text class="v2-serif" x="${x}" y="${y + s(170)}" font-size="${s(116)}" font-weight="900" fill="#ffffff">${escapeXml(spec.average)}</text>
    ${renderV2TrendBadgeSmallSvg({ spec, x: x + s(800), y: y + s(137), scale })}
    ${renderV2MiniChartSvg({ spec, x, y: chartY, w: w - s(122), h: chartH, scale })}
    <line x1="${x}" y1="${footerY}" x2="${x + w}" y2="${footerY}"
      stroke="#ffffff" stroke-opacity="0.12" stroke-width="${s(1.4)}"/>
    <text class="v2-serif" x="${x}" y="${y + h - s(38)}" font-size="${s(54)}" font-weight="800" fill="#ffffff">Total Screen Time</text>
    <text class="v2-serif" x="${x + w}" y="${y + h - s(38)}" text-anchor="end" font-size="${s(54)}" font-weight="800" fill="#c2c0c8">${escapeXml(spec.total)}</text>
  </g>`;
}

function renderV2StoryTextSvg({ spec, x, y, maxWidth, maxHeight, scale, options = {} }) {
  const layout = fitV2StoryTextSvg({ spec, maxWidth, maxHeight, scale, options });
  const headline = layout.headlineLines
    .map(
      (line, index) =>
        `<text class="v2-hand" x="${x}" y="${round(y + index * layout.headlineLineHeight)}" dominant-baseline="text-before-edge" font-size="${round(layout.headlineSize)}" fill="#ffffff">${escapeXml(line)}</text>`
    )
    .join("");
  const bodyY = y + layout.headlineLines.length * layout.headlineLineHeight + layout.gap;
  const body = layout.bodyLines
    .map(
      (line, index) =>
        `<text class="v2-hand" x="${x}" y="${round(bodyY + index * layout.bodyLineHeight)}" dominant-baseline="text-before-edge" font-size="${round(layout.bodySize)}" fill="#ffffff">${escapeXml(line)}</text>`
    )
    .join("");
  return `<g filter="url(#v2SoftGlow)">${headline}</g><g>${body}</g>`;
}

function fitV2StoryTextSvg({ spec, maxWidth, maxHeight, scale, options = {} }) {
  const s = (value) => round(value * scale);
  const headlineSource = splitV2TextLines(spec.headline);
  const bodySource = splitV2TextLines(spec.body);
  let headlineSize = s(options.headlineMax || 112);
  const headlineMin = s(options.headlineMin || 68);
  const bodyBaseRatio = (options.bodyMax || 68) / (options.headlineMax || 112);
  const bodyMin = s(options.bodyMin || 46);
  const lineRatio = options.lineRatio || 1.2;
  const bodyRatio = options.bodyRatio || 1.24;
  const gapBase = s(options.gap || 62);

  while (headlineSize >= headlineMin) {
    const bodySize = Math.max(bodyMin, headlineSize * bodyBaseRatio);
    const headlineLines = headlineSource.flatMap((line) => wrapSvgWords(line, maxWidth, headlineSize)).slice(0, 5);
    const bodyLines = bodySource.flatMap((line) => wrapSvgWords(line, maxWidth, bodySize)).slice(0, 5);
    const headlineLineHeight = headlineSize * lineRatio;
    const bodyLineHeight = bodySize * bodyRatio;
    const gap = bodyLines.length ? gapBase : 0;
    const totalHeight = headlineLines.length * headlineLineHeight + gap + bodyLines.length * bodyLineHeight;
    if (totalHeight <= maxHeight || headlineSize <= headlineMin) {
      return { headlineLines, bodyLines, headlineSize, bodySize, headlineLineHeight, bodyLineHeight, gap };
    }
    headlineSize -= s(4);
  }

  return {
    headlineLines: headlineSource,
    bodyLines: bodySource,
    headlineSize,
    bodySize: Math.max(bodyMin, headlineSize * bodyBaseRatio),
    headlineLineHeight: headlineSize * lineRatio,
    bodyLineHeight: Math.max(bodyMin, headlineSize * bodyBaseRatio) * bodyRatio,
    gap: gapBase,
  };
}

function wrapSvgWords(text, maxWidth, fontSize) {
  const words = String(text || "").trim().split(/\s+/g).filter(Boolean);
  const lines = [];
  let line = "";
  const estimate = (value) => value.length * fontSize * 0.48;
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && estimate(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

function renderV2MiniScreenTimeCardSvg({ spec, x, y, w, h, scale }) {
  const s = (value) => round(value * scale);
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${s(42)}" fill="#17181f" fill-opacity="0.9"
      stroke="#ffffff" stroke-opacity="0.09" stroke-width="${s(1.5)}" filter="url(#v2SoftGlow)"/>
    <text class="v2-serif" x="${x + s(54)}" y="${y + s(70)}" font-size="${s(38)}" font-weight="700" fill="#a9a9b2">Last Week&apos;s Average</text>
    <text class="v2-serif" x="${x + s(54)}" y="${y + s(154)}" font-size="${s(86)}" font-weight="900" fill="#ffffff">${escapeXml(spec.average)}</text>
    ${renderV2TrendBadgeSmallSvg({ spec, x: x + s(572), y: y + s(128), scale })}
    ${renderV2MiniChartSvg({ spec, x: x + s(62), y: y + s(196), w: w - s(196), h: s(174), scale })}
    <line x1="${x + s(54)}" y1="${y + h - s(78)}" x2="${x + w - s(54)}" y2="${y + h - s(78)}"
      stroke="#ffffff" stroke-opacity="0.09" stroke-width="${s(1.4)}"/>
    <text class="v2-serif" x="${x + s(54)}" y="${y + h - s(30)}" font-size="${s(38)}" font-weight="800" fill="#f3f3f6">Total Screen Time</text>
    <text class="v2-serif" x="${x + w - s(54)}" y="${y + h - s(30)}" text-anchor="end" font-size="${s(38)}" font-weight="800" fill="#b7b5be">${escapeXml(spec.total)}</text>
  </g>`;
}

function renderV2TrendBadgeSmallSvg({ spec, x, y, scale }) {
  const s = (value) => round(value * scale);
  const arrow =
    spec.direction === "down"
      ? `M ${x} ${y - s(30)} L ${x} ${y - s(6)} M ${x - s(12)} ${y - s(16)} L ${x} ${y - s(4)} L ${x + s(12)} ${y - s(16)}`
      : `M ${x} ${y - s(6)} L ${x} ${y - s(30)} M ${x - s(12)} ${y - s(20)} L ${x} ${y - s(32)} L ${x + s(12)} ${y - s(20)}`;
  return `<g>
    <circle cx="${x}" cy="${y - s(18)}" r="${s(22)}" fill="#b8b7bf"/>
    <path d="${arrow}" fill="none" stroke="#171820" stroke-width="${s(5)}" stroke-linecap="round" stroke-linejoin="round"/>
    <text class="v2-serif" x="${x + s(42)}" y="${y - s(4)}" font-size="${s(36)}" font-weight="700" fill="#b8b7bf">${escapeXml(`${spec.change} from last week`)}</text>
  </g>`;
}

function renderV2MiniChartSvg({ spec, x, y, w, h, scale }) {
  const s = (value) => round(value * scale);
  const chartBottom = y + h;
  const chartRight = x + w;
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  const dayValues = spec.days.map(parseDurationToHours);
  while (dayValues.length < 7) dayValues.push(dayValues[dayValues.length - 1] || 8);
  const maxHours = getV2ChartMaxHours(dayValues, parseDurationToHours(spec.average));
  const avgY = chartBottom - (parseDurationToHours(spec.average) / maxHours) * h;
  const slot = w / 7;
  const barW = Math.min(s(62), slot - s(30));
  const grid = [];
  for (let i = 0; i <= 4; i += 1) {
    const gy = y + (h * i) / 4;
    grid.push(`<line x1="${x}" y1="${round(gy)}" x2="${chartRight}" y2="${round(gy)}"/>`);
  }
  const bars = spec.days.slice(0, 7).map((day, index) => {
    const hours = parseDurationToHours(day);
    const barH = Math.max(s(34), (hours / maxHours) * h);
    const bx = x + slot * index + (slot - barW) / 2;
    const by = chartBottom - barH;
    return `${renderStackedBarSvg({ x: round(bx), y: round(by), w: round(barW), h: round(barH), index, scale })}
    <text class="v2-serif" x="${round(bx + s(4))}" y="${chartBottom + s(34)}" font-size="${s(28)}" font-weight="700" fill="#85828c">${labels[index]}</text>`;
  });
  return `<g>
    <g stroke="#ffffff" stroke-opacity="0.08" stroke-width="${s(1.1)}">${grid.join("")}</g>
    <line x1="${x}" y1="${round(avgY)}" x2="${chartRight}" y2="${round(avgY)}"
      stroke="#68df83" stroke-width="${s(3)}" stroke-dasharray="${s(8)} ${s(12)}"/>
    ${bars.join("")}
    <text class="v2-serif" x="${chartRight + s(24)}" y="${y + s(10)}" font-size="${s(32)}" font-weight="700" fill="#85828c">${maxHours}h</text>
    <text class="v2-serif" x="${chartRight + s(24)}" y="${y + h * 0.52}" font-size="${s(32)}" font-weight="700" fill="#85828c">${maxHours / 2}h</text>
    <text class="v2-serif" x="${chartRight + s(24)}" y="${chartBottom + s(8)}" font-size="${s(32)}" font-weight="700" fill="#85828c">0</text>
    <text class="v2-serif" x="${chartRight + s(24)}" y="${round(avgY + s(10))}" font-size="${s(32)}" font-weight="700" fill="#68df83">avg</text>
  </g>`;
}

function getV2ChartMaxHours(dayValues, average) {
  const peak = Math.max(average, ...dayValues.filter(Number.isFinite));
  if (peak <= 2) return 4;
  if (peak <= 4) return 6;
  if (peak <= 7) return 10;
  return 14;
}

function renderV2HeadlineSvg({ spec, x, y, fontSize, lineHeight, maxWidth }) {
  const lines = splitV2TextLines(spec.headline);
  const highlight = String(spec.highlight || "").trim().toUpperCase();
  return `<g filter="url(#v2SoftGlow)">
    ${lines
      .map((line, index) => {
        const upper = line.toUpperCase();
        const at = highlight ? upper.indexOf(highlight) : -1;
        const base = `class="v2-hand" x="${x}" y="${y + index * lineHeight}" dominant-baseline="text-before-edge" font-size="${fontSize}" fill="#ffffff"`;
        if (at < 0) return `<text ${base}>${escapeXml(line)}</text>`;
        const before = line.slice(0, at);
        const marked = line.slice(at, at + highlight.length);
        const after = line.slice(at + highlight.length);
        return `<text ${base}><tspan>${escapeXml(before)}</tspan><tspan fill="#ffffff">${escapeXml(marked)}</tspan><tspan>${escapeXml(after)}</tspan></text>`;
      })
      .join("")}
  </g>`;
}

function renderV2PhoneSvg({ x, y, w, h, kind, app, name, v2CatBase64, scale }) {
  const s = (value) => round(value * scale);
  const title = kind === "apple" ? "Time Limit" : `${name} locked ${app}`;
  const body = kind === "apple"
    ? [`You&apos;ve reached your limit`, `on ${escapeXml(app)}.`]
    : ["Strict mode means strict.", "Back to the work."];
  const icon = kind === "apple"
    ? renderHourglassSvg({ cx: x + w / 2, cy: y + s(236), size: s(72), scale })
    : renderV2CatThumbSvg({ cx: x + w / 2, cy: y + s(242), size: s(130), v2CatBase64 });
  const primary = kind === "apple"
    ? renderV2PillSvg({ x: x + s(58), y: y + h - s(174), w: w - s(116), h: s(76), fill: "#3b8df2", color: "#d8fff7", label: "OK", scale })
    : renderV2PillSvg({ x: x + s(58), y: y + h - s(174), w: w - s(116), h: s(76), fill: "#e2bd61", color: "#4b2605", label: `Face ${name}`, scale });
  const secondary = renderV2OutlinePillSvg({
    x: x + s(58),
    y: y + h - s(82),
    w: w - s(116),
    h: s(66),
    label: kind === "apple" ? "Ignore Limit" : "Close App",
    scale,
  });
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${s(46)}" fill="${kind === "apple" ? "#242426" : "#1c1a18"}"
      stroke="#ffffff" stroke-opacity="0.1" stroke-width="${s(1.3)}"/>
    <text class="v2-sans" x="${x + s(48)}" y="${y + s(62)}" font-size="${s(24)}" font-weight="800" fill="#ffffff">${kind === "apple" ? "9:31" : "9:09"}</text>
    <text class="v2-sans" x="${x + w - s(48)}" y="${y + s(62)}" text-anchor="end" font-size="${s(24)}" font-weight="800" fill="#ffffff">${kind === "apple" ? "74" : "78"}</text>
    ${icon}
    <text class="v2-sans" x="${x + w / 2}" y="${y + (kind === "apple" ? s(338) : s(356))}" text-anchor="middle"
      font-size="${kind === "apple" ? s(42) : s(37)}" font-weight="${kind === "apple" ? "800" : "850"}" fill="#ffffff">${escapeXml(title)}</text>
    ${body
      .map(
        (line, index) =>
          `<text class="v2-sans" x="${x + w / 2}" y="${y + (kind === "apple" ? s(400) : s(414)) + index * s(42)}" text-anchor="middle"
            font-size="${kind === "apple" ? s(34) : s(33)}" font-weight="500" fill="${kind === "apple" ? "#a7a5ae" : "#b8b3ad"}">${line}</text>`
      )
      .join("")}
    ${primary}
    ${secondary}
  </g>`;
}

function renderV2PillSvg({ x, y, w, h, fill, color, label, scale }) {
  const s = (value) => round(value * scale);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>
  <text class="v2-sans" x="${x + w / 2}" y="${y + h / 2 + s(10)}" text-anchor="middle" font-size="${s(28)}" font-weight="800" fill="${color}">${escapeXml(label)}</text>`;
}

function renderV2OutlinePillSvg({ x, y, w, h, label, scale }) {
  const s = (value) => round(value * scale);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#080808" fill-opacity="0.2"
    stroke="#ffffff" stroke-opacity="0.13" stroke-width="${s(1.5)}"/>
  <text class="v2-sans" x="${x + w / 2}" y="${y + h / 2 + s(10)}" text-anchor="middle" font-size="${s(28)}" font-weight="500" fill="#d8d6dc">${escapeXml(label)}</text>`;
}

function renderHourglassSvg({ cx, cy, size, scale }) {
  const s = (value) => round(value * scale);
  const d = [
    `M ${cx - size * 0.42} ${cy - size * 0.5}`,
    `Q ${cx} ${cy - size * 0.52} ${cx + size * 0.42} ${cy - size * 0.5}`,
    `Q ${cx + size * 0.34} ${cy - size * 0.12} ${cx + size * 0.08} ${cy}`,
    `Q ${cx + size * 0.34} ${cy + size * 0.12} ${cx + size * 0.42} ${cy + size * 0.5}`,
    `Q ${cx} ${cy + size * 0.52} ${cx - size * 0.42} ${cy + size * 0.5}`,
    `Q ${cx - size * 0.34} ${cy + size * 0.12} ${cx - size * 0.08} ${cy}`,
    `Q ${cx - size * 0.34} ${cy - size * 0.12} ${cx - size * 0.42} ${cy - size * 0.5}`,
    "Z",
  ].join(" ");
  return `<path d="${d}" fill="#377ae6"/>
  <path d="M ${cx - size * 0.22} ${cy + size * 0.3} L ${cx} ${cy + size * 0.1} L ${cx + size * 0.22} ${cy + size * 0.3} Z"
    fill="none" stroke="#222226" stroke-opacity="0.72" stroke-width="${s(8)}" stroke-linejoin="round"/>`;
}

function renderV2CatThumbSvg({ cx, cy, size, v2CatBase64 }) {
  return `<g filter="url(#v2SoftGlow)">
    <image x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}"
      preserveAspectRatio="xMidYMid meet"
      href="data:image/png;base64,${v2CatBase64}"/>
  </g>`;
}

function splitV2Headline(value) {
  return String(value || "")
    .replace(/\\n/g, "|")
    .split("|")
    .map((line) => line.trim().toUpperCase())
    .filter(Boolean);
}

function splitV2TextLines(value) {
  return String(value || "")
    .replace(/\\n/g, "|")
    .split("|")
    .map((line) => line.trim())
    .filter(Boolean);
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
  if (!fontSupportsText(font, text)) {
    return renderPixelText({ text, fontSize, x, y, fill, anchor });
  }

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

function fontSupportsText(font, text) {
  for (const char of String(text)) {
    if (char === " ") continue;
    const glyph = font.glyphForCodePoint(char.codePointAt(0));
    if (!glyph || glyph.id === 0 || !glyph.path?.toSVG()) return false;
  }
  return true;
}

function renderPixelText({ text, fontSize, x, y, fill, anchor = "start" }) {
  const value = String(text).toUpperCase();
  const unit = fontSize / 7;
  const gap = unit;
  const width = pixelTextWidth(value, unit, gap);
  const startX = anchor === "end" ? x - width : x;
  const top = y - fontSize * 0.82;
  let cursor = 0;
  const rects = [];

  for (const char of value) {
    if (char === " ") {
      cursor += unit * 3;
      continue;
    }
    const glyph = PIXEL_FONT[char] || PIXEL_FONT["?"];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] === "1") {
          rects.push(
            `<rect x="${round(startX + cursor + col * unit)}" y="${round(top + row * unit)}" width="${round(unit * 0.86)}" height="${round(unit * 0.86)}" rx="${round(unit * 0.12)}"/>`
          );
        }
      }
    }
    cursor += glyph[0].length * unit + gap;
  }

  return `<g fill="${fill}">${rects.join("")}</g>`;
}

function pixelTextWidth(text, unit, gap) {
  let width = 0;
  for (const char of String(text)) {
    if (char === " ") {
      width += unit * 3;
      continue;
    }
    const glyph = PIXEL_FONT[char] || PIXEL_FONT["?"];
    width += glyph[0].length * unit + gap;
  }
  return Math.max(0, width - gap);
}

const PIXEL_FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
};

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
