/* Nestville streets (step 1 of "make the town like the photo").
   world.js lays out the streets (L.streets: polylines, L.xwalks: crosswalks, L.inter: intersections). This file draws them:
   dark asphalt with a little tone variation, light curbs on both edges, a dashed white centre line (not through intersections),
   and zebra crosswalks. Everything is two meshes (asphalt, markings), so it costs two draw calls.
   Every street now ends in a half round turning bay with a curb all round, so no street stops dead against the grass.
   Runs next to town.js and extras.js and reads the same scene (window.__nv). Add  import './streets.js';  where extras.js is imported.
   Colours are at the top: tune ASPHALT / CURB / PAINT to taste.
   Road look pass (photo): bolder curbs (CURB_W), longer and thicker centre dashes (DASH, GAP, DASH_W), bigger zebra stripes.
   Cross streets (roads.js): curbs now also stop short of an intersection on the narrower cross street, so no curb stub lies on the crossing road.
   TOWN LAYOUT FIX (part 1): every street now has a raised curb and a paved sidewalk on BOTH sides (no grass or water ever touches the asphalt), the grass verge
   between a row street and its row sidewalk is paved (street trees and lamps stand in it), lake and river edges get a low stone wall, bridge decks get parapets,
   and street trees get a little planter. See the SIDEWALKS block below. Only a few zebra crosswalks are drawn now (XWALK_EVERY).
   Road network fix: road bridges over the river (k 'bridge', flat deck), ring links (k 'ring'), and no turning bay where a street end joins another street. */
import * as THREE from './lib.js';
import { H, L, ROAD_W, XW, ROAD_OFF, WL, polyDist, canalDist } from './world.js';
import { surfaceY, addSurf } from './paths.js';
import './polish.js'; /* smaller sun + natural water (polish.js) */

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

const ASPHALT = '#7a7d8a', CURB = '#c9c3b4', SKIRT = '#8d887c', PAINT = '#f4f1e8';
const CURB_W = .45, DASH = 3.2, GAP = 3.0, DASH_W = .16; /* curb width, centre dash length, gap between dashes, half width of a dash */
const XWALK_EVERY = 5; /* draw only every 5th crosswalk: a few, not one on every corner (1 = all of them) */
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
    const hw = ROAD_W / 2 * (st.k === 'ns' ? (XW * 2) / ROAD_W : 1), S = sample(st.pts, hw), cw = CURB_W; /* cw: curb width */
    if (st.k === 'bridge') { /* road bridge over the river: a flat deck between the two banks, with a deep edge so it does not float */
      const y0 = S[0].y, y1 = S[S.length - 1].y, tot = S[S.length - 1].s || 1;
      S.forEach(p => { p.y = y0 + (y1 - y0) * (p.s / tot); p.yl = p.y - .9; p.yr = p.y - .9; });
    }
    S.forEach(p => all.push(p));
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], c = S[i + 1], tone = (hash(st.row === undefined ? st.x : st.row, i) - .5) * .02;
      const col = shade(ASPHALT, tone);
      road.quad([a.L[0], a.y, a.L[1]], [a.R[0], a.y, a.R[1]], [c.R[0], c.y, c.R[1]], [c.L[0], c.y, c.L[1]], col);
      /* skirts down to the ground, so nothing floats on a cross slope */
      road.quad([a.L[0], a.yl, a.L[1]], [a.L[0], a.y, a.L[1]], [c.L[0], c.y, c.L[1]], [c.L[0], c.yl, c.L[1]], SKIRT, [-a.tz, 0, a.tx]);
      road.quad([a.R[0], a.yr, a.R[1]], [a.R[0], a.y, a.R[1]], [c.R[0], c.y, c.R[1]], [c.R[0], c.yr, c.R[1]], SKIRT, [a.tz, 0, -a.tx]);
      /* (the old flat curb strips are gone: the SIDEWALKS block below builds real raised curbs on both sides) */
    }
    /* dashed centre line: DASH long, GAP between, none inside an intersection or crosswalk zone */
    const total = S[S.length - 1].s;
    for (let s = 1.5; s + DASH < total - 1.5; s += DASH + GAP) {
      const m = at(S, s + DASH / 2);
      if (nearInter(m.x, m.z, hw + 3.6)) continue;
      const p0 = at(S, s), p1 = at(S, s + DASH), w = DASH_W, y = .014;
      mark.quad([p0.x - p0.tz * w, p0.y + y, p0.z + p0.tx * w], [p0.x + p0.tz * w, p0.y + y, p0.z - p0.tx * w], [p1.x + p1.tz * w, p1.y + y, p1.z - p1.tx * w], [p1.x - p1.tz * w, p1.y + y, p1.z + p1.tx * w], PAINT);
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

  /* crosswalks: zebra stripes run along the traffic, spaced across the street. Only a few are drawn (every XWALK_EVERY-th one). */
  const yAt = (x, z) => { let best = 1e9, y = H(x, z) + LIFT; for (const p of all) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; y = p.y; } } return y; };
  (L.xwalks || []).filter((w, i) => i % XWALK_EVERY === 0).forEach(w => {
    const nx = -w.dz, nz = w.dx, k = Math.max(2, Math.floor(w.w / .9)), y = yAt(w.x, w.z) + .018;
    for (let j = 0; j < k; j++) {
      const o = (j - (k - 1) / 2) * (w.w - .5) / (k - 1), cx = w.x + nx * o, cz = w.z + nz * o, hl = 1.4, hn = .3;
      const P = (a, b) => [cx + w.dx * a + nx * b, y, cz + w.dz * a + nz * b];
      mark.quad(P(-hl, -hn), P(-hl, hn), P(hl, hn), P(hl, -hn), PAINT);
    }
  });

  /* ================= SIDEWALKS (town layout part 1) =================
     Cross section of every street, from the middle outward:  asphalt | raised curb (CB) | paved sidewalk | house lot.
     - Row streets: the south side is the old grass verge (street trees and lamps stand there); it is paved all the way to the row sidewalk of paths.js,
       so the two form one wide boulevard sidewalk. The north side gets a normal sidewalk (SW wide) in front of the back gardens.
     - Cross streets and ring links: a sidewalk (SW_NS wide) on both sides.
     - Where another street crosses, the sidewalk and curb stop at its kerb line (a crossing), so no sidewalk lies on a road.
     - Where open water lies just outside a sidewalk (the lake, the river), a low stone wall with posts runs along its outer edge.
     - Bridge decks get a stone parapet on both sides.
     - Street trees get a stone-edged planter (tree pit).
     Tune the numbers just below. */
  const WALKC = '#d9d3c5', CURBC = '#e6e1d3', JOINTC = '#bdb7a8', STONEC = '#cdc6b6', CAPC = '#e8e3d6', SOILC = '#5b4737', EDGEC = '#c4beaf';
  const CB2 = .42, SW = 2.6, SW_NS = 2.2, CURB_H = .17, WALK_H = .14, ROW_EDGE = -ROAD_OFF - .3 + .15; /* ROW_EDGE: distance from a row street's middle to the north edge of its row sidewalk (+ a little overlap) */
  const side = Builder(), bandSegs = [];
  /* winding-safe quads: the materials are double sided, and a back-facing triangle gets its normal flipped (it would render dark), so every quad is
     wound to agree with the normal it was given. This is what lets the same code build both sides of a street. */
  const wind = (a, b, c, d, n) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return (u[1] * v[2] - u[2] * v[1]) * n[0] + (u[2] * v[0] - u[0] * v[2]) * n[1] + (u[0] * v[1] - u[1] * v[0]) * n[2] < 0; };
  const sq = (a, b, c, d, col, n = [0, 1, 0]) => wind(a, b, c, d, n) ? side.quad(a, d, c, b, col, n) : side.quad(a, b, c, d, col, n);
  const mq = (a, b, c, d, col, n = [0, 1, 0]) => wind(a, b, c, d, n) ? mark.quad(a, d, c, b, col, n) : mark.quad(a, b, c, d, col, n);

  const hwOfSt = st => st.k === 'ns' ? XW : ROAD_W / 2;
  const others = st => streets.filter(o => o !== st && o.k !== 'bridge');
  const lat = (p, sg, o) => [p.x + sg * -p.tz * o, p.z + sg * p.tx * o];
  const wet = (x, z) => H(x, z) < WL + .06 || canalDist(x, z) < .6;
  const wall = (a, c, sg, o, top0, top1, ya, yc) => { /* low stone wall: 0.38 thick, 0.55 high, from lateral offset o-0.38 to o */
    const A0 = lat(a, sg, o - .38), A1 = lat(a, sg, o), C0 = lat(c, sg, o - .38), C1 = lat(c, sg, o), h = .55;
    sq([A0[0], top0 + h, A0[1]], [A1[0], top0 + h, A1[1]], [C1[0], top1 + h, C1[1]], [C0[0], top1 + h, C0[1]], CAPC);
    sq([A1[0], ya, A1[1]], [A1[0], top0 + h, A1[1]], [C1[0], top1 + h, C1[1]], [C1[0], yc, C1[1]], STONEC, [sg * -a.tz, 0, sg * a.tx]);
    sq([A0[0], top0, A0[1]], [A0[0], top0 + h, A0[1]], [C0[0], top1 + h, C0[1]], [C0[0], top1, C0[1]], STONEC, [-sg * -a.tz, 0, -sg * a.tx]);
  };
  const post = (p, sg, o, y) => { const q = lat(p, sg, o - .19); side.box(q[0], y + .5, q[1], .56, 1.0, .56, STONEC); side.box(q[0], y + 1.04, q[1], .7, .1, .7, CAPC); };

  streets.forEach(st => {
    const hw = hwOfSt(st), S = sample(st.pts, hw);
    if (S.length < 2) return;
    if (st.k === 'bridge') { /* flat deck: stone parapet on both edges */
      const y0 = S[0].y, y1 = S[S.length - 1].y, tot = S[S.length - 1].s || 1;
      S.forEach(p => { p.y = y0 + (y1 - y0) * (p.s / tot); });
      for (const sg of [1, -1]) {
        for (let i = 0; i < S.length - 1; i++) { const a = S[i], c = S[i + 1]; wall(a, c, sg, hw + .12, a.y, c.y, a.y - .9, c.y - .9); }
        for (let i = 0; i < S.length; i += 2) post(S[i], sg, hw + .12, S[i].y);
      }
      return;
    }
    const oth = others(st);
    for (const sg of [1, -1]) {
      const south = sg * S[Math.floor(S.length / 2)].tx > 0 && st.k === 'ew' && Math.abs(S[Math.floor(S.length / 2)].tx) > .7; /* the side that carries the row sidewalk */
      const o0 = hw, o1 = hw + CB2, o2 = o1 + (st.k === 'ns' ? SW_NS : south ? ROW_EDGE - o1 : SW);
      /* band top height: the road surface + WALK_H, but never under the ground beside it; smoothed along the street */
      let top = S.map(p => { const m = lat(p, sg, (o1 + o2) / 2), e = lat(p, sg, o2); return Math.min(p.y + .7, Math.max(p.y + WALK_H, H(m[0], m[1]) + .08, H(e[0], e[1]) + .08)); });
      top = top.map((v, i) => Math.max(v, i > 0 ? top[i - 1] : v, i < top.length - 1 ? top[i + 1] : v));
      for (let it = 0; it < 2; it++) { const g = top.slice(); for (let i = 1; i < g.length - 1; i++) top[i] = (g[i - 1] + 2 * g[i] + g[i + 1]) / 4; }
      /* outer edge height: where it meets a row sidewalk it takes that sidewalk's height (a hair lower, so the sidewalk wins the overlap) */
      const outTop = S.map((p, i) => { if (!south) return top[i]; const q = lat(p, sg, o2 + .5), y = surfaceY(q[0], q[1]); return y === null || y === undefined ? top[i] : y - .03; });
      const cut = []; /* is this segment inside another street? */
      for (let i = 0; i < S.length - 1; i++) {
        const a = S[i], c = S[i + 1], m = lat({ x: (a.x + c.x) / 2, z: (a.z + c.z) / 2, tx: a.tx, tz: a.tz }, sg, (o0 + o2) / 2);
        cut.push(oth.some(o => polyDist(o.pts, m[0], m[1]) < hwOfSt(o) + .3 || polyDist(o.pts, lat(a, sg, o1 + .3)[0], lat(a, sg, o1 + .3)[1]) < hwOfSt(o) + .1 && polyDist(o.pts, lat(c, sg, o1 + .3)[0], lat(c, sg, o1 + .3)[1]) < hwOfSt(o) + .1));
      }
      let jointAt = 1.1;
      for (let i = 0; i < S.length - 1; i++) {
        if (cut[i]) continue;
        const a = S[i], c = S[i + 1], tn = (hash(st.row === undefined ? st.x || 3 : st.row, i * 2 + sg) - .5) * .03;
        const P = (p, o, y) => { const q = lat(p, sg, o); return [q[0], y, q[1]]; };
        const ga = Math.min(top[i] - .3, H(...lat(a, sg, o2)) - .3), gc = Math.min(top[i + 1] - .3, H(...lat(c, sg, o2)) - .3);
        const ct0 = Math.max(a.y + CURB_H, top[i] + .015), ct1 = Math.max(c.y + CURB_H, top[i + 1] + .015);
        /* sidewalk top, curb top, curb face toward the street, outer skirt */
        sq(P(a, o1, top[i]), P(a, o2, outTop[i]), P(c, o2, outTop[i + 1]), P(c, o1, top[i + 1]), shade(WALKC, tn));
        sq(P(a, o0, ct0), P(a, o1, ct0), P(c, o1, ct1), P(c, o0, ct1), CURBC);
        sq(P(a, o0, a.y - .02), P(a, o0, ct0), P(c, o0, ct1), P(c, o0, c.y - .02), EDGEC, [-sg * -a.tz, 0, -sg * a.tx]);
        sq(P(a, o1, top[i]), P(a, o1, ct0), P(c, o1, ct1), P(c, o1, top[i + 1]), EDGEC, [sg * -a.tz, 0, sg * a.tx]);
        const w1 = lat(a, sg, o2 + 1.6), w2 = lat(c, sg, o2 + 1.6), isWet = wet(w1[0], w1[1]) || wet(w2[0], w2[1]);
        if (!isWet && (!south || outTop[i] === top[i])) sq(P(a, o2, ga), P(a, o2, outTop[i]), P(c, o2, outTop[i + 1]), P(c, o2, gc), EDGEC, [sg * -a.tz, 0, sg * a.tx]);
        /* end caps where the sidewalk stops (a street crosses, or the street ends) */
        const gl = (p, o) => Math.min(p.y - .3, H(...lat(p, sg, o)) - .3);
        if (i === 0 || cut[i - 1]) { sq(P(a, o0, a.y - .02), P(a, o0, ct0), P(a, o1, ct0), P(a, o1, top[i]), EDGEC, [-a.tx, 0, -a.tz]); sq(P(a, o1, gl(a, o2)), P(a, o1, top[i]), P(a, o2, outTop[i]), P(a, o2, gl(a, o2)), EDGEC, [-a.tx, 0, -a.tz]); }
        if (i === S.length - 2 || cut[i + 1]) { sq(P(c, o0, c.y - .02), P(c, o0, ct1), P(c, o1, ct1), P(c, o1, top[i + 1]), EDGEC, [c.tx, 0, c.tz]); sq(P(c, o1, gl(c, o2)), P(c, o1, top[i + 1]), P(c, o2, outTop[i + 1]), P(c, o2, gl(c, o2)), EDGEC, [c.tx, 0, c.tz]); }
        /* slab joints across the sidewalk */
        if (c.s > jointAt) { const q = (o, y) => lat(c, sg, o); const j0 = lat(c, sg, o1), j1 = lat(c, sg, o2), y = (top[i + 1] + outTop[i + 1]) / 2 + .008, w = .045; mq([j0[0] - c.tx * w, top[i + 1] + .008, j0[1] - c.tz * w], [j1[0] - c.tx * w, y, j1[1] - c.tz * w], [j1[0] + c.tx * w, y, j1[1] + c.tz * w], [j0[0] + c.tx * w, top[i + 1] + .008, j0[1] + c.tz * w], JOINTC); jointAt = c.s + 2.2; }
        /* walkable surface (people, first-person walk, tree pits) */
        const mc = (o1 + o2) / 2, qa = lat(a, sg, mc), qc = lat(c, sg, mc);
        addSurf(qa[0], qa[1], qc[0], qc[1], (o2 - o1) / 2, (top[i] + outTop[i]) / 2, (top[i + 1] + outTop[i + 1]) / 2);
        bandSegs.push([qa[0], qa[1], qc[0], qc[1], (o2 - o1) / 2]);
        /* open water just outside: low stone wall along the outer edge */
        if (isWet) { wall(a, c, sg, o2, outTop[i], outTop[i + 1], ga, gc); if (i % 2 === 0) post(a, sg, o2, outTop[i]); }
      }
    }
  });

  /* tree pits: the little street trees (town.js streetSpots) that stand on a sidewalk get a stone-edged planter */
  let pits = 0;
  if (nv.streetSpots) nv.streetSpots().forEach(([x, , z]) => {
    if (!bandSegs.some(b => { const vx = b[2] - b[0], vz = b[3] - b[1], t = Math.max(0, Math.min(1, ((x - b[0]) * vx + (z - b[1]) * vz) / (vx * vx + vz * vz + 1e-6))); return Math.hypot(x - b[0] - vx * t, z - b[1] - vz * t) < b[4] - .9; })) return;
    const y = surfaceY(x, z); if (y === null || y === undefined) return;
    pits++; const h = .75, e = .26; /* half size, border width */
    for (const [cx, cz, sx, sz] of [[x, z - h, 2 * h + e, e], [x, z + h, 2 * h + e, e], [x - h, z, e, 2 * h - e], [x + h, z, e, 2 * h - e]]) side.box(cx, y + .1, cz, sx, .2, sz, STONEC);
    sq([x - h + e / 2, y + .13, z - h + e / 2], [x - h + e / 2, y + .13, z + h - e / 2], [x + h - e / 2, y + .13, z + h - e / 2], [x + h - e / 2, y + .13, z - h + e / 2], SOILC);
  });
  const sidewalks = side.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  sidewalks.receiveShadow = true; sidewalks.castShadow = false; sidewalks.name = 'street-sidewalks'; sidewalks.userData = { pits, segs: bandSegs.length }; scene.add(sidewalks);

  const asphalt = road.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const paint = mark.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  asphalt.receiveShadow = true; paint.receiveShadow = true; asphalt.castShadow = false; paint.castShadow = false;
  asphalt.name = 'streets'; paint.name = 'street-markings';
  scene.add(asphalt, paint);
});
