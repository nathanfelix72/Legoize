import { nearestLego } from "./palette.js";

/**
 * Photo → solid LEGO figure.
 * Thickness comes from distance-to-edge (rounded body), not a flat image extrusion.
 * Bricks are mirrored front/back around the center so the form reads as a freestanding build.
 */
export function imageToMosaic(image, options = {}) {
  const width = Math.max(4, Math.min(56, options.width ?? 28));
  const maxDepth = Math.max(2, Math.min(18, options.maxDepth ?? 10));
  const knockBackground = options.knockBackground !== false;
  const bgThreshold = options.bgThreshold ?? 40;
  const aspect = image.height / image.width;
  const height = Math.max(1, Math.round(width * aspect));

  const sample = document.createElement("canvas");
  sample.width = width;
  sample.height = height;
  const ctx = sample.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const bg = estimateBackground(data, width, height);
  const raw = [];

  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const a = data[o + 3];
    const x = i % width;
    const y = Math.floor(i / width);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    const transparent = a < 12;
    const isBg =
      knockBackground &&
      !transparent &&
      colorDist(r, g, b, bg.r, bg.g, bg.b) <= bgThreshold;

    raw.push({
      x,
      y,
      r,
      g,
      b,
      lum,
      empty: transparent || isBg,
    });
  }

  refineMask(raw, width, height);

  // Chamfer distance to background → rounded mass (thick in the middle, thin at edges)
  const dist = distanceToBackground(raw, width, height);
  let maxDist = 0;
  for (let i = 0; i < dist.length; i++) {
    if (!raw[i].empty) maxDist = Math.max(maxDist, dist[i]);
  }
  maxDist = Math.max(maxDist, 1);

  // Slight blur on distance field for smoother, rounder contours
  const smoothDist = boxBlurMasked(dist, raw, width, height, 1);

  const cells = [];
  const counts = new Map();

  for (let i = 0; i < raw.length; i++) {
    const px = raw[i];
    if (px.empty) continue;

    const color = nearestLego(px.r, px.g, px.b);
    const n = Math.min(1, smoothDist[i] / maxDist);
    // Ease-out curve → plump rounded cross-section instead of a cone
    const round = Math.sin(n * (Math.PI / 2));
    // Half-depth from center; full span is odd so there is a center brick
    const half = Math.max(1, Math.round(round * Math.floor(maxDepth / 2)));
    const depth = half * 2 - 1;

    // z offsets centered on 0: e.g. depth 5 → [-2,-1,0,1,2]
    const zOffsets = [];
    for (let z = -half + 1; z <= half - 1; z++) zOffsets.push(z);

    cells.push({
      x: px.x,
      y: px.y,
      color,
      lum: px.lum,
      depth,
      half,
      zOffsets,
      layers: depth,
    });
    counts.set(color.id, (counts.get(color.id) || 0) + depth);
  }

  const colorById = new Map(cells.map((c) => [c.color.id, c.color]));
  const parts = [...counts.entries()]
    .map(([id, qty]) => ({ ...colorById.get(id), qty }))
    .sort((a, b) => b.qty - a.qty);

  return {
    width,
    height,
    cells,
    parts,
    totalBricks: cells.reduce((sum, c) => sum + c.depth, 0),
    mode: "figure",
    maxDepth,
  };
}

/** Chessboard / chamfer distance transform to nearest empty cell. */
function distanceToBackground(raw, width, height) {
  const INF = width + height;
  const d = new Float32Array(width * height);

  for (let i = 0; i < raw.length; i++) {
    d[i] = raw[i].empty ? 0 : INF;
  }

  // Forward pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y > 0) d[i] = Math.min(d[i], d[i - width] + 1);
      if (x > 0 && y > 0) d[i] = Math.min(d[i], d[i - width - 1] + 1.414);
      if (x < width - 1 && y > 0) d[i] = Math.min(d[i], d[i - width + 1] + 1.414);
    }
  }

  // Backward pass
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      if (x < width - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y < height - 1) d[i] = Math.min(d[i], d[i + width] + 1);
      if (x < width - 1 && y < height - 1) {
        d[i] = Math.min(d[i], d[i + width + 1] + 1.414);
      }
      if (x > 0 && y < height - 1) {
        d[i] = Math.min(d[i], d[i + width - 1] + 1.414);
      }
    }
  }

  return d;
}

function boxBlurMasked(dist, raw, width, height, radius) {
  const out = new Float32Array(dist.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (raw[i].empty) {
        out[i] = 0;
        continue;
      }
      let sum = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (raw[j].empty) continue;
          sum += dist[j];
          n++;
        }
      }
      out[i] = n ? sum / n : dist[i];
    }
  }
  return out;
}

function estimateBackground(data, width, height) {
  const samples = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
    Math.floor(width / 2) * 4,
    ((height - 1) * width + Math.floor(width / 2)) * 4,
    Math.floor(height / 2) * width * 4,
    (Math.floor(height / 2) * width + (width - 1)) * 4,
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const o of samples) {
    r += data[o];
    g += data[o + 1];
    b += data[o + 2];
  }
  const n = samples.length;
  return { r: r / n, g: g / n, b: b / n };
}

function colorDist(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function neighbors(raw, width, height, x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      out.push(raw[ny * width + nx]);
    }
  }
  return out;
}

function refineMask(raw, width, height) {
  for (const px of raw) {
    if (px.empty) continue;
    const n = neighbors(raw, width, height, px.x, px.y);
    if (n.filter((p) => !p.empty).length <= 1) px.empty = true;
  }
  for (const px of raw) {
    if (!px.empty) continue;
    const n = neighbors(raw, width, height, px.x, px.y);
    if (n.filter((p) => !p.empty).length >= 6) {
      px.empty = false;
      const donor = n.find((p) => !p.empty);
      if (donor) {
        px.r = donor.r;
        px.g = donor.g;
        px.b = donor.b;
        px.lum = donor.lum;
      }
    }
  }
}

/** Ground-up build steps (image bottom first). */
export function buildSteps(mosaic) {
  const byRow = new Map();
  for (const cell of mosaic.cells) {
    if (!byRow.has(cell.y)) byRow.set(cell.y, []);
    byRow.get(cell.y).push(cell);
  }

  const rows = [...byRow.keys()].sort((a, b) => b - a);
  return rows.map((row, i) => {
    const rowCells = byRow.get(row);
    const rowParts = new Map();
    for (const cell of rowCells) {
      rowParts.set(cell.color.id, (rowParts.get(cell.color.id) || 0) + cell.depth);
    }
    return {
      step: i + 1,
      row,
      label: `Level ${i + 1} (from ground)`,
      cells: rowCells,
      parts: [...rowParts.entries()].map(([id, qty]) => {
        const color = rowCells.find((c) => c.color.id === id).color;
        return { ...color, qty };
      }),
    };
  });
}

export function drawMosaicCanvas(canvas, mosaic, options = {}) {
  const cellSize = options.cellSize ?? 18;
  const builtThroughRow = options.builtThroughRow;
  const ctx = canvas.getContext("2d");
  canvas.width = mosaic.width * cellSize;
  canvas.height = mosaic.height * cellSize;

  ctx.fillStyle = "#0e1012";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const cell of mosaic.cells) {
    // Progressive preview: only rows from ground through current step
    if (builtThroughRow !== undefined && cell.y < builtThroughRow) continue;

    const { r, g, b } = cell.color;
    const x = cell.x * cellSize;
    const y = cell.y * cellSize;
    const depthT = cell.depth / (mosaic.maxDepth || cell.depth);
    const shade = 0.65 + 0.35 * depthT;
    ctx.fillStyle = `rgb(${Math.round(r * shade)},${Math.round(g * shade)},${Math.round(b * shade)})`;
    ctx.fillRect(x, y, cellSize, cellSize);

    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = Math.max(1, cellSize * 0.06);
    ctx.stroke();

    if (builtThroughRow !== undefined && cell.y === builtThroughRow) {
      ctx.strokeStyle = "rgba(255, 214, 10, 0.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
    }
  }
}
