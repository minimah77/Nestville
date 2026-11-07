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

export const B = { x0: -340, x1: 340, z0: -340, z1: 300 }; /* world bounds */
export const TOWN = { x0: -150, x1: 150, z0: -80, z1: 175 }; /* high detail terrain rect */
const LAKE = { cx: 0, cz: -88, rx: 175, rz: 98 };
export const lakeE = (x, z) => Math.hypot((x - LAKE.cx) / LAKE.rx, (z - LAKE.cz) / LAKE.rz) + (fbm(x * .017 + 5, z * .017 + 9, 3) - .5) * .2;

export function baseH(x, z) {
  const e = lakeE(x, z);
  let h = -8 + sm(.86, 1.0, e) * 8.8;
  const land = sm(.97, 1.1, e);
  const south = Math.max(0, z - 4) * .2 + Math.max(0, z - 105) * .18;
  h += land * (south + (fbm(x * .02 + 1, z * .02 + 4, 3) - .5) * 9 * sm(0, 60, z) + (fbm(x * .05, z * .05, 2) - .5) * 2.5);
  let mm = Math.max(sm(-140, -230, z), sm(135, 235, Math.abs(x)), sm(150, 235, z)) * sm(1.0, 1.35, e);
  if (mm > 0) {
    const r = 1 - Math.abs(2 * fbm(x * .0075 + 11, z * .0075 + 5, 5) - 1);
    h += mm * (22 + r * r * 150 * (.55 + .45 * fbm(x * .004 + 30, z * .004 + 2, 2)) + fbm(x * .03, z * .03, 3) * 24);
  }
  h += sm(270, 330, Math.max(Math.abs(x), Math.abs(z))) * 90;
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
export const RIVER_Z0 = 2, RIVER_Z1 = 210;
const riverSurf = z => Math.max(baseH(xr(z), z) - .5, .1);
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
  if (z > 0) {
    const d = Math.abs(x - xr(z));
    if (d < 7) h = mix(h, Math.min(h, Rs(z) - 1.3), 1 - sm(3.2, 6.8, d));
  }
  return h;
}

/* road mask */
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
export const L = { houses: [], pent: [], shops: [], castles: [], church: null, plaza: null, pier: null, bridge: null, towers: [] };

export function layout() {
  const z0 = sz(0);
  /* main street */
  const main = [[0, z0 + 3], [9, z0 + 18], [-4, z0 + 36], [7, z0 + 55], [-3, z0 + 74], [3, z0 + 92], [0, z0 + 112]];
  const smooth = [];
  for (let i = 0; i < main.length - 1; i++) for (let k = 0; k < 8; k++) {
    const t = k / 8, a = main[Math.max(0, i - 1)], b = main[i], c = main[i + 1], d = main[Math.min(main.length - 1, i + 2)];
    const cr = (p0, p1, p2, p3) => .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    smooth.push([cr(a[0], b[0], c[0], d[0]), cr(a[1], b[1], c[1], d[1])]);
  }
  smooth.push(main[main.length - 1]);
  roads.push(smooth);

  /* church + plaza */
  const cx = -16, cz = z0 + 41;
  L.church = { x: cx, z: cz, yaw: Math.PI, name: 'Village church', k: 'church', w: 10, d: 18, hgt: 52, r: 12 };
  L.plaza = { x: cx, z: cz - 15, r: 10 };
  plazas.push(L.plaza);
  addPad(cx, cz + 1, 11, undefined, 6);
  addPad(L.plaza.x, L.plaza.z, 9, undefined, 5);
  roads.push([[cx + 8, cz - 15], [4, z0 + 36]]);

  /* castles */
  const lc = { x: -68, z: z0 - 12 }; /* lakeside peninsula castle */
  addPad(lc.x, lc.z, 14, 3.6, 12);
  L.castles.push({ id: 'lake', x: lc.x, z: lc.z, y: 3.6, name: 'Lakeside castle', k: 'castle', w: 26, d: 22, hgt: 44, r: 20, yaw: 0 });
  const ex = 118, ez = 46, eh = baseH(ex, ez) + 5;
  addPad(ex, ez, 18, eh, 14);
  L.castles.push({ id: 'east', x: ex, z: ez, y: eh, name: 'Hilltop citadel', k: 'castle', w: 30, d: 30, hgt: 50, r: 24, yaw: 0 });
  addPad(50, -62, 9, 2.7, 10);
  L.castles.push({ id: 'island', x: 50, z: -62, y: 2.7, name: 'Island keep', k: 'castle', w: 20, d: 16, hgt: 36, r: 13, yaw: .4 });
  const tx = 124, tzz = shoreZ(124) + 2;
  addPad(tx, tzz, 5, 2.6, 7);
  L.castles.push({ id: 'tower', x: tx, z: tzz, y: 2.6, name: 'Old watchtower', k: 'castle', w: 8, d: 8, hgt: 28, r: 6, yaw: 0 });

  /* shops on the promenade */
  for (let i = 0; i < 6; i++) {
    const x = -42 + i * 10.5, z = sz(x) + 5.5, h = Math.max(1.3, baseH(x, z));
    addPad(x, z, 5.2, h, 4);
    L.shops.push({ i, x, z, y: h, yaw: Math.PI, name: KIND[i], k: 'shop', w: 9, d: 7, hgt: 18 });
  }
  /* promenade strip */
  roads.push(Array.from({ length: 14 }, (_, i) => { const x = -52 + i * 8; return [x, sz(x) + 2.2]; }));
  /* pier */
  const px = -6; L.pier = { x: px, z0: sz(px) + 1, len: 24 };

  /* penthouses: two groups either side of the river */
  const zr = z0 + 101, xrr = xr(zr);
  const xs = [];
  for (let k = 0; k < 5; k++) { xs.push(xrr - 22 - k * 17); xs.push(xrr + 22 + k * 17); }
  xs.sort((a, b) => a - b);
  xs.forEach((x, i) => {
    const z = zr + 5 * Math.pow((x - xrr) / 85, 2) + (((i * 37) % 5) - 2) * 1.2;
    const h = baseH(x, z) + .4;
    addPad(x, z, 8.5, h, 6);
    L.pent.push({ i, x, z, y: h, yaw: Math.PI + ((i % 3) - 1) * .06, name: 'Penthouse ' + (i + 1), k: 'ph', w: 11, d: 9, hgt: 34 });
  });
  roads.push(xs.map(x => [x, zr + 5 * Math.pow((x - xrr) / 85, 2) - 9]));

  /* lanes + houses */
  const cands = [];
  const lanePts = [];
  for (let r = 0; r < 5; r++) {
    const lane = x => sz(x) + 16 + r * 16.5 + 3 * Math.sin(x * .045 + r * 1.9);
    const pts = []; for (let x = -100; x <= 100; x += 8) pts.push([x, lane(x)]);
    lanePts.push(pts); roads.push(pts);
    const rnd = (a) => { const s = Math.sin(a * 91.7 + r * 13.1) * 9137.3; return s - Math.floor(s); };
    for (let k = 0, x = -94; x < 96; k++, x += 11.2) {
      const xx = x + (rnd(k) - .5) * 2.4, zz = lane(xx) + 6.8 + (rnd(k + 40) - .5) * 1.6;
      cands.push({ x: xx, z: zz, yaw: Math.PI + (rnd(k + 90) - .5) * .16, row: r });
    }
  }
  const ok = c => {
    if (Math.abs(c.x - xr(c.z)) < 12) return false;
    if (Math.hypot(c.x - cx, c.z - cz) < 19) return false;
    if (Math.hypot(c.x - L.plaza.x, c.z - L.plaza.z) < 14) return false;
    if (Math.hypot(c.x - lc.x, c.z - lc.z) < 26) return false;
    if (polyDist(roads[0], c.x, c.z) < 7) return false;
    if (baseH(c.x, c.z) < 1.5) return false;
    if (c.z > zr - 12 && c.row > 3) return false;
    return true;
  };
  const good = cands.filter(ok).sort((a, b) => Math.hypot(a.x - 4, (a.z - (z0 + 40)) * 1.4) - Math.hypot(b.x - 4, (b.z - (z0 + 40)) * 1.4)).slice(0, 72);
  good.forEach((c, i) => {
    const h = baseH(c.x, c.z);
    addPad(c.x, c.z, 4.6, h, 4.5);
    L.houses.push({ idx: i, x: c.x, z: c.z, y: h, yaw: c.yaw, w: 9, d: 8, hgt: 14 });
  });
  return L;
}
const KIND = ['Bakery', 'Nail salon', 'Hair salon', 'Cafe', 'Flower shop', 'Barber'];
