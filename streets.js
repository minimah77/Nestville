/* Nestville streets (step 1 of "make the town like the photo").
   world.js lays out the streets (L.streets: polylines, L.xwalks: crosswalks, L.inter: intersections). This file draws them:
   asphalt with a little tone variation, light curbs on both edges, a dashed white centre line (not through intersections),
   and zebra crosswalks. Everything is a few meshes (asphalt, markings, timber bridges), so it costs only a few draw calls.
   Every street now ends in a half round turning bay with a curb all round, so no street stops dead against the grass.
   Runs next to town.js and extras.js and reads the same scene (window.__nv). Add  import './streets.js';  where extras.js is imported.
   Colours are at the top: tune ASPHALT / CURB / PAINT to taste.
   Road look pass (photo): bolder curbs (CURB_W), longer and thicker centre dashes (DASH, GAP, DASH_W), bigger zebra stripes.
   Cross streets (roads.js): curbs now also stop short of an intersection on the narrower cross street, so no curb stub lies on the crossing road.
   Road network fix: road bridges over the river (k 'bridge'), ring links (k 'ring'), and no turning bay where a street end joins another street.
   Look fix 2: the Builder winds every face to match its normal (roads used to render almost black because many faces pointed down), one clean zebra
   per arm of every junction, sidewalks along the cross streets, and the road bridges are brown timber bridges with rails, lamps and piers. */
import * as THREE from './lib.js';
import { H, L, ROAD_W, XW, polyDist } from './world.js';
import './polish.js'; /* smaller sun + natural water (polish.js) */

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

const ASPHALT = '#5a5e67', CURB = '#d8d3c4', SKIRT = '#a9a595', PAINT = '#f7f4ea', SIDEW = '#dcd7ca';
/* timber bridge colours (brown, like the photo's pier) */
const PLANK_A = '#a06a3f', PLANK_B = '#8f5b34', BEAM = '#5b3a22', POST = '#6c4528', LAMP = '#f0cf7a';
const SW_W = 1.9; /* width of the sidewalk beside every cross street */
const CURB_W = .45, DASH = 3.2, GAP = 3.0, DASH_W = .16; /* curb width, centre dash length, gap between dashes, half width of a dash */
export const LIFT = .02; /* the street surface sits this far above the highest ground across its width; the row sidewalks are .16 above the same ground, so the kerb is ~.14 high */

/* tiny indexed-geometry builder with per-vertex colour and explicit normals */
export function Builder() {
  const pos = [], col = [], nor = [], idx = [];
  return {
    quad(a, b, c, d, color, n = [0, 1, 0]) {
      const k = pos.length / 3, C = new THREE.Color(color);
      for (const p of [a, b, c, d]) { pos.push(p[0], p[1], p[2]); col.push(C.r, C.g, C.b); nor.push(n[0], n[1], n[2]); }
      /* winding follows the normal: a quad whose corners run the "wrong" way used to face downward and was lit from underneath (almost black).
         Now every face is wound so its front side points the way its normal says, whatever order the corners were given in. */
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const gx = e1[1] * e2[2] - e1[2] * e2[1], gy = e1[2] * e2[0] - e1[0] * e2[2], gz = e1[0] * e2[1] - e1[1] * e2[0];
      if (gx * n[0] + gy * n[1] + gz * n[2] >= 0) idx.push(k, k + 1, k + 2, k, k + 2, k + 3); else idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
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
  const road = Builder(), mark = Builder(), wood = Builder(), all = []; /* all: every sample, for looking up the street height under a crosswalk */
  const inter = L.inter || [];
  const nearInter = (x, z, r) => inter.some(p => Math.hypot(x - p.x, z - p.z) < r);

  streets.forEach(st => {
    const hw = ROAD_W / 2 * (st.k === 'ns' ? (XW * 2) / ROAD_W : 1), S = sample(st.pts, hw), cw = CURB_W; /* cw: curb width */
    if (st.k === 'bridge') { /* road bridge over the river: a flat deck between the two banks, with a deep edge so it does not float */
      const y0 = S[0].y, y1 = S[S.length - 1].y, tot = S[S.length - 1].s || 1;
      S.forEach(p => { p.y = y0 + (y1 - y0) * (p.s / tot); p.yl = p.y - .9; p.yr = p.y - .9; });
    }
    S.forEach(p => all.push(p));
    if (st.k === 'bridge') { timberBridge(wood, S, hw); return; }
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], c = S[i + 1], tone = (hash(st.row === undefined ? st.x : st.row, i) - .5) * .02;
      const col = shade(ASPHALT, tone);
      road.quad([a.L[0], a.y, a.L[1]], [a.R[0], a.y, a.R[1]], [c.R[0], c.y, c.R[1]], [c.L[0], c.y, c.L[1]], col);
      /* skirts down to the ground, so nothing floats on a cross slope */
      road.quad([a.L[0], a.yl, a.L[1]], [a.L[0], a.y, a.L[1]], [c.L[0], c.y, c.L[1]], [c.L[0], c.yl, c.L[1]], SKIRT, [-a.tz, 0, a.tx]);
      road.quad([a.R[0], a.yr, a.R[1]], [a.R[0], a.y, a.R[1]], [c.R[0], c.y, c.R[1]], [c.R[0], c.yr, c.R[1]], SKIRT, [a.tz, 0, -a.tx]);
      /* light curbs along both edges (not at an intersection, where the other street crosses) */
      const mid = at(S, (a.s + c.s) / 2);
      if (!nearInter(mid.x, mid.z, Math.max(hw, ROAD_W / 2) + .6)) {
        const k = cw / (2 * hw), f = (P, Q, t, y) => [P[0] + (Q[0] - P[0]) * t, y, P[1] + (Q[1] - P[1]) * t];
        const y0 = .012;
        mark.quad([a.L[0], a.y + y0, a.L[1]], f(a.L, a.R, k, a.y + y0), f(c.L, c.R, k, c.y + y0), [c.L[0], c.y + y0, c.L[1]], CURB);
        mark.quad(f(a.L, a.R, 1 - k, a.y + y0), [a.R[0], a.y + y0, a.R[1]], [c.R[0], c.y + y0, c.R[1]], f(c.L, c.R, 1 - k, c.y + y0), CURB);
      }
    }
    /* dashed centre line: DASH long, GAP between, none inside an intersection or crosswalk zone */
    const total = S[S.length - 1].s;
    for (let s = 1.5; s + DASH < total - 1.5; s += DASH + GAP) {
      const m = at(S, s + DASH / 2);
      if (nearInter(m.x, m.z, hw + 3.6)) continue;
      const p0 = at(S, s), p1 = at(S, s + DASH), w = DASH_W, y = .014;
      mark.quad([p0.x - p0.tz * w, p0.y + y, p0.z + p0.tx * w], [p0.x + p0.tz * w, p0.y + y, p0.z - p0.tx * w], [p1.x + p1.tz * w, p1.y + y, p1.z - p1.tx * w], [p1.x - p1.tz * w, p1.y + y, p1.z + p1.tx * w], PAINT);
    }
    /* sidewalks along both sides of a cross street, with a gap where a row street crosses (the zebra crossing goes there) */
    if (st.k === 'ns') {
      for (let i = 0; i < S.length - 1; i++) {
        const a = S[i], c = S[i + 1], mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2;
        if (inter.some(p => Math.abs(mz - p.z) < ROAD_W / 2 + 2.6 && Math.abs(mx - p.x) < 8)) continue;
        for (const side of ['L', 'R']) {
          const sg = side === 'L' ? 1 : -1, o0 = hw + .08, o1 = hw + SW_W, up = .07;
          const P = (q, o) => [q.x + (-q.tz) * sg * o, q.z + q.tx * sg * o];
          const A0 = P(a, o0), A1 = P(a, o1), C0 = P(c, o0), C1 = P(c, o1);
          /* the strip follows the ground when it is higher than the street, so the grass never covers it */
          const ys = (q, P0, P1) => Math.max(q.y, H(P0[0], P0[1]), H(P1[0], P1[1])) + up;
          const yA = ys(a, A0, A1), yC = ys(c, C0, C1);
          mark.quad([A0[0], yA, A0[1]], [A1[0], yA, A1[1]], [C1[0], yC, C1[1]], [C0[0], yC, C0[1]], SIDEW);
          const ya = Math.min(yA - .3, H(A1[0], A1[1]) - .3), yc = Math.min(yC - .3, H(C1[0], C1[1]) - .3);
          road.quad([A1[0], ya, A1[1]], [A1[0], yA, A1[1]], [C1[0], yC, C1[1]], [C1[0], yc, C1[1]], SIDEW, [-a.tz * sg, 0, a.tx * sg]);
        }
      }
    }
    /* rounded ends: a street no longer stops dead against the grass. It finishes in a half round turning bay with a curb all round.
       (p.tx, p.tz) is the way the street runs; dir turns it to point out of the street at each end. */
    for (const [p, dir] of [[S[0], -1], [S[S.length - 1], 1]]) {
      if (streets.some(o => o !== st && polyDist(o.pts, p.x, p.z) < 4.5)) continue; /* this end joins another street: no turning bay, the road just carries on */
      const ox = p.tx * dir, oz = p.tz * dir, nx = -oz, nz = ox, N = 10;
      const pt = (a, r, y) => [p.x + (Math.cos(a) * ox + Math.sin(a) * nx) * r, y, p.z + (Math.cos(a) * oz + Math.sin(a) * nz) * r];
      for (let i = 0; i < N; i++) {
        const a0 = -Math.PI / 2 + Math.PI * i / N, a1 = -Math.PI / 2 + Math.PI * (i + 1) / N, am = (a0 + a1) / 2;
        const A = pt(a0, hw, p.y), Bp = pt(a1, hw, p.y), ctr = [p.x, p.y, p.z];
        road.quad(ctr, A, Bp, Bp, ASPHALT);
        const ya = Math.min(p.y - .3, H(A[0], A[2]) - .3), yb = Math.min(p.y - .3, H(Bp[0], Bp[2]) - .3);
        road.quad([A[0], ya, A[2]], A, Bp, [Bp[0], yb, Bp[2]], SKIRT, [Math.cos(am) * ox + Math.sin(am) * nx, 0, Math.cos(am) * oz + Math.sin(am) * nz]);
        mark.quad(pt(a0, hw, p.y + .012), pt(a1, hw, p.y + .012), pt(a1, hw - cw, p.y + .012), pt(a0, hw - cw, p.y + .012), CURB);
      }
    }
  });

  /* crosswalks: a zebra is a row of short bars that run ALONG the traffic, spaced ACROSS the street, always inside the asphalt.
     Every intersection gets one zebra on each of its four arms (placed just outside the junction), so they never pile up on each other. */
  const nearest = (x, z) => { let best = 1e9, q = all[0]; for (const p of all) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; q = p; } } return q; };
  const zebra = (cx, cz, dx, dz, width, y) => {
    const nx = -dz, nz = dx, BAR = .5, PITCH = 1.05, hl = 1.3, k = Math.max(2, Math.floor((width - 1.0) / PITCH) + 1), span = (k - 1) * PITCH;
    for (let j = 0; j < k; j++) {
      const o = -span / 2 + j * PITCH, bx = cx + nx * o, bz = cz + nz * o, hn = BAR / 2;
      const P = (a, b) => [bx + dx * a + nx * b, y, bz + dz * a + nz * b];
      mark.quad(P(-hl, -hn), P(-hl, hn), P(hl, hn), P(hl, -hn), PAINT);
    }
  };
  const onRoad = (x, z) => streets.some(o => o.k !== 'bridge' && polyDist(o.pts, x, z) < (o.k === 'ns' ? XW : ROAD_W / 2) + .2);
  inter.forEach(p => {
    const row = nearest(p.x, p.z), len = Math.hypot(row.tx, row.tz) || 1, tx = row.tx / len, tz = row.tz / len, d = XW + 2.2, d2 = ROAD_W / 2 + 2.2;
    for (const sg of [-1, 1]) {
      /* arm along the row street: the zebra crosses the row street */
      const ax = p.x + tx * d * sg, az = p.z + tz * d * sg;
      if (onRoad(ax + tx * 2 * sg, az + tz * 2 * sg)) { const q = nearest(ax, az); zebra(ax, az, tx, tz, ROAD_W, q.y + .02); }
      /* arm along the cross street: the zebra crosses the cross street */
      const bx = p.x, bz = p.z + d2 * sg;
      if (onRoad(bx, bz + 2 * sg)) { const q = nearest(bx, bz); zebra(bx, bz, 0, 1, XW * 2, q.y + .02); }
    }
  });
  /* zebras where a footpath crosses a street away from the junctions */
  (L.xwalks || []).forEach(w => {
    if (inter.some(p => Math.hypot(w.x - p.x, w.z - p.z) < 12)) return;
    zebra(w.x, w.z, w.dx, w.dz, w.w, nearest(w.x, w.z).y + .02);
  });

  /* ---------- the timber bridge ---------- */
  function timberBridge(B, S, hw) {
    const W = hw + .5, HUMP = .5, TH = .85, tot = S[S.length - 1].s || 1;
    const lift = (p) => p.y + .12 + HUMP * Math.sin(Math.PI * p.s / tot);
    const sd = (p, o) => [p.x + (-p.tz) * o, p.z + p.tx * o];
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], c = S[i + 1], ya = lift(a), yc = lift(c), col = i % 2 ? PLANK_A : PLANK_B;
      const aL = sd(a, W), aR = sd(a, -W), cL = sd(c, W), cR = sd(c, -W);
      B.quad([aL[0], ya, aL[1]], [aR[0], ya, aR[1]], [cR[0], yc, cR[1]], [cL[0], yc, cL[1]], col);
      B.quad([aR[0], ya - TH, aR[1]], [aL[0], ya - TH, aL[1]], [cL[0], yc - TH, cL[1]], [cR[0], yc - TH, cR[1]], BEAM, [0, -1, 0]);
      B.quad([aL[0], ya - TH, aL[1]], [aL[0], ya, aL[1]], [cL[0], yc, cL[1]], [cL[0], yc - TH, cL[1]], BEAM, [-a.tz, 0, a.tx]);
      B.quad([aR[0], ya, aR[1]], [aR[0], ya - TH, aR[1]], [cR[0], yc - TH, cR[1]], [cR[0], yc, cR[1]], BEAM, [a.tz, 0, -a.tx]);
      /* two rails per side: a low one and a hand rail, both with a visible top and inner face */
      for (const sg of [-1, 1]) for (const [h0, h1] of [[.5, .68], [1.0, 1.2]]) {
        const o = sg * (W - .12), w = .13, i0 = sd(a, o - w), i1 = sd(a, o + w), j0 = sd(c, o - w), j1 = sd(c, o + w);
        B.quad([i0[0], ya + h1, i0[1]], [i1[0], ya + h1, i1[1]], [j1[0], yc + h1, j1[1]], [j0[0], yc + h1, j0[1]], POST);
        const inn = sg > 0 ? [i0, j0] : [i1, j1];
        B.quad([inn[0][0], ya + h0, inn[0][1]], [inn[0][0], ya + h1, inn[0][1]], [inn[1][0], yc + h1, inn[1][1]], [inn[1][0], yc + h0, inn[1][1]], POST, [-a.tz * -sg, 0, a.tx * -sg]);
      }
      /* posts every other sample, and a heavy timber pier pair under every fourth one, down into the river bed */
      if (i % 2 === 0) for (const sg of [-1, 1]) { const q = sd(a, sg * (W - .12)); B.box(q[0], ya + .6, q[1], .3, 1.3, .3, POST); }
      if (i % 4 === 2) for (const sg of [-1, 1]) {
        const q = sd(a, sg * (W - .5)), bot = Math.min(H(q[0], q[1]) - .6, ya - 3.5);
        B.box(q[0], (ya - TH + bot) / 2, q[1], .75, ya - TH - bot, .75, BEAM);
      }
    }
    /* lamp posts at both ends */
    for (const [p, sg2] of [[S[0], 1], [S[S.length - 1], -1]]) for (const sg of [-1, 1]) {
      const q = sd(p, sg * (W - .12)), y = lift(p);
      B.box(q[0], y + 1.6, q[1], .34, 3.2, .34, BEAM); B.box(q[0], y + 3.4, q[1], .5, .5, .5, LAMP);
    }
  }

  const asphalt = road.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const paint = mark.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  asphalt.receiveShadow = true; paint.receiveShadow = true; asphalt.castShadow = false; paint.castShadow = false;
  const timber = wood.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  timber.castShadow = true; timber.receiveShadow = true; timber.name = 'road-bridges';
  asphalt.name = 'streets'; paint.name = 'street-markings';
  scene.add(asphalt, paint, timber);
});
