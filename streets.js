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
   Road network fix: road bridges over the river (k 'bridge', flat deck), ring links (k 'ring'), and no turning bay where a street end joins another street.
   JUNCTION FIX (part 2): where streets meet, the sidewalks and curbs are now cut EXACTLY along the edge of the other street (a straight, angled cut, not a
   staircase), so no sidewalk piece lies on a road and no grass wedge is left in a corner. A street end that joins another street carries its asphalt (and its
   sidewalks) a little way into it, so bends and angled T-junctions have a filled, squared corner instead of a notch. Centre dashes no longer run into a crossing street. */
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
/* JUNCTION FIX helpers. refine: cuts a sampled street into finer pieces where m(a, c) says so (positions, tangent and height are interpolated, so the
   heights still match the asphalt exactly). pdist: distance from a point to a polyline, but it skips every segment that is farther than R away (fast). */
function refine(S, mFn) {
  const out = [];
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], c = S[i + 1], m = mFn(a, c);
    for (let k = 0; k < m; k++) {
      const t = k / m; let tx = a.tx + (c.tx - a.tx) * t, tz = a.tz + (c.tz - a.tz) * t; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      out.push({ x: a.x + (c.x - a.x) * t, z: a.z + (c.z - a.z) * t, y: a.y + (c.y - a.y) * t, tx, tz, s: a.s + (c.s - a.s) * t });
    }
  }
  out.push(S[S.length - 1]);
  return out;
}
function pdist(pl, x, z, R) {
  let best = 99;
  for (let i = 0; i < pl.length - 1; i++) {
    const ax = pl[i][0], az = pl[i][1], bx = pl[i + 1][0], bz = pl[i + 1][1];
    if ((ax < x - R && bx < x - R) || (ax > x + R && bx > x + R) || (az < z - R && bz < z - R) || (az > z + R && bz > z + R)) continue;
    const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz + 1e-6)));
    const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t)); if (d < best) best = d;
  }
  return best;
}

ready(nv => {
  const scene = nv.scene, streets = L.streets || [];
  if (!streets.length) return;
  const road = Builder(), mark = Builder(), all = []; /* all: every sample, for looking up the street height under a crosswalk */
  const inter = L.inter || [];
  const nearInter = (x, z, r) => inter.some(p => Math.hypot(x - p.x, z - p.z) < r);
  const hwOfSt = st => st.k === 'ns' ? XW : ROAD_W / 2;
  /* winding-safe quads: the materials are double sided, and a back-facing triangle gets its normal flipped (it would render dark), so every quad is
     wound to agree with the normal it was given. This is what lets the same code build both sides of a street. */
  const wind = (a, b, c, d, n) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return (u[1] * v[2] - u[2] * v[1]) * n[0] + (u[2] * v[0] - u[0] * v[2]) * n[1] + (u[0] * v[1] - u[1] * v[0]) * n[2] < 0; };
  const rq = (a, b, c, d, col, n = [0, 1, 0]) => wind(a, b, c, d, n) ? road.quad(a, d, c, b, col, n) : road.quad(a, b, c, d, col, n);
  const T = (e, h) => [e.x, h, e.z];
  /* does this street end p join another street (not a bridge)? */
  const joinsStreet = (st, p) => streets.some(o => o !== st && o.k !== 'bridge' && polyDist(o.pts, p.x, p.z) < 4.5);
  /* a street end that joins another street: carry the asphalt on into the other street (to just past its edge), so a bend or an angled T leaves no notch */
  const joinFill = (p, dir, hw) => {
    const ox = p.tx * dir, oz = p.tz * dir, nx = -oz, nz = ox, E = hw + .05, y = p.y;
    const gy = (x, z) => Math.min(y - .3, H(x, z) - .3);
    const A = [p.x + nx * hw, y, p.z + nz * hw], B = [p.x - nx * hw, y, p.z - nz * hw], A2 = [A[0] + ox * E, y, A[2] + oz * E], B2 = [B[0] + ox * E, y, B[2] + oz * E];
    rq(A, B, B2, A2, ASPHALT);
    for (const [u, v, n] of [[A, A2, [nx, 0, nz]], [B, B2, [-nx, 0, -nz]], [A2, B2, [ox, 0, oz]]]) rq([u[0], gy(u[0], u[2]), u[2]], u, v, [v[0], gy(v[0], v[2]), v[2]], SKIRT, n);
  };

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
    /* dashed centre line: DASH long, GAP between, none inside an intersection or crosswalk zone, and none inside another street */
    const total = S[S.length - 1].s;
    for (let s = 1.5; s + DASH < total - 1.5; s += DASH + GAP) {
      const m = at(S, s + DASH / 2);
      if (nearInter(m.x, m.z, hw + 3.6)) continue;
      if (streets.some(o => o !== st && o.k !== 'bridge' && polyDist(o.pts, m.x, m.z) < hwOfSt(o) + DASH / 2 + .4)) continue; /* a dash never lies on a crossing street */
      const p0 = at(S, s), p1 = at(S, s + DASH), w = DASH_W, y = .014;
      mark.quad([p0.x - p0.tz * w, p0.y + y, p0.z + p0.tx * w], [p0.x + p0.tz * w, p0.y + y, p0.z - p0.tx * w], [p1.x + p1.tz * w, p1.y + y, p1.z - p1.tx * w], [p1.x - p1.tz * w, p1.y + y, p1.z + p1.tx * w], PAINT);
    }
    /* rounded ends: a street no longer stops dead against the grass. It finishes in a half round turning bay with a curb all round.
       (p.tx, p.tz) is the way the street runs; dir turns it to point out of the street at each end. */
    for (const [p, dir] of [[S[0], -1], [S[S.length - 1], 1]]) {
      if (streets.some(o => o !== st && polyDist(o.pts, p.x, p.z) < 4.5)) { /* this end joins another street: no turning bay, the road just carries on into it */
        if (joinsStreet(st, p)) joinFill(p, dir, hw);
        continue;
      }
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

  /* ================= SIDEWALKS (town layout part 1, junctions part 2) =================
     Cross section of every street, from the middle outward:  asphalt | raised curb (CB) | paved sidewalk | house lot.
     - Row streets: the south side is the old grass verge (street trees and lamps stand there); it is paved all the way to the row sidewalk of paths.js,
       so the two form one wide boulevard sidewalk. The north side gets a normal sidewalk (SW wide) in front of the back gardens.
     - Cross streets and ring links: a sidewalk (SW_NS wide) on both sides.
     - JUNCTIONS: each of the three edges (curb face, curb back, sidewalk edge) is cut exactly where it meets the asphalt of another street, so the cut
       follows the other street's edge at its real angle. Edges that are cut at different places are joined by a small triangle, so the end is clean.
       A street end that joins another street is carried a little way into it first (see EXT), which fills the corner of a bend.
     - Where open water lies just outside a sidewalk (the lake, the river), a low stone wall with posts runs along its outer edge.
     - Bridge decks get a stone parapet on both sides.
     - Street trees get a stone-edged planter (tree pit).
     Tune the numbers just below. */
  const WALKC = '#d9d3c5', CURBC = '#e6e1d3', JOINTC = '#bdb7a8', STONEC = '#cdc6b6', CAPC = '#e8e3d6', SOILC = '#5b4737', EDGEC = '#c4beaf';
  const CB2 = .42, SW = 3.0, SW_NS = 2.6, CURB_H = .17, WALK_H = .14, ROW_EDGE = -ROAD_OFF - .3 + .15; /* ROW_EDGE: distance from a row street's middle to the north edge of its row sidewalk (+ a little overlap) */
  const MARG = .02; /* an edge counts as clear of another street when it is at least this far from its asphalt */
  const side = Builder(), bandSegs = [];
  const sq = (a, b, c, d, col, n = [0, 1, 0]) => wind(a, b, c, d, n) ? side.quad(a, d, c, b, col, n) : side.quad(a, b, c, d, col, n);
  const mq = (a, b, c, d, col, n = [0, 1, 0]) => wind(a, b, c, d, n) ? mark.quad(a, d, c, b, col, n) : mark.quad(a, b, c, d, col, n);

  const others = st => streets.filter(o => o !== st && o.k !== 'bridge');
  /* fieldOf(list): (x, z) -> gap to the nearest asphalt edge of those streets (<= 0 inside a street, about 99 when none is near) */
  const fieldOf = list => {
    const E = list.map(o => { const hwo = hwOfSt(o); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; o.pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }); return { pts: o.pts, hw: hwo, R: hwo + 14, b: [x0 - hwo - 14, x1 + hwo + 14, z0 - hwo - 14, z1 + hwo + 14] }; });
    return (x, z) => { let m = 99; for (const e of E) { if (x < e.b[0] || x > e.b[1] || z < e.b[2] || z > e.b[3]) continue; const d = pdist(e.pts, x, z, e.R) - e.hw; if (d < m) m = d; } return m; };
  };
  const lat = (p, sg, o) => [p.x + sg * -p.tz * o, p.z + sg * p.tx * o];
  const wet = (x, z) => H(x, z) < WL + .06 || canalDist(x, z) < .6;
  const wall = (a, c, sg, o, top0, top1, ya, yc) => { /* low stone wall: 0.38 thick, 0.55 high, from lateral offset o-0.38 to o */
    const A0 = lat(a, sg, o - .38), A1 = lat(a, sg, o), C0 = lat(c, sg, o - .38), C1 = lat(c, sg, o), h = .55;
    sq([A0[0], top0 + h, A0[1]], [A1[0], top0 + h, A1[1]], [C1[0], top1 + h, C1[1]], [C0[0], top1 + h, C0[1]], CAPC);
    sq([A1[0], ya, A1[1]], [A1[0], top0 + h, A1[1]], [C1[0], top1 + h, C1[1]], [C1[0], yc, C1[1]], STONEC, [sg * -a.tz, 0, sg * a.tx]);
    sq([A0[0], top0, A0[1]], [A0[0], top0 + h, A0[1]], [C0[0], top1 + h, C0[1]], [C0[0], top1, C0[1]], STONEC, [-sg * -a.tz, 0, -sg * a.tx]);
  };
  /* the same wall between two explicit outer points A, C (objects with x, z, ot) and their outward unit vectors na, nc */
  const wallP = (A, C, na, nc, ya, yc) => {
    const A0 = [A.x - na[0] * .38, A.z - na[1] * .38], C0 = [C.x - nc[0] * .38, C.z - nc[1] * .38], top0 = A.ot, top1 = C.ot, h = .55;
    sq([A0[0], top0 + h, A0[1]], [A.x, top0 + h, A.z], [C.x, top1 + h, C.z], [C0[0], top1 + h, C0[1]], CAPC);
    sq([A.x, ya, A.z], [A.x, top0 + h, A.z], [C.x, top1 + h, C.z], [C.x, yc, C.z], STONEC, [na[0], 0, na[1]]);
    sq([A0[0], top0, A0[1]], [A0[0], top0 + h, A0[1]], [C0[0], top1 + h, C0[1]], [C0[0], top1, C0[1]], STONEC, [-na[0], 0, -na[1]]);
  };
  const post = (p, sg, o, y) => { const q = lat(p, sg, o - .19); side.box(q[0], y + .5, q[1], .56, 1.0, .56, STONEC); side.box(q[0], y + 1.04, q[1], .7, .1, .7, CAPC); };

  streets.forEach(st => {
    const hw = hwOfSt(st);
    let S = sample(st.pts, hw);
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
    const oth = others(st), fo = fieldOf(oth);
    /* EXT: a street end that joins another street is carried on past its end by EXT (straight on), so its sidewalks reach right into the junction.
       They are cut to the other street's edge below, and at a bend they fill the outer corner. */
    { const extra = hw + .2, ds = []; for (let d = .5; d < extra; d += .5) ds.push(d); ds.push(extra);
      const a0 = S[0], e0 = S[S.length - 1], head = [], tail = [];
      if (joinsStreet(st, a0)) for (let k = ds.length - 1; k >= 0; k--) head.push({ x: a0.x - a0.tx * ds[k], z: a0.z - a0.tz * ds[k], tx: a0.tx, tz: a0.tz, y: a0.y, s: a0.s - ds[k] });
      if (joinsStreet(st, e0)) for (const d of ds) tail.push({ x: e0.x + e0.tx * d, z: e0.z + e0.tz * d, tx: e0.tx, tz: e0.tz, y: e0.y, s: e0.s + d });
      if (head.length || tail.length) S = head.concat(S, tail); }
    /* finer samples (about 0.5 apart) near other streets, so the cut is smooth */
    S = refine(S, (a, c) => fo((a.x + c.x) / 2, (a.z + c.z) / 2) < 14 ? Math.max(1, Math.min(4, Math.round(Math.hypot(c.x - a.x, c.z - a.z) / .5))) : 1);
    const n = S.length, midp = S[Math.floor(n / 2)];
    for (const sg of [1, -1]) {
      const south = sg * midp.tx > 0 && st.k === 'ew' && Math.abs(midp.tx) > .7; /* the side that carries the row sidewalk */
      const o0 = hw, o1 = hw + CB2, o2 = o1 + (st.k === 'ns' ? SW_NS : south ? ROW_EDGE - o1 : SW), O = [o0, o1, o2];
      /* band top height: the road surface + WALK_H, but never under the ground beside it; smoothed along the street */
      let top = S.map(p => { const m = lat(p, sg, (o1 + o2) / 2), e = lat(p, sg, o2); return Math.min(p.y + .7, Math.max(p.y + WALK_H, H(m[0], m[1]) + .08, H(e[0], e[1]) + .08)); });
      top = top.map((v, i) => Math.max(v, i > 0 ? top[i - 1] : v, i < top.length - 1 ? top[i + 1] : v));
      for (let it = 0; it < 2; it++) { const g = top.slice(); for (let i = 1; i < g.length - 1; i++) top[i] = (g[i - 1] + 2 * g[i] + g[i + 1]) / 4; }
      /* outer edge height: where it meets a row sidewalk it takes that sidewalk's height (a hair lower, so the sidewalk wins the overlap) */
      const outTop = S.map((p, i) => { if (!south) return top[i]; const q = lat(p, sg, o2 + .5), y = surfaceY(q[0], q[1]); return y === null || y === undefined ? top[i] : y - .03; });
      const ct = S.map((p, i) => Math.max(p.y + CURB_H, top[i] + .015));
      /* the three edges (line 0 = curb face, 1 = curb back / sidewalk start, 2 = sidewalk outer edge): positions, and the gap to the nearest other street */
      const P = [0, 1, 2].map(k => S.map(p => lat(p, sg, O[k])));
      const Fv = P.map(line => line.map(q => fo(q[0], q[1])));
      const mk = (k, i, t) => { const A = P[k][i], B = P[k][i + 1], M = (u, v) => u + (v - u) * t; return { x: M(A[0], B[0]), z: M(A[1], B[1]), y: M(S[i].y, S[i + 1].y), ct: M(ct[i], ct[i + 1]), tp: M(top[i], top[i + 1]), ot: M(outTop[i], outTop[i + 1]) }; };
      /* for each edge and each piece: the part of it that is clear of other streets (a range 0..1 along the piece, or null). EV lists where a clear run starts ('in') and stops ('out'). */
      const IV = [[], [], []], EV = [[], [], []];
      for (let k = 0; k < 3; k++) for (let i = 0; i < n - 1; i++) {
        const va = Fv[k][i] > MARG, vc = Fv[k][i + 1] > MARG; let u = null;
        if (va && vc) u = [0, 1];
        else if (va || vc) {
          const A = P[k][i], B = P[k][i + 1]; let lo = 0, hi = 1;
          for (let it = 0; it < 8; it++) { const m = (lo + hi) / 2, f = fo(A[0] + (B[0] - A[0]) * m, A[1] + (B[1] - A[1]) * m); if ((f > MARG) === va) lo = m; else hi = m; }
          u = va ? [0, lo] : [hi, 1];
        }
        IV[k].push(u);
        if (u) { if (u[0] > 0 || i === 0) EV[k].push({ type: 'in', i, pt: mk(k, i, u[0]) }); if (u[1] < 1 || i === n - 2) EV[k].push({ type: 'out', i, pt: mk(k, i, u[1]) }); }
      }
      if (!EV[0].length || !EV[1].length || !EV[2].length) continue;
      /* a piece where an edge is entirely inside another street: that edge's end point sits at the nearest cut (the exit before it, or the entry after it) */
      const anchor = (k, i) => { let pv = null, nx = null; for (const e of EV[k]) { if (e.type === 'out' && e.i < i) pv = e; if (e.type === 'in' && e.i > i && !nx) nx = e; } return pv && nx ? (i - pv.i <= nx.i - i ? pv.pt : nx.pt) : (pv || nx || { pt: null }).pt; };
      let jointAt = 1.1, postAt = -1e9;
      for (let i = 0; i < n - 1; i++) {
        const a = S[i], c = S[i + 1];
        if (!IV[0][i] && !IV[1][i] && !IV[2][i]) continue;
        const Ea = [], Ec = []; let okk = true;
        for (let k = 0; k < 3; k++) { const u = IV[k][i]; if (u) { Ea.push(mk(k, i, u[0])); Ec.push(mk(k, i, u[1])); } else { const an = anchor(k, i); if (!an) { okk = false; break; } Ea.push(an); Ec.push(an); } }
        if (!okk) continue;
        const full = k => IV[k][i] && IV[k][i][0] === 0 && IV[k][i][1] === 1;
        const nL = [sg * -a.tz, 0, sg * a.tx], nS = [-nL[0], 0, -nL[2]]; /* outward / toward the street */
        const tn = (hash(st.row === undefined ? st.x || 3 : st.row, Math.floor(a.s / 2) * 2 + sg) - .5) * .03;
        const ga = e => Math.min(e.tp - .3, H(e.x, e.z) - .3);
        /* sidewalk top, curb top, curb face toward the street, curb back */
        sq(T(Ea[1], Ea[1].tp), T(Ea[2], Ea[2].ot), T(Ec[2], Ec[2].ot), T(Ec[1], Ec[1].tp), shade(WALKC, tn));
        sq(T(Ea[0], Ea[0].ct), T(Ea[1], Ea[1].ct), T(Ec[1], Ec[1].ct), T(Ec[0], Ec[0].ct), CURBC);
        sq(T(Ea[0], Ea[0].y - .02), T(Ea[0], Ea[0].ct), T(Ec[0], Ec[0].ct), T(Ec[0], Ec[0].y - .02), EDGEC, nS);
        sq(T(Ea[1], Ea[1].tp), T(Ea[1], Ea[1].ct), T(Ec[1], Ec[1].ct), T(Ec[1], Ec[1].tp), EDGEC, nL);
        const w1 = lat(a, sg, o2 + 1.6), w2 = lat(c, sg, o2 + 1.6), isWet = wet(w1[0], w1[1]) || wet(w2[0], w2[1]);
        if (!isWet && (!south || outTop[i] === top[i])) sq(T(Ea[2], ga(Ea[2])), T(Ea[2], Ea[2].ot), T(Ec[2], Ec[2].ot), T(Ec[2], ga(Ec[2])), EDGEC, nL);
        /* slab joints across the sidewalk */
        if (full(1) && full(2) && c.s > jointAt) { const w = .045, j0 = Ec[1], j1 = Ec[2], y = (j0.tp + j1.ot) / 2 + .008; mq([j0.x - c.tx * w, j0.tp + .008, j0.z - c.tz * w], [j1.x - c.tx * w, y, j1.z - c.tz * w], [j1.x + c.tx * w, y, j1.z + c.tz * w], [j0.x + c.tx * w, j0.tp + .008, j0.z + c.tz * w], JOINTC); jointAt = c.s + 2.2; }
        /* walkable surface (people, first-person walk, tree pits) */
        if (IV[1][i] && IV[2][i]) {
          const qa = [(Ea[1].x + Ea[2].x) / 2, (Ea[1].z + Ea[2].z) / 2], qc = [(Ec[1].x + Ec[2].x) / 2, (Ec[1].z + Ec[2].z) / 2];
          addSurf(qa[0], qa[1], qc[0], qc[1], (o2 - o1) / 2, (Ea[1].tp + Ea[2].ot) / 2, (Ec[1].tp + Ec[2].ot) / 2);
          bandSegs.push([qa[0], qa[1], qc[0], qc[1], (o2 - o1) / 2]);
        }
        /* open water just outside: low stone wall along the outer edge */
        if (isWet && IV[2][i]) { wallP(Ea[2], Ec[2], [nL[0], nL[2]], [sg * -c.tz, sg * c.tx], ga(Ea[2]), ga(Ec[2])); if (full(2) && a.s >= postAt) { post(a, sg, o2, outTop[i]); postAt = a.s + 4; } }
      }
      /* end caps where a clear run starts or stops (a street crosses, or the street ends): the cut follows the other street's edge, at its angle */
      if (EV[0].length === EV[1].length && EV[1].length === EV[2].length) for (let m = 0; m < EV[1].length; m++) {
        const e0 = EV[0][m], e1 = EV[1][m], e2 = EV[2][m]; if (e0.type !== e1.type || e1.type !== e2.type) continue;
        const sgn = e1.type === 'out' ? 1 : -1, ts = S[Math.min(e1.i, n - 2)], nn = [sgn * ts.tx, 0, sgn * ts.tz], p0 = e0.pt, p1 = e1.pt, p2 = e2.pt, g = Math.min(p1.y - .3, H(p2.x, p2.z) - .3);
        sq(T(p0, p0.y - .02), T(p0, p0.ct), T(p1, p1.ct), T(p1, p1.tp), EDGEC, nn);
        sq(T(p1, g), T(p1, p1.tp), T(p2, p2.ot), T(p2, g), EDGEC, nn);
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
