/* Nestville streets: drawn like a real town (the photo): charcoal asphalt, a thin dashed white centre line, a light concrete kerb on both edges,
   ROUNDED corners at every crossing, proper zebra crosswalks on each leg of a crossing, and brown arched road bridges over the river.
   world.js lays out the streets (L.streets: polylines, L.xwalks: crosswalks, L.inter: intersections). This file draws them.
   Meshes: asphalt, markings (kerb + paint), and the brown bridge woodwork. Three draw calls.
   Runs next to town.js and extras.js and reads the same scene (window.__nv).
   Tune at the top: ASPHALT / CURB / PAINT colours, CURB_W (kerb width), DASH / GAP / DASH_W (centre line), NS_HW (half width of the cross streets),
   CORNER (kerb radius at a crossing), BAR_* (zebra bars), and the BRIDGE colours.
   Real-life rules used here:
   - no centre line and no kerb inside a crossing; the four corners are quarter-round fillets with a kerb round them
   - one zebra crossing per leg of a crossing, just outside the corner, bars parallel to the traffic (wide bars, wide gaps), never stacked on top of each other
   - the cross streets are as wide as the row streets (nearly: NS_HW)
   - a road bridge is a brown arch: parapet walls, an arched opening with a lighter ring, a planked deck, posts, and a lantern pillar at each end. */
import * as THREE from './lib.js';
import { H, L, ROAD_W, WL, polyDist } from './world.js';
import './polish.js'; /* smaller sun + natural water (polish.js) */

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

const ASPHALT = '#45474e', CURB = '#d8d2c3', SKIRT = '#8d887c', PAINT = '#f6f3ea';
const CURB_W = .7, DASH = 2.6, GAP = 3.4, DASH_W = .12; /* kerb width (outside the asphalt), centre dash length, gap, half width of a dash */
const NS_HW = 2.9, CORNER = 2.2; /* half width of the cross streets, radius of the rounded corners */
const BAR_HL = 1.35, BAR_HW = .27, BAR_STEP = .95; /* zebra bar: half length (along the traffic), half width, spacing */
const BR_WALL = '#7b4b2f', BR_CAP = '#a8744c', BR_SOFFIT = '#5a3822', BR_RING = '#b07c52', BR_PILLAR = '#6f4328', BR_DECK1 = '#7a5236', BR_DECK2 = '#6b472e', LANTERN = '#f2d27a';
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
/* nearest point of a polyline: distance and the direction the line runs there */
function segNear(pts, x, z) {
  let best = { d: 1e9, tx: 1, tz: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz + 1e-6;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / l2)), d = Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t);
    if (d < best.d) { const l = Math.sqrt(l2); best = { d, tx: vx / l, tz: vz / l }; }
  }
  return best;
}

ready(nv => {
  const scene = nv.scene, streets = L.streets || [];
  if (!streets.length) return;
  const road = Builder(), mark = Builder(), wood = Builder(), all = [], bridges = []; /* all: every sample, for looking up the street height under a crosswalk */
  const inter = L.inter || [];
  const nearInter = (x, z, r) => inter.some(p => Math.hypot(x - p.x, z - p.z) < r);

  streets.forEach(st => {
    const hw = st.k === 'ns' ? NS_HW : ROAD_W / 2, S = sample(st.pts, hw), isBridge = st.k === 'bridge';
    if (isBridge) { /* road bridge over the river: a level (or gently sloping) deck between the two banks */
      const y0 = S[0].y, y1 = S[S.length - 1].y, tot = S[S.length - 1].s || 1;
      S.forEach(p => { p.y = y0 + (y1 - y0) * (p.s / tot); });
      bridges.push({ S, hw, tot });
    }
    S.forEach(p => all.push(p));
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], c = S[i + 1], tone = (hash(st.row === undefined ? st.x : st.row, i) - .5) * .02;
      const col = isBridge ? (i % 2 ? BR_DECK1 : BR_DECK2) : shade(ASPHALT, tone); /* the bridge deck is planked timber */
      road.quad([a.L[0], a.y, a.L[1]], [a.R[0], a.y, a.R[1]], [c.R[0], c.y, c.R[1]], [c.L[0], c.y, c.L[1]], col);
      if (isBridge) continue;
      /* skirts down to the ground, so nothing floats on a cross slope */
      road.quad([a.L[0], a.yl, a.L[1]], [a.L[0], a.y, a.L[1]], [c.L[0], c.y, c.L[1]], [c.L[0], c.yl, c.L[1]], SKIRT, [-a.tz, 0, a.tx]);
      road.quad([a.R[0], a.yr, a.R[1]], [a.R[0], a.y, a.R[1]], [c.R[0], c.y, c.R[1]], [c.R[0], c.yr, c.R[1]], SKIRT, [a.tz, 0, -a.tx]);
      /* light concrete kerb along both edges, just outside the asphalt (not inside a crossing: the rounded corners carry it there) */
      const mid = at(S, (a.s + c.s) / 2);
      if (!nearInter(mid.x, mid.z, 5.4)) {
        const o = CURB_W, y0 = .05;
        mark.quad([a.L[0], a.y + y0, a.L[1]], [a.L[0] - a.tz * o, a.y + y0, a.L[1] + a.tx * o], [c.L[0] - c.tz * o, c.y + y0, c.L[1] + c.tx * o], [c.L[0], c.y + y0, c.L[1]], CURB);
        mark.quad([a.R[0] + a.tz * o, a.y + y0, a.R[1] - a.tx * o], [a.R[0], a.y + y0, a.R[1]], [c.R[0], c.y + y0, c.R[1]], [c.R[0] + c.tz * o, c.y + y0, c.R[1] - c.tx * o], CURB);
        road.quad([a.L[0], a.y, a.L[1]], [a.L[0], a.y + y0, a.L[1]], [c.L[0], c.y + y0, c.L[1]], [c.L[0], c.y, c.L[1]], SKIRT, [-a.tz, 0, a.tx]);
        road.quad([a.R[0], a.y, a.R[1]], [a.R[0], a.y + y0, a.R[1]], [c.R[0], c.y + y0, c.R[1]], [c.R[0], c.y, c.R[1]], SKIRT, [a.tz, 0, -a.tx]);
      }
    }
    if (isBridge) return; /* no centre line on the bridge */
    /* dashed centre line: DASH long, GAP between, none inside a crossing or its zebra zone */
    const total = S[S.length - 1].s;
    for (let s = 1.5; s + DASH < total - 1.5; s += DASH + GAP) {
      const m = at(S, s + DASH / 2);
      if (nearInter(m.x, m.z, 8.8)) continue;
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
        mark.quad(pt(a0, hw + CURB_W, p.y + .05), pt(a1, hw + CURB_W, p.y + .05), pt(a1, hw, p.y + .05), pt(a0, hw, p.y + .05), CURB);
      }
    }
  });

  const yAt = (x, z) => { let best = 1e9, y = H(x, z) + LIFT; for (const p of all) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; y = p.y; } } return y; };

  /* a zebra crossing: wide bars parallel to the traffic (t), spaced across the road (n), road half width hw, centred on (cx, cz) */
  const zebra = (cx, cz, tx, tz, nx, nz, hw, y) => {
    const n = Math.max(2, Math.floor((2 * hw - 1.0) / BAR_STEP));
    for (let j = 0; j <= n; j++) {
      const o = (j - n / 2) * BAR_STEP, px = cx + nx * o, pz = cz + nz * o;
      const P = (a, b) => [px + tx * a + nx * b, y, pz + tz * a + nz * b];
      mark.quad(P(-BAR_HL, -BAR_HW), P(-BAR_HL, BAR_HW), P(BAR_HL, BAR_HW), P(BAR_HL, -BAR_HW), PAINT);
    }
  };

  /* ---------- crossings: rounded corners and one zebra crossing per leg ---------- */
  const ewSts = streets.filter(s => s.k === 'ew' || s.k === 'bridge' || s.k === 'ring'), nsSts = streets.filter(s => s.k === 'ns');
  const legExists = (list, x, z) => list.some(s => polyDist(s.pts, x, z) < 1.8);
  inter.forEach(P => {
    let ew = null; for (const s of ewSts) { const r = segNear(s.pts, P.x, P.z); if (!ew || r.d < ew.d) ew = r; }
    if (!ew || ew.d > 2) return;
    let ux = ew.tx, uz = ew.tz; if (ux < 0) { ux = -ux; uz = -uz; }
    const nx = -uz, nz = ux, m = uz / (ux || 1e-6), y = yAt(P.x, P.z), hwE = ROAD_W / 2;
    const hasE = sx => legExists(ewSts, P.x + ux * sx * (NS_HW + CORNER + 2), P.z + uz * sx * (NS_HW + CORNER + 2));
    const hasN = sz => legExists(nsSts, P.x, P.z + sz * (hwE + CORNER + 2));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { /* the four corners */
      if (!hasE(sx) || !hasN(sz)) continue;
      const Cx = P.x + sx * NS_HW, Cz = P.z + m * sx * NS_HW + sz * hwE * Math.hypot(1, m);
      const T1 = [Cx + sx * CORNER * ux, Cz + sx * CORNER * uz], T2 = [Cx, Cz + sz * CORNER], D = [T1[0] + sz * CORNER * nx, T1[1] + sz * CORNER * nz];
      const a1 = [(T1[0] - D[0]) / CORNER, (T1[1] - D[1]) / CORNER]; let a2 = [T2[0] - D[0], T2[1] - D[1]]; const l2 = Math.hypot(a2[0], a2[1]) || 1; a2 = [a2[0] / l2, a2[1] / l2];
      const Q = (f, r, yy) => [D[0] + r * (Math.cos(f) * a1[0] + Math.sin(f) * a2[0]), yy, D[1] + r * (Math.cos(f) * a1[1] + Math.sin(f) * a2[1])], N = 8;
      for (let i = 0; i < N; i++) {
        const f0 = Math.PI / 2 * i / N, f1 = Math.PI / 2 * (i + 1) / N;
        road.quad([Cx, y, Cz], Q(f0, CORNER, y), Q(f1, CORNER, y), Q(f1, CORNER, y), ASPHALT); /* asphalt filling the corner up to the curve */
        mark.quad(Q(f0, CORNER, y + .05), Q(f1, CORNER, y + .05), Q(f1, CORNER + CURB_W, y + .05), Q(f0, CORNER + CURB_W, y + .05), CURB); /* kerb round it */
      }
    }
    for (const sx of [-1, 1]) if (hasE(sx)) { /* zebra on each east-west leg */
      const d = NS_HW + CORNER + 1.9; zebra(P.x + ux * sx * d, P.z + uz * sx * d, ux, uz, nx, nz, hwE, y + .018);
    }
    for (const sz of [-1, 1]) if (hasN(sz)) { /* zebra on each north-south leg */
      const d = hwE + CORNER + 1.9; zebra(P.x, P.z + sz * d, 0, 1, 1, 0, NS_HW, y + .018);
    }
  });
  /* the crosswalks world.js made for walkways that cross a street (the ones at a crossing are replaced by the zebras above) */
  (L.xwalks || []).forEach(w => {
    if (nearInter(w.x, w.z, 9)) return;
    zebra(w.x, w.z, w.dx, w.dz, -w.dz, w.dx, w.w / 2, yAt(w.x, w.z) + .018);
  });

  /* ---------- the brown road bridges ---------- */
  bridges.forEach(({ S, hw, tot }) => {
    const P = (p, off, y) => [p.x - p.tz * off, y, p.z + p.tx * off];
    const ymin = Math.min(S[0].y, S[S.length - 1].y), hArch = Math.max(.8, ymin - 1.0 - WL);
    const arch = t => WL - .3 + hArch * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)); /* the arched opening: water level at the banks, high in the middle */
    const oOut = hw + .65, oIn = hw + .02;
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], c = S[i + 1], ya = arch(a.s / tot), yc = arch(c.s / tot), ta = a.y + 1.0, tc = c.y + 1.0;
      for (const sd of [1, -1]) {
        const nO = [-a.tz * sd, 0, a.tx * sd], nI = [a.tz * sd, 0, -a.tx * sd];
        wood.quad(P(a, sd * oOut, ya), P(c, sd * oOut, yc), P(c, sd * oOut, tc), P(a, sd * oOut, ta), BR_WALL, nO); /* outer wall face, above the arch */
        wood.quad(P(a, sd * (oOut + .03), ya), P(c, sd * (oOut + .03), yc), P(c, sd * (oOut + .03), yc + .55), P(a, sd * (oOut + .03), ya + .55), BR_RING, nO); /* the lighter ring round the arch */
        wood.quad(P(a, sd * oIn, a.y + .02), P(c, sd * oIn, c.y + .02), P(c, sd * oIn, tc), P(a, sd * oIn, ta), BR_WALL, nI); /* parapet, road side */
        wood.quad(P(a, sd * (oIn - .1), ta + .02), P(c, sd * (oIn - .1), tc + .02), P(c, sd * (oOut + .1), tc + .02), P(a, sd * (oOut + .1), ta + .02), BR_CAP, [0, 1, 0]); /* wide cap on top of the parapet */
      }
      wood.quad(P(a, oOut, ya), P(a, -oOut, ya), P(c, -oOut, yc), P(c, oOut, yc), BR_SOFFIT, [0, -1, 0]); /* the curved underside of the arch */
    }
    for (let s = 1.2; s < tot - .8; s += 3.2) for (const sd of [1, -1]) { /* little posts along the parapet */
      const p = at(S, s); wood.box(p.x - p.tz * sd * (hw + .33), p.y + 1.0 + .32, p.z + p.tx * sd * (hw + .33), .36, .64, .36, BR_CAP);
    }
    for (const [s, dir] of [[.5, 1], [tot - .5, -1]]) for (const sd of [1, -1]) { /* a lantern pillar at each corner of the bridge */
      const p = at(S, s), x = p.x - p.tz * sd * (hw + .33), z = p.z + p.tx * sd * (hw + .33);
      wood.box(x, p.y + 1.0 + .7, z, .85, 1.4, .85, BR_PILLAR); wood.box(x, p.y + 2.4 + .05, z, 1.0, .12, 1.0, BR_CAP);
      wood.box(x, p.y + 2.4 + .45, z, .42, .6, .42, LANTERN); wood.box(x, p.y + 3.1 + .08, z, .6, .16, .6, BR_PILLAR);
    }
  });

  const asphalt = road.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const paint = mark.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  const timber = wood.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  asphalt.receiveShadow = true; paint.receiveShadow = true; timber.receiveShadow = true; asphalt.castShadow = false; paint.castShadow = false; timber.castShadow = true;
  asphalt.name = 'streets'; paint.name = 'street-markings'; timber.name = 'road-bridges';
  scene.add(asphalt, paint, timber);
});
