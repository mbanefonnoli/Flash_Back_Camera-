// Generates public/og-image.png (1200x630) for Open Graph / social previews.
// Uses @napi-rs/canvas — pre-built binaries, no node-gyp required.
const { createCanvas } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

const W = 1200;
const H = 630;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// ── Background ──────────────────────────────────────────────────────────────
ctx.fillStyle = "#0A0A0A";
ctx.fillRect(0, 0, W, H);

// ── Film-strip bar (top) ─────────────────────────────────────────────────────
ctx.fillStyle = "#141414";
ctx.fillRect(0, 0, W, 64);
for (let x = 24; x < W - 20; x += 64) {
  ctx.fillStyle = "#0A0A0A";
  ctx.beginPath();
  ctx.roundRect(x, 12, 32, 40, 5);
  ctx.fill();
}

// ── Film-strip bar (bottom) ──────────────────────────────────────────────────
ctx.fillStyle = "#141414";
ctx.fillRect(0, H - 64, W, 64);
for (let x = 24; x < W - 20; x += 64) {
  ctx.fillStyle = "#0A0A0A";
  ctx.beginPath();
  ctx.roundRect(x, H - 52, 32, 40, 5);
  ctx.fill();
}

// ── Amber accent bar (left) ──────────────────────────────────────────────────
ctx.fillStyle = "#F5A623";
ctx.fillRect(80, 110, 6, 200);

// ── "27 EXPOSURES" label ─────────────────────────────────────────────────────
ctx.fillStyle = "#F5A623";
ctx.font = "bold 18px monospace";
ctx.fillText("▶  27 EXPOSURES", 100, 150);

// ── "Flashback" title ────────────────────────────────────────────────────────
ctx.font = "bold 128px sans-serif";
ctx.fillStyle = "#F5F5F5";
ctx.fillText("Flash", 100, 290);
const flashW = ctx.measureText("Flash").width;
ctx.fillStyle = "#F5A623";
ctx.fillText("back", 100 + flashW, 290);

// ── Tagline ──────────────────────────────────────────────────────────────────
ctx.fillStyle = "#888888";
ctx.font = "28px sans-serif";
ctx.fillText("Guests snap photos, nobody sees them until the end.", 100, 360);
ctx.fillText("Then the film develops — all at once. No app needed.", 100, 402);

// ── Bottom label ─────────────────────────────────────────────────────────────
ctx.fillStyle = "#444444";
ctx.font = "20px monospace";
ctx.fillText("flashback.app", 100, 490);

// ── Save ─────────────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, "..", "public");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const buffer = canvas.toBuffer("image/png");
fs.writeFileSync(path.join(outDir, "og-image.png"), buffer);
console.log("✓  OG image written to public/og-image.png (1200 x 630)");
