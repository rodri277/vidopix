// Draws the animation of a warrior resting at a campfire and exports it as a GIF with the editor's
// own GIF export. The picture is built here, layer by layer and frame by frame (sky, stars, fire
// light, warrior, fire); the editor opens it as a project and does the exporting.
// Usage: pnpm build && pnpm --filter @vidopix/web preview & pnpm campfire
import { mkdirSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const OUT = new URL('../docs/media/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const W = 96,
  H = 64,
  N = 12;
const TAU = Math.PI * 2;

// ---------- helpers ----------
const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + b[i] * t));
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const bay = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;
let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Img {
  constructor() {
    this.d = new Array(W * H).fill(null);
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H) this.d[y * W + x] = c;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < W && y < H ? this.d[y * W + x] : null;
  }
  rect(x0, y0, x1, y1, c) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c);
  }
  disc(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, c);
  }
  poly(pts, c) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys)),
      y1 = Math.ceil(Math.max(...ys));
    const xs = pts.map((p) => p[0]);
    const x0 = Math.floor(Math.min(...xs)),
      x1 = Math.ceil(Math.max(...xs));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5,
          py = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i],
            [xj, yj] = pts[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
            inside = !inside;
        }
        if (inside) this.set(x, y, c);
      }
  }
}

// ---------- palette ----------
const P = {
  sky: ['#080B1E', '#0C1230', '#121A42', '#1B2358', '#2A2F6B', '#3D3A7C', '#57468A', '#7A5496'].map(
    hex,
  ),
  moon: hex('#F2EBC7'),
  moon2: hex('#D8CFA0'),
  far: [hex('#26264F'), hex('#34346A')],
  near: [hex('#1A1A3C'), hex('#25254F')],
  mid: [hex('#101A2C'), hex('#16233A')],
  ground: [hex('#0F1722'), hex('#152030'), hex('#1C2B40'), hex('#243650')],
  tree: [hex('#08101A'), hex('#0E1A28'), hex('#142436')],
  star: [hex('#8F9BE0'), hex('#C9D2FF'), hex('#FFFFFF')],
  wood: [hex('#2A1A12'), hex('#4A2E1E'), hex('#6B4529'), hex('#8F5E35')],
  stone: [hex('#2E3446'), hex('#4A5268'), hex('#6F7A94')],
  fire: {
    deep: hex('#7A1F14'),
    red: hex('#C2321C'),
    orange: hex('#FF7A1A'),
    yellow: hex('#FFC933'),
    pale: hex('#FFF1B0'),
    ember: hex('#FF9A3C'),
  },
  smoke: [hex('#323850'), hex('#4D5472'), hex('#737A98')],
};
const WARM = hex('#FF9A4A');
const FX = 66,
  FY = 53; // fire centre and base
const LX = 66,
  LY = 47; // light source

// ---------- fire light ----------
const Ii = (f) =>
  0.82 + 0.12 * Math.sin((TAU * f) / N + 0.4) + 0.06 * Math.sin((TAU * 3 * f) / N + 1.7);
const LEVELS = 4;
function lit(c, x, y, I, strength = 0.7) {
  const d = Math.sqrt((x - LX) ** 2 + ((y - LY) * 1.45) ** 2);
  const k = Math.pow(clamp(1 - d / 36, 0, 1), 1.5) * I;
  if (k <= 0) return c;
  const v = k * LEVELS * 1.1;
  let level = Math.floor(v);
  if (v - level > 0.8 && ((x + y) & 1) === 0) level += 1;
  const m = clamp(level / LEVELS, 0, 1) * strength;
  return m <= 0 ? c : mix(c, WARM, m);
}

// ---------- static scene (unlit colours) ----------
const base = new Img();
// sky
for (let y = 0; y < 50; y++)
  for (let x = 0; x < W; x++) {
    const p = (y / 46) * 7;
    let band = Math.floor(p);
    if (p - band > 0.86 && ((x + y) & 1) === 0) band += 1;
    base.set(x, y, P.sky[clamp(band, 0, 7)]);
  }
// moon with a dithered glow
const MX = 82,
  MY = 10;
for (let y = 0; y < 30; y++)
  for (let x = 56; x < W; x++) {
    const d = Math.hypot(x - MX, y - MY);
    const cur = base.get(x, y);
    const idx = P.sky.findIndex((c) => c === cur);
    if (idx < 0) continue;
    if (d > 6.5 && d <= 9) base.set(x, y, P.sky[Math.min(7, idx + 2)]);
    else if (d > 9 && d <= 12 && ((x + y) & 1) === 0) base.set(x, y, P.sky[Math.min(7, idx + 1)]);
  }
for (let y = 0; y < 30; y++)
  for (let x = 64; x < W; x++) {
    const d = Math.hypot(x - MX, y - MY);
    const d2 = Math.hypot(x - (MX + 3.6), y - (MY - 2.6));
    if (d <= 7 && d2 > 6) base.set(x, y, d > 5.6 || y > MY + 3 ? P.moon2 : P.moon);
  }
// stars (the twinkling ones go on their own layer)
const stars = [];
for (let i = 0; i < 70; i++) {
  const x = Math.floor(rnd() * W),
    y = Math.floor(rnd() * 34);
  if (Math.hypot(x - MX, y - MY) < 16) continue;
  stars.push([x, y, rnd() < 0.25 ? 1 : 0]);
}
const twinkle = [
  [3, 4],
  [40, 24],
  [58, 21],
  [17, 28],
  [90, 26],
  [65, 5],
];
for (const [x, y, k] of stars)
  if (!twinkle.some(([tx, ty]) => Math.abs(tx - x) < 3 && Math.abs(ty - y) < 3))
    base.set(x, y, P.star[k]);
// ridges
const ridge = (b, a, ph) => (x) =>
  Math.round(
    b -
      a *
        (0.5 * Math.sin(x * 0.07 + ph) +
          0.3 * Math.sin(x * 0.17 + ph * 2.1) +
          0.2 * Math.sin(x * 0.31 + ph * 0.7)),
  );
const farR = ridge(36, 9, 1.3),
  nearR = ridge(42, 6, 4.1);
for (let x = 0; x < W; x++) {
  for (let y = farR(x); y < 52; y++) base.set(x, y, y === farR(x) ? P.far[1] : P.far[0]);
  for (let y = nearR(x); y < 52; y++) base.set(x, y, y === nearR(x) ? P.near[1] : P.near[0]);
}
// the name in the sky: gold lettering with a highlight, a shade and a dark outline
{
  const GLYPH = {
    V: ['101', '101', '101', '101', '010'],
    I: ['111', '010', '010', '010', '111'],
    D: ['110', '101', '101', '101', '110'],
    O: ['010', '101', '101', '101', '010'],
    P: ['110', '101', '110', '100', '100'],
    X: ['101', '101', '010', '101', '101'],
  };
  const X0 = 8,
    Y0 = 8,
    CELL = 2;
  const filled = new Map();
  [...'VIDOPIX'].forEach((ch, i) =>
    GLYPH[ch].forEach((row, gy2) =>
      [...row].forEach((cell, gx) => {
        if (cell !== '1') return;
        for (let dy = 0; dy < CELL; dy++)
          for (let dx = 0; dx < CELL; dx++)
            filled.set(`${X0 + i * 8 + gx * CELL + dx},${Y0 + gy2 * CELL + dy}`, [
              X0 + i * 8 + gx * CELL + dx,
              Y0 + gy2 * CELL + dy,
            ]);
      }),
    ),
  );
  const HI = hex('#FBEFC0'),
    MID = hex('#F0BE5C'),
    LO = hex('#C46F2E'),
    OUTLINE = hex('#140C2E'),
    SH = hex('#0B0720');
  for (const [x, y] of filled.values()) {
    const r = y - Y0; // 0..9
    let c = r < 3 ? HI : r < 7 ? MID : LO;
    if ((r === 3 || r === 7) && (x + y) & 1) c = r === 3 ? HI : MID;
    base.set(x, y, c);
  }
  const edge = [];
  for (const [x, y] of filled.values())
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const k = `${x + dx},${y + dy}`;
        if (!filled.has(k)) edge.push([x + dx, y + dy]);
      }
  for (const [x, y] of edge) base.set(x, y, OUTLINE);
  for (const [x, y] of filled.values()) {
    const k = `${x + 1},${y + 2}`;
    if (!filled.has(k) && !edge.some(([ex, ey]) => ex === x + 1 && ey === y + 2))
      base.set(x + 1, y + 2, SH);
  }
}
// distant pines along the horizon
const pine = (img, cx, baseY, h, w, cols) => {
  for (let i = 0; i < h; i++) {
    const half =
      Math.round((w * (i + 1)) / h) + (i % 4 === 3 ? 1 : 0) - (i % 4 === 0 && i > 0 ? 1 : 0);
    for (let x = cx - half; x <= cx + half; x++)
      img.set(
        x,
        baseY - h + 1 + i,
        x > cx + half - 1 && i % 2 === 0 ? cols[2] : x < cx - half + 1 ? cols[0] : cols[1],
      );
  }
  img.rect(cx - 1, baseY + 1, cx, baseY + 3, cols[0]);
};
for (const [x, h] of [
  [26, 9],
  [31, 12],
  [56, 9],
  [74, 10],
  [79, 8],
  [84, 12],
])
  pine(base, x, 49, h, Math.round(h / 3.3), P.mid);
// ground
const gy = (x) => 43 + Math.round(1.6 * Math.sin(x * 0.06 + 0.5)) - (x < 18 ? 2 : 0);
for (let x = 0; x < W; x++)
  for (let y = gy(x); y < H; y++) {
    const t = (y - gy(x)) / (H - gy(x));
    const idx = clamp(Math.floor(3 - t * 2.4 + (bay(x, y) - 0.5) * 1.1), 0, 3);
    base.set(x, y, P.ground[idx]);
  }
for (let i = 0; i < 90; i++) {
  const x = Math.floor(rnd() * W),
    y = 50 + Math.floor(rnd() * 13);
  if (base.get(x, y)) base.set(x, y, P.ground[rnd() < 0.5 ? 3 : 0]);
}
for (let x = 0; x < W; x += 1)
  if (rnd() < 0.3) {
    const y = gy(x);
    base.set(x, y - 1, P.ground[2]);
  }
// foreground pines (left and right)
const fg = [
  [-1, 63, 54, 10],
  [5, 63, 40, 8],
  [93, 63, 50, 10],
  [87, 63, 36, 8],
  [98, 63, 56, 10],
];
for (const [cx, by, h, w] of fg) pine(base, cx, by, h, w, P.tree);

// stones around the fire
for (const [dx, dy, r] of [
  [-11, 1, 1.6],
  [-8, 3, 1.8],
  [-3, 4, 1.7],
  [4, 4, 1.8],
  [9, 3, 1.7],
  [12, 0, 1.5],
  [-12, -1, 1.2],
]) {
  base.disc(FX + dx, FY + dy + 1, r, P.stone[1]);
  base.set(FX + dx - 1, FY + dy, P.stone[0]);
  base.set(FX + dx + 1, FY + dy, P.stone[2]);
}
// log the warrior sits on
const L0 = { x0: 20, x1: 47, y0: 47, y1: 54 };
base.poly(
  [
    [L0.x0 + 1, L0.y0 + 1],
    [L0.x1 - 1, L0.y0],
    [L0.x1, L0.y1 - 2],
    [L0.x1 - 2, L0.y1],
    [L0.x0 + 2, L0.y1],
  ],
  P.wood[1],
);
base.rect(L0.x0 + 3, L0.y0 + 1, L0.x1 - 3, L0.y0 + 1, P.wood[2]);
base.rect(L0.x0 + 2, L0.y1 - 1, L0.x1 - 2, L0.y1, P.wood[0]);
for (let x = L0.x0 + 5; x < L0.x1 - 3; x += 5) base.set(x, L0.y0 + 3, P.wood[0]);
base.disc(L0.x1 - 1, (L0.y0 + L0.y1) / 2, 2.6, P.wood[3]);
base.disc(L0.x1 - 1, (L0.y0 + L0.y1) / 2, 1.2, P.wood[2]);
base.set(L0.x1 - 1, (L0.y0 + L0.y1) / 2, P.wood[1]);
// sword planted in the ground
base.rect(17, 40, 17, 54, hex('#B8C4DA'));
base.rect(18, 40, 18, 54, hex('#7F8CA8'));
base.set(17, 55, hex('#7F8CA8'));
base.rect(14, 39, 21, 39, hex('#B8892E'));
base.set(14, 40, hex('#F0C75E'));
base.set(21, 40, hex('#B8892E'));
base.rect(17, 35, 18, 38, hex('#5A3A24'));
base.disc(17.5, 34, 1.5, hex('#F0C75E'));
// shield leaning on the log
const SC = [11, 50];
base.disc(SC[0], SC[1], 6.4, hex('#4B5570'));
base.disc(SC[0], SC[1], 5.2, hex('#8A1F2B'));
for (let y = -5; y <= 5; y++)
  for (let x = -5; x <= 5; x++)
    if (x * x + y * y <= 26 && x > 0 === y > 0 && x !== 0 && y !== 0)
      base.set(SC[0] + x, SC[1] + y, hex('#5E1620'));
base.rect(SC[0] - 5, SC[1], SC[0] + 5, SC[1], hex('#B8892E'));
base.rect(SC[0], SC[1] - 5, SC[0], SC[1] + 5, hex('#B8892E'));
base.disc(SC[0], SC[1], 1.8, hex('#F0C75E'));
base.set(SC[0], SC[1], hex('#B8892E'));
for (let a = 0; a < 16; a++)
  base.set(
    SC[0] + Math.round(Math.cos((a / 16) * TAU) * 6.4),
    SC[1] + Math.round(Math.sin((a / 16) * TAU) * 6.4),
    a < 4 || a > 11 ? hex('#7F8CA8') : hex('#2E3447'),
  );
// ---------- warrior ----------
const WARRIOR = { ox: 22, oy: 26 }; // local (0,0)
const MAT = {
  A: [hex('#2A3044'), hex('#66738F'), hex('#AAB7D3')],
  C: [hex('#3E0F18'), hex('#6E1824'), hex('#A82A38')],
  T: [hex('#171D2E'), hex('#2F3B58'), hex('#566895')],
  L: [hex('#24160E'), hex('#3F2818'), hex('#5E3C24')],
  F: [hex('#B88A78'), hex('#EFCDB9'), hex('#FFEEE0')],
  B: [hex('#2A1D17'), hex('#43301F'), hex('#6A4A30')],
  H: [hex('#2A3044'), hex('#6A7692'), hex('#B4C1DB')],
  G: [hex('#8A6420'), hex('#C79A38'), hex('#F6D878')],
  P: [hex('#6E1824'), hex('#B8303C'), hex('#E8584E')],
  E: [hex('#0A0A10'), hex('#0A0A10'), hex('#0A0A10')],
  K: [hex('#1C120C'), hex('#2C1C12'), hex('#3F2A1A')],
};
function buildWarrior(f) {
  const lift = [0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0][f];
  const headLift = lift + ([0, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0, 0][f] ? -1 : 0);
  const blink = f === 8;
  const S = new Img(); // pixels hold { m: material, z: paint order }
  let z = 0;
  const orig = S.set.bind(S);
  S.set = (x, y, m) => orig(x, y, { m, z });
  S.poly = ((poly) =>
    function (pts, m) {
      z++;
      return poly.call(this, pts, m);
    })(S.poly);
  S.disc = ((disc) =>
    function (cx, cy, r, m) {
      z++;
      return disc.call(this, cx, cy, r, m);
    })(S.disc);
  const L = (x, y) => [WARRIOR.ox + x, WARRIOR.oy + y];
  const poly = (pts, c, dy = 0, dx = 0) =>
    S.poly(
      pts.map(([x, y]) => L(x + dx, y + dy)),
      c,
    );
  const disc = (x, y, r, c, dy = 0) => {
    const [px, py] = L(x, y + dy);
    S.disc(px, py, r, c);
  };
  // cape behind
  poly(
    [
      [8, 10],
      [5, 13],
      [2, 18],
      [1, 24],
      [2, 27],
      [9, 27],
      [10, 21],
      [11, 13],
    ],
    'C',
    0,
  );
  poly(
    [
      [8, 10],
      [6, 13],
      [4, 18],
      [3, 23],
    ],
    'C',
    lift * 0,
  ); // keep
  // far leg
  poly(
    [
      [14, 21],
      [18, 21],
      [19, 26],
      [15, 26],
    ],
    'T',
  );
  poly(
    [
      [14, 26],
      [20, 26],
      [20, 27],
      [14, 27],
    ],
    'L',
  );
  // thigh + shin
  poly(
    [
      [8, 18],
      [20, 17],
      [23, 19],
      [22, 22],
      [9, 22],
    ],
    'T',
  );
  poly(
    [
      [20, 20],
      [24, 20],
      [25, 25],
      [21, 26],
      [19, 26],
    ],
    'A',
  );
  poly(
    [
      [18, 25],
      [26, 25],
      [26, 27],
      [18, 27],
    ],
    'L',
  );
  poly(
    [
      [21, 17],
      [24, 19],
      [24, 21],
      [21, 21],
    ],
    'A',
  ); // knee cop
  // torso
  poly(
    [
      [9, 10],
      [16, 10],
      [18, 13],
      [18, 17],
      [15, 20],
      [8, 20],
      [7, 15],
    ],
    'A',
    lift,
  );
  poly(
    [
      [8, 19],
      [17, 19],
      [17, 21],
      [8, 21],
    ],
    'K',
  );
  poly(
    [
      [11, 12],
      [16, 12],
      [16, 13],
      [11, 13],
    ],
    'G',
    lift,
  );
  // upper arm + forearm
  disc(11, 11, 2.7, 'A', lift);
  poly(
    [
      [9, 10],
      [13, 9],
      [13, 11],
      [9, 12],
    ],
    'G',
    lift,
  );
  poly(
    [
      [10, 12],
      [14, 12],
      [16, 17],
      [13, 18],
      [10, 14],
    ],
    'A',
    lift,
  );
  poly(
    [
      [13, 17],
      [21, 16],
      [22, 18],
      [14, 20],
    ],
    'L',
    Math.round(lift / 2),
  );
  disc(22, 17, 1.7, 'F', Math.round(lift / 2));
  // head
  const hl = headLift;
  poly(
    [
      [9, 4],
      [9, 10],
      [12, 10],
      [12, 5],
    ],
    'H',
    hl,
  ); // neck guard
  S.poly(
    [
      [13.5, 0.6],
      [17.5, 2.2],
      [18, 5],
      [17.5, 8.5],
      [13, 9.5],
      [10, 7],
      [9.5, 3.5],
    ].map(([x, y]) => L(x, y + hl)),
    'F',
  );
  poly(
    [
      [12.5, 0.2],
      [17, 1.6],
      [17.6, 4.4],
      [9.3, 4.4],
      [9.3, 2.5],
    ],
    'H',
    hl,
  ); // helmet dome
  poly(
    [
      [9, 4.2],
      [18, 4.2],
      [18, 5],
      [9, 5],
    ],
    'G',
    hl,
  );
  poly(
    [
      [16, 4.5],
      [17, 4.5],
      [17, 8],
      [16, 8],
    ],
    'H',
    hl,
  ); // nasal
  poly(
    [
      [10, 5],
      [12.5, 5],
      [12.5, 8],
      [10, 9],
    ],
    'H',
    hl,
  ); // cheek guard
  poly(
    [
      [12.5, 7.5],
      [18, 7.5],
      [18, 10.5],
      [15.5, 12.5],
      [12.5, 11],
    ],
    'B',
    hl,
  );
  S.set(...L(15, 6 + hl), blink ? 'F' : 'E');
  S.set(...L(18, 6 + hl), 'F');
  // plume
  const sway = (x) => Math.round(Math.sin((TAU * f) / N + (14 - x) * 0.35) * 1.1);
  const plume = [
    [12, 1],
    [9, -0.5],
    [5, 0],
    [2, 3],
    [1, 6],
    [4, 6.5],
    [7, 5],
    [11, 3.5],
  ].map(([x, y]) => [x, y + sway(x) * (x < 10 ? 1 : 0) + hl]);
  poly(plume, 'P');
  return S;
}
function shadeWarrior(S, f) {
  const out = new Img();
  const I = Ii(f);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = S.get(x, y);
      if (!px) continue;
      const m = px.m;
      const ramp = MAT[m];
      if (!ramp) continue;
      const nl = S.get(x - 1, y),
        nr = S.get(x + 1, y),
        nt = S.get(x, y - 1),
        nb = S.get(x, y + 1);
      const behind = (n) => n && n.z < px.z && n.m !== m;
      let c = ramp[1];
      if (!nl || !nb || !nt || behind(nl) || behind(nb) || behind(nt)) c = ramp[0];
      else if (!nr || behind(nr)) c = ramp[2];
      else if (y - WARRIOR.oy > 19 && (x + y) & 1) c = ramp[0];
      else if (x - WARRIOR.ox > 13 && bay(x, y) < 0.3) c = ramp[2];
      const rim = !nr || behind(nr);
      const rel = clamp((x - WARRIOR.ox) / 24, 0, 1);
      const m2 = (rim ? 0.5 : 0.1 + 0.22 * rel) * I * (m === 'E' ? 0 : 1);
      const q = Math.floor(m2 * 4 + 0.5) / 4;
      out.set(x, y, q > 0 ? mix(c, WARM, q * 0.9) : c);
    }
  return out;
}

// ---------- fire ----------
function buildFire(f) {
  const img = new Img();
  const t = f / N;
  // smoke: soft puffs that rise, grow and thin out well below the moon
  for (let k = 0; k < 3; k++) {
    const ph = ((f + k * 4) % N) / N;
    const cx = FX + 3 + ph * 9 + Math.sin(ph * TAU + k * 2) * 1.5,
      cy = FY - 21 - ph * 15,
      r = 2 + ph * 3.6;
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        const solid = d < r * 0.55 && ph < 0.45;
        if (!solid && bay(x, y) > (1 - d / r) * 1.6 * (1 - ph * 0.9)) continue;
        img.set(x, y, P.smoke[ph < 0.3 ? 2 : ph < 0.65 ? 1 : 0]);
      }
  }
  // flame
  const h = Math.round(19 + 2.6 * Math.sin(TAU * 2 * t + 0.5) + 1.4 * Math.sin(TAU * 3 * t));
  const flame = (cx, hh, phase, wScale) => {
    const layers = [
      { c: P.fire.deep, wid: 5.4 * wScale, top: hh, edge: true },
      { c: P.fire.red, wid: 4.6 * wScale, top: hh * 0.92 },
      { c: P.fire.orange, wid: 3.6 * wScale, top: hh * 0.78 },
      { c: P.fire.yellow, wid: 2.4 * wScale, top: hh * 0.56 },
      { c: P.fire.pale, wid: 1.3 * wScale, top: hh * 0.32 },
    ];
    for (const L of layers)
      for (let r = 0; r < L.top; r++) {
        const half = Math.max(0, Math.round(L.wid * (1 - Math.pow(r / L.top, 1.55))));
        const dx = Math.round(Math.sin(phase + r * 0.42) * (r / 6.5));
        const y = FY - 1 - r;
        for (let x = cx - half + dx; x <= cx + half + dx; x++) {
          const edge = x === cx - half + dx || x === cx + half + dx;
          if (edge && r > L.top * 0.55 && bay(x, y) > 0.55) continue; // ragged tips
          img.set(x, y, L.c);
        }
      }
  };
  flame(FX, h, TAU * t * 1, 1);
  flame(FX - 5, Math.round(h * 0.52), TAU * t * 1 + 2, 0.7);
  flame(FX + 5, Math.round(h * 0.46), TAU * t * 1 + 4, 0.65);
  // logs in front of the flame
  img.poly(
    [
      [FX - 11, FY + 2],
      [FX - 9, FY - 2],
      [FX + 7, FY + 1],
      [FX + 6, FY + 4],
    ],
    P.wood[1],
  );
  img.poly(
    [
      [FX + 12, FY + 2],
      [FX + 10, FY - 2],
      [FX - 6, FY + 1],
      [FX - 5, FY + 4],
    ],
    P.wood[2],
  );
  img.rect(FX - 9, FY, FX + 5, FY, P.wood[0]);
  img.disc(FX - 11, FY + 1.5, 1.6, P.wood[3]);
  img.disc(FX + 12, FY + 1.5, 1.6, P.wood[3]);
  // glowing coals
  for (let i = 0; i < 9; i++) {
    const x = FX - 8 + i * 2,
      on = Math.sin(TAU * t * 2 + i * 1.9) > -0.2;
    if (on) img.set(x, FY + 1 + (i % 2), i % 3 === 0 ? P.fire.yellow : P.fire.ember);
  }
  // sparks
  for (let i = 0; i < 6; i++) {
    const ph = ((f + i * 5) % N) / N;
    if (ph > 0.88) continue;
    const x = FX + Math.round((i % 2 ? 1 : -1) * (2 + ph * (6 + i)) + Math.sin(ph * 9 + i) * 1.4);
    const y = FY - h * 0.55 - ph * 24;
    img.set(x, y, ph < 0.3 ? P.fire.pale : ph < 0.6 ? P.fire.ember : P.fire.red);
    if (ph < 0.25) img.set(x, y + 1, P.fire.orange);
  }
  return img;
}

// ---------- compose the layers and frames ----------
const toBytes = (img) => {
  const bytes = new Uint8Array(W * H * 4);
  img.d.forEach((c, i) => {
    if (c) bytes.set([c[0], c[1], c[2], 255], i * 4);
  });
  return bytes;
};
const I0 = 0.82;
const scene = new Img();
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const c = base.get(x, y);
    if (c) scene.set(x, y, lit(c, x, y, I0));
  }
const order = ['Scene', 'Stars', 'Light', 'Warrior', 'Fire'];
const layers = Object.fromEntries(order.map((name) => [name, []]));
for (let f = 0; f < N; f++) {
  layers.Scene.push(toBytes(scene));
  const sky = new Img();
  twinkle.forEach(([x, y], i) => {
    if ((f + i * 2) % N < 2) {
      sky.set(x, y, P.star[2]);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        sky.set(x + dx, y + dy, P.star[0]);
    } else sky.set(x, y, P.star[0]);
  });
  layers.Stars.push(toBytes(sky));
  // Only the pixels whose light changes this frame; the rest comes from the scene layer.
  const light = new Img();
  const I = Ii(f);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = base.get(x, y);
      if (!c) continue;
      const now = lit(c, x, y, I);
      if (now.join() !== scene.get(x, y).join()) light.set(x, y, now);
    }
  layers.Light.push(toBytes(light));
  layers.Warrior.push(toBytes(shadeWarrior(buildWarrior(f), f)));
  layers.Fire.push(toBytes(buildFire(f)));
}

// ---------- a .vidopix project, opened and exported by the editor ----------
const project = JSON.stringify({
  format: 'vidopix',
  schemaVersion: 2,
  sprite: {
    id: 'campfire',
    name: 'Warrior at the campfire',
    width: W,
    height: H,
    palette: { id: 'palette', name: 'Campfire', colors: [] },
    frames: Array.from({ length: N }, (_, i) => ({ id: `frame-${i}`, duration: 110 })),
    layers: order.map((name, i) => ({
      id: `layer-${i}`,
      name,
      visible: true,
      locked: false,
      opacity: 1,
      cels: layers[name].map((bytes) => Buffer.from(bytes).toString('base64')),
    })),
  },
});

const { chromium } = createRequire(new URL('../apps/web/', import.meta.url))('@playwright/test');
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: 'en-US',
  acceptDownloads: true,
  // A first visit opens a size dialog; this starts as someone who has seen it.
  storageState: {
    cookies: [],
    origins: [
      { origin: 'http://localhost:4173', localStorage: [{ name: 'vidopix.welcomed', value: '1' }] },
    ],
  },
});
const page = await context.newPage();
await page.goto('http://localhost:4173/');
const surface = page.getByRole('application');
await surface.waitFor();
await surface.focus();
const chooser = page.waitForEvent('filechooser');
await page.keyboard.press('ControlOrMeta+o');
await (
  await chooser
).setFiles({
  name: 'campfire.vidopix',
  mimeType: 'application/json',
  buffer: Buffer.from(project),
});
await page.getByRole('contentinfo').getByText(`${W}×${H} px`).waitFor();
await page
  .getByRole('list', { name: 'Frames' })
  .getByRole('listitem')
  .nth(N - 1)
  .waitFor();

await surface.focus();
await page.keyboard.press('ControlOrMeta+e');
const dialog = page.getByRole('dialog', { name: 'Export' });
await dialog.getByLabel('Format').selectOption({ label: 'Animated GIF' });
await dialog.getByLabel('Scale').fill('6');
const download = page.waitForEvent('download');
await dialog.getByRole('button', { name: 'Export' }).click();
copyFileSync(await (await download).path(), join(OUT, 'campfire.gif'));
await dialog.waitFor({ state: 'hidden' });
await browser.close();
console.warn(`Wrote ${join(OUT, 'campfire.gif')}`);
