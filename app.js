const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");

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
  "Your Screen Time is high. Now what?",
  "Check your top app first\nThat is where the spiral usually starts.",
  "Don't fix the whole phone\nPick the app you reopen automatically.",
  "Protect your worst time\nBedtime, mornings, work, or study.",
  "Start with one clean hour\nNot a perfect day.",
  "Move the app out of reach\nLess visible means less automatic.",
  "The goal is not zero phone use\nThe goal is fewer automatic openings.",
  "If you keep going back to the same app\nTry EvoCat on the App Store.",
];

let activeIndex = 0;
const icon = new Image();
icon.src = "./assets/ironcat-app-icon.png";
icon.onload = render;

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
  while (fontSize >= minSize) {
    ctx.font = `900 ${fontSize}px Georgia, "Times New Roman", serif`;
    const lines = wrapText(text, maxWidth);
    if (lines.length * fontSize * lineHeightRatio <= maxHeight) {
      return { fontSize, lines };
    }
    fontSize -= 4;
  }
  ctx.font = `900 ${minSize}px Georgia, "Times New Roman", serif`;
  return { fontSize: minSize, lines: wrapText(text, maxWidth) };
}

function wrapText(text, maxWidth) {
  const paragraphs = text.split(/\n+/g).map((line) => line.trim()).filter(Boolean);
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/g);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !current) {
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

function drawMainText(text) {
  const s = getScale();
  const scale = Number(els.fontScale.value) / 100;
  const x = 344 * s;
  const y = 570 * s;
  const maxWidth = 1360 * s;
  const maxHeight = 650 * s;
  const start = 134 * s * scale;
  const min = 66 * s;
  const lineHeightRatio = 1.34;

  const fit = fitFontSize(text, maxWidth, maxHeight, start, min, lineHeightRatio);
  ctx.fillStyle = "#fffdf7";
  ctx.textBaseline = "top";
  ctx.font = `900 ${fit.fontSize}px Georgia, "Times New Roman", serif`;

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
  drawBackground();
  drawCard();
  drawMainText(slides[activeIndex] || "");
  drawFooter();
  drawIcon();
  els.activeLabel.textContent = `Slide ${activeIndex + 1}`;
  renderSlideList();
}

function renderSlideList() {
  els.slideList.innerHTML = "";
  slides.forEach((slide, index) => {
    const button = document.createElement("button");
    button.className = `slide-chip${index === activeIndex ? " is-active" : ""}`;
    button.type = "button";
    button.innerHTML = `<small>${String(index + 1).padStart(2, "0")}</small><span>${escapeHtml(slide)}</span>`;
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
  const clean = topic.trim() || "Your Screen Time is high. Now what?";
  const base = [
    clean,
    "Check your top app first\nThat is where the spiral usually starts.",
    "Don't fix the whole phone\nPick the app you reopen automatically.",
    "Protect your worst time\nBedtime, mornings, work, or study.",
    "Start with one clean hour\nNot a perfect day.",
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
      filename: `${packageName}/evocat-slide-${String(index + 1).padStart(2, "0")}.png`,
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
  return `Create ${count} square social slideshow slides for EvoCat, an app that helps people stop reopening distracting apps.

Topic: ${els.topic.value.trim()}

Use this winning structure:
- Slide 1: painful self-diagnosis question.
- Slides 2-6: specific useful steps, each with a short headline and simple action.
- Slide 7: core principle with a short memorable line.
- Slide 8: soft EvoCat CTA that connects directly to the problem.

Copy rules:
- One idea per slide.
- Keep language direct and useful.
- No hashtags.
- No emoji.
- Avoid sounding like an ad.
- Use line breaks inside slides when useful.
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
