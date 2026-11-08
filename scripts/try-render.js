// Renders two fake drawings to PNG files so you can eyeball the pipeline: node scripts/try-render.js
const fs = require("fs");
const { encode } = require("../lib/codec");
const { renderDrawing } = require("../lib/render");

const circle = [];
for (let a = 0; a <= 6.4; a += 0.2) circle.push(0.5 + 0.25 * Math.cos(a), 0.5 + 0.3 * Math.sin(a));
(async () => {
  const strokes = [
    { color: [220, 40, 40], size: 0.014, points: encode(circle) },
    { color: [30, 30, 200], size: 0.03, points: encode([0.1, 0.9, 0.9, 0.9]) },
    { color: [0, 0, 0], size: 0.03, points: encode([0.5, 0.5]) },
  ];
  fs.writeFileSync("try-render.png", await renderDrawing(strokes));
  console.log("wrote try-render.png");
})();
