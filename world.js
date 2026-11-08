/* Nestville world: terrain math, lake, mountains, river and the town layout */
export const sm = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
export const mix = (a, b, t) => a + (b - a) * t;
const h2 = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return mix(mix(h2(xi, yi), h2(xi + 1, yi), u), mix(h2(xi, yi + 1), h2(xi + 1, yi + 1), u), v);
}
export function fbm(x, y, o = 4) {
  let a = .5, s = 0, f = 1, t = 0;
  for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); t += a; f *= 2.03; a *= .5; }
  return s / t;
}

export const B = { x0: -590, x1: 590, z0: -560, z1: 570 }; /* world bounds */
export const TOWN = { x0: -175, x1: 175, z0: -80, z1: 195 }; /* town rect: canals, quays, colour detail */
export const WL = .3; /* water level of lake and canals */
const LAKE = { cx: 0, cz: -88, rx: 175, rz: 98 };
export const lakeE = (x, z) => Math.hypot((x - LAKE.cx) / LAKE.rx, (z - LAKE.cz) / LAKE.rz) + (fbm(x * .017 + 5, z * .017 + 9, 3) - .5) * .2;

export function baseH(x, z) {
  const e = lakeE(x, z);
  let h = -8 + sm(.86, 1.0, e) * 8.8;
  const land = sm(.97, 1.1, e);
  const hills = sm(150, 235, z); /* the flat town plateau ends here, hills begin */
  const south = 2.1 + Math.max(0, z - 150) * .16 + Math.max(0, z - 235) * .14;
  h += land * (south + (fbm(x * .02 + 1, z * .02 + 4, 3) - .5) * (1.6 + 7 * hills) * sm(0, 60, z) + (fbm(x * .05, z * .05, 2) - .5) * (.9 + 1.6 * hills));
  /* mountains: lower than before and much farther from the village */
  const mm = Math.max(sm(-405, -525, z), sm(375, 505, Math.abs(x)), sm(395, 515, z)) * sm(1.0, 1.35, e); /* wide flat meadow between the village and the mountains */
  if (mm > 0) {
    const r = 1 - Math.abs(2 * fbm(x * .0075 + 11, z * .0075 + 5, 5) - 1);
    h += mm * (16 + r * r * 84 * (.55 + .45 * fbm(x * .004 + 30, z * .004 + 2, 2)) + fbm(x * .03, z * .03, 3) * 12);
  }
  h += sm(525, 585, Math.max(Math.abs(x), Math.abs(z))) * 100;
  return h;
}
export function shoreZ(x) {
  for (let z = -70; z < 70; z += .5) if (baseH(x, z) > .3) return z;
  return 0;
}
export const sz = x => (shoreZ(x - 10) + shoreZ(x) + shoreZ(x + 10)) / 3;

/* pads: flat platforms for buildings and landforms */
export const pads = [];
export function addPad(x, z, r, h, blend = 5) { pads.push({ x, z, r, h: h === undefined ? baseH(x, z) : h, b: blend }); }

/* river */
export const xr = z => 12 + 9 * Math.sin(z * .05 + .9);
export const RIVER_Z0 = 140, RIVER_Z1 = 206; /* the river is the main canal in town; this is the wild stretch upstream */
const riverSurf = z => mix(WL, Math.max(baseH(xr(z), z) - .5, WL), sm(138, 185, z));
const RS = []; for (let z = 0; z <= 260; z += 2) RS.push(riverSurf(z));
export const Rs = z => { const t = Math.min(Math.max(z, 0), 258) / 2, i = Math.floor(t); return mix(RS[i], RS[Math.min(i + 1, 129)], t - i); };

export function H(x, z) {
  let h = baseH(x, z);
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i], dx = x - p.x, dz = z - p.z, d2 = dx * dx + dz * dz, R = p.r + p.b;
    if (d2 > R * R) continue;
    const w = 1 - sm(p.r, R, Math.sqrt(d2));
    h = mix(h, p.h, w);
  }
  if (z > 135) {
    const d = Math.abs(x - xr(z));
    if (d < 7) h = mix(h, Math.min(h, Rs(z) - 1.3), 1 - sm(3.2, 6.8, d));
  }
  if (x > TOWN.x0 - 10 && x < TOWN.x1 + 10 && z > TOWN.z0 - 20 && z < TOWN.z1) {
    const cd = canalDist(x, z);
    if (cd < 2) h = mix(h, Math.min(h, -1.7), 1 - sm(0, 2, cd));
  }
  return h;
}

/* canals: the streets of Nestville. each is {pts, w(half width)} */
export const canals = [];
export function addCanal(pts, w) {
  let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
  pts.forEach(p => { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); bz0 = Math.min(bz0, p[1]); bz1 = Math.max(bz1, p[1]); });
  const m = w + 6; canals.push({ pts, w, bx0: bx0 - m, bx1: bx1 + m, bz0: bz0 - m, bz1: bz1 + m });
}
export function canalDist(x, z) { /* distance to the nearest canal edge (negative inside the water) */
  let best = 99;
  for (const c of canals) {
    if (x < c.bx0 || x > c.bx1 || z < c.bz0 || z > c.bz1) continue;
    const d = polyDist(c.pts, x, z) - c.w; if (d < best) best = d;
  }
  return best;
}
const PITCH = 21, NROWS = 6; /* row spacing: was 18.5, opened up so a street fits behind every row of houses */
export const laneZ = (r, x) => sz(x) + 16 + r * PITCH + 3 * Math.sin(x * .045 + r * .3);

/* ---------- STREETS (step 1 of the "like the photo" makeover) ----------
   The E-W canal is gone. Every row now has an asphalt street running in front of its sidewalk, and a few narrow cross streets run N-S
   through the gaps between houses (gap centres of the 16.5 spacing), so the blocks look like the photo. The river stays as the one canal.
   ROAD_W: width of every street. ROAD_OFF: street centre relative to laneZ (so the street edge touches the row sidewalk).
   XSTREETS: x of the cross streets. XW: their half width. To add or move one, edit XSTREETS (use a house-gap centre: -151.75 + 16.5 * k). */
export const ROAD_W = 4.6, ROAD_OFF = -2.6, XW = 2.0;
export const XSTREETS = [-118.75, -69.25, 46.25, 95.75];
export const roadZ = (r, x) => laneZ(r, x) + ROAD_OFF;
/* is (x, z) closer than m to a cross street (only counting the stretch between the first and the last row street)? */
/* how far (>= 0) a footprint (half depth hd, half width 4.8) whose centre is (x, z) in row r pokes into the street behind it (row r + 1).
   Houses and shops are moved that far toward their own sidewalk (their .n), and their garden path gets longer by the same amount. */
export const backOverlap = (x, z, r, hd) => {
  if (r >= NROWS) return 0; let worst = 0;
  for (const dx of [-4.8, -2.4, 0, 2.4, 4.8]) worst = Math.max(worst, (z + hd + .3) - (roadZ(r + 1, x + dx) - ROAD_W / 2));
  return Math.min(3, worst);
};
export const crossBlock = (x, z, m) => XSTREETS.some(X => Math.abs(x - X) < XW + m && z > roadZ(0, X) - 4 && z < roadZ(NROWS, X) + 4);

/* road mask (only the lakeside promenade is paved now) */
export const roads = []; /* each: array of [x,z] */
export function polyDist(pl, x, z) {
  let best = 99;
  for (let i = 0; i < pl.length - 1; i++) {
    const ax = pl[i][0], az = pl[i][1], bx = pl[i + 1][0], bz = pl[i + 1][1], vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz + 1e-6)));
    const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
    if (d < best) best = d;
  }
  return best;
}
export function roadDist(x, z) {
  let best = 99;
  for (const pl of roads) { const d = polyDist(pl, x, z); if (d < best) best = d; }
  return best;
}
export const plazas = []; /* {x,z,r} */

/* ---------- layout ---------- */
const LAKE0 = { x: 0, z: -88 };
export const L = { houses: [], pent: [], shops: [], cot: [], castles: [], church: null, plaza: null, pier: null, yachtPier: null, bridge: null, towers: [], walks: [], bridges: [], fbr: [] };

export function layout() {
  const z0 = sz(0);
  /* the river is the main canal through the village */
  const rv = []; for (let z = z0 + 1; z <= 142; z += 4) rv.push([xr(z), z]);
  addCanal(rv, 3.3);

  /* church + plaza */
  const cx = -16, cz = z0 + 41;
  L.church = { x: cx, z: cz, yaw: Math.PI, name: 'Village church', k: 'church', w: 10, d: 18, hgt: 52, r: 12 };
  L.plaza = { x: cx, z: cz - 15, r: 10 };
  plazas.push(L.plaza);
  addPad(cx, cz + 1, 11, undefined, 6);
  addPad(L.plaza.x, L.plaza.z, 9, undefined, 5);

  /* three more little squares with a fountain (a jet of water that rises and falls back into the pool, see extras.js).
     Each one sits in the strip between two sidewalks, so a sidewalk runs along both its sides. [row, x]. Houses and shops keep clear of them. */
  L.squares = [];
  for (const [r, x] of [[1, -104], [3, 76], [4, -52]]) {
    const q = { x, z: laneZ(r, x) + 9.6, r: 8 };
    L.squares.push(q); plazas.push(q);
    addPad(q.x, q.z, 7, undefined, 5);
  }
  const nearSquare = (x, z, m) => L.squares.some(q => Math.hypot(x - q.x, z - q.z) < q.r + m);

  /* castles */
  const lc = { x: -68, z: z0 - 12 }; /* lakeside peninsula castle */
  addPad(lc.x, lc.z, 14, 3.6, 12);
  L.castles.push({ id: 'lake', x: lc.x, z: lc.z, y: 3.6, name: 'Lakeside castle', k: 'castle', w: 26, d: 22, hgt: 44, r: 20, yaw: 0 });
  const ex = 180, ez = 64, eh = baseH(ex, ez) + 8;
  addPad(ex, ez, 18, eh, 14);
  L.castles.push({ id: 'east', x: ex, z: ez, y: eh, name: 'Hilltop citadel', k: 'castle', w: 30, d: 30, hgt: 50, r: 24, yaw: 0 });
  addPad(50, -62, 9, 2.7, 10);
  L.castles.push({ id: 'island', x: 50, z: -62, y: 2.7, name: 'Island keep', k: 'castle', w: 20, d: 16, hgt: 36, r: 13, yaw: .4 });
  const tx = 124, tzz = shoreZ(124) + 2;
  addPad(tx, tzz, 5, 2.6, 7);
  L.castles.push({ id: 'tower', x: tx, z: tzz, y: 2.6, name: 'Old watchtower', k: 'castle', w: 8, d: 8, hgt: 28, r: 6, yaw: 0 });

  /* promenade strip (the shops now live inside the town, see below) */
  roads.push(Array.from({ length: 14 }, (_, i) => { const x = -52 + i * 8; return [x, sz(x) + 2.2]; }));
  /* piers: the village pier and the yacht club pier */
  const px = -6; L.pier = { x: px, z0: sz(px) + 1, len: 24 };
  L.yachtPier = { x: 88, z0: sz(88) + 1, len: 34 };

  /* only ONE east-west canal is left: it runs along the lakeside edge of the village. rows 1 to 6 are plain sidewalks now,
     and the river is the canal that divides the village in two. */
  /* (the E-W canal that used to run here is gone: it is the row-0 street now, see the STREETS block at the end of layout()) */

  /* penthouses: two groups either side of the river, facing the last canal. 8 floors tall */
  const zr = z0 + 16 + NROWS * PITCH + 9.8, xrr = xr(zr);
  const xs = [];
  for (let k = 0; k < 5; k++) { xs.push(xrr - 22 - k * 17); xs.push(xrr + 22 + k * 17); }
  xs.sort((a, b) => a - b);
  xs.forEach((x, i) => {
    const z = laneZ(NROWS, x) + 9.8 + (((i * 37) % 5) - 2) * .8;
    const h = baseH(x, z) + .4;
    addPad(x, z, 8.5, h, 6);
    L.pent.push({ i, x, z, y: h, yaw: Math.PI + ((i % 3) - 1) * .06, name: 'Penthouse ' + (i + 1), k: 'ph', w: 11, d: 9, hgt: 61 });
  });

  /* shops: spread through the town between the houses, never next to each other */
  const shopOK = (x, z) => Math.abs(x - xr(z)) > 16 && Math.hypot(x - cx, z - cz) > 28 && Math.hypot(x - L.plaza.x, z - L.plaza.z) > 20 &&
    Math.hypot(x - lc.x, z - lc.z) > 30 && baseH(x, z) > 1.2 && canalDist(x, z) > 5 && !nearSquare(x, z, 9) && !crossBlock(x, z, 9) &&
    !L.pent.some(p => Math.hypot(x - p.x, z - p.z) < 17) && !L.castles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 10);
  const tryShop = (r, x, gap) => {
    if (L.shops.length >= 6) return;
    let z = laneZ(r, x) + 9.6;
    if (!shopOK(x, z)) return;
    if (L.shops.some(s => Math.hypot(x - s.x, z - s.z) < gap)) return;
    const n = backOverlap(x, z, r, 3.8); z -= n;
    const h = Math.max(1.3, baseH(x, z)), i = L.shops.length;
    addPad(x, z, 5.2, h, 4);
    L.shops.push({ i, x, z, y: h, yaw: Math.PI, name: KIND[i], k: 'shop', w: 9, d: 7, hgt: 18, row: r, n });
  };
  for (const [r, x] of [[1, -122], [2, -72], [3, 40], [4, 112], [2, 126], [5, -24], [3, -110], [4, -60], [5, 70], [1, 84], [3, -40], [2, 22]]) tryShop(r, x, 34);
  for (let r = 0; r < NROWS && L.shops.length < 6; r++) for (let x = -150; x <= 150; x += 14) tryShop(r, x, 26);

  /* houses: rows facing the sidewalks */
  const cands = [];
  for (let r = 0; r <= NROWS; r++) {
    const rnd = (a) => { const s = Math.sin(a * 91.7 + r * 13.1) * 9137.3; return s - Math.floor(s); };
    for (let k = 0, x = -160; x < 162; k++, x += 16.5) {
      const xx = x + (rnd(k) - .5) * 2.4, zz = laneZ(r, xx) + 9.6 + (rnd(k + 40) - .5) * 1.2;
      cands.push({ x: xx, z: zz, yaw: Math.PI + (rnd(k + 90) - .5) * .14, row: r });
    }
  }
  const ok = c => {
    if (Math.abs(c.x - xr(c.z)) < 10.5) return false;
    if (Math.hypot(c.x - cx, c.z - cz) < 19) return false;
    if (Math.hypot(c.x - L.plaza.x, c.z - L.plaza.z) < 14) return false;
    if (nearSquare(c.x, c.z, 8)) return false;
    if (Math.hypot(c.x - lc.x, c.z - lc.z) < 26) return false;
    if (baseH(c.x, c.z) < 1.2) return false;
    if (canalDist(c.x, c.z) < 5) return false;
    if (crossBlock(c.x, c.z, 4.6)) return false;
    for (const p of L.pent) if (Math.hypot(c.x - p.x, c.z - p.z) < 17) return false;
    for (const s of L.shops) if (Math.hypot(c.x - s.x, c.z - s.z) < 12) return false;
    for (const cs of L.castles) if (Math.hypot(c.x - cs.x, c.z - cs.z) < cs.r + 10) return false;
    return true;
  };
  /* EVERY valid plot is used now (about 149 houses, it was capped at 120), handed out front-row first so early residents are in open view, not behind the church or castle */
  const front = c => Math.hypot(c.x - 24, (c.z - (z0 + 26)) * 1.6);
  const good = cands.filter(ok).sort((a, b) => Math.hypot(a.x, (a.z - (z0 + 56)) * 1.4) - Math.hypot(b.x, (b.z - (z0 + 56)) * 1.4)).slice(0, 400).sort((a, b) => front(a) - front(b));
  good.forEach((c, i) => {
    const n = backOverlap(c.x, c.z, c.row, 4.3); c.z -= n; /* keep the house out of the street behind it */
    const h = baseH(c.x, c.z);
    addPad(c.x, c.z, 4.6, h, 4.5);
    L.houses.push({ idx: i, x: c.x, z: c.z, y: h, yaw: c.yaw, w: 9, d: 8, hgt: 14, row: c.row, n });
  });

  /* ---------- hillside quarters ----------
     Tidy blocks of villas on the open meadow all round the lake. Every block is a neat grid: the houses stand in straight rows with equal spacing,
     every front looks the same way (toward the lake, turned to the nearest of 8 compass directions so the rows run square), each has its little
     back garden behind it and a sidewalk runs in front of every row, joined by one cross sidewalk, exactly like the village.
     They are claimable plots like the rest and are handed out after the village rows are full.
     To move or resize a block change its centre cx, cz or its cols (houses per row) and rows. Houses that would land in water or on a steep slope are skipped. */
  /* MEADOW QUARTERS (the big open meadow north of the lake, around the cottages): four tidy blocks of houses, all facing the lake.
     cx, cz = centre of the block | cols = houses per row | rows = number of rows | yaw 0 = fronts look south, toward the lake.
     To move or resize a block change its numbers. Houses that would land in water or on a steep slope are skipped. */
  const BLOCKS = [
    { cx: -175, cz: -250, cols: 6, rows: 3, yaw: 0 }, /* west of the cottages */
    { cx: 175, cz: -250, cols: 6, rows: 3, yaw: 0 }, /* east of the cottages */
    { cx: -82, cz: -345, cols: 8, rows: 2, yaw: 0 }, /* behind the cottages, left */
    { cx: 82, cz: -345, cols: 8, rows: 2, yaw: 0 }, /* behind the cottages, right */
    /* the meadows on both sides of the lake, fronts looking east or west toward the water */
    { cx: -250, cz: -145, cols: 8, rows: 3, yaw: Math.PI / 2 }, /* west of the lake, north of the old town */
    { cx: 250, cz: -145, cols: 8, rows: 3, yaw: -Math.PI / 2 }, /* east of the lake, north of the old town */
    { cx: -325, cz: -30, cols: 8, rows: 2, yaw: Math.PI / 2 }, /* far west meadow, beyond the old town */
    { cx: 325, cz: -30, cols: 8, rows: 2, yaw: -Math.PI / 2 }, /* far east meadow */
    { cx: -325, cz: 110, cols: 6, rows: 2, yaw: Math.PI / 2 },
    { cx: 325, cz: 110, cols: 6, rows: 2, yaw: -Math.PI / 2 },
    /* the north meadow, second tier */
    { cx: -195, cz: -345, cols: 5, rows: 2, yaw: 0 }, { cx: 195, cz: -345, cols: 5, rows: 2, yaw: 0 },
    { cx: -300, cz: -290, cols: 4, rows: 2, yaw: 0 }, { cx: 300, cz: -290, cols: 4, rows: 2, yaw: 0 },
    /* the gentle slope just south of the village, fronts looking north to the lake (further south it gets too steep) */
    { cx: -95, cz: 215, cols: 8, rows: 2, yaw: Math.PI }, { cx: 105, cz: 215, cols: 8, rows: 2, yaw: Math.PI },
    { cx: -200, cz: 220, cols: 5, rows: 2, yaw: Math.PI }, { cx: 205, cz: 220, cols: 5, rows: 2, yaw: Math.PI }
  ];
  const VS = 18, VR = 29, FRONT = 11.6; /* spacing along a row, spacing between rows, sidewalk distance in front of the house centre */
  /* AUTO-FILL: more blocks laid over every free stretch of land, nearest to the middle first, until the village and meadow houses reach HOUSE_CAP
     (the 100 old-town houses come after, so the whole town ends up at about 700). A house is skipped if it would land on water, a steep slope, another house,
     the village, the old towns, the cottages or the river. Lower HOUSE_CAP for fewer houses. */
  const HOUSE_CAP = 600, AUTO = [];
  for (let cx = -345; cx <= 345; cx += 90) for (let cz = -385; cz <= 235; cz += 58) AUTO.push({ cx, cz, cols: 5, rows: 2, yaw: Math.round(Math.atan2(LAKE0.x - cx, LAKE0.z - cz) / (Math.PI / 2)) * (Math.PI / 2), auto: 1 });
  AUTO.sort((p, q) => Math.hypot(p.cx * .7, p.cz + 60) - Math.hypot(q.cx * .7, q.cz + 60));
  BLOCKS.push(...AUTO);
  const villas = [], nearC = (x, z, m) => L.castles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + m);
  for (const bk of BLOCKS) {
    const ang = bk.yaw !== undefined ? bk.yaw : Math.round(Math.atan2(LAKE0.x - bk.cx, LAKE0.z - bk.cz) / (Math.PI / 4)) * (Math.PI / 4);
    const lx = Math.sin(ang), lz = Math.cos(ang); /* unit vector from the block to the lake: the way the fronts look */
    const yaw = ang, tx = Math.cos(ang), tz = -Math.sin(ang); /* tx, tz: along a row */
    for (let j = 0; j < bk.rows; j++) {
      const rowPts = [];
      for (let i = 0; i < bk.cols; i++) {
        const along = (i - (bk.cols - 1) / 2) * VS, back = (j - (bk.rows - 1) / 2) * VR;
        const x = bk.cx + tx * along - lx * back, z = bk.cz + tz * along - lz * back;
        const gx = x - lx * 7, gz = z - lz * 7; /* centre of the back garden */
        const h = baseH(x, z);
        if (h < 1.4 || baseH(gx, gz) < 1.2) continue;
        if (Math.hypot(baseH(x + 6, z) - baseH(x - 6, z), baseH(x, z + 6) - baseH(x, z - 6)) / 12 > .24) continue; /* not on a steep slope */
        if (L.castles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 26)) continue;
        if (L.houses.length >= HOUSE_CAP) continue;
        if (L.houses.some(v => Math.hypot(x - v.x, z - v.z) < 14) || L.shops.some(v => Math.hypot(x - v.x, z - v.z) < 14) || L.pent.some(v => Math.hypot(x - v.x, z - v.z) < 18)) continue;
        if (Math.abs(x) < 125 && z > -325 && z < -165) continue; /* the cottage district */
        if (bk.auto && ((Math.abs(x) < 292 && z > -80 && z < 205) || (z > 120 && Math.abs(x - xr(z)) < 16))) continue; /* the village, the old towns and the river */
        addPad(x, z, 5.6, h, 4.5); addPad(gx, gz, 6.6, h, 5); addPad(x + lx * 7.5, z + lz * 7.5, 3.4, h, 4); /* house, back garden, front gate */
        const v = { idx: L.houses.length, x, z, y: h, yaw, w: 9, d: 8, hgt: 14, row: -1, built: true, gx, gz, style: (i + j) % 3 === 1 ? 'town' : 'chalet' };
        villas.push(v); L.houses.push(v); rowPts.push(v); bk.placed = (bk.placed || 0) + 1;
      }
      if (rowPts.length < (bk.auto ? 3 : 1)) continue; /* no sidewalk for a row of one or two houses */
      /* sidewalk in front of the row, running one house further than the first and last house */
      const first = rowPts[0], last = rowPts[rowPts.length - 1];
      const sx = (p, k) => [p.x + lx * FRONT + tx * k, p.z + lz * FRONT + tz * k];
      const a0 = sx(first, -VS * .75), a1 = sx(last, VS * .75), n = Math.max(2, Math.ceil(Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) / 4));
      let cur = []; const flush = () => { if (cur.length > 2) L.walks.push({ pts: cur, w: 2.4, kind: 'hill' }); cur = []; };
      for (let k = 0; k <= n; k++) {
        const x = a0[0] + (a1[0] - a0[0]) * k / n, z = a0[1] + (a1[1] - a0[1]) * k / n;
        if (H(x, z) < 1.4 || nearC(x, z, 4)) flush(); else cur.push([x, z]);
      }
      flush();
    }
    /* the cross sidewalk joining the rows of a two-row block, halfway along the row, running in the gap between two houses */
    if (bk.rows > 1 && bk.cols > 1 && (!bk.auto || (bk.placed || 0) >= 6)) {
      const m = Math.floor(bk.cols / 2) - .5, along = (m - (bk.cols - 1) / 2) * VS;
      const ends = [0, bk.rows - 1].map(j => { const back = (j - (bk.rows - 1) / 2) * VR; return [bk.cx + tx * along - lx * back + lx * FRONT, bk.cz + tz * along - lz * back + lz * FRONT]; });
      const pts = [], n = Math.max(2, Math.ceil(Math.hypot(ends[1][0] - ends[0][0], ends[1][1] - ends[0][1]) / 4));
      for (let k = 0; k <= n; k++) { const x = ends[0][0] + (ends[1][0] - ends[0][0]) * k / n, z = ends[0][1] + (ends[1][1] - ends[0][1]) * k / n; if (H(x, z) > 1.4 && !nearC(x, z, 4)) pts.push([x, z]); }
      if (pts.length > 2) L.walks.push({ pts, w: 1.8, kind: 'hill' });
    }
  }

  /* ---------- hamlets all around the lake ----------
     Small clean groups (3 by 2, equal spacing, fronts to the lake) spread round the whole shore, so the lake looks like it sits in the middle of an inhabited island.
     Townhouses (the photo) mixed with Swiss chalets (the video). Edit HAM to move a hamlet: [centre x, centre z]. Hamlets on steep or wet ground just lose those houses. */
  const HAM = []; /* the isolated lakeside hamlets are gone: the town is one continuous quarter now (see the old-town districts below) */
  HAM.forEach((hc, hi) => {
    let lx = LAKE0.x - hc[0], lz = LAKE0.z - hc[1]; const ll = Math.hypot(lx, lz); lx /= ll; lz /= ll;
    const yaw = Math.atan2(lx, lz), tx = -lz, tz = lx;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) {
      const x = hc[0] + tx * (i - 1) * 14 - lx * (j - .5) * 20, z = hc[1] + tz * (i - 1) * 14 - lz * (j - .5) * 20, h = baseH(x, z);
      if (h < 1.4 || h > 60 || L.castles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 9)) continue;
      if (Math.abs(x) < 195 && z > -95 && z < 205) continue; /* the main village */
      if (Math.abs(x) < 150 && z < -150 && z > -290) continue; /* the cottage district */
      if (Math.hypot(baseH(x + 6, z) - baseH(x - 6, z), baseH(x, z + 6) - baseH(x, z - 6)) / 12 > .25) continue;
      if (L.houses.some(v => Math.hypot(x - v.x, z - v.z) < 11)) continue;
      addPad(x, z, 5.6, h, 4.5);
      L.houses.push({ idx: L.houses.length, x, z, y: h, yaw, w: 9, d: 8, hgt: 14, row: -1, built: true, style: (i + j + hi) % 3 === 1 ? 'chalet' : 'town' });
    }
  });

  /* ---------- old town districts: 100 empty houses, west and east of the village ----------
     Two cobbled quarters like the photo: two pedestrian streets (a wide cobbled sidewalk, no cars) with townhouses facing each other on both sides,
     and a green park strip between the streets with a fountain square and a gazebo square (extras.js builds the gazebos, benches and cobbles).
     All of these houses are claimable plots handed out LAST, so they stay empty until the rest is taken.
     To move a district change cx / zc; ROWS is the number of houses on each side of a street (the target total is 100, extra houses are dropped). */
  const OLD = [{ cx: -222, zc: 45 }, { cx: 226, zc: 45 }], OROWS = 17, OSP = 13.5, OOFF = [[-52, Math.PI / 2], [-20, -Math.PI / 2], [20, Math.PI / 2], [52, -Math.PI / 2]], OSTREET = 36;
  L.gazebos = [];
  const oldCand = [];
  for (const d of OLD) {
    const zf = d.zc - 32, zg = d.zc + 32; /* fountain square, gazebo square (both in the park strip between the two streets) */
    L.ponds = L.ponds || []; L.ponds.push({ x: d.cx, z: d.zc, rx: 9, rz: 14 }); addPad(d.cx, d.zc, 15, undefined, 6); /* the park pond between the two squares */
    for (const [zq, kind] of [[zf, 'f'], [zg, 'g']]) {
      const q = { x: d.cx, z: zq, r: 13, disc: 11 }; addPad(q.x, q.z, 11, undefined, 6);
      if (kind === 'f') { L.squares.push(q); plazas.push(q); } else { L.gazebos.push(q); plazas.push(q); }
    }
    for (const [off, yaw] of OOFF) for (let k = 0; k < OROWS; k++) {
      const x = d.cx + off, z = d.zc + (k - (OROWS - 1) / 2) * OSP, h = baseH(x, z);
      if (Math.abs(off) === 20 && (Math.abs(z - zf) < 9 || Math.abs(z - zg) < 9)) continue; /* the cross walks to the squares pass here */
      if (h < 1.6 || baseH(x - Math.sin(yaw) * 6, z - Math.cos(yaw) * 6) < 1.4) continue;
      if (Math.hypot(baseH(x + 6, z) - baseH(x - 6, z), baseH(x, z + 6) - baseH(x, z - 6)) / 12 > .2) continue;
      if (L.castles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 14)) continue;
      if (L.houses.some(v => Math.hypot(x - v.x, z - v.z) < 13) || L.shops.some(v => Math.hypot(x - v.x, z - v.z) < 13) || L.pent.some(v => Math.hypot(x - v.x, z - v.z) < 16)) continue;
      oldCand.push({ x, z, yaw, h, d });
    }
  }
  /* keep exactly 100 (the ones nearest the district centres), then drop them on the map */
  oldCand.sort((a, b) => Math.hypot(a.x - a.d.cx, (a.z - a.d.zc) * .8) - Math.hypot(b.x - b.d.cx, (b.z - b.d.zc) * .8));
  const oldHouses = oldCand.slice(0, 100);
  oldHouses.forEach(c => {
    addPad(c.x, c.z, 5.6, c.h, 4.5);
    const hr = Math.abs(Math.sin(c.x * 12.9898 + c.z * 78.233) * 43758.5453) % 1; /* a fixed pseudo-random number per house: mixes the two house styles and turns each house a hair */
    L.houses.push({ idx: L.houses.length, x: c.x, z: c.z, y: c.h, yaw: c.yaw + (hr - .5) * .06, w: 9, d: 8, hgt: 14, row: -1, built: true, style: hr < .38 ? 'chalet' : 'town', old: true });
  });
  /* cobbled sidewalks: one wide pedestrian walk down the middle of each street, a thin one down the park, and cross walks to the two squares */
  const OCOB = '#b9a594';
  for (const d of OLD) {
    const mine = oldHouses.filter(c => c.d === d); if (!mine.length) continue;
    const z0 = Math.min(...mine.map(c => c.z)) - 8, z1 = Math.max(...mine.map(c => c.z)) + 8;
    const line = (ax, az, bx, bz, w, kind) => {
      const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 4)); let cur = [];
      const flush = () => { if (cur.length > 2) L.walks.push({ pts: cur, w, kind: 'hill', col: OCOB }); cur = []; };
      for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; if (H(x, z) < 1.4 || nearC(x, z, 4)) flush(); else cur.push([x, z]); }
      flush();
    };
    for (const sx of [-OSTREET, OSTREET]) line(d.cx + sx, z0, d.cx + sx, z1, 10);
    for (const sx of [-12.5, 12.5]) line(d.cx + sx, z0, d.cx + sx, z1, 2.4);
    for (const zq of [d.zc - 32, d.zc + 32]) line(d.cx - OSTREET, zq, d.cx + OSTREET, zq, 3);
  }

  /* lakeview cottages: 6 terraced rows of 10 on the north shore slope, all facing the lake.
     Rows 0-3 are the original ones. Rows 4 and 5 (cottages 41 to 60) sit further back up the slope with more room: every second one has a BIG garden
     (c.big = true, drawn by build.js). Their x positions put each house between two of the N-S sidewalks in L.walk.conn, so no path cuts through a garden. */
  const CROW = [-198, -216, -234, -252, -274, -302];
  const CX2 = [-87, -66.5, -47.5, -28.5, -9.5, 9.5, 28.5, 47.5, 66.5, 87];
  for (let r = 0; r < 6; r++) for (let k = 0; k < 10; k++) {
    const x = r < 4 ? (k - 4.5) * 19 + (r % 2 ? 4.5 : -4.5) : CX2[k], z = CROW[r] + Math.sin(k * 1.7 + r) * 1.4, h = (baseH(x, z) + baseH(x, z + 11)) / 2; /* cut into the hillside: halfway between the back and the front slope, so the stairs below stay gentle */
    const big = r >= 4 && (k + r) % 2 === 0;
    addPad(x, z, big ? 11 : 7, h, big ? 8 : 13);
    L.cot.push({ i: L.cot.length, x, z, y: h, yaw: (((k * 7 + r * 3) % 5) - 2) * .03, name: 'Cottage ' + (L.cot.length + 1), k: 'cot', w: 7, d: 6, hgt: 9, big });
  }
  /* sidewalks in front of each cottage row: level the ground under them. each row's path height is the natural
     ground height smoothed along the row, so it rises and falls gently instead of following every bump */
  const walkZ = [];
  for (let r = 0; r < 6; r++) { let s = 0; for (let k = 0; k < 10; k++) s += L.cot[r * 10 + k].z; walkZ.push(s / 10 + 11); }
  L.walk = { z: walkZ, prom: walkZ[0] + 3.8, x0: -98, x1: 98, conn: [-76, -38, 0, 38, 76] }; /* conn: N-S sidewalks, each exactly between two cottages of neighbouring rows */
  const wp = [];
  for (let r = 0; r < 6; r++) for (let x = L.walk.x0; x <= L.walk.x1; x += 2.4) {
    let s = 0, n = 0; for (let dx = -12; dx <= 12; dx += 3) { s += baseH(x + dx, walkZ[r]); n++; }
    wp.push([x, walkZ[r], s / n]);
  }
  wp.forEach(p => addPad(p[0], p[1], 1.6, p[2], 3.2));
  /* promenade quay: only ever raises low shore under the walkway so its front edge stays on dry land (no stone in the water) */
  for (let x = L.walk.x0; x <= L.walk.x1; x += 2.4) { const h0 = H(x, L.walk.prom); if (h0 < 1.5) addPad(x, L.walk.prom, 2.2, 1.5, 3); }

  /* ---------- sidewalks, bridges, footbridges: there are no streets in Nestville, people walk ---------- */
  const inChurch = (x, z) => Math.abs(x - cx) < 20 && z > cz - 27 && z < cz + 15;
  const nearCastle = (x, z, m) => L.castles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + m);
  /* a stone bridge over the river on every row sidewalk, so every house and shop can reach the other half of the village.
     The bridge is laid on the straight line between the two sidewalk ends (10 either side of the river), so it is turned a little to match. */
  for (let r = 0; r <= NROWS; r++) {
    let zb = laneZ(r, 12) + .9; zb = laneZ(r, xr(zb)) + .9; const bx = xr(zb);
    const zw = laneZ(r, bx - 10) + .9, ze = laneZ(r, bx + 10) + .9;
    L.bridges.push({ big: r === 3, x: bx, y: Math.max(baseH(bx - 11, zb), baseH(bx + 11, zb)) - .8, z: (zw + ze) / 2, zw, ze, yaw: -Math.atan2(ze - zw, 20), row: r });
  }
  /* one sidewalk in front of every row of houses (the garden paths in paths.js end on it).
     Each sidewalk now runs right up to the end of the bridge (exactly 10 from its centre), so there is no gap of bare grass any more. */
  for (let r = 0; r <= NROWS; r++) {
    const br = L.bridges[r], gx = [];
    for (let x = -160; x <= 160; x += 4) if (Math.abs(x - br.x) >= 10.8 && !(r < NROWS && XSTREETS.some(X => Math.abs(x - X) < XW + .6))) gx.push([x, 0]);
    gx.push([br.x - 10, 1], [br.x + 10, 2]); /* 1 = last point before the bridge, 2 = first point after it */
    if (r < NROWS) for (const X of XSTREETS) gx.push([X - XW, 1], [X + XW, 2]); /* the sidewalk stops at a cross street (a crosswalk goes there) */
    gx.sort((a, b) => a[0] - b[0]);
    let cur = []; const flush = () => { if (cur.length > 2) L.walks.push({ pts: cur, w: 2.4, kind: 'row', row: r }); cur = []; };
    for (const [x, tag] of gx) {
      const z = laneZ(r, x) + .9;
      if (inChurch(x, z) || nearCastle(x, z, 4) || H(x, z) < 1.2 || canalDist(x, z) < 3) { flush(); continue; }
      if (tag === 2) flush();
      cur.push([x, z]);
      if (tag === 1) flush();
    }
    flush();
  }
  /* the lakeside walk on the far bank of the one E-W canal, and footbridges across it */
  { let cur = []; const flush = () => { if (cur.length > 2) L.walks.push({ pts: cur, w: 2.2, kind: 'bank' }); cur = []; };
    for (let x = -160; x <= 160; x += 4) {
      const z = laneZ(0, x) - 12.8;
      if (Math.abs(x - xr(z)) < 8 || nearCastle(x, z, 2) || H(x, z) < 1.4 || canalDist(x, z) < 3) flush(); else cur.push([x, z]);
    }
    flush(); }
  /* (no footbridges: there is no E-W canal to cross any more) */

  /* ---------- STREETS: polylines for streets.js, plus the crosswalk list ---------- */
  L.streets = []; L.xwalks = [];
  const roadOK = (x, z, bridgeRow) => !(inChurch(x, z) || nearCastle(x, z, 5.5) || H(x, z) < 1.2 || (!bridgeRow && canalDist(x, z) < 3.5));
  for (let r = 0; r <= NROWS; r++) { /* one street in front of each row of houses. Row 3 ends at the big bridge, the others at the river bank */
    const br = L.bridges[r]; let cur = [];
    const flush = () => { if (cur.length > 1) L.streets.push({ pts: cur, k: 'ew', row: r }); cur = []; };
    for (let x = -166; x <= 166; x += 3) {
      const z = roadZ(r, x);
      if ((r === 3 && Math.abs(x - br.x) < 10.4) || !roadOK(x, z, r === 3) || (r !== 3 && Math.abs(x - xr(z)) < 8) || Math.abs(roadZ(r, x + 4) - roadZ(r, x - 4)) / 8 > .55) { flush(); continue; } /* last test: the street ends where the shore curves away (too steep for a straight street) */
      cur.push([x, z]);
    }
    flush();
  }
  for (const X of XSTREETS) { /* the cross streets, from the row-0 street to the row-6 street */
    let cur = []; const z1 = roadZ(NROWS, X);
    const flush = () => { if (cur.length > 1) L.streets.push({ pts: cur, k: 'ns', x: X }); cur = []; };
    for (let z = roadZ(0, X); z <= z1 + .01; z += 3) { if (!roadOK(X, z, false)) flush(); else cur.push([X, z]); }
    if (cur.length && cur[cur.length - 1][1] < z1 - .5 && roadOK(X, z1, false)) cur.push([X, z1]);
    flush();
  }
  /* crosswalks: zebra stripes on the cross street either side of each row street, and on each row street either side of each cross street */
  const onStreet = (x, z) => L.streets.some(s => polyDist(s.pts, x, z) < (s.k === 'ew' ? ROAD_W : XW * 2) / 2 + .4);
  const tang = (r, x) => { const dz = roadZ(r, x + 1) - roadZ(r, x - 1); const l = Math.hypot(2, dz); return [2 / l, dz / l]; };
  for (const X of XSTREETS) for (let r = 0; r <= NROWS; r++) {
    const zc = roadZ(r, X); if (!onStreet(X, zc)) continue;
    const off = ROAD_W / 2 + 1.2;
    if (r > 0 && onStreet(X, zc - off - 1)) L.xwalks.push({ x: X, z: zc - off, dx: 0, dz: 1, w: XW * 2 });
    if (r < NROWS && onStreet(X, zc + off + 1)) L.xwalks.push({ x: X, z: zc + off, dx: 0, dz: 1, w: XW * 2 });
    for (const sgn of [-1, 1]) {
      const x = X + sgn * (XW + 1.2), [tx, tz] = tang(r, x), z = roadZ(r, x);
      if (onStreet(x + sgn * 1.5, roadZ(r, x + sgn * 1.5))) L.xwalks.push({ x, z, dx: tx, dz: tz, w: ROAD_W });
    }
  }
  L.inter = []; for (const X of XSTREETS) for (let r = 0; r <= NROWS; r++) { const z = roadZ(r, X); if (onStreet(X, z)) L.inter.push({ x: X, z }); }
  return L;
}
const KIND = ['Bakery', 'Nail salon', 'Hair salon', 'Cafe', 'Flower shop', 'Barber'];
