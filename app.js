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
  "[screen-time]\naverage: 10h 39m\nchange: 11%\ntotal: 74h 38m\ndays: 10h 5m, 12h 10m, 11h 20m, 7h 48m, 7h 42m, 8h 18m, 9h 4m\ncategories:\nSocial: 62h 12m\nEntertainment: 5h 25m\nShopping & Food: 2h 58m\n[/screen-time]",
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
  const screenTime = parseScreenTimeSlide(slide);
  if (screenTime) {
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
    const screenTime = parseScreenTimeSlide(slide);
    const label = screenTime ? `Screen Time mockup (${screenTime.average})` : slide;
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
    "[screen-time]\naverage: 10h 39m\nchange: 11%\ntotal: 74h 38m\ndays: 10h 5m, 12h 10m, 11h 20m, 7h 48m, 7h 42m, 8h 18m, 9h 4m\ncategories:\nSocial: 62h 12m\nEntertainment: 5h 25m\nShopping & Food: 2h 58m\n[/screen-time]",
    "Protect your worst time\nBedtime, mornings, work, or study.",
    "Start with one clean hour\nNot a perfect day.",
    "Don't fix the whole phone\nPick the app you reopen automatically.",
    "Move the app out of reach\nLess visible means less automatic.",
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
