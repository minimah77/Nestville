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
const PITCH = 18.5, NROWS = 6;
export const laneZ = (r, x) => sz(x) + 16 + r * PITCH + 3 * Math.sin(x * .045 + r * .3);

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
  { const pts = []; for (let x = -166; x <= 166; x += 8) pts.push([x, laneZ(0, x) - 6]); addCanal(pts, 2.3); }

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
    Math.hypot(x - lc.x, z - lc.z) > 30 && baseH(x, z) > 1.2 && canalDist(x, z) > 5 &&
    !L.pent.some(p => Math.hypot(x - p.x, z - p.z) < 17) && !L.castles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 10);
  const tryShop = (r, x, gap) => {
    if (L.shops.length >= 6) return;
    const z = laneZ(r, x) + 9.6;
    if (!shopOK(x, z)) return;
    if (L.shops.some(s => Math.hypot(x - s.x, z - s.z) < gap)) return;
    const h = Math.max(1.3, baseH(x, z)), i = L.shops.length;
    addPad(x, z, 5.2, h, 4);
    L.shops.push({ i, x, z, y: h, yaw: Math.PI, name: KIND[i], k: 'shop', w: 9, d: 7, hgt: 18, row: r });
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
    if (Math.hypot(c.x - lc.x, c.z - lc.z) < 26) return false;
    if (baseH(c.x, c.z) < 1.2) return false;
    if (canalDist(c.x, c.z) < 5) return false;
    for (const p of L.pent) if (Math.hypot(c.x - p.x, c.z - p.z) < 17) return false;
    for (const s of L.shops) if (Math.hypot(c.x - s.x, c.z - s.z) < 12) return false;
    for (const cs of L.castles) if (Math.hypot(c.x - cs.x, c.z - cs.z) < cs.r + 10) return false;
    return true;
  };
  /* EVERY valid plot is used now (about 149 houses, it was capped at 120), handed out front-row first so early residents are in open view, not behind the church or castle */
  const front = c => Math.hypot(c.x - 24, (c.z - (z0 + 26)) * 1.6);
  const good = cands.filter(ok).sort((a, b) => Math.hypot(a.x, (a.z - (z0 + 56)) * 1.4) - Math.hypot(b.x, (b.z - (z0 + 56)) * 1.4)).slice(0, 400).sort((a, b) => front(a) - front(b));
  good.forEach((c, i) => {
    const h = baseH(c.x, c.z);
    addPad(c.x, c.z, 4.6, h, 4.5);
    L.houses.push({ idx: i, x: c.x, z: c.z, y: h, yaw: c.yaw, w: 9, d: 8, hgt: 14, row: c.row });
  });

  /* ---------- hillside quarters ----------
     Villas scattered over the open meadow west and east of the village. No rows: every house is turned its own way (some look at the mountains,
     the next one a bit toward the lake, the next toward the far hills), and every one has a little back garden behind it.
     They are claimable plots like the rest and are handed out after the village rows are full.
     To move or resize a quarter, change x0/x1/z0/z1 (area) or n (how many) here. dirs = the directions the fronts look: [east, south]. */
  const QS = [ /* messy hillside villas, spread all round the lake (edit n for more or fewer) */
    { x0: -352, x1: -284, z0: -60, z1: 80, n: 7, dirs: [[-1, 0], [-.7, -.7], [-.8, .6], [0, -1], [-1, .25]] },
    { x0: -352, x1: -284, z0: 110, z1: 230, n: 5, dirs: [[-1, 0], [-.8, .6], [0, -1]] },
    { x0: 284, x1: 352, z0: -60, z1: 80, n: 7, dirs: [[1, 0], [.7, -.7], [.8, .6], [0, -1], [1, .25]] },
    { x0: 284, x1: 352, z0: 110, z1: 230, n: 5, dirs: [[1, 0], [.8, .6], [0, -1]] },
    { x0: -330, x1: -230, z0: -340, z1: -200, n: 6, dirs: [[-.5, .9], [0, 1], [.6, .8]] },
    { x0: 230, x1: 330, z0: -340, z1: -200, n: 6, dirs: [[.5, .9], [0, 1], [-.6, .8]] },
    { x0: -140, x1: 140, z0: -385, z1: -300, n: 6, dirs: [[0, 1], [.5, .9], [-.5, .9]] },
    { x0: -300, x1: -120, z0: 240, z1: 340, n: 5, dirs: [[0, -1], [-.6, -.8], [.6, -.8]] },
    { x0: 120, x1: 300, z0: 240, z1: 340, n: 5, dirs: [[0, -1], [.6, -.8], [-.6, -.8]] }
  ];
  let sd = 90210; const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const villas = [];
  for (const q of QS) {
    let made = 0;
    for (let t = 0; t < 1500 && made < q.n; t++) {
      const x = q.x0 + rnd() * (q.x1 - q.x0), z = q.z0 + rnd() * (q.z1 - q.z0);
      const dv = q.dirs[made % q.dirs.length], yaw = Math.atan2(dv[0], dv[1]) + (rnd() - .5) * .6; /* the front looks along (sin yaw, cos yaw) */
      const gx = x - Math.sin(yaw) * 7, gz = z - Math.cos(yaw) * 7; /* centre of the back garden */
      if (baseH(x, z) < 1.4 || baseH(gx, gz) < 1.2) continue;
      if (Math.hypot(baseH(x + 6, z) - baseH(x - 6, z), baseH(x, z + 6) - baseH(x, z - 6)) / 12 > .2) continue; /* not on a steep slope */
      if (L.castles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 26)) continue;
      if (villas.some(v => Math.hypot(x - v.x, z - v.z) < 19 || Math.hypot(x - v.gx, z - v.gz) < 12 || Math.hypot(gx - v.x, gz - v.z) < 12)) continue;
      const h = baseH(x, z);
      addPad(x, z, 5.6, h, 4.5); addPad(gx, gz, 6.6, h, 5); addPad(x + Math.sin(yaw) * 7.5, z + Math.cos(yaw) * 7.5, 3.4, h, 4); /* house, back garden, front gate */
      const v = { idx: L.houses.length, x, z, y: h, yaw, w: 9, d: 8, hgt: 14, row: -1, built: true, gx, gz, style: villas.length % 3 === 1 ? 'town' : 'chalet' };
      villas.push(v); L.houses.push(v); made++;
    }
  }


  /* ---------- hamlets all around the lake ----------
     Small clean groups (3 by 2, equal spacing, fronts to the lake) spread round the whole shore, so the lake looks like it sits in the middle of an inhabited island.
     Townhouses (the photo) mixed with Swiss chalets (the video). Edit HAM to move a hamlet: [centre x, centre z]. Hamlets on steep or wet ground just lose those houses. */
  const HAM = [[-250, -250], [-190, -330], [-70, -345], [80, -345], [190, -330], [250, -250], [305, -130], [305, 20], [262, 130], [185, 225], [60, 245], [-70, 245], [-190, 225], [-262, 130], [-305, 20], [-305, -130]];
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

  /* lakeview cottages: 4 terraced rows on the north shore slope, all facing the lake */
  const CROW = [-198, -216, -234, -252];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 10; k++) {
    const x = (k - 4.5) * 19 + (r % 2 ? 4.5 : -4.5), z = CROW[r] + Math.sin(k * 1.7 + r) * 1.4, h = (baseH(x, z) + baseH(x, z + 11)) / 2; /* cut into the hillside: halfway between the back and the front slope, so the stairs below stay gentle */
    addPad(x, z, 7, h, 13);
    L.cot.push({ i: L.cot.length, x, z, y: h, yaw: (((k * 7 + r * 3) % 5) - 2) * .03, name: 'Cottage ' + (L.cot.length + 1), k: 'cot', w: 7, d: 6, hgt: 9 });
  }
  /* sidewalks in front of each cottage row: level the ground under them. each row's path height is the natural
     ground height smoothed along the row, so it rises and falls gently instead of following every bump */
  const walkZ = [];
  for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 10; k++) s += L.cot[r * 10 + k].z; walkZ.push(s / 10 + 11); }
  L.walk = { z: walkZ, prom: walkZ[0] + 3.8, x0: -98, x1: 98, conn: [-76, -38, 0, 38, 76] }; /* conn: N-S sidewalks, each exactly between two cottages of neighbouring rows */
  const wp = [];
  for (let r = 0; r < 4; r++) for (let x = L.walk.x0; x <= L.walk.x1; x += 2.4) {
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
    for (let x = -160; x <= 160; x += 4) if (Math.abs(x - br.x) >= 10.8) gx.push([x, 0]);
    gx.push([br.x - 10, 1], [br.x + 10, 2]); /* 1 = last point before the bridge, 2 = first point after it */
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
  /* footbridges: only where both ends land on dry ground (the shore curves a lot), at least 38 apart */
  for (let x = -150; x <= 150; x += 2) {
    const z = laneZ(0, x) - 6, n = H(x, z - 6.75), so = H(x, z + 6.75);
    if (n < 1.6 || so < 1.6 || Math.abs(x - xr(z)) < 16 || nearCastle(x, z, 6) || L.fbr.some(f => Math.abs(f.x - x) < 38) || Math.abs(x - L.yachtPier.x) < 8) continue;
    L.fbr.push({ x, z, y: Math.max(n, so) });
  }
  return L;
}
const KIND = ['Bakery', 'Nail salon', 'Hair salon', 'Cafe', 'Flower shop', 'Barber'];
