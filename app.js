const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");
const LATIN_DISPLAY_FONT = 'Georgia, "Times New Roman", serif';
const CJK_DISPLAY_FONT = '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif';

const els = {
  topic: document.getElementById("topic"),
  bulkSlides: document.getElementById("bulkSlides"),
  slideCount: document.getElementById("slideCount"),
  exportSize: document.getElementById("exportSize"),
  fontScale: document.getElementById("fontScale"),
  footerBrand: document.getElementById("footerBrand"),
  slideList: document.getElementById("slideList"),
  activeLabel: document.getElementById("activeLabel"),
  slideMeta: document.getElementById("slideMeta"),
  exportAll: document.getElementById("exportAll"),
  draftFromTopic: document.getElementById("draftFromTopic"),
  copyPrompt: document.getElementById("copyPrompt"),
  applySlides: document.getElementById("applySlides"),
  addSlide: document.getElementById("addSlide"),
  prevSlide: document.getElementById("prevSlide"),
  nextSlide: document.getElementById("nextSlide"),
};

let slides = [
  "Your Phone Is Training You To Lose Focus",
  "Check your top app first\nThat is where the spiral usually starts.",
  "[evocat-v2]\nmode: screen-time\nheadline: Is this your Screen Time?\naverage: 8h 58m\nchange: 13%\ntotal: 62h 46m\ndays: 8h 40m, 9h 58m, 9h 18m, 9h 22m, 10h 45m, 9h 24m, 8h 51m\n[/evocat-v2]",
  "Don't fix the whole phone\nPick the app you reopen automatically.",
  "Protect your worst time\nBedtime, mornings, work, or study.",
  "Move the app out of reach\nLess visible means less automatic.",
  "The goal is not zero phone use\nThe goal is fewer automatic openings.",
  "If you keep going back to the same app\nTry EvoCat on the App Store.",
];

let activeIndex = 0;
const icon = new Image();
icon.src = "./assets/ironcat-app-icon.png";
icon.onload = render;
const v2Cat = new Image();
v2Cat.src = "./assets/ironcat_transparent_bg.png";
v2Cat.onload = render;
const v2SlideImages = new Map();
if (document.fonts) document.fonts.ready.then(render);

function splitSlides(value) {
  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Plain text is the normal input path.
  }

  return trimmed
    .split(/\n\s*\n/g)
    .map((item) => item.trim().replace(/^(slide\s*)?\d+[\).:-]\s*/i, ""))
    .filter(Boolean);
}

function syncBulk() {
  els.bulkSlides.value = slides.join("\n\n");
  els.slideCount.value = String(slides.length);
}

function setCanvasSize() {
  const size = Number(els.exportSize.value);
  canvas.width = size;
  canvas.height = size;
  els.slideMeta.textContent = `${size} x ${size} PNG`;
}

function getScale() {
  return canvas.width / 2048;
}

function drawRoundRect(context, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

function drawBackground() {
  const s = getScale();
  ctx.fillStyle = "#171716";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(
    720 * s,
    1080 * s,
    60 * s,
    720 * s,
    1080 * s,
    980 * s
  );
  glow.addColorStop(0, "rgba(255,255,255,0.045)");
  glow.addColorStop(0.36, "rgba(255,255,255,0.018)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.17;
  ctx.fillStyle = "#ffffff";
  for (let y = 0; y < canvas.height; y += 11 * s) {
    for (let x = (y / s) % 22 === 0 ? 0 : 5 * s; x < canvas.width; x += 17 * s) {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      if (n - Math.floor(n) > 0.86) ctx.fillRect(x, y, 1 * s, 1 * s);
    }
  }
  ctx.globalAlpha = 1;
}

function drawCard() {
  const s = getScale();
  const x = 210 * s;
  const y = 318 * s;
  const w = 1628 * s;
  const h = 1438 * s;
  const r = 150 * s;

  ctx.save();
  drawRoundRect(ctx, x, y, w, h, r);
  ctx.shadowColor = "rgba(255,255,255,0.64)";
  ctx.shadowBlur = 26 * s;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2.2 * s;
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 1.2 * s;
  ctx.stroke();
  ctx.restore();
}

function drawIcon() {
  const s = getScale();
  if (!icon.complete) return;

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.shadowColor = "rgba(55, 69, 125, 0.55)";
  ctx.shadowBlur = 42 * s;
  ctx.drawImage(icon, 1185 * s, 1216 * s, 470 * s, 470 * s);
  ctx.restore();
}

function fitFontSize(text, maxWidth, maxHeight, startSize, minSize, lineHeightRatio) {
  let fontSize = startSize;
  const fontFamily = displayFontFor(text);
  while (fontSize >= minSize) {
    ctx.font = `900 ${fontSize}px ${fontFamily}`;
    const lines = wrapText(text, maxWidth);
    if (lines.length * fontSize * lineHeightRatio <= maxHeight) {
      return { fontSize, fontFamily, lines };
    }
    fontSize -= 4;
  }
  ctx.font = `900 ${minSize}px ${fontFamily}`;
  return { fontSize: minSize, fontFamily, lines: wrapText(text, maxWidth) };
}

function wrapText(text, maxWidth) {
  const paragraphs = text.split(/\n+/g).map((line) => line.trim()).filter(Boolean);
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = tokenizeForWrap(paragraph);
    let current = "";
    for (const word of words) {
      const next = joinWrapToken(current, word);
      if (ctx.measureText(next).width <= maxWidth || !current) {
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

function hasCjk(text) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(text);
}

function isClosingPunctuation(token) {
  return /^[。！？；：，、）】》」』”’.,!?;:%)]$/.test(token);
}

function displayFontFor(text) {
  return hasCjk(text) ? CJK_DISPLAY_FONT : LATIN_DISPLAY_FONT;
}

function drawMainText(text) {
  const s = getScale();
  const scale = Number(els.fontScale.value) / 100;
  const x = 344 * s;
  const y = 570 * s;
  const maxWidth = 1240 * s;
  const maxHeight = 650 * s;
  const start = 134 * s * scale;
  const min = 66 * s;
  const lineHeightRatio = 1.34;

  const fit = fitFontSize(text, maxWidth, maxHeight, start, min, lineHeightRatio);
  ctx.fillStyle = "#fffdf7";
  ctx.textBaseline = "top";
  ctx.font = `900 ${fit.fontSize}px ${fit.fontFamily}`;

  const lineHeight = fit.fontSize * lineHeightRatio;
  fit.lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function drawFooter() {
  const s = getScale();
  const x = 344 * s;
  const y = 1368 * s;
  const brand = els.footerBrand.value.trim() || "Evocat";

  ctx.fillStyle = "#fffdf7";
  ctx.textBaseline = "top";
  ctx.font = `900 ${42 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillText("Focus Advice by", x, y);
  ctx.font = `900 ${58 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillText(brand, x, y + 72 * s);
}

function render() {
  setCanvasSize();
  const slide = slides[activeIndex] || "";
  const evocatV2 = parseEvocatV2Slide(slide);
  const screenTime = parseScreenTimeSlide(slide);
  if (evocatV2) {
    drawEvocatV2Slide(evocatV2);
  } else if (screenTime) {
    drawScreenTimeSlide(screenTime);
  } else {
    drawBackground();
    drawCard();
    drawMainText(slide);
    drawFooter();
    drawIcon();
  }
  els.activeLabel.textContent = `Slide ${activeIndex + 1}`;
  renderSlideList();
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
    if (key === "headline") spec.headline = val;
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

function drawEvocatV2Slide(spec) {
  drawV2Background();
  if (/compare|limit/i.test(spec.mode)) {
    drawV2ComparisonScene(spec);
  } else if (/screen/i.test(spec.mode)) {
    drawV2ScreenTimeScene(spec);
  } else {
    drawV2TextScene(spec);
  }
}

function drawV2Background() {
  const s = getScale();
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (v2Cat.complete) {
    ctx.drawImage(v2Cat, 704 * s, 1308 * s, 640 * s, 640 * s);
  }
}

function drawV2ScreenTimeScene(spec) {
  const s = getScale();
  drawV2Bubble(126 * s, 138 * s, 1796 * s, 1188 * s, 170 * s);
  if (splitV2TextLines(spec.headline).length) {
    drawV2StoryText({ ...spec, body: "" }, 220 * s, 246 * s, 1628 * s, 210 * s, {
      headlineMax: 148,
      headlineMin: 108,
      lineRatio: 1.06,
    });
    drawV2ScreenTimeDashboard(spec, 316 * s, 600 * s, 1416 * s, 672 * s);
  } else {
    drawV2ScreenTimeDashboard(spec, 316 * s, 294 * s, 1416 * s, 788 * s);
  }
}

function drawV2ComparisonScene(spec) {
  const s = getScale();
  drawV2Bubble(258 * s, 74 * s, 1532 * s, 1300 * s, 130 * s);
  drawV2Headline(
    {
      headline: spec.headline || "Apple gives you an exit.|EvoCat gives you friction.",
      highlight: spec.highlight || "EvoCat",
    },
    316 * s,
    132 * s,
    76 * s,
    92 * s,
    1420 * s
  );
  drawV2Phone({
    x: 386 * s,
    y: 448 * s,
    w: 514 * s,
    h: 842 * s,
    kind: "apple",
    app: spec.appleApp,
    name: spec.evocatName,
  });
  drawV2Phone({
    x: 1148 * s,
    y: 448 * s,
    w: 514 * s,
    h: 842 * s,
    kind: "evocat",
    app: spec.evocatApp,
    name: spec.evocatName,
  });
}

function drawV2TextScene(spec) {
  if (spec.image) {
    drawV2ImageTextScene(spec);
    return;
  }

  const s = getScale();
  drawV2Bubble(170 * s, 154 * s, 1708 * s, 1158 * s, 154 * s);
  drawV2StoryText(spec, 270 * s, 294 * s, 1510 * s, 680 * s, {
    headlineMax: 148,
    headlineMin: 96,
    bodyMax: 86,
    bodyMin: 64,
    lineRatio: 1.1,
    bodyRatio: 1.16,
    gap: 68,
  });
}

function drawV2ImageTextScene(spec) {
  const s = getScale();
  const imageLayout = getV2ImageTextLayout(spec);
  drawV2Bubble(170 * s, 154 * s, 1708 * s, 1158 * s, 154 * s);
  drawV2StoryText(spec, 270 * s, 252 * s, 1510 * s, 430 * s, {
    headlineMax: 132,
    headlineMin: 76,
    bodyMax: 76,
    bodyMin: 54,
    lineRatio: 1.1,
    bodyRatio: 1.16,
    gap: 54,
  });
  drawV2JobImage(spec.image, imageLayout.x * s, imageLayout.y * s, imageLayout.w * s, imageLayout.h * s, spec.imageFit);
}

function getV2ImageTextLayout(spec) {
  const headlineLines = Math.max(1, splitV2Headline(spec.headline).length);
  const bodyLines = splitV2TextLines(spec.body).length;
  let y = 620;
  if (bodyLines && headlineLines > 1) y = 710;
  else if (bodyLines) y = 670;
  else if (headlineLines <= 1) y = 600;
  return { x: 220, y, w: 1608, h: 1302 - y };
}

function drawV2JobImage(src, x, y, w, h, fit = "cover") {
  const s = getScale();
  const image = getV2SlideImage(src);
  ctx.save();
  drawRoundRect(ctx, x, y, w, h, 48 * s);
  ctx.fillStyle = "#111116";
  ctx.fill();
  if (image.complete && image.naturalWidth && image.naturalHeight) {
    ctx.clip();
    if (String(fit).toLowerCase() === "contain") {
      drawImageContain(image, x, y, w, h);
    } else {
      drawImageCover(image, x, y, w, h);
    }
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();

  ctx.save();
  drawRoundRect(ctx, x, y, w, h, 48 * s);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2.2 * s;
  ctx.stroke();
  ctx.restore();
}

function getV2SlideImage(src) {
  const key = String(src || "").trim();
  if (!v2SlideImages.has(key)) {
    const image = new Image();
    image.onload = render;
    image.src = key;
    v2SlideImages.set(key, image);
  }
  return v2SlideImages.get(key);
}

function drawImageCover(image, x, y, w, h) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawImageContain(image, x, y, w, h) {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);
}

function drawV2Bubble(x, y, w, h, r) {
  const s = getScale();
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.94)";
  ctx.shadowBlur = 32 * s;
  ctx.lineWidth = 10.5 * s;
  ctx.strokeStyle = "rgba(255,255,255,0.98)";
  ctx.fillStyle = "rgba(5,5,8,0.94)";
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + w * 0.64, y + h);
  ctx.bezierCurveTo(x + w * 0.63, y + h + 92 * s, x + w * 0.55, y + h + 158 * s, x + w * 0.49, y + h + 172 * s);
  ctx.bezierCurveTo(x + w * 0.54, y + h + 92 * s, x + w * 0.53, y + h + 24 * s, x + w * 0.46, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.2 * s;
  ctx.strokeStyle = "rgba(220,228,255,0.66)";
  ctx.stroke();
  ctx.restore();
}

function drawV2ScreenTimeDashboard(spec, x, y, w, h) {
  const s = getScale();
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `700 ${54 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = "#a9a9b2";
  ctx.fillText("Last Week's Average", x, y + 58 * s);

  ctx.font = `900 ${116 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(spec.average, x, y + 170 * s);
  drawTrendBadgeSmall(spec, x + 800 * s, y + 137 * s);

  const footerY = y + h - 100 * s;
  const chartY = y + 252 * s;
  const chartH = Math.min(410 * s, Math.max(220 * s, footerY - chartY - 42 * s));
  drawV2MiniChart(spec, x, chartY, w - 122 * s, chartH);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(x, footerY);
  ctx.lineTo(x + w, footerY);
  ctx.stroke();

  ctx.font = `800 ${54 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Total Screen Time", x, y + h - 38 * s);
  ctx.textAlign = "right";
  ctx.fillStyle = "#c2c0c8";
  ctx.fillText(spec.total, x + w, y + h - 38 * s);
  ctx.restore();
}

function drawV2StoryText(spec, x, y, maxWidth, maxHeight, options = {}) {
  const s = getScale();
  const layout = fitV2StoryText(spec, maxWidth, maxHeight, options);

  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(255,255,255,0.36)";
  ctx.shadowBlur = 10 * s;
  ctx.font = v2HandFont(layout.headlineSize);
  ctx.fillStyle = "#ffffff";
  layout.headlineLines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * layout.headlineLineHeight);
  });

  if (layout.bodyLines.length) {
    ctx.shadowBlur = 7 * s;
    ctx.font = v2HandFont(layout.bodySize);
    ctx.fillStyle = "#ffffff";
    const bodyY = y + layout.headlineLines.length * layout.headlineLineHeight + layout.gap;
    layout.bodyLines.forEach((line, index) => {
      ctx.fillText(line, x, bodyY + index * layout.bodyLineHeight);
    });
  }
  ctx.restore();
}

function fitV2StoryText(spec, maxWidth, maxHeight, options = {}) {
  const s = getScale();
  const headlineSource = splitV2TextLines(spec.headline);
  const bodySource = splitV2TextLines(spec.body);
  let headlineSize = (options.headlineMax || 112) * s;
  const headlineMin = (options.headlineMin || 68) * s;
  const bodyBaseRatio = (options.bodyMax || 68) / (options.headlineMax || 112);
  const bodyMin = (options.bodyMin || 46) * s;
  const lineRatio = options.lineRatio || 1.2;
  const bodyRatio = options.bodyRatio || 1.24;
  const gapBase = (options.gap || 62) * s;

  while (headlineSize >= headlineMin) {
    const bodySize = Math.max(bodyMin, headlineSize * bodyBaseRatio);
    const headlineLines = headlineSource.flatMap((line) => wrapWords(line, maxWidth, headlineSize)).slice(0, 5);
    const bodyLines = bodySource.flatMap((line) => wrapWords(line, maxWidth, bodySize)).slice(0, 5);
    const headlineLineHeight = headlineSize * lineRatio;
    const bodyLineHeight = bodySize * bodyRatio;
    const gap = bodyLines.length ? gapBase : 0;
    const totalHeight = headlineLines.length * headlineLineHeight + gap + bodyLines.length * bodyLineHeight;
    if (totalHeight <= maxHeight || headlineSize <= headlineMin) {
      return { headlineLines, bodyLines, headlineSize, bodySize, headlineLineHeight, bodyLineHeight, gap };
    }
    headlineSize -= 4 * s;
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

function wrapWords(text, maxWidth, fontSize) {
  const words = String(text || "").trim().split(/\s+/g).filter(Boolean);
  const lines = [];
  let line = "";
  ctx.save();
  ctx.font = v2HandFont(fontSize);
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  ctx.restore();
  return lines.length ? lines : [text];
}

function v2HandFont(size) {
  return `300 ${size}px "Chalkboard SE", "Marker Felt", "Noteworthy", "Comic Sans MS", cursive`;
}

function drawV2MiniScreenTimeCard(spec, x, y, w, h) {
  const s = getScale();
  ctx.save();
  drawRoundRect(ctx, x, y, w, h, 42 * s);
  ctx.fillStyle = "rgba(23,24,31,0.9)";
  ctx.shadowColor = "rgba(80,98,160,0.52)";
  ctx.shadowBlur = 42 * s;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `700 ${38 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = "#a9a9b2";
  ctx.fillText("Last Week's Average", x + 54 * s, y + 70 * s);

  ctx.font = `900 ${86 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = "#fff";
  ctx.fillText(spec.average, x + 54 * s, y + 154 * s);
  drawTrendBadgeSmall(spec, x + 572 * s, y + 128 * s);

  drawV2MiniChart(spec, x + 62 * s, y + 196 * s, w - 196 * s, 174 * s);

  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(x + 54 * s, y + h - 78 * s);
  ctx.lineTo(x + w - 54 * s, y + h - 78 * s);
  ctx.stroke();

  ctx.font = `800 ${38 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = "#f3f3f6";
  ctx.fillText("Total Screen Time", x + 54 * s, y + h - 30 * s);
  ctx.textAlign = "right";
  ctx.fillStyle = "#b7b5be";
  ctx.fillText(spec.total, x + w - 54 * s, y + h - 30 * s);
  ctx.restore();
}

function drawTrendBadgeSmall(spec, x, y) {
  const s = getScale();
  ctx.save();
  ctx.fillStyle = "#b8b7bf";
  ctx.beginPath();
  ctx.arc(x, y - 18 * s, 22 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#171820";
  ctx.lineWidth = 5 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (spec.direction === "down") {
    ctx.moveTo(x, y - 30 * s);
    ctx.lineTo(x, y - 6 * s);
    ctx.moveTo(x - 12 * s, y - 16 * s);
    ctx.lineTo(x, y - 4 * s);
    ctx.lineTo(x + 12 * s, y - 16 * s);
  } else {
    ctx.moveTo(x, y - 6 * s);
    ctx.lineTo(x, y - 30 * s);
    ctx.moveTo(x - 12 * s, y - 20 * s);
    ctx.lineTo(x, y - 32 * s);
    ctx.lineTo(x + 12 * s, y - 20 * s);
  }
  ctx.stroke();
  ctx.font = `700 ${36 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = "#b8b7bf";
  ctx.fillText(`${spec.change} from last week`, x + 42 * s, y - 4 * s);
  ctx.restore();
}

function drawV2MiniChart(spec, x, y, w, h) {
  const s = getScale();
  const chartBottom = y + h;
  const chartRight = x + w;
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  const dayValues = spec.days.map(parseDurationToHours);
  while (dayValues.length < 7) dayValues.push(dayValues[dayValues.length - 1] || 8);
  const maxHours = getV2ChartMaxHours(dayValues, parseDurationToHours(spec.average));
  const avgY = chartBottom - (parseDurationToHours(spec.average) / maxHours) * h;
  const slot = w / 7;
  const barW = Math.min(62 * s, slot - 30 * s);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.1 * s;
  for (let i = 0; i <= 4; i += 1) {
    const gy = y + (h * i) / 4;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(chartRight, gy);
    ctx.stroke();
  }

  ctx.strokeStyle = "#68df83";
  ctx.lineWidth = 3 * s;
  ctx.setLineDash([8 * s, 12 * s]);
  ctx.beginPath();
  ctx.moveTo(x, avgY);
  ctx.lineTo(chartRight, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  spec.days.slice(0, 7).forEach((day, index) => {
    const hours = parseDurationToHours(day);
    const barH = Math.max(34 * s, (hours / maxHours) * h);
    const bx = x + slot * index + (slot - barW) / 2;
    const by = chartBottom - barH;
    drawStackedBar(bx, by, barW, barH, index);
    ctx.font = `700 ${28 * s}px Georgia, "Times New Roman", serif`;
    ctx.fillStyle = "#85828c";
    ctx.fillText(labels[index], bx + 4 * s, chartBottom + 34 * s);
  });

  ctx.font = `700 ${32 * s}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = "#85828c";
  ctx.fillText(`${maxHours}h`, chartRight + 24 * s, y + 10 * s);
  ctx.fillText(`${maxHours / 2}h`, chartRight + 24 * s, y + h * 0.52);
  ctx.fillText("0", chartRight + 24 * s, chartBottom + 8 * s);
  ctx.fillStyle = "#68df83";
  ctx.fillText("avg", chartRight + 24 * s, avgY + 10 * s);
}

function getV2ChartMaxHours(dayValues, average) {
  const peak = Math.max(average, ...dayValues.filter(Number.isFinite));
  if (peak <= 2) return 4;
  if (peak <= 4) return 6;
  if (peak <= 7) return 10;
  return 14;
}

function drawV2Headline(spec, x, y, fontSize, lineHeight, maxWidth) {
  const lines = splitV2TextLines(spec.headline);
  const highlight = String(spec.highlight || "").trim();
  let size = fontSize;
  while (size > 48 * getScale()) {
    ctx.font = `400 ${size}px "Chalkboard SE", "Marker Felt", "Noteworthy", "Comic Sans MS", cursive`;
    if (lines.every((line) => ctx.measureText(line).width <= maxWidth)) break;
    size -= 4 * getScale();
  }

  ctx.save();
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(255,255,255,0.36)";
  ctx.shadowBlur = 10 * getScale();
  ctx.font = `400 ${size}px "Chalkboard SE", "Marker Felt", "Noteworthy", "Comic Sans MS", cursive`;
  lines.forEach((line, index) => {
    const ly = y + index * lineHeight;
    const upper = line.toUpperCase();
    const mark = highlight.toUpperCase();
    const at = mark ? upper.indexOf(mark) : -1;
    if (at >= 0) {
      const before = line.slice(0, at);
      const marked = line.slice(at, at + highlight.length);
      const after = line.slice(at + highlight.length);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(before, x, ly);
      const hx = x + ctx.measureText(before).width;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(marked, hx, ly);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(after, hx + ctx.measureText(marked).width, ly);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillText(line, x, ly);
    }
  });
  ctx.restore();
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

function drawV2Phone({ x, y, w, h, kind, app, name }) {
  const s = getScale();
  ctx.save();
  drawRoundRect(ctx, x, y, w, h, 46 * s);
  ctx.fillStyle = kind === "apple" ? "#242426" : "#1c1a18";
  ctx.shadowColor = kind === "apple" ? "rgba(66,150,255,0.24)" : "rgba(229,190,96,0.22)";
  ctx.shadowBlur = 24 * s;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1.3 * s;
  ctx.stroke();

  ctx.font = `800 ${24 * s}px -apple-system, BlinkMacSystemFont, "SF Pro Display", Arial, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(kind === "apple" ? "9:31" : "9:09", x + 48 * s, y + 62 * s);
  ctx.textAlign = "right";
  ctx.fillText(kind === "apple" ? "74" : "78", x + w - 48 * s, y + 62 * s);
  ctx.textAlign = "left";

  if (kind === "apple") {
    drawHourglass(x + w / 2, y + 236 * s, 72 * s);
    drawPhoneText("Time Limit", x + w / 2, y + 338 * s, 42 * s, "#ffffff", "800");
    drawPhoneText(`You've reached your limit\non ${app}.`, x + w / 2, y + 400 * s, 34 * s, "#a7a5ae", "500", 1.28);
    drawPillButton(x + 58 * s, y + h - 174 * s, w - 116 * s, 76 * s, "#3b8df2", "#d8fff7", "OK");
    drawOutlineButton(x + 58 * s, y + h - 82 * s, w - 116 * s, 66 * s, "Ignore Limit");
  } else {
    drawV2CatThumb(x + w / 2, y + 242 * s, 130 * s);
    drawPhoneText(`${name} locked ${app}`, x + w / 2, y + 356 * s, 37 * s, "#ffffff", "850");
    drawPhoneText("Strict mode means strict.\nBack to the work.", x + w / 2, y + 414 * s, 33 * s, "#b8b3ad", "500", 1.28);
    drawPillButton(x + 58 * s, y + h - 174 * s, w - 116 * s, 76 * s, "#e2bd61", "#4b2605", `Face ${name}`);
    drawOutlineButton(x + 58 * s, y + h - 82 * s, w - 116 * s, 66 * s, "Close App");
  }
  ctx.restore();
}

function drawPhoneText(text, x, y, size, color, weight, lineRatio = 1.2) {
  const s = getScale();
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "SF Pro Display", Arial, sans-serif`;
  ctx.fillStyle = color;
  String(text)
    .split("\n")
    .forEach((line, index) => {
      ctx.fillText(line, x, y + index * size * lineRatio);
    });
  ctx.restore();
}

function drawPillButton(x, y, w, h, fill, color, label) {
  const s = getScale();
  drawRoundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.font = `800 ${28 * s}px -apple-system, BlinkMacSystemFont, "SF Pro Display", Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.textAlign = "left";
}

function drawOutlineButton(x, y, w, h, label) {
  const s = getScale();
  drawRoundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(8,8,8,0.2)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.13)";
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();
  ctx.font = `500 ${28 * s}px -apple-system, BlinkMacSystemFont, "SF Pro Display", Arial, sans-serif`;
  ctx.fillStyle = "#d8d6dc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.textAlign = "left";
}

function drawHourglass(cx, cy, size) {
  const s = getScale();
  ctx.save();
  ctx.fillStyle = "#377ae6";
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.42, cy - size * 0.5);
  ctx.quadraticCurveTo(cx, cy - size * 0.52, cx + size * 0.42, cy - size * 0.5);
  ctx.quadraticCurveTo(cx + size * 0.34, cy - size * 0.12, cx + size * 0.08, cy);
  ctx.quadraticCurveTo(cx + size * 0.34, cy + size * 0.12, cx + size * 0.42, cy + size * 0.5);
  ctx.quadraticCurveTo(cx, cy + size * 0.52, cx - size * 0.42, cy + size * 0.5);
  ctx.quadraticCurveTo(cx - size * 0.34, cy + size * 0.12, cx - size * 0.08, cy);
  ctx.quadraticCurveTo(cx - size * 0.34, cy - size * 0.12, cx - size * 0.42, cy - size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(34,34,38,0.72)";
  ctx.lineWidth = 8 * s;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.22, cy + size * 0.3);
  ctx.lineTo(cx, cy + size * 0.1);
  ctx.lineTo(cx + size * 0.22, cy + size * 0.3);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawV2CatThumb(cx, cy, size) {
  const s = getScale();
  if (!v2Cat.complete) return;
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.5)";
  ctx.shadowBlur = 18 * s;
  ctx.drawImage(v2Cat, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
}

function drawScreenTimeSlide(spec) {
  const s = getScale();
  ctx.fillStyle = "#17161a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createLinearGradient(0, 0, 0, canvas.height);
  glow.addColorStop(0, "rgba(255,255,255,0.035)");
  glow.addColorStop(0.48, "rgba(255,255,255,0.01)");
  glow.addColorStop(1, "rgba(0,0,0,0.24)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const x = 116 * s;
  const y = 78 * s;
  const w = 1816 * s;
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 ${83 * s}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "#aaa8b0";
  ctx.fillText("Last Week's Average", x, y + 82 * s);

  ctx.font = `300 ${176 * s}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "#fbfbff";
  ctx.fillText(spec.average, x, y + 292 * s);

  drawTrendBadge(spec, x + 850 * s, y + 212 * s);

  drawScreenTimeChart(spec, x, y + 386 * s, w - 240 * s, 628 * s);
  drawScreenTimeCategories(spec, x, y + 1155 * s, w);

  ctx.strokeStyle = "rgba(255,255,255,0.13)";
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(x, y + 1410 * s);
  ctx.lineTo(x + w, y + 1410 * s);
  ctx.stroke();

  ctx.font = `400 ${72 * s}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "#f3f2f8";
  ctx.fillText("Total Screen Time", x, y + 1570 * s);
  ctx.fillStyle = "#aaa8b0";
  ctx.textAlign = "right";
  ctx.fillText(spec.total, x + w, y + 1570 * s);
  ctx.textAlign = "left";
}

function drawTrendBadge(spec, x, y) {
  const s = getScale();
  ctx.save();
  ctx.fillStyle = "#a7a5ad";
  ctx.beginPath();
  ctx.arc(x + 43 * s, y, 38 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#17161a";
  ctx.lineWidth = 9 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (spec.direction === "down") {
    ctx.moveTo(x + 43 * s, y - 17 * s);
    ctx.lineTo(x + 43 * s, y + 17 * s);
    ctx.moveTo(x + 22 * s, y);
    ctx.lineTo(x + 43 * s, y + 22 * s);
    ctx.lineTo(x + 64 * s, y);
  } else {
    ctx.moveTo(x + 43 * s, y + 17 * s);
    ctx.lineTo(x + 43 * s, y - 17 * s);
    ctx.moveTo(x + 22 * s, y);
    ctx.lineTo(x + 43 * s, y - 22 * s);
    ctx.lineTo(x + 64 * s, y);
  }
  ctx.stroke();
  ctx.font = `400 ${74 * s}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "#aaa8b0";
  ctx.fillText(`${spec.change} from last week`, x + 100 * s, y + 27 * s);
  ctx.restore();
}

function drawScreenTimeChart(spec, x, y, w, h) {
  const s = getScale();
  const chartRight = x + w;
  const chartBottom = y + h;
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  const dayValues = spec.days.map(parseDurationToHours);
  while (dayValues.length < 7) dayValues.push(dayValues[dayValues.length - 1] || 8);
  const maxHours = Math.max(14, ...dayValues, parseDurationToHours(spec.average) + 2);
  const avgHours = parseDurationToHours(spec.average);
  const barGap = 66 * s;
  const slot = w / 7;
  const barW = Math.min(125 * s, slot - barGap);

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.3 * s;
  for (let i = 0; i <= 4; i += 1) {
    const gy = y + (h * i) / 4;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(chartRight, gy);
    ctx.stroke();
  }
  ctx.setLineDash([14 * s, 13 * s]);
  for (let i = 0; i <= 7; i += 1) {
    const gx = x + slot * i;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, chartBottom + 114 * s);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const avgY = chartBottom - (avgHours / maxHours) * h;
  ctx.strokeStyle = "#6ade82";
  ctx.lineWidth = 6 * s;
  ctx.setLineDash([14 * s, 24 * s]);
  ctx.beginPath();
  ctx.moveTo(x, avgY);
  ctx.lineTo(chartRight, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  spec.days.slice(0, 7).forEach((day, index) => {
    const hours = parseDurationToHours(day);
    const barH = Math.max(74 * s, (hours / maxHours) * h);
    const bx = x + slot * index + (slot - barW) / 2;
    const by = chartBottom - barH;
    drawStackedBar(bx, by, barW, barH, index);
    ctx.font = `500 ${60 * s}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = "#74717a";
    ctx.fillText(labels[index], bx - 12 * s, chartBottom + 82 * s);
  });

  ctx.font = `400 ${64 * s}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "#74717a";
  ctx.fillText("14h", chartRight + 24 * s, y + 22 * s);
  ctx.fillText("7h", chartRight + 24 * s, y + h * 0.52);
  ctx.fillText("0", chartRight + 24 * s, chartBottom + 20 * s);
  ctx.fillStyle = "#6ade82";
  ctx.fillText("avg", chartRight + 24 * s, avgY + 22 * s);
}

function drawStackedBar(x, y, w, h, index) {
  const s = getScale();
  const cap = 12 * s;
  const social = h * (0.75 + (index % 3) * 0.025);
  const entertainment = h * (0.17 - (index % 2) * 0.025);
  const shopping = h * 0.045;
  const other = Math.max(12 * s, h - social - entertainment - shopping);
  let cy = y + h;
  ctx.fillStyle = "#168df4";
  ctx.fillRect(x, cy - social, w, social);
  cy -= social;
  ctx.fillStyle = "#55c8d9";
  ctx.fillRect(x, cy - entertainment, w, entertainment);
  cy -= entertainment;
  ctx.fillStyle = "#f4a742";
  ctx.fillRect(x, cy - shopping, w, shopping);
  cy -= shopping;
  ctx.fillStyle = "#434248";
  ctx.beginPath();
  ctx.roundRect(x, y, w, other + cap, [cap, cap, 0, 0]);
  ctx.fill();
}

function drawScreenTimeCategories(spec, x, y, w) {
  const s = getScale();
  const col = w / 3;
  spec.categories.slice(0, 3).forEach((category, index) => {
    const cx = x + col * index;
    ctx.font = `400 ${62 * s}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = category.color;
    ctx.fillText(category.name, cx, y);
    ctx.font = `400 ${72 * s}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = "#fbfbff";
    ctx.fillText(category.value, cx, y + 112 * s);
  });
}

function parseDurationToHours(value) {
  const text = String(value || "");
  const hours = Number(text.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] || 0);
  const minutes = Number(text.match(/(\d+(?:\.\d+)?)\s*m/i)?.[1] || 0);
  return hours + minutes / 60;
}

function renderSlideList() {
  els.slideList.innerHTML = "";
  slides.forEach((slide, index) => {
    const button = document.createElement("button");
    button.className = `slide-chip${index === activeIndex ? " is-active" : ""}`;
    button.type = "button";
    const evocatV2 = parseEvocatV2Slide(slide);
    const screenTime = parseScreenTimeSlide(slide);
    const label = evocatV2
      ? `Evocat v2 ${/compare|limit/i.test(evocatV2.mode) ? "comparison" : "neon"}`
      : screenTime
        ? `Screen Time mockup (${screenTime.average})`
        : slide;
    button.innerHTML = `<small>${String(index + 1).padStart(2, "0")}</small><span>${escapeHtml(label)}</span>`;
    button.addEventListener("click", () => {
      activeIndex = index;
      render();
    });
    els.slideList.appendChild(button);
  });
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function makeDraft(topic, count) {
  const clean = topic.trim() || "Your Phone Is Training You To Lose Focus";
  const base = [
    clean,
    "Check your top app first\nThat is where the spiral usually starts.",
    "[evocat-v2]\nmode: screen-time\nheadline: Is this your Screen Time?\naverage: 8h 58m\nchange: 13%\ntotal: 62h 46m\ndays: 8h 40m, 9h 58m, 9h 18m, 9h 22m, 10h 45m, 9h 24m, 8h 51m\n[/evocat-v2]",
    "[evocat-v2]\nmode: limit-compare\nheadline: Apple gives you an exit.|EvoCat gives you friction.\nhighlight: EvoCat\napple-app: Instagram\nevocat-app: Instagram\nevocat-name: EvoCat\n[/evocat-v2]",
    "Protect your worst time\nBedtime, mornings, work, or study.",
    "Start with one clean hour\nNot a perfect day.",
    "The goal is not zero phone use\nThe goal is fewer automatic openings.",
    "If you keep going back to the same app\nTry EvoCat on the App Store.",
  ];
  return base.slice(0, count);
}

function applyBulk() {
  const parsed = splitSlides(els.bulkSlides.value);
  if (parsed.length) {
    slides = parsed;
    activeIndex = Math.min(activeIndex, slides.length - 1);
    els.slideCount.value = String(slides.length);
    render();
  }
}

function canvasToBlob() {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function exportAll() {
  const previous = activeIndex;
  els.exportAll.disabled = true;
  els.exportAll.textContent = "Exporting";

  const stamp = makeDateStamp();
  const slug = slugify(els.topic.value.trim() || "evocat-slides");
  const packageName = `${stamp.date}-${slug}`;
  const entries = [];
  for (let index = 0; index < slides.length; index += 1) {
    activeIndex = index;
    render();
    const blob = await canvasToBlob();
    entries.push({
      filename: `evocat-slide-${String(index + 1).padStart(2, "0")}.png`,
      data: new Uint8Array(await blob.arrayBuffer()),
    });
  }

  downloadBlob(makeZip(entries), `${packageName}.zip`);
  activeIndex = previous;
  render();
  els.exportAll.disabled = false;
  els.exportAll.textContent = "Export ZIP";
}

function makeDateStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return {
    date,
    time,
    iso: now.toISOString(),
  };
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return slug || "evocat-slides";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function makeZip(entries) {
  const encoder = new TextEncoder();
  const files = [];
  const centralDirectory = [];
  let offset = 0;
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const entry of entries) {
    const name = encoder.encode(entry.filename);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, dosTime, true);
    view.setUint16(12, dosDate, true);
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
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
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

function buildPrompt() {
  const count = Number(els.slideCount.value) || 8;
  return `Create ${count} square social slideshow positions for EvoCat, an app that helps people stop reopening distracting apps.

Topic: ${els.topic.value.trim()}

Use this TikTok-ready structure:
- Slide 1: a 5-9 word direct hook that lands in under 2 seconds.
- Middle slides: specific useful steps, one idea per slide.
- Optional middle visual: use a fake Screen Time screenshot slide when it makes the problem feel concrete.
- For the new neon cat visual style, use an [evocat-v2] block as its own slide.
- Final slide: soft EvoCat CTA that connects directly to the problem.

Copy rules:
- One idea per slide.
- Keep language direct and useful.
- No hashtags.
- No emoji.
- Avoid sounding like an ad.
- Use line breaks inside slides when useful.
- A Screen Time screenshot slide should be its own blank-line-separated slide and use this marker:
[screen-time]
average: 10h 39m
change: 11%
total: 74h 38m
days: 10h 5m, 12h 10m, 11h 20m, 7h 48m, 7h 42m, 8h 18m, 9h 4m
categories:
Social: 62h 12m
Entertainment: 5h 25m
Shopping & Food: 2h 58m
[/screen-time]
- Preferred v2 visual slide:
[evocat-v2]
mode: screen-time
headline: Is this your Screen Time?
average: 8h 58m
change: 13%
total: 62h 46m
days: 8h 40m, 9h 58m, 9h 18m, 9h 22m, 10h 45m, 9h 24m, 8h 51m
[/evocat-v2]
- Apple vs EvoCat comparison slide:
[evocat-v2]
mode: limit-compare
headline: Apple gives you an exit.|EvoCat gives you friction.
highlight: EvoCat
apple-app: Instagram
evocat-app: Instagram
evocat-name: EvoCat
[/evocat-v2]
- Last slide should be similar in tone to: If you keep going back to the same app / Try EvoCat on the App Store.

Return only the slide texts separated by one blank line.`;
}

els.draftFromTopic.addEventListener("click", () => {
  slides = makeDraft(els.topic.value, Number(els.slideCount.value) || 8);
  activeIndex = 0;
  syncBulk();
  render();
});

els.copyPrompt.addEventListener("click", async () => {
  const prompt = buildPrompt();
  await navigator.clipboard.writeText(prompt);
  els.copyPrompt.textContent = "Copied";
  setTimeout(() => {
    els.copyPrompt.textContent = "Copy AI prompt";
  }, 1200);
});

els.applySlides.addEventListener("click", applyBulk);

els.addSlide.addEventListener("click", () => {
  slides.push("New slide text");
  activeIndex = slides.length - 1;
  syncBulk();
  render();
});

els.prevSlide.addEventListener("click", () => {
  activeIndex = (activeIndex - 1 + slides.length) % slides.length;
  render();
});

els.nextSlide.addEventListener("click", () => {
  activeIndex = (activeIndex + 1) % slides.length;
  render();
});

els.exportAll.addEventListener("click", exportAll);
els.exportSize.addEventListener("change", render);
els.fontScale.addEventListener("input", render);
els.footerBrand.addEventListener("input", render);

els.slideCount.addEventListener("change", () => {
  const count = Number(els.slideCount.value) || slides.length;
  if (count > slides.length) {
    while (slides.length < count) slides.push("New slide text");
  } else {
    slides = slides.slice(0, count);
  }
  activeIndex = Math.min(activeIndex, slides.length - 1);
  syncBulk();
  render();
});

syncBulk();
render();
