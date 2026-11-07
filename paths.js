/* Nestville paths: smooth pavement, no stairs anywhere.
   Every sidewalk is a continuous ribbon. Its height is the HIGHEST ground across its width (then smoothed), so the grass can
   never poke through the pavement (that was the green patches). Gentle slopes become gentle ramps. Slab joints and edge stripes
   keep it looking like pavement. This file also places the stone bridges, the lakefront footbridges and the five parked bicycles.
   It also records every sidewalk (RIB) so people can walk on the real surface, and a pavement mask so the terrain under a
   sidewalk is painted grey instead of green. */
import { H } from './world.js';
import { K, qd, bridge, fbridge, bicycle } from './build.js';

const WALK = '#d9d4c7', EDGE = '#c8c2b3', JOINT = '#bcb6a7', PATH = '#e6dec8', LIFT = .16;

/* every tagged sidewalk: { tag, pts: [[x, z, topY], ...] } (read by folks.js) */
export const RIB = [];

/* pavement mask: spatial hash of sidewalk segments, read by the terrain colouring in town.js */
const PAVED = new Map(), CELL = 8;
function regPaved(x0, z0, x1, z1, hw, col) {
  const m = hw + 2, ax = Math.floor((Math.min(x0, x1) - m) / CELL), bx = Math.floor((Math.max(x0, x1) + m) / CELL), az = Math.floor((Math.min(z0, z1) - m) / CELL), bz = Math.floor((Math.max(z0, z1) + m) / CELL);
  for (let i = ax; i <= bx; i++) for (let j = az; j <= bz; j++) { const k = i + ',' + j; let a = PAVED.get(k); if (!a) PAVED.set(k, a = []); a.push([x0, z0, x1, z1, hw, col]); }
}
const PV = { d: 99, col: null };
/* distance from (x,z) to the edge of the nearest sidewalk (negative = on it) and its colour */
export function pavement(x, z) {
  PV.d = 99; PV.col = null;
  const a = PAVED.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); if (!a) return PV;
  for (const s of a) {
    const vx = s[2] - s[0], vz = s[3] - s[1], t = Math.max(0, Math.min(1, ((x - s[0]) * vx + (z - s[1]) * vz) / (vx * vx + vz * vz + 1e-6)));
    const d = Math.hypot(x - (s[0] + vx * t), z - (s[1] + vz * t)) - s[4];
    if (d < PV.d) { PV.d = d; PV.col = s[5]; }
  }
  return PV;
}

/* the sidewalk surface along a polyline: samples with their top height */
function profile(pts, w, o) {
  const lift = o.lift === undefined ? LIFT : o.lift, step = o.step || 1.6, hw = w / 2, S = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, z0] = pts[s], [x1, z1] = pts[s + 1], len = Math.hypot(x1 - x0, z1 - z0) || 1, n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) S.push({ x: x0 + (x1 - x0) * k / n, z: z0 + (z1 - z0) * k / n, tx: (x1 - x0) / len, tz: (z1 - z0) / len });
  }
  const e = pts[pts.length - 1], pr = S[S.length - 1]; S.push({ x: e[0], z: e[1], tx: pr.tx, tz: pr.tz });
  /* highest ground across the width: the surface must never end up below the grass */
  S.forEach(p => {
    const nx = -p.tz, nz = p.tx;
    p.h0 = H(p.x, p.z);
    p.h = Math.max(p.h0, H(p.x + nx * hw, p.z + nz * hw), H(p.x - nx * hw, p.z - nz * hw));
  });
  /* take the local maximum first (so smoothing cannot dip under a bump), then smooth: gentle, no bumps */
  let h = S.map(p => p.h);
  h = h.map((v, i) => Math.max(v, i > 0 ? h[i - 1] : v, i < h.length - 1 ? h[i + 1] : v));
  for (let it = 0; it < 2; it++) { const g = h.slice(); for (let i = 1; i < g.length - 1; i++) h[i] = (g[i - 1] + 2 * g[i] + g[i + 1]) / 4; }
  S.forEach((p, i) => {
    p.h = h[i]; p.top = p.h + lift; const nx = -p.tz, nz = p.tx;
    p.L = [p.x + nx * hw, p.z + nz * hw]; p.R = [p.x - nx * hw, p.z - nz * hw];
    p.bl = Math.min(p.top - .4, H(p.L[0], p.L[1]) - .3); p.br = Math.min(p.top - .4, H(p.R[0], p.R[1]) - .3);
  });
  return S;
}

function ribbon(b, pts, w, col = WALK, o = {}) {
  b.at(0, 0, 0, 0);
  const S = profile(pts, w, o), hw = w / 2, pc = K(col);
  if (o.tag) RIB.push({ tag: o.tag, pts: S.map(p => [p.x, p.z, p.top]) });
  for (let s = 0; s < pts.length - 1; s++) regPaved(pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1], hw, pc);
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], c = S[i + 1];
    if (a.h0 < .9 || c.h0 < .9) continue; /* never down into the lake */
    const A = [a.L[0], a.top, a.L[1]], B = [a.R[0], a.top, a.R[1]], C = [c.R[0], c.top, c.R[1]], D = [c.L[0], c.top, c.L[1]];
    qd(b, A, B, C, D, [0, 1, 0], col);
    qd(b, [a.L[0], a.bl, a.L[1]], A, D, [c.L[0], c.bl, c.L[1]], [-a.tz, 0, a.tx], EDGE);
    qd(b, [a.R[0], a.br, a.R[1]], B, C, [c.R[0], c.br, c.R[1]], [a.tz, 0, -a.tx], EDGE);
    if (!o.plain) {
      /* thin edge stripes and a slab joint, just above the surface */
      const k = .22 / w, e0 = .006, f = (P, Q, t) => [P[0] + (Q[0] - P[0]) * t, P[1] + e0, P[2] + (Q[2] - P[2]) * t];
      qd(b, A, f(A, B, k), f(D, C, k), D, [0, 1, 0], EDGE);
      qd(b, f(A, B, 1 - k), B, C, f(D, C, 1 - k), [0, 1, 0], EDGE);
      const jt = .05, J0 = [a.L[0], a.top + e0, a.L[1]], J1 = [a.R[0], a.top + e0, a.R[1]];
      qd(b, J0, J1, [J1[0] + a.tx * jt, J1[1], J1[2] + a.tz * jt], [J0[0] + a.tx * jt, J0[1], J0[2] + a.tz * jt], [0, 1, 0], JOINT);
    }
  }
  return S;
}

/* sidewalk height at x along a roughly east-west ribbon */
function yAt(S, x) {
  let i = 1; while (i < S.length - 1 && S[i].x < x) i++;
  const a = S[i - 1], c = S[i], t = Math.max(0, Math.min(1, (x - a.x) / ((c.x - a.x) || 1)));
  return a.top + (c.top - a.top) * t;
}

/* position at distance s in front of a house, along its facing direction */
const front = (h, s, side = 0) => [h.x + Math.sin(h.yaw) * s + Math.cos(h.yaw) * side, h.z + Math.cos(h.yaw) * s - Math.sin(h.yaw) * side];

const BIKE_COLORS = ['#d9463a', '#3f7fb5', '#e9a93a', '#4f9d69', '#e0527a'];
/* five bicycles in the cottage village: cottage index -> which side(s) of the gate they lean on. one house has one bike, one has two, most have none. */
export const BIKES = [[3, [1]], [12, [-1, 1]], [21, [1]], [37, [-1]]];

export function paths(b, L) {
  b.at(0, 0, 0, 0); /* reset the builder transform: the lamps built just before this left it shifted */
  RIB.length = 0; PAVED.clear();
  /* ---------- main village ---------- */
  L.bridges.forEach(br => bridge(b, br.x, br.y, br.z));
  L.fbr.forEach(f => fbridge(b, f.x, f.y, f.z));
  L.walks.forEach(w => ribbon(b, w.pts, w.w, WALK, { tag: w.kind }));
  /* a short path from every front door through the garden gate to the sidewalk */
  L.houses.forEach(h => { if (h.row > 0) ribbon(b, [front(h, 6.4), front(h, 8.7)], 1.4, PATH, { plain: true, lift: .1, step: 1.2 }); });
  L.shops.forEach(s => { if (s.row > 0) { const dx = 2.8, p = (z) => [s.x + dx * Math.cos(s.yaw) + z * Math.sin(s.yaw), s.z - dx * Math.sin(s.yaw) + z * Math.cos(s.yaw)]; ribbon(b, [p(5.2), p(8.7)], 1.7, PATH, { plain: true, lift: .1, step: 1.2 }); } });

  /* ---------- cottage village ---------- */
  const cot = L.cot; if (!cot.length) return;
  const rowZ = L.walk.z, prom = L.walk.prom, X0 = L.walk.x0, X1 = L.walk.x1;
  ribbon(b, [[X0, prom], [X1, prom]], 3.2, WALK, { tag: 'prom' }); /* lakeside promenade */
  const rows = rowZ.map(z => ribbon(b, [[X0, z], [X1, z]], 2.2, WALK, { tag: 'cot' })); /* a sidewalk in front of each terrace row */
  L.walk.conn.forEach(x => ribbon(b, [[x, prom], [x, rowZ[rowZ.length - 1]]], 1.3, PATH, { tag: 'conn' })); /* gentle N-S sidewalks between the rows */
  cot.forEach(c => { const r = Math.floor(c.i / 10), px = c.x + Math.sin(c.yaw) * 6.7; ribbon(b, [[px, c.z + Math.cos(c.yaw) * 6.7], [px + .1, rowZ[r] - .8]], 1.3, PATH, { plain: true, lift: .1, step: 1.2 }); });
  /* five bicycles parked on the sidewalk next to the garden gates, standing on the real sidewalk surface */
  let k = 0;
  BIKES.forEach(([i, sides]) => sides.forEach(sd => {
    const c = cot[i], r = Math.floor(i / 10), x = c.x + sd * 2.5, z = rowZ[r] - .15;
    bicycle(b, x, yAt(rows[r], x), z, (sd > 0 ? .1 : -.14) + (i % 3) * .03, BIKE_COLORS[k++ % BIKE_COLORS.length]);
  }));
}
