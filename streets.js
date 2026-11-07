/* Nestville streets (step 1 of "make the town like the photo").
   world.js lays out the streets (L.streets: polylines, L.xwalks: crosswalks, L.inter: intersections). This file draws them:
   dark asphalt with a little tone variation, light curbs on both edges, a dashed white centre line (not through intersections),
   and zebra crosswalks. Everything is two meshes (asphalt, markings), so it costs two draw calls.
   Runs next to town.js and extras.js and reads the same scene (window.__nv). Add  import './streets.js';  where extras.js is imported.
   Colours are at the top: tune ASPHALT / CURB / PAINT to taste. */
import * as THREE from './lib.js';
import { H, L, ROAD_W, XW } from './world.js';

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

const ASPHALT = '#3b3d45', CURB = '#c9c3b4', SKIRT = '#8d887c', PAINT = '#f4f1e8';
export const LIFT = .02; /* the street surface sits this far above the highest ground across its width; the row sidewalks are .16 above the same ground, so the kerb is ~.14 high */

/* tiny indexed-geometry builder with per-vertex colour and explicit normals */
export function Builder() {
  const pos = [], col = [], nor = [], idx = [];
  return {
    quad(a, b, c, d, color, n = [0, 1, 0]) {
      const k = pos.length / 3, C = new THREE.Color(color);
      for (const p of [a, b, c, d]) { pos.push(p[0], p[1], p[2]); col.push(C.r, C.g, C.b); nor.push(n[0], n[1], n[2]); }
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    },
    box(cx, cy, cz, sx, sy, sz, color) { /* axis-aligned box (no bottom face) */
      const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
      this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], color, [0, 1, 0]);
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, [0, 0, 1]);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color, [0, 0, -1]);
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color, [1, 0, 0]);
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color, [-1, 0, 0]);
    },
    geo() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setIndex(idx);
      return g;
    },
    mesh(mat) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setIndex(idx);
      return new THREE.Mesh(g, mat);
    }
  };
}
const hash = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
const shade = (hex, t) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, t); return '#' + c.getHexString(); };

/* samples along a polyline, every ~2 units: position, tangent, arc length, and the road surface height (smoothed highest ground across the width) */
export function sample(pts, hw) {
  const S = []; let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], len = Math.hypot(x1 - x0, z1 - z0) || 1, n = Math.max(1, Math.ceil(len / 2));
    for (let k = 0; k < n; k++) S.push({ x: x0 + (x1 - x0) * k / n, z: z0 + (z1 - z0) * k / n, tx: (x1 - x0) / len, tz: (z1 - z0) / len });
  }
  const e = pts[pts.length - 1], pr = S[S.length - 1]; S.push({ x: e[0], z: e[1], tx: pr.tx, tz: pr.tz });
  S.forEach((p, i) => {
    p.s = i ? S[i - 1].s + Math.hypot(p.x - S[i - 1].x, p.z - S[i - 1].z) : 0;
    const nx = -p.tz, nz = p.tx;
    p.L = [p.x + nx * hw, p.z + nz * hw]; p.R = [p.x - nx * hw, p.z - nz * hw];
    p.g = Math.max(H(p.x, p.z), H(p.L[0], p.L[1]), H(p.R[0], p.R[1]));
  });
  let h = S.map(p => p.g);
  h = h.map((v, i) => Math.max(v, i > 0 ? h[i - 1] : v, i < h.length - 1 ? h[i + 1] : v)); /* local max first, so smoothing cannot dip under a bump */
  for (let it = 0; it < 2; it++) { const g = h.slice(); for (let i = 1; i < g.length - 1; i++) h[i] = (g[i - 1] + 2 * g[i] + g[i + 1]) / 4; }
  S.forEach((p, i) => { p.y = h[i] + LIFT; p.yl = Math.min(p.y - .3, H(p.L[0], p.L[1]) - .3); p.yr = Math.min(p.y - .3, H(p.R[0], p.R[1]) - .3); });
  return S;
}
/* point on a sampled street at arc length s */
export function at(S, s) {
  let i = 1; while (i < S.length - 1 && S[i].s < s) i++;
  const a = S[i - 1], c = S[i], t = Math.max(0, Math.min(1, (s - a.s) / ((c.s - a.s) || 1)));
  return { x: a.x + (c.x - a.x) * t, z: a.z + (c.z - a.z) * t, y: a.y + (c.y - a.y) * t, tx: a.tx, tz: a.tz };
}

ready(nv => {
  const scene = nv.scene, streets = L.streets || [];
  if (!streets.length) return;
  const road = Builder(), mark = Builder(), all = []; /* all: every sample, for looking up the street height under a crosswalk */
  const inter = L.inter || [];
  const nearInter = (x, z, r) => inter.some(p => Math.hypot(x - p.x, z - p.z) < r);

  streets.forEach(st => {
    const hw = ROAD_W / 2 * (st.k === 'ew' ? 1 : (XW * 2) / ROAD_W), S = sample(st.pts, hw), cw = .26; /* cw: curb width */
    S.forEach(p => all.push(p));
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], c = S[i + 1], tone = (hash(st.row === undefined ? st.x : st.row, i) - .5) * .02;
      const col = shade(ASPHALT, tone);
      road.quad([a.L[0], a.y, a.L[1]], [a.R[0], a.y, a.R[1]], [c.R[0], c.y, c.R[1]], [c.L[0], c.y, c.L[1]], col);
      /* skirts down to the ground, so nothing floats on a cross slope */
      road.quad([a.L[0], a.yl, a.L[1]], [a.L[0], a.y, a.L[1]], [c.L[0], c.y, c.L[1]], [c.L[0], c.yl, c.L[1]], SKIRT, [-a.tz, 0, a.tx]);
      road.quad([a.R[0], a.yr, a.R[1]], [a.R[0], a.y, a.R[1]], [c.R[0], c.y, c.R[1]], [c.R[0], c.yr, c.R[1]], SKIRT, [a.tz, 0, -a.tx]);
      /* light curbs along both edges (not at an intersection, where the other street crosses) */
      const mid = at(S, (a.s + c.s) / 2);
      if (!nearInter(mid.x, mid.z, hw + .6)) {
        const k = cw / (2 * hw), f = (P, Q, t, y) => [P[0] + (Q[0] - P[0]) * t, y, P[1] + (Q[1] - P[1]) * t];
        const y0 = .012;
        mark.quad([a.L[0], a.y + y0, a.L[1]], f(a.L, a.R, k, a.y + y0), f(c.L, c.R, k, c.y + y0), [c.L[0], c.y + y0, c.L[1]], CURB);
        mark.quad(f(a.L, a.R, 1 - k, a.y + y0), [a.R[0], a.y + y0, a.R[1]], [c.R[0], c.y + y0, c.R[1]], f(c.L, c.R, 1 - k, c.y + y0), CURB);
      }
    }
    /* dashed centre line: 2.0 long, 2.4 gap, none inside an intersection or crosswalk zone */
    const total = S[S.length - 1].s;
    for (let s = 1.5; s + 2 < total - 1.5; s += 4.4) {
      const m = at(S, s + 1);
      if (nearInter(m.x, m.z, hw + 3.6)) continue;
      const p0 = at(S, s), p1 = at(S, s + 2), w = .09, y = .014;
      mark.quad([p0.x - p0.tz * w, p0.y + y, p0.z + p0.tx * w], [p0.x + p0.tz * w, p0.y + y, p0.z - p0.tx * w], [p1.x + p1.tz * w, p1.y + y, p1.z - p1.tx * w], [p1.x - p1.tz * w, p1.y + y, p1.z + p1.tx * w], PAINT);
    }
  });

  /* crosswalks: zebra stripes run along the traffic, spaced across the street */
  const yAt = (x, z) => { let best = 1e9, y = H(x, z) + LIFT; for (const p of all) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; y = p.y; } } return y; };
  (L.xwalks || []).forEach(w => {
    const nx = -w.dz, nz = w.dx, k = Math.max(2, Math.floor(w.w / .9)), y = yAt(w.x, w.z) + .018;
    for (let j = 0; j < k; j++) {
      const o = (j - (k - 1) / 2) * (w.w - .5) / (k - 1), cx = w.x + nx * o, cz = w.z + nz * o, hl = 1.0, hn = .24;
      const P = (a, b) => [cx + w.dx * a + nx * b, y, cz + w.dz * a + nz * b];
      mark.quad(P(-hl, -hn), P(-hl, hn), P(hl, hn), P(hl, -hn), PAINT);
    }
  });

  const asphalt = road.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const paint = mark.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  asphalt.receiveShadow = true; paint.receiveShadow = true; asphalt.castShadow = false; paint.castShadow = false;
  asphalt.name = 'streets'; paint.name = 'street-markings';
  scene.add(asphalt, paint);
});
