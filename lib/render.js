const sharp = require("sharp");
const { decode } = require("./codec");

const W = 512;
const H = 384; // 4:3, same as the in-game canvas

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const byte = (v) => Math.min(255, Math.max(0, Math.round(num(v, 0))));

function strokeToSvg(stroke) {
  const [r, g, b] = Array.isArray(stroke.color) ? stroke.color : [0, 0, 0];
  const color = `rgb(${byte(r)},${byte(g)},${byte(b)})`;
  const size = Math.min(0.06, Math.max(0.004, num(stroke.size, 0.01))) * W;
  const pts = decode(typeof stroke.points === "string" ? stroke.points : "");
  if (pts.length < 2) return "";

  const xy = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    xy.push([(pts[i] * W).toFixed(1), (pts[i + 1] * H).toFixed(1)]);
  }
  if (xy.length === 1) {
    return `<circle cx="${xy[0][0]}" cy="${xy[0][1]}" r="${(size / 2).toFixed(1)}" fill="${color}"/>`;
  }
  const d = xy.map((p) => p.join(",")).join(" ");
  return `<polyline points="${d}" fill="none" stroke="${color}" stroke-width="${size.toFixed(
    1
  )}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// Returns a PNG buffer (white paper, strokes in order).
async function renderDrawing(strokes) {
  const body = (Array.isArray(strokes) ? strokes : []).map(strokeToSvg).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${body}</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

// Cheap check so blank pages don't need a model look.
function inkAmount(strokes) {
  return (Array.isArray(strokes) ? strokes : []).reduce(
    (n, s) => n + (typeof s.points === "string" ? s.points.length / 4 : 0),
    0
  );
}

module.exports = { renderDrawing, inkAmount, W, H };
