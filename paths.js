/* Nestville paths: smooth pavement, no stairs anywhere.
   Every sidewalk is a continuous ribbon that follows the real ground height (smoothed), so flat ground gives a flat
   sidewalk and any gentle slope becomes a gentle ramp. Light slab joints and edge stripes keep it looking like pavement.
   This file also places the stone bridges, the lakefront footbridges and the five parked bicycles. */
import { H } from './world.js';
import { qd, bridge, fbridge, bicycle } from './build.js';

const WALK = '#d9d4c7', EDGE = '#c8c2b3', JOINT = '#bcb6a7', PATH = '#e6dec8', LIFT = .14;

function ribbon(b, pts, w, col = WALK, o = {}) {
  b.at(0, 0, 0, 0);
  const lift = o.lift === undefined ? LIFT : o.lift, step = o.step || 1.6, hw = w / 2, S = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, z0] = pts[s], [x1, z1] = pts[s + 1], len = Math.hypot(x1 - x0, z1 - z0) || 1, n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) S.push({ x: x0 + (x1 - x0) * k / n, z: z0 + (z1 - z0) * k / n, tx: (x1 - x0) / len, tz: (z1 - z0) / len });
  }
  const e = pts[pts.length - 1], pr = S[S.length - 1]; S.push({ x: e[0], z: e[1], tx: pr.tx, tz: pr.tz });
  S.forEach(p => { p.h = H(p.x, p.z); });
  for (let it = 0; it < 2; it++) { const h = S.map(p => p.h); for (let i = 1; i < S.length - 1; i++) S[i].h = (h[i - 1] + 2 * h[i] + h[i + 1]) / 4; } /* gentle, no bumps */
  S.forEach(p => {
    p.top = p.h + lift; const nx = -p.tz, nz = p.tx;
    p.L = [p.x + nx * hw, p.z + nz * hw]; p.R = [p.x - nx * hw, p.z - nz * hw];
    p.bl = Math.min(p.top - .4, H(p.L[0], p.L[1]) - .3); p.br = Math.min(p.top - .4, H(p.R[0], p.R[1]) - .3);
  });
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], c = S[i + 1];
    if (a.h < .9 || c.h < .9) continue; /* never down into the lake */
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
}

/* position at distance s in front of a house, along its facing direction */
const front = (h, s, side = 0) => [h.x + Math.sin(h.yaw) * s + Math.cos(h.yaw) * side, h.z + Math.cos(h.yaw) * s - Math.sin(h.yaw) * side];

const BIKE_COLORS = ['#d9463a', '#3f7fb5', '#e9a93a', '#4f9d69', '#e0527a'];
/* five bicycles in the cottage village: cottage index -> which side(s) of the gate they lean on. one house has one bike, one has two, most have none. */
export const BIKES = [[3, [1]], [12, [-1, 1]], [21, [1]], [37, [-1]]];

export function paths(b, L) {
  b.at(0, 0, 0, 0); /* reset the builder transform: the lamps built just before this left it shifted */
  /* ---------- main village ---------- */
  L.bridges.forEach(br => bridge(b, br.x, br.y, br.z));
  L.fbr.forEach(f => fbridge(b, f.x, f.y, f.z));
  L.walks.forEach(w => ribbon(b, w.pts, w.w, WALK));
  /* a short path from every front door through the garden gate to the sidewalk */
  L.houses.forEach(h => { if (h.row > 0) ribbon(b, [front(h, 6.4), front(h, 8.7)], 1.4, PATH, { plain: true, lift: .1, step: 1.2 }); });
  L.shops.forEach(s => { if (s.row > 0) { const dx = 2.8, p = (z) => [s.x + dx * Math.cos(s.yaw) + z * Math.sin(s.yaw), s.z - dx * Math.sin(s.yaw) + z * Math.cos(s.yaw)]; ribbon(b, [p(5.2), p(8.7)], 1.7, PATH, { plain: true, lift: .1, step: 1.2 }); } });

  /* ---------- cottage village ---------- */
  const cot = L.cot; if (!cot.length) return;
  const rowZ = L.walk.z, prom = L.walk.prom, X0 = L.walk.x0, X1 = L.walk.x1;
  ribbon(b, [[X0, prom], [X1, prom]], 3.2, WALK); /* lakeside promenade */
  rowZ.forEach(z => ribbon(b, [[X0, z], [X1, z]], 2.2, WALK)); /* a sidewalk in front of each terrace row */
  L.walk.conn.forEach(x => ribbon(b, [[x, prom], [x, rowZ[rowZ.length - 1]]], 1.3, PATH)); /* gentle N-S sidewalks between the rows */
  cot.forEach(c => { const r = Math.floor(c.i / 10), px = c.x + Math.sin(c.yaw) * 6.7; ribbon(b, [[px, c.z + Math.cos(c.yaw) * 6.7], [px + .1, rowZ[r] - .8]], 1.3, PATH, { plain: true, lift: .1, step: 1.2 }); });
  /* five bicycles parked on the sidewalk next to the garden gates */
  let k = 0;
  BIKES.forEach(([i, sides]) => sides.forEach(sd => {
    const c = cot[i], r = Math.floor(i / 10), x = c.x + sd * 2.5, z = rowZ[r] - .45;
    bicycle(b, x, H(x, z) + LIFT, z, (sd > 0 ? .1 : -.14) + (i % 3) * .03, BIKE_COLORS[k++ % BIKE_COLORS.length]);
  }));
}
