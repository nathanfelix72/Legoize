/** Classic LEGO-ish solid colors with BrickLink-style names. */
export const LEGO_PALETTE = [
  { id: 1, name: "White", hex: "#F4F4F4" },
  { id: 11, name: "Black", hex: "#1B2A34" },
  { id: 5, name: "Red", hex: "#C91A09" },
  { id: 7, name: "Blue", hex: "#0055BF" },
  { id: 3, name: "Yellow", hex: "#F2CD37" },
  { id: 6, name: "Green", hex: "#237841" },
  { id: 4, name: "Orange", hex: "#FE8A18" },
  { id: 24, name: "Purple", hex: "#81007B" },
  { id: 85, name: "Dark Bluish Gray", hex: "#6C6E68" },
  { id: 86, name: "Light Bluish Gray", hex: "#A0A5A9" },
  { id: 42, name: "Medium Blue", hex: "#5A93DB" },
  { id: 23, name: "Pink", hex: "#FC97AC" },
  { id: 2, name: "Tan", hex: "#E4CD9E" },
  { id: 8, name: "Brown", hex: "#583927" },
  { id: 34, name: "Lime", hex: "#BBE90B" },
  { id: 59, name: "Dark Red", hex: "#720E0F" },
  { id: 88, name: "Reddish Brown", hex: "#582A12" },
  { id: 14, name: "Dark Blue", hex: "#0A3463" },
  { id: 80, name: "Dark Green", hex: "#184632" },
  { id: 9, name: "Light Gray", hex: "#9BA19D" },
].map((c) => {
  const n = parseInt(c.hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return { ...c, r, g, b, lab: rgbToLab(r, g, b) };
});

function rgbToLab(r, g, b) {
  let rr = r / 255;
  let gg = g / 255;
  let bb = b / 255;
  rr = rr > 0.04045 ? ((rr + 0.055) / 1.055) ** 2.4 : rr / 12.92;
  gg = gg > 0.04045 ? ((gg + 0.055) / 1.055) ** 2.4 : gg / 12.92;
  bb = bb > 0.04045 ? ((bb + 0.055) / 1.055) ** 2.4 : bb / 12.92;

  let x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047;
  let y = (rr * 0.2126 + gg * 0.7152 + bb * 0.0722) / 1.0;
  let z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883;

  x = x > 0.008856 ? x ** (1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? y ** (1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? z ** (1 / 3) : 7.787 * z + 16 / 116;

  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

function deltaE(a, b) {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dL * dL + da * da + db * db;
}

export function nearestLego(r, g, b, palette = LEGO_PALETTE) {
  const lab = rgbToLab(r, g, b);
  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const d = deltaE(lab, c.lab);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}
