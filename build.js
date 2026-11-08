/* Nestville geometry: a tiny flat-shaded mesh builder plus every building */
import * as THREE from './lib.js';
import { rng, hs } from './shared.js';
import { flowerBed, windowBox, pottedFlower } from './flowers.js';

const CC = new Map();
export const K = h => { if (typeof h !== 'string') return h; let c = CC.get(h); if (!c) { c = new THREE.Color(h); CC.set(h, c); } return c; };
const Y = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), qq = new THREE.Quaternion(), ee = new THREE.Euler(), sc1 = new THREE.Vector3(1, 1, 1);

export class MB {
  constructor() { this.P = []; this.N = []; this.C = []; this.m = new THREE.Matrix4(); this.a = new THREE.Vector3(); this.b = new THREE.Vector3(); this.c = new THREE.Vector3(); }
  at(x, y, z, yaw = 0) { qq.setFromAxisAngle(Y, yaw); this.m.compose(v3.set(x, y, z), qq, sc1); return this; }
  sub(x, y, z, yaw, fn, roll = 0) {
    const old = this.m.clone(); ee.set(0, yaw, roll, 'YXZ'); qq.setFromEuler(ee);
    const l = new THREE.Matrix4().compose(v3.set(x, y, z), qq, sc1); this.m.multiply(l); fn(); this.m.copy(old);
  }
  world(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.m); }
  T(p, q, r, col) {
    const A = this.a.set(p[0], p[1], p[2]).applyMatrix4(this.m), Bv = this.b.set(q[0], q[1], q[2]).applyMatrix4(this.m), C = this.c.set(r[0], r[1], r[2]).applyMatrix4(this.m);
    const ux = Bv.x - A.x, uy = Bv.y - A.y, uz = Bv.z - A.z, vx = C.x - A.x, vy = C.y - A.y, vz = C.z - A.z;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const c = K(col);
    this.P.push(A.x, A.y, A.z, Bv.x, Bv.y, Bv.z, C.x, C.y, C.z);
    this.N.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.C.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
  }
  Q(a, b, c, d, col) { this.T(a, b, c, col); this.T(a, c, d, col); }
  box(x, y, z, w, h, d, col, bottom) {
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y, y1 = y + h, z0 = z - d / 2, z1 = z + d / 2;
    this.Q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col);
    this.Q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col);
    this.Q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col);
    this.Q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col);
    this.Q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], col);
    if (bottom) this.Q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col);
  }
  /* gable roof, ridge along local z */
  gable(x, y, z, w, d, h, o, col, colG) {
    const W = w / 2 + o, D = d / 2 + o * .7, zf = z + D, zb = z - D, yh = y + h * (W / (w / 2 + o) > 0 ? 1 : 1);
    this.Q([x - W, y, zf], [x, yh, zf], [x, yh, zb], [x - W, y, zb], col);
    this.Q([x, yh, zf], [x + W, y, zf], [x + W, y, zb], [x, yh, zb], K(col).clone().multiplyScalar(.82));
    const hl = h * (1 - (w / 2) / W), zF = z + d / 2, zB = z - d / 2;
    /* gable end walls: fill from the wall top (y) up to the roof line so the roof sits ON the building, no gap */
    this.Q([x - w / 2, y, zF], [x + w / 2, y, zF], [x + w / 2, y + hl, zF], [x - w / 2, y + hl, zF], colG);
    this.Q([x + w / 2, y, zB], [x - w / 2, y, zB], [x - w / 2, y + hl, zB], [x + w / 2, y + hl, zB], colG);
    this.T([x - w / 2, y + hl, zF], [x + w / 2, y + hl, zF], [x, yh, zF], colG);
    this.T([x + w / 2, y + hl, zB], [x - w / 2, y + hl, zB], [x, yh, zB], colG);
    /* thin underside so eaves are not see-through */
    this.Q([x - W, y, zb], [x + W, y, zb], [x + W, y, zf], [x - W, y, zf], K(col).clone().multiplyScalar(.55));
  }
  gableX(x, y, z, w, d, h, o, col, colG) { this.sub(x, 0, z, Math.PI / 2, () => this.gable(0, y, 0, d, w, h, o, col, colG)); }
  /* hip roof, w >= d */
  hip(x, y, z, w, d, h, o, col) {
    const W = w / 2 + o, D = d / 2 + o, e = Math.max(0, W - D), yh = y + h;
    this.Q([x - W, y, z + D], [x + W, y, z + D], [x + e, yh, z], [x - e, yh, z], col);
    this.Q([x + W, y, z - D], [x - W, y, z - D], [x - e, yh, z], [x + e, yh, z], K(col).clone().multiplyScalar(.8));
    this.T([x + W, y, z + D], [x + W, y, z - D], [x + e, yh, z], K(col).clone().multiplyScalar(.7));
    this.T([x - W, y, z - D], [x - W, y, z + D], [x - e, yh, z], K(col).clone().multiplyScalar(.9));
    this.Q([x - W, y, z - D], [x + W, y, z - D], [x + W, y, z + D], [x - W, y, z + D], K(col).clone().multiplyScalar(.5));
  }
  pyr(cx, y, cz, w, d, h, col) {
    const a = [-w / 2, 0, d / 2], b = [w / 2, 0, d / 2], c = [w / 2, 0, -d / 2], e = [-w / 2, 0, -d / 2], ap = [0, h, 0];
    const f = (p) => [cx + p[0], y + p[1], cz + p[2]];
    const kk = K(col);
    this.T(f(a), f(b), f(ap), kk); this.T(f(b), f(c), f(ap), kk.clone().multiplyScalar(.7));
    this.T(f(c), f(e), f(ap), kk.clone().multiplyScalar(.82)); this.T(f(e), f(a), f(ap), kk.clone().multiplyScalar(.92));
  }
  cone(cx, y, cz, r, h, seg, col, r2 = 0) {
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * 6.2832, a1 = (i + 1) / seg * 6.2832;
      const p0 = [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r];
      const kk = K(col).clone().multiplyScalar(.82 + .18 * Math.cos(a0 + .8));
      if (r2 > 0) {
        const q0 = [cx + Math.cos(a0) * r2, y + h, cz + Math.sin(a0) * r2], q1 = [cx + Math.cos(a1) * r2, y + h, cz + Math.sin(a1) * r2];
        this.Q(p1, p0, q0, q1, kk);
      } else this.T(p1, p0, [cx, y + h, cz], kk);
    }
  }
  cyl(cx, y, cz, r, h, seg, col, cap) {
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * 6.2832, a1 = (i + 1) / seg * 6.2832;
      const p0 = [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r];
      const q0 = [p0[0], y + h, p0[2]], q1 = [p1[0], y + h, p1[2]];
      const kk = K(col).clone().multiplyScalar(.8 + .2 * Math.cos(a0 + .8));
      this.Q(p1, p0, q0, q1, kk);
      if (cap) this.T([cx, y + h, cz], q1, q0, cap);
    }
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
  }
}


/* ---------------- flat helpers: a quad whose winding follows the given normal, ramps, footbridges, bicycles ---------------- */
export function qd(b, A, B, C, D, n, col) {
  const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  if (cx * n[0] + cy * n[1] + cz * n[2] < 0) b.Q(D, C, B, A, col); else b.Q(A, B, C, D, col);
}
/* a gentle sloped entrance instead of steps: runs from z to z+len, top height y0 -> y1, width w, centred on x. its sides are sunk below the ground */
export function ramp(b, x, z, len, y0, y1, w, top, side) {
  const hw = w / 2, yb = Math.min(y0, y1) - .5, z1 = z + len;
  qd(b, [x - hw, y0, z], [x + hw, y0, z], [x + hw, y1, z1], [x - hw, y1, z1], [0, 1, 0], top);
  qd(b, [x - hw, yb, z], [x - hw, y0, z], [x - hw, y1, z1], [x - hw, yb, z1], [-1, 0, 0], side);
  qd(b, [x + hw, yb, z], [x + hw, y0, z], [x + hw, y1, z1], [x + hw, yb, z1], [1, 0, 0], side);
  qd(b, [x - hw, yb, z1], [x + hw, yb, z1], [x + hw, y1, z1], [x - hw, y1, z1], [0, 0, 1], side);
}
/* a small footbridge over a canal that runs east-west: it spans north-south, with a soft arch (no steps) and low stone sides */
export function fbridge(b, x, y, z) {
  b.at(x, y, z, 0);
  const L = 13.5, W = 3.4, N = 12, hump = .75, DECK = '#d9d2c0', STONE = '#c3bba6', DARK = '#a79f8b';
  const P = t => [-L / 2 + t * L, .16 + hump * Math.sin(Math.PI * t)];
  for (let i = 0; i < N; i++) {
    const [z0, h0] = P(i / N), [z1, h1] = P((i + 1) / N), hw = W / 2, th = .5, ph = .55, pt = .26;
    qd(b, [-hw, h0, z0], [hw, h0, z0], [hw, h1, z1], [-hw, h1, z1], [0, 1, 0], DECK);
    qd(b, [-hw, h0 - th, z0], [hw, h0 - th, z0], [hw, h1 - th, z1], [-hw, h1 - th, z1], [0, -1, 0], DARK);
    for (const s of [-1, 1]) {
      const xo = s * hw, xi = s * (hw - pt);
      qd(b, [xo, h0 - th, z0], [xo, h0 + ph, z0], [xo, h1 + ph, z1], [xo, h1 - th, z1], [s, 0, 0], STONE);
      qd(b, [xi, h0, z0], [xi, h0 + ph, z0], [xi, h1 + ph, z1], [xi, h1, z1], [-s, 0, 0], STONE);
      qd(b, [xo, h0 + ph, z0], [xi, h0 + ph, z0], [xi, h1 + ph, z1], [xo, h1 + ph, z1], [0, 1, 0], '#e3dccb');
    }
  }
  /* abutments sink into both banks */
  for (const e of [-1, 1]) b.box(0, -2.6, e * (L / 2 - .5), W, 2.9, 1.2, DARK);
  /* the walls stop with a small post at each end */
  for (const e of [-1, 1]) for (const s of [-1, 1]) b.box(s * (W / 2 - .13), .16, e * (L / 2 - .1), .34, .95, .34, '#e3dccb');
}
/* a parked bicycle, wheels along z */
export function bicycle(b, x, y, z, yaw, col) {
  b.at(x, y, z, yaw);
  const TYRE = '#26282b', HUB = '#d9dcde', SADDLE = '#3a2f2a';
  for (const wz of [-.82, .82]) {
    b.sub(0, .46, wz, 0, () => { b.cyl(0, -.05, 0, .46, .1, 10, TYRE, TYRE); b.cyl(0, -.07, 0, .12, .14, 6, HUB, HUB); }, Math.PI / 2);
  }
  b.box(0, .5, -.05, .1, .1, 1.3, col);            /* top tube */
  b.box(0, .5, -.7, .1, .62, .1, col);             /* seat post */
  b.box(0, .18, .35, .1, .1, 1.05, col);           /* chain stay */
  b.box(0, .5, .62, .1, .62, .1, col);             /* fork */
  b.box(0, 1.1, .64, .78, .08, .08, '#2b2d30');    /* handlebar */
  b.box(0, 1.1, -.72, .24, .09, .46, SADDLE);      /* saddle */
  b.box(0, .02, .9, .14, .14, .12, '#8a8d90');     /* little front light so it reads from far away */
}

/* ---------------- shared bits ---------------- */
function win(b, x, y, zf, w, h, sh, flower, fcol) {
  b.box(x, y - .12, zf + .03, w + .5, h + .28, .1, '#f8f4e8');
  b.box(x, y, zf + .08, w, h, .06, '#4f7894');
  b.box(x, y + h * .5 - .04, zf + .12, w, .08, .04, '#f8f4e8');
  b.box(x - .04, y, zf + .12, .08, h, .04, '#f8f4e8');
  b.box(x - w / 2 - .5, y - .05, zf + .08, .62, h + .1, .08, sh);
  b.box(x + w / 2 + .5, y - .05, zf + .08, .62, h + .1, .08, sh);
  if (flower) windowBox(b, x, y - .62, zf + .4, w + .5, Math.round(x * 10 + y * 7)); /* a real window box: wood planter, leaves, daisies, tulips, poppies */
}
/* a plain window (white frame, glass, cross bars; no shutters, no flower box): used on the backs and the sides of the houses, so every wall has windows */
function win2(b, x, y, zf, w, h) {
  b.box(x, y - .1, zf + .03, w + .4, h + .24, .1, '#f8f4e8');
  b.box(x, y, zf + .08, w, h, .06, '#4f7894');
  b.box(x, y + h * .5 - .04, zf + .12, w, .08, .04, '#f8f4e8');
  b.box(x - .04, y, zf + .12, .08, h, .04, '#f8f4e8');
}
const FL = ['#e0527a', '#f3a6c0', '#d9463a', '#fff3d6', '#f0b13a'];
const WALL = ['#f3ead3', '#f6f2e8', '#f0d9a2', '#ecc9a8', '#dbe4e6', '#e9e1c8', '#f2e2c4'];
const TIM = ['#6e4a31', '#8a5b39', '#5b3f2c', '#7a5a3a'];
const ROOFS = ['#4a2f1f', '#7a5236', '#a77b52']; /* every house roof is one of three browns: dark, mid, light */
const SHUT = ['#4a7c4a', '#b3372d', '#3f6a8f', '#2f6e62', '#c9772f'];

/* ---------------- resident chalet ---------------- */
export function chalet(b, x, y, z, yaw, u, smoke, lite) {
  const r = rng(hs(u) + 5), pick = a => a[(r() * a.length) | 0];
  const w = 8 + r() * 2.2, d = 7 + r() * 1.4, wall = pick(WALL), tim = pick(TIM), roof = pick(ROOFS), sh = pick(SHUT);
  const floors = r() < .3 ? 3 : 2, hip = r() < .26, fence = r() < .55;
  b.at(x, y, z, yaw);
  b.box(0, -3.2, 0, w + .5, 3.8, d + .5, '#8f897d');
  b.box(0, .6, 0, w, 3.7, d, wall);
  let top = 4.3;
  const fh = 3.5, zu = d / 2 + .6;
  for (let f = 1; f < floors; f++) { b.box(0, top, .3, w + .7, fh, d + .6, f % 2 ? tim : wall); top += fh; }
  /* door + steps */
  b.box(0, .6, d / 2 + .03, 1.7, 2.9, .12, '#5c3a20');
  b.box(0, 3.3, d / 2 + .03, 1.7, .25, .14, '#f8f4e8');
  ramp(b, 0, d / 2 + .02, 3.3, .6, -.1, 2.6, '#cfc8b8', '#b9b2a2'); /* a gentle entrance ramp instead of a step */
  win(b, -w * .29, 1.9, d / 2, 1.5, 1.7, sh, !lite, FL); win(b, w * .29, 1.9, d / 2, 1.5, 1.7, sh, !lite, FL);
  for (let f = 1; f < floors; f++) {
    const yy = 4.3 + (f - 1) * fh + .9;
    win(b, -w * .3, yy, zu, 1.5, 1.8, sh, f > 1 && !lite, FL); win(b, w * .3, yy, zu, 1.5, 1.8, sh, f > 1 && !lite, FL);
    if (f === 1) {
      b.box(0, yy - .1, zu + .03, 1.4, 2, .1, '#4f7894'); b.box(0, yy - .15, zu + .02, 1.9, 2.15, .08, '#f8f4e8');
      b.box(0, 4.15, zu + .8, w * .62, .22, 1.6, '#7a5336');
      for (let i = 0; i <= 8; i++) b.box(-w * .31 + i * w * .62 / 8, 4.37, zu + 1.5, .1, .85, .1, '#8a5b39');
      b.box(0, 5.2, zu + 1.5, w * .62, .1, .16, '#8a5b39');
      if (!lite) windowBox(b, 0, 5.2, zu + 1.5, w * .6, 91);
    }
  }
  /* the back and the two sides get windows too (the village is mostly seen from behind, from the south) */
  b.sub(0, 0, 0, Math.PI, () => {
    win2(b, -w * .29, 1.9, d / 2, 1.5, 1.7); win2(b, w * .29, 1.9, d / 2, 1.5, 1.7);
    for (let f = 1; f < floors; f++) { const yy = 4.3 + (f - 1) * fh + .9; win2(b, -w * .3, yy, d / 2, 1.5, 1.8); win2(b, w * .3, yy, d / 2, 1.5, 1.8); }
  });
  for (const s of [-1, 1]) b.sub(0, 0, 0, s * Math.PI / 2, () => {
    win2(b, 0, 1.9, w / 2, 1.5, 1.7);
    for (let f = 1; f < floors; f++) win2(b, 0, 4.3 + (f - 1) * fh + .9, w / 2 + .35, 1.5, 1.8);
  });
  let rh;
  if (hip) { rh = 3.6; b.hip(0, top, .3, w + .7, d + .6, rh, .9, roof); }
  else { rh = (w / 2 + .35 + .9) * .8; b.gable(0, top, .3, w + .7, d + .6, rh, .9, roof, tim); }
  const cxm = w * .24, czm = -d * .12;
  b.box(cxm, top + .3, czm, 1, rh + 1.1, 1, '#a67856'); b.box(cxm, top + rh + 1.4, czm, 1.35, .3, 1.35, '#8c6244');
  if (smoke) smoke.push(b.world(cxm, top + rh + 1.9, czm));
  if (fence && !lite) {
    const zf = d / 2 + 3.4;
    for (let i = -5; i <= 5; i++) { if (Math.abs(i) < 1) continue; b.box(i * .85, .0, zf, .2, 1.0, .12, '#f5f0e4'); }
    b.box(-2.6, .75, zf, 5, .1, .1, '#f5f0e4'); b.box(2.6, .75, zf, 5, .1, .1, '#f5f0e4');
  }
}

/* ---------------- town house: the old-town look from the photo (cream or pastel front, steep brown roof with dormers, striped awning, ivy) ---------------- */
const TWALL = ['#f1e4c3', '#ead7aa', '#d4e2e6', '#f2dcc9', '#e3e8cf', '#f4ecd8'];
export function townhouse(b, x, y, z, yaw, u, smoke, lite) {
  const r = rng(hs(u) + 11), pick = a => a[(r() * a.length) | 0];
  const w = 8.6 + r() * 1.4, d = 7.4 + r() * .7, wall = pick(TWALL), floors = r() < .45 ? 3 : 2, roof = pick(ROOFS), shut = pick(['#2f5a3c', '#3a4a6a', '#4a2f1f']);
  const awn = pick(['#b3372d', '#1f6b5c', '#2b4c7e']), TRIM = '#fbf6ea', door = pick(['#6b2a2e', '#4a2f1f', '#2f5a3c']);
  b.at(x, y, z, yaw);
  b.box(0, -3.2, 0, w + .5, 3.8, d + .5, '#8f897d');
  b.box(0, .6, 0, w, 3.7, d, wall);
  let top = 4.3; const fh = 3.3;
  for (let f = 1; f < floors; f++) { b.box(0, top, 0, w, fh, d, wall); b.box(0, top - .12, 0, w + .3, .26, d + .3, TRIM); top += fh; }
  b.box(0, top - .3, 0, w + .6, .4, d + .6, TRIM); /* cornice */
  for (const s of [-1, 1]) b.box(s * (w / 2 - .12), .6, d / 2 + .05, .36, top - .9, .12, TRIM); /* corner pilasters */
  /* ground floor: door on one side, a tall shop-style window on the other, a striped awning over both */
  b.box(-w * .24, .6, d / 2 + .04, 1.5, 2.8, .12, door); b.box(-w * .24, 3.4, d / 2 + .04, 1.9, .24, .14, TRIM);
  win(b, w * .2, 1.3, d / 2, 2.6, 2.0, shut, false, FL);
  const ax = 0, aw = w * .86, n = 8;
  for (let i = 0; i < n; i++) b.box(ax - aw / 2 + (i + .5) * aw / n, 3.55 - (i % 1) * 0, d / 2 + .9, aw / n, .1, 1.7, i % 2 ? '#f6ece0' : awn);
  b.box(ax, 3.2, d / 2 + 1.7, aw, .32, .08, awn);
  for (let f = 1; f < floors; f++) {
    const yy = 4.3 + (f - 1) * fh + .8;
    win(b, -w * .27, yy, d / 2, 1.3, 1.8, shut, !lite && f === 1, FL); win(b, w * .27, yy, d / 2, 1.3, 1.8, shut, !lite && f === 1, FL); win(b, 0, yy, d / 2, 1.1, 1.8, shut, false, FL);
  }
  /* the back and the two sides get windows too (the village is mostly seen from behind, from the south) */
  b.sub(0, 0, 0, Math.PI, () => {
    win2(b, -w * .25, 1.5, d / 2, 1.5, 1.8); win2(b, w * .25, 1.5, d / 2, 1.5, 1.8);
    for (let f = 1; f < floors; f++) { const yy = 4.3 + (f - 1) * fh + .8; win2(b, -w * .27, yy, d / 2, 1.3, 1.8); win2(b, w * .27, yy, d / 2, 1.3, 1.8); win2(b, 0, yy, d / 2, 1.1, 1.8); }
  });
  for (const s of [-1, 1]) b.sub(0, 0, 0, s * Math.PI / 2, () => {
    win2(b, 0, 1.5, w / 2, 1.5, 1.8);
    for (let f = 1; f < floors; f++) win2(b, 0, 4.3 + (f - 1) * fh + .8, w / 2, 1.3, 1.8);
  });
  /* steep roof (ridge along the street), two dormers, chimney */
  const rh = (d / 2 + .6) * 1.15, dd = d + .4, ze = dd / 2 + .6;
  b.gableX(0, top, 0, w + .4, dd, rh, .6, roof, wall);
  for (const s of [-1, 1]) {
    const zd = dd / 2 - .3, ys = top + rh * (1 - zd / ze) - .15, cx = s * w * .27;
    b.box(cx, ys, zd - .5, 1.6, 1.7, 1.5, wall); b.gable(cx, ys + 1.7, zd - .5, 1.6, 1.5, .85, .18, roof, wall);
    b.box(cx, ys + .3, zd + .27, .9, 1.0, .06, '#4f7894'); b.box(cx, ys + .25, zd + .24, 1.2, 1.2, .05, TRIM);
  }
  b.box(w * .3, top + rh * .45, -d * .1, .9, rh * .8 + .9, .9, '#a67856'); b.box(w * .3, top + rh * 1.2 + .9, -d * .1, 1.25, .26, 1.25, '#8c6244');
  if (smoke) smoke.push(b.world(w * .3, top + rh * 1.2 + 1.5, -d * .1));
  /* ivy on a side wall and one corner */
  const iv = r() < .5 ? 1 : -1;
  b.box(iv * (w / 2 + .05), .8, d * .06, .1, top - 1.4, d * .5, '#4d7a3a'); b.box(iv * (w / 2 + .1), 1.6, d * .12, .08, top - 3.4, d * .3, '#5f9448');
  b.box(-iv * (w / 2 - .1), 1.0, d / 2 + .09, .5, top - 2.4, .08, '#4d7a3a');
  if (!lite) { const zf = d / 2 + 2.6; for (let i = -4; i <= 4; i++) b.box(i * 1.0, 0, zf, .14, .8, .1, '#2f4a36'); b.box(0, .6, zf, 8, .08, .08, '#2f4a36'); }
}
export function openLot(b, x, y, z, yaw) {
  b.at(x, y, z, yaw);
  const zf = 3.6;
  for (let i = -4; i <= 4; i++) b.box(i * 1.0, 0, zf, .16, .8, .1, '#f5f0e4');
  b.box(0, .5, zf, 8, .08, .08, '#f5f0e4');
  b.box(-3.5, 0, zf - .4, .16, 3.0, .16, '#7a5336'); b.box(-3.5, 1.6, zf - .4, 2.4, 1.1, .12, '#e9a93a');
  flowerBed(b, -1.6, 0, -.2, 4.6, 4.6, 12, Math.floor(x * 7 + z * 13) + 3);
  b.box(1, 0, 0, .3, 2.2, .3, '#6a4a32'); b.cone(1, 1.3, 0, 1.1, 1.8, 6, '#6aa84a');
}

/* ---------------- penthouse (8 floors) ---------------- */
const ACC = ['#e2b04a', '#f5f0e4', '#e2b04a', '#d9623f', '#f5f0e4', '#e2b04a', '#3f7fb5', '#f5f0e4', '#e2b04a', '#d9577f'];
export function penthouse(b, P, owned) {
  const acc = ACC[P.i % 10], NF = 8, RAIL = '#efe9dc', GLASS = '#bfe3ef';
  b.at(P.x, P.y, P.z, P.yaw);
  b.box(0, -3.4, 0, 12.2, 7.4, 10.2, '#cfc5b2');
  b.box(0, 3.9, 0, 12.6, .5, 10.6, '#efe9dc');
  b.box(0, 0, 5.15, 2.4, 3.4, .2, '#5a3d2a'); b.box(0, 3.4, 5.15, 2.8, .25, .28, acc);
  ramp(b, 0, 5.3, 3.4, .3, -.38, 3.6, '#e7dfcf', '#cfc5b2'); /* a long, gentle entrance ramp instead of steps */
  for (let f = 0; f < NF; f++) {
    const y = 4.4 + f * 5.4, slab = f % 2 ? '#efe9dc' : acc;
    b.box(0, y, 0, 10, 5, 8, '#9fd0e3');
    b.box(0, y + .35, 4.03, 9.5, 4.3, .05, f === NF - 1 ? '#d8f0f7' : '#c4e6f1');
    for (let i = -4; i <= 4; i++) b.box(i * 1.19, y, 4.07, .12, 5, .1, '#33505e');
    b.box(0, y + 2.4, 4.07, 9.6, .1, .1, '#33505e');
    b.box(0, y + 5, 0, 10.8, .4, 8.8, slab);
    /* full balcony for the floor above: deck continues the slab, glass on three sides, handrail, posts, planter, little table */
    if (f < NF - 1) {
      const ty = y + 5.4;
      b.box(0, y + 5, 5.6, 10.8, .4, 2.4, slab);
      b.box(0, ty, 6.76, 10.6, 1.05, .07, GLASS);
      b.box(-5.3, ty, 5.6, .07, 1.05, 2.4, GLASS); b.box(5.3, ty, 5.6, .07, 1.05, 2.4, GLASS);
      b.box(0, ty + 1.05, 6.76, 10.8, .1, .16, RAIL);
      b.box(-5.3, ty + 1.05, 5.6, .16, .1, 2.5, RAIL); b.box(5.3, ty + 1.05, 5.6, .16, .1, 2.5, RAIL);
      for (const px of [-5.3, -1.8, 1.8, 5.3]) b.box(px, ty, 6.76, .14, 1.15, .14, RAIL);
      b.box(-3.3, ty, 6.1, 2.6, .5, .55, '#6a4a32'); b.box(-3.3, ty + .5, 6.1, 2.4, .35, .45, '#4f9a4a');
      b.box(2.7, ty, 5.7, .1, .7, .1, '#8a8a8a'); b.box(2.7, ty + .7, 5.7, 1.3, .07, 1.3, '#a77b4e');
    }
    b.box(-5.15, y, 0, .3, 5, 8, '#e7dfcf'); b.box(5.15, y, 0, .3, 5, 8, '#e7dfcf');
  }
  const ry = 4.4 + NF * 5.4 + .4;
  b.box(0, ry - .2, 0, 11.2, .4, 9.2, '#efe9dc');
  b.box(2.4, ry + .2, -.6, 5.8, .25, 5.6, '#a77b4e');
  b.box(-2.6, ry + .15, .6, 5, .12, 4.4, '#e7dfcf'); b.box(-2.6, ry + .2, .6, 4.4, .1, 3.8, '#2fb9d6');
  for (let i = -5; i <= 5; i += 1.1) { b.box(i, ry + .2, 4.4, .12, .95, .08, '#cfeaf3'); b.box(i, ry + .2, -4.4, .12, .95, .08, '#cfeaf3'); }
  b.box(0, ry + 1.1, 4.4, 11, .08, .1, '#efe9dc');
  /* roof terrace: back and side rails so it is enclosed all the way round */
  b.box(0, ry + 1.1, -4.4, 11, .08, .1, '#efe9dc');
  for (const sx of [-5.58, 5.58]) { for (let k = -4.4; k <= 4.5; k += 1.1) b.box(sx, ry + .2, k, .08, .95, .12, '#cfeaf3'); b.box(sx, ry + 1.1, 0, .1, .08, 9, '#efe9dc'); }
  b.box(-5.3, ry + .2, -1, .5, .7, 6, '#6aa84a'); b.cone(-5.3, ry + .6, -3, .9, 1.8, 6, '#4f9a4a'); b.cone(-5.3, ry + .6, 1.2, .9, 1.8, 6, '#4f9a4a');
  for (const [px, pz] of [[1, -3], [4.4, -3], [1, 1.6], [4.4, 1.6]]) b.box(px, ry + .2, pz, .15, 3, .15, '#6a4a32');
  b.box(2.7, ry + 3.2, -.7, 4.2, .15, 5, '#efe9dc');
  b.cone(.4, ry + 2.2, -2.8, 1.5, .8, 8, '#d9623f');
  b.box(.4, ry + .2, -2.8, .1, 2.0, .1, '#8a8a8a');
  b.box(4.6, ry, 4.1, .12, 7.5, .12, '#d8d2c4');
  b.T([4.66, ry + 7.4, 4.1], [4.66, ry + 5.9, 4.1], [6.4, ry + 6.65, 4.1], owned ? '#e9a93a' : '#e2553f');
  b.T([4.66, ry + 5.9, 4.1], [4.66, ry + 7.4, 4.1], [6.4, ry + 6.65, 4.1], owned ? '#e9a93a' : '#e2553f');
}

/* ---------------- castle pieces ---------------- */
function crenels(b, x, y, z, len, t, col, axis) {
  const n = Math.max(2, Math.floor(len / 1.6));
  for (let i = 0; i < n; i += 2) {
    const p = -len / 2 + (i + .5) * len / n;
    axis === 'x' ? b.box(x + p, y, z, len / n, .9, t, col) : b.box(x, y, z + p, t, .9, len / n, col);
  }
}
function wallSeg(b, x1, z1, x2, z2, y, h, t, col) {
  const L = Math.hypot(x2 - x1, z2 - z1), ang = -Math.atan2(z2 - z1, x2 - x1);
  b.sub((x1 + x2) / 2, y, (z1 + z2) / 2, ang, () => { b.box(0, 0, 0, L, h, t, col); b.box(0, h * .6, 0, L, .25, t + .35, K(col).clone().multiplyScalar(.9)); crenels(b, 0, h, 0, L, t, col, 'x'); });
}
function rtower(b, cx, y, cz, r, h, rh, wall, roof, flag) {
  b.cyl(cx, y - 2, cz, r + .55, 3, 12, K(wall).clone().multiplyScalar(.88));
  b.cyl(cx, y, cz, r, h, 12, wall);
  b.cyl(cx, y + h * .66, cz, r + .35, .35, 12, K(wall).clone().multiplyScalar(.9));
  for (let i = 0; i < 4; i++) { const a = i * 1.57 + .4; b.box(cx + Math.cos(a) * (r - .02), y + h * .45, cz + Math.sin(a) * (r - .02), .5, 1.3, .5, '#3d4d5a'); }
  b.cone(cx, y + h, cz, r + .8, rh, 12, roof);
  b.box(cx, y + h + rh, cz, .12, 2.4, .12, '#6a6a6a');
  if (flag) { b.T([cx + .06, y + h + rh + 2.3, cz], [cx + .06, y + h + rh + 1.1, cz], [cx + 1.8, y + h + rh + 1.7, cz], flag); b.T([cx + .06, y + h + rh + 1.1, cz], [cx + .06, y + h + rh + 2.3, cz], [cx + 1.8, y + h + rh + 1.7, cz], flag); }
}
function keep(b, cx, y, cz, w, d, h, rh, wall, roof) {
  b.box(cx, y - 2, cz, w + .8, 3, d + .8, K(wall).clone().multiplyScalar(.86));
  b.box(cx, y, cz, w, h, d, wall);
  for (const f of [.3, .62]) b.box(cx, y + h * f, cz, w + .45, .35, d + .45, K(wall).clone().multiplyScalar(.9));
  for (let k = 0; k < 3; k++) for (const s of [1, -1]) {
    const xx = cx + (k - 1) * w * .3;
    b.box(xx, y + h * .72, cz + s * (d / 2 + .02), .9, 2, .1, '#3d4d5a'); b.box(xx, y + h * .4, cz + s * (d / 2 + .02), .9, 2, .1, '#3d4d5a');
    b.box(cx + s * (w / 2 + .02), y + h * .72, cz + (k - 1) * d * .3, .1, 2, .9, '#3d4d5a');
  }
  b.hip(cx, y + h, cz, w, d, rh, .9, roof);
  b.box(cx, y + h + rh, cz, .14, 2.6, .14, '#6a6a6a');
}
const STONE = '#d9d0bd', WHITE = '#f3eee0';

export function castleLake(b, C) {
  b.at(C.x, C.y, C.z, 0);
  wallSeg(b, -13, -9, 13, -9, -.5, 3.2, 1.2, '#cfc7b4'); wallSeg(b, -13, 10, 13, 10, -.5, 3.2, 1.2, '#cfc7b4');
  wallSeg(b, -13, -9, -13, 10, -.5, 3.2, 1.2, '#cfc7b4'); wallSeg(b, 13, -9, 13, 10, -.5, 3.2, 1.2, '#cfc7b4');
  keep(b, -7, 0, -3, 8.5, 8.5, 25, 13, STONE, '#c4552b');
  b.cyl(-7, 38, -3, .5, 1.2, 8, '#d8b24a');
  /* long white hall, ridge along x, dormers facing south */
  b.box(4, 0, 2.5, 18, 11, 8, WHITE); b.box(4, -2, 2.5, 18.6, 2.5, 8.6, '#cfc7b4');
  b.gableX(4, 11, 2.5, 18, 8, 6.6, .9, '#6a4636', '#6a4636');
  for (let i = 0; i < 5; i++) { const xx = -3 + i * 4; b.box(xx, 3.5, 6.5, 1.6, 2.2, .1, '#4f7894'); b.box(xx, 3.3, 6.46, 2.2, 2.6, .06, '#f8f4e8'); b.box(xx, 7.5, 6.5, 1.6, 2.2, .1, '#4f7894'); b.box(xx, 7.3, 6.46, 2.2, 2.6, .06, '#f8f4e8'); }
  for (const xx of [-1, 4, 9]) { b.box(xx, 9.8, 5.6, 2.4, 2.8, 1.8, WHITE); b.gable(xx, 12.6, 5.6, 2.4, 1.8, 1.6, .35, '#6a4636', '#6a4636'); b.box(xx, 10.4, 6.52, 1.1, 1.5, .08, '#4f7894'); }
  b.box(2, 11, .5, 1.2, 4.5, 1.2, '#a67856');
  rtower(b, -1.5, 0, 7, 2.2, 17, 8, WHITE, '#a8452a');
  b.box(15.5, 0, 0, 5, 12, 5, WHITE); b.pyr(15.5, 12, 0, 6, 6, 4, '#6a4636');
  b.cone(15.5, 16, 0, .95, 14, 8, '#34383f'); b.box(15.5, 30, 0, .18, 1.6, .18, '#d8b24a'); b.box(15.5, 30.7, 0, .9, .16, .16, '#d8b24a');
  b.box(15.5, 6, 2.55, 1, 2.4, .1, '#3d4d5a');
  b.box(-8, 0, 12, 6, 1, .5, '#cfc7b4');
}
export function castleEast(b, C) {
  b.at(C.x, C.y, C.z, 0);
  b.box(0, -3, 0, 28, 3.6, 28, '#a9a190');
  const s = 12.5, RED = '#b9452d';
  wallSeg(b, -s, -s, s, -s, 0, 8, 1.6, '#f1ece0'); wallSeg(b, -s, -s, -s, s, 0, 8, 1.6, '#f1ece0'); wallSeg(b, s, -s, s, s, 0, 8, 1.6, '#f1ece0');
  wallSeg(b, -s, s, -3, s, 0, 8, 1.6, '#f1ece0'); wallSeg(b, 3, s, s, s, 0, 8, 1.6, '#f1ece0');
  b.box(0, 5.4, s, 6.4, 3, 2.2, '#f1ece0'); b.box(0, 0, s + .1, 3.2, 5.2, 2.3, '#2e2a28'); b.cone(0, 5.2, s + 1.2, 1.6, 0, 6, '#2e2a28');
  b.hip(0, 8.4, s, 6.4, 2.2, 2.6, .5, '#344f80');
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) rtower(b, x, 0, z, 3.2, 20, 11, '#f1ece0', RED, '#e2553f');
  keep(b, 0, 0, -2, 10, 10, 22, 17, '#f4f0e6', '#344f80');
  b.box(-1.5, 22, -4, .1, 1, .1, '#fff');
  b.box(4, 0, -9, 5.4, 36, 5.4, '#f4f0e6'); b.box(4, 15, -9, 6, .4, 6, '#d9d0bd'); b.box(4, 28, -9, 6, .4, 6, '#d9d0bd');
  for (let i = 0; i < 3; i++) { b.box(4, 8 + i * 9, -6.28, 1.1, 2.6, .1, '#3d4d5a'); }
  b.pyr(4, 36, -9, 6.6, 6.6, 15, '#344f80'); b.box(4, 51, -9, .14, 3, .14, '#d8b24a');
  for (let i = 0; i < 3; i++) b.box(-4 + i * 3, 0, 8.6, 1.6, 3.4, 1.6, '#e9a93a');
}
export function castleIsland(b, C) {
  b.at(C.x, C.y, C.z, C.yaw);
  rtower(b, -3, 0, -1, 4, 24, 13, '#d9d0bd', '#3d7f72', '#e9a93a');
  b.box(5, 0, 1.5, 12, 9, 6.4, WHITE); b.gableX(5, 9, 1.5, 12, 6.4, 5, .8, '#a8452a', '#a8452a');
  for (let i = 0; i < 3; i++) { b.box(1 + i * 4, 3, 4.75, 1.4, 2.2, .1, '#4f7894'); b.box(1 + i * 4, 3, 4.7, 2, 2.6, .06, '#f8f4e8'); }
  b.box(11, -1.7, 4, 1.2, .3, 8, '#8b6a43');
  b.box(10.8, -1.4, 8.4, 3.6, .3, 1.4, '#8b6a43');
}
export function watchtower(b, C) {
  b.at(C.x, C.y, C.z, 0);
  b.cyl(0, -3, 0, 3.4, 4, 10, '#a9a190'); b.cyl(0, 0, 0, 2.7, 16, 10, '#cfc7b4');
  b.cyl(0, 16, 0, 3.3, .8, 10, '#bdb5a2');
  for (let i = 0; i < 10; i += 2) { const a = i / 10 * 6.2832; b.box(Math.cos(a) * 3, 16.8, Math.sin(a) * 3, 1, 1, 1, '#cfc7b4'); }
  b.cone(0, 16, 0, 2.6, 7, 10, '#5a4a40'); b.box(0, 22.5, 0, .12, 2, .12, '#6a6a6a');
}

/* ---------------- church ---------------- */
export function church(b, C) {
  b.at(C.x, 0, C.z, C.yaw); const y = C.y || 0;
  b.at(C.x, C.y, C.z, C.yaw);
  b.box(0, -3, 0, 11, 3.6, 19, '#a9a190');
  b.box(0, 0, -1.5, 9, 11, 14, '#ece6d6');
  b.gable(0, 11, -1.5, 9, 14, 6.5, .8, '#5d636d', '#ece6d6');
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { b.box(s * 4.52, 3.6, -5 + i * 4, .1, 4.6, 1.4, '#3d5a76'); b.box(s * 4.5, 8.2, -5 + i * 4, .12, .3, 1.8, '#d9d0bd'); b.box(s * 4.8, 0, -5 + i * 4 + 2, .8, 7.5, .5, '#d9d0bd'); }
  b.box(0, 0, 8.2, 6, 20, 6, '#d6cfbd'); b.box(0, 20, 8.2, 6.6, .5, 6.6, '#bdb5a2');
  b.box(0, 20.5, 8.2, 5.4, 4, 5.4, '#e7e0cd');
  for (const [dx, dz] of [[0, 2.75], [0, -2.75]]) b.box(dx, 21.6, 8.2 + dz, 1.8, 2.4, .1, '#33373f');
  for (const dx of [-2.75, 2.75]) b.box(8.2 * 0 + dx, 21.6, 8.2, .1, 2.4, 1.8, '#33373f');
  b.cyl(0, 14.5, 11.28, 1.5, .25, 14, '#f8f4e8'); b.cyl(0, 14.5, 11.3, .06, .1, 6, '#222');
  b.box(0, 14.9, 11.31, .14, .75, .06, '#222'); b.box(.2, 14.7, 11.31, .5, .12, .06, '#222');
  b.box(0, 3.4, 11.25, 2.4, 4.4, .12, '#4b3524'); b.box(0, 7.8, 11.25, 3, .3, .2, '#d9d0bd');
  b.cone(0, 24.5, 8.2, 3.9, 22, 8, '#2e323a'); b.box(0, 46.4, 8.2, .16, 3, .16, '#d8b24a'); b.box(0, 47.6, 8.2, 1.2, .16, .16, '#d8b24a');
  for (const [dx, dz] of [[-2.9, 2.9], [2.9, 2.9], [-2.9, 5.5], [2.9, 5.5]]) { }
}
export function fountain(b, P, y) {
  b.at(P.x, y, P.z, 0);
  b.cyl(0, 0, 0, 3.4, .9, 14, '#cfc7b4', '#cfc7b4'); b.cyl(0, .6, 0, 3, .4, 14, '#35b6cf', '#7fd8e6');
  b.cyl(0, 0, 0, .5, 3, 8, '#e0d8c5'); b.cyl(0, 2.6, 0, 1.4, .4, 10, '#e0d8c5', '#7fd8e6'); b.cone(0, 3, 0, .35, 1.2, 8, '#bfeaf2');
}

/* ---------------- shop ---------------- */
const SHOPC = ['#f0d2a0', '#f4c9d4', '#cfe3d4', '#d9c8f0', '#f6e3a4', '#c9dcec'], AWN = ['#e9a93a', '#e07a9a', '#4f9d69', '#8a62c4', '#e0525a', '#3f7fb5'];
export function shop(b, S, owned) {
  const k = S.i; b.at(S.x, S.y, S.z, S.yaw);
  const w = 9, d = 7;
  b.box(0, -3, 0, w + .5, 3.4, d + .5, '#a9a190');
  b.box(0, .4, 0, w, 4.4, d, SHOPC[k]);
  b.box(0, 4.8, .25, w + .5, 3.4, d + .5, '#f3ead3');
  b.box(-1.8, 1, d / 2 + .04, 4.4, 2.8, .1, '#4f7894'); b.box(-1.8, 1, d / 2 + .02, 4.9, 3.2, .06, '#f8f4e8');
  b.box(2.8, .4, d / 2 + .04, 1.8, 3, .1, '#5c3a20');
  ramp(b, 2.8, d / 2 + .05, 3.4, .4, -.1, 1.9, '#d6cfbd', '#b9b2a2'); /* shop door ramp */
  /* a small padlock on the door while the shop is for sale */
  if (!owned) {
    b.box(2.8, 1.2, d / 2 + .14, .8, .65, .22, '#3a3f47'); b.box(2.8, 1.35, d / 2 + .27, .2, .24, .06, '#e9a93a');
    b.box(2.48, 1.85, d / 2 + .14, .1, .5, .12, '#9aa0a8'); b.box(3.12, 1.85, d / 2 + .14, .1, .5, .12, '#9aa0a8'); b.box(2.8, 2.3, d / 2 + .14, .74, .1, .12, '#9aa0a8');
  }
  for (let i = 0; i < 6; i++) { const x0 = -w / 2 + i * w / 6, x1 = x0 + w / 6, c = i % 2 ? '#fffaf0' : AWN[k]; b.Q([x0, 3.8, d / 2], [x1, 3.8, d / 2], [x1, 3.2, d / 2 + 1.5], [x0, 3.2, d / 2 + 1.5], c); b.Q([x0, 3.2, d / 2 + 1.5], [x1, 3.2, d / 2 + 1.5], [x1, 3.8, d / 2], [x0, 3.8, d / 2], K(c).clone().multiplyScalar(.7)); }
  win(b, -2.4, 5.8, d / 2 + .5, 1.5, 1.8, '#4a7c4a', true, FL); win(b, 2.4, 5.8, d / 2 + .5, 1.5, 1.8, '#4a7c4a', true, FL);
  b.gable(0, 8.2, .25, w + .5, d + .5, 3.6, .8, '#7a3b2c', '#8a5b39');
  b.box(0, 8.8, d / 2 + .6, 5.6, 1.5, .25, AWN[k]); b.box(0, 8.8, d / 2 + .5, 5.9, 1.8, .15, '#fffaf0');
  b.box(0, 8.95, d / 2 + .8, 5.2, 1.2, .1, AWN[k]);
  b.box(w * .3, 8, -1, 1, 6, 1, '#a67856');
  for (let i = 0; i < 3; i++) pottedFlower(b, -3 + i * 1.3, 0, d / 2 + 1.4, ['tulip', 'daisy', 'poppy'][i], undefined, 1.25);
}

/* ---------------- lakeview cottage (north shore): calm and minimal, every one in its own soft colour ---------------- */
const COTW = ['#eadfca', '#e4d6bb', '#e8dcc4', '#e1d2b6', '#ebe1cd', '#e3d4b9', '#e6d8be', '#ece2d0']; /* rose, apricot, lemon, mint, sky, lilac, coral, cream. rooms.js uses the same order for the inside */
const COTR = ['#4a2f1f', '#7a5236', '#a77b52', '#4a2f1f', '#7a5236', '#a77b52', '#4a2f1f', '#7a5236'];

/* a BIG garden (cottages with C.big): a fence all the way round the plot, two flower beds at the front corners,
   two trees, a little pond, a bench and a vegetable patch at the back. Local coordinates: the house is at 0,0 and its front looks toward +z. */
function bigGarden(b, C, gz) {
  const HW = 8.3, ZB = -9.4, F = '#f5f0e4', W = '#8a5b39', zm = (gz + ZB) / 2;
  const pk = (x, z) => b.box(x, -.9, z, .18, 1.9, .12, F);
  for (let x = -HW; x <= HW + .01; x += .85) { if (Math.abs(x) > 1.1) pk(x, gz); pk(x, ZB); } /* front (with a gate gap) and back fence */
  for (let z = ZB + .85; z < gz - .4; z += .85) { pk(-HW, z); pk(HW, z); } /* both side fences */
  b.box(-(HW + 1.1) / 2, .75, gz, HW - 1.1, .1, .1, F); b.box((HW + 1.1) / 2, .75, gz, HW - 1.1, .1, .1, F);
  b.box(0, .75, ZB, HW * 2, .1, .1, F); b.box(-HW, .75, zm, .1, .1, gz - ZB, F); b.box(HW, .75, zm, .1, .1, gz - ZB, F);
  for (const s of [-1, 1]) b.box(s * 1.1, -.9, gz, .3, 2.3, .3, W); /* gate posts */
  flowerBed(b, -6.1, -.5, gz - 2.3, 3.2, 2.2, 10, C.i * 7 + 3); flowerBed(b, 6.1, -.5, gz - 2.3, 3.2, 2.2, 10, C.i * 7 + 4);
  const tree = (x, z, s) => { b.cyl(x, -.4, z, .26 * s, 2.4 * s, 6, '#6b4a32'); b.cone(x, 1.6 * s, z, 1.9 * s, 2.6 * s, 8, '#5ea244', .5 * s); b.cone(x, 3.3 * s, z, 1.4 * s, 2.2 * s, 8, '#6db04a'); };
  tree(6.2, -5.5, 1); tree(7, .6, .85);
  b.cyl(-1.6, -.45, -6.2, 1.8, .7, 14, '#cfc7b4', '#cfc7b4'); b.cyl(-1.6, -.15, -6.2, 1.45, .45, 14, '#35b6cf', '#7fd8e6'); /* pond */
  b.box(3, .4, -8, 2, .14, .6, W); b.box(3, .85, -8.3, 2, .5, .1, W); for (const s of [-.8, .8]) b.box(3 + s, -.05, -8, .12, .45, .5, W); /* bench */
  b.box(-5.9, -.5, -5.7, 3.2, .62, 5, '#7a5a3e'); for (let j = 0; j < 4; j++) b.box(-7 + j * .72, .12, -5.7, .5, .35, 4.4, '#5f9a3f'); /* vegetable patch */
}

export function cottage(b, C, owned, smoke) {
  const r = rng(C.i * 97 + 13), pick = a => a[(r() * a.length) | 0], row = Math.floor(C.i / 10);
  const wall = COTW[(C.i * 3 + row * 5) % 8], roof = COTR[(C.i * 5 + row * 3 + 2) % 8], door = pick(['#5a3a24', '#7a5236', '#3f2a1b']);
  const w = 6.6, d = 5.4, zf = d / 2, gz = zf + 4.1, trim = '#fffaf0';
  b.at(C.x, C.y, C.z, C.yaw);
  b.box(0, -2.6, 0, w + .5, 3.2, d + .5, '#9a948a');
  b.box(0, .6, 0, w, 3.3, d, wall);
  b.box(0, .6, 0, w + .14, .34, d + .14, K(wall).clone().multiplyScalar(.9)); /* one soft skirting band, nothing else */
  b.gable(0, 3.9, 0, w, d, 3.2, .7, roof, wall);
  b.box(0, 4.7, zf + .04, 1.1, 1.2, .08, '#6f9bb4'); b.box(0, 4.6, zf + .02, 1.5, 1.6, .06, trim);
  b.box(0, 5.25, zf + .08, 1.1, .06, .05, trim); b.box(0, 4.7, zf + .08, .06, 1.2, .05, trim);
  b.box(0, .6, zf + .03, 1.4, 2.6, .12, door); b.box(0, 3.2, zf + .03, 1.7, .22, .14, trim);
  b.box(.45, 1.7, zf + .1, .1, .1, .06, '#e6c07a');
  /* a low stone landing at the door, then a soft ramp down to the garden path */
  b.box(0, -.1, zf + .75, 2.8, .65, 1.5, '#b3b2aa');
  ramp(b, 0, zf + 1.5, 2.6, .55, .02, 1.8, '#b3b2aa', '#8d8c85');
  pottedFlower(b, -1.05, .55, zf + .95, 'tulip', undefined, .9); pottedFlower(b, 1.05, .55, zf + .95, 'daisy', undefined, .9);
  win(b, -2, 1.8, zf, 1.1, 1.4, roof, true, FL); win(b, 2, 1.8, zf, 1.1, 1.4, roof, true, FL);
  const cx = w * .25, cz = -d * .15;
  b.box(cx, 3.9, cz, .9, 4.4, .9, '#cfc0ac'); b.box(cx, 8.3, cz, 1.2, .26, 1.2, '#b3a38f');
  if (owned && smoke) smoke.push(b.world(cx, 8.6, cz));
  /* garden: a low picket fence, a path, two flower beds and two round bushes. Cottages with C.big get a much larger fenced garden (see bigGarden) */
  if (!C.big) {
    for (let i = -4; i <= 4; i++) { if (Math.abs(i) < 1) continue; b.box(i * .85, -.9, gz, .18, 1.9, .12, '#f5f0e4'); }
    b.box(-2.6, .75, gz, 4.6, .1, .1, '#f5f0e4'); b.box(2.6, .75, gz, 4.6, .1, .1, '#f5f0e4');
  } else bigGarden(b, C, gz);
  b.box(0, -.05, zf + 2.75, 1.3, .15, 2.7, '#d9cfb4');
  flowerBed(b, -2.75, -.5, zf + 2.85, 3.0, 2.0, 9, C.i * 7 + 1); flowerBed(b, 2.75, -.5, zf + 2.85, 3.0, 2.0, 9, C.i * 7 + 2);
  b.cone(-3.7, -.4, zf + 1.3, .8, 1.8, 6, '#4f9a4a'); b.cone(3.7, -.4, zf + 1.3, .8, 1.8, 6, '#5ea244');
  /* for sale: padlock on the door and a small gold sign */
  if (!owned) {
    b.box(0, 1.15, zf + .14, .75, .6, .22, '#3a3f47'); b.box(0, 1.3, zf + .27, .18, .22, .06, '#e9a93a');
    b.box(-.27, 1.75, zf + .14, .1, .45, .12, '#9aa0a8'); b.box(.27, 1.75, zf + .14, .1, .45, .12, '#9aa0a8'); b.box(0, 2.15, zf + .14, .64, .1, .12, '#9aa0a8');
    b.box(w / 2 + .8, -.4, zf + 3.2, .12, 2.3, .12, '#7a5336'); b.box(w / 2 + .8, 1.1, zf + 3.2, 1.5, .8, .1, '#e9a93a'); b.box(w / 2 + .8, 1.5, zf + 3.27, 1.1, .12, .04, '#fffaf0');
  }
}

/* ---------------- bridge, pier, boats, lamps ---------------- */
export function bridge(b, x, y, z, yaw = 0) {
  b.at(x, y, z, yaw);
  b.box(0, 0, 0, 20, 1, 6, '#cbc3b0'); b.box(0, 1, 2.7, 20, 1.1, .6, '#b4ac98'); b.box(0, 1, -2.7, 20, 1.1, .6, '#b4ac98');
  b.box(-8.2, -3.6, 0, 3.4, 4.6, 6, '#a69e8b'); b.box(8.2, -3.6, 0, 3.4, 4.6, 6, '#a69e8b');
  const R = 6.4, n = 9;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI * (i / n), a1 = Math.PI * ((i + 1) / n), am = (a0 + a1) / 2, cxm = Math.cos(am) * R, cym = Math.sin(am) * R - 4.5;
    b.sub(cxm, cym, 0, 0, () => b.box(0, -.5, 0, 1.2, 1.1, 5.8, '#a69e8b'), am - Math.PI / 2);
  }
  for (const s of [-1, 1]) { b.box(s * 9.6, 1, 2.7, .9, 1.7, .9, '#b4ac98'); b.box(s * 9.6, 1, -2.7, .9, 1.7, .9, '#b4ac98'); }
}
export function pier(b, P, hy) {
  b.at(P.x, 0, P.z0, 0);
  b.box(0, hy, -P.len / 2, 3.6, .4, P.len, '#a0774a');
  for (let i = 0; i < 7; i++) { b.box(-1.9, -2, -i * 4, .45, hy + 2.8, .45, '#6d4e2f'); b.box(1.9, -2, -i * 4, .45, hy + 2.8, .45, '#6d4e2f'); }
  for (const zz of [-8, -15]) { b.box(-5, hy, zz, 6.4, .4, 2.4, '#a0774a'); b.box(5.4, hy, zz, 7.2, .4, 2.4, '#a0774a'); }
  b.box(0, hy + .4, -P.len - .4, 2.4, .1, .1, '#6d4e2f');
}
function wedge(b, w, h, z0, z1, col) {
  const hw = w / 2, k = K(col);
  b.Q([-hw, 0, z0], [-hw, h, z0], [0, h, z1], [0, 0, z1], k); /* placeholder, replaced below */
}
export function boat(b, x, y, z, yaw, hull, sail, big = 1) {
  b.at(x, y, z, yaw); const s = big;
  b.box(0, 0, 0, 1.8 * s, .9 * s, 5 * s, hull);
  b.T([-.9 * s, 0, 2.5 * s], [0, 0, 4.2 * s], [-.9 * s, .9 * s, 2.5 * s], K(hull).clone().multiplyScalar(.85)); b.T([-.9 * s, .9 * s, 2.5 * s], [0, 0, 4.2 * s], [0, .9 * s, 4.2 * s], K(hull).clone().multiplyScalar(.85));
  b.T([.9 * s, 0, 2.5 * s], [.9 * s, .9 * s, 2.5 * s], [0, 0, 4.2 * s], K(hull).clone().multiplyScalar(.7)); b.T([.9 * s, .9 * s, 2.5 * s], [0, .9 * s, 4.2 * s], [0, 0, 4.2 * s], K(hull).clone().multiplyScalar(.7));
  b.T([.9 * s, .9 * s, 2.5 * s], [-.9 * s, .9 * s, 2.5 * s], [0, .9 * s, 4.2 * s], K(hull).clone().multiplyScalar(1.1));
  b.box(0, .9 * s, -.5 * s, 1.1 * s, .5 * s, 1.8 * s, '#f3ead3');
  b.box(0, .9 * s, .2 * s, .12, 7 * s, .12, '#e7dfcf');
  const p = [0, 1.4 * s, -.1 * s], q = [0, 7.2 * s, -.1 * s], r = [0, 1.4 * s, 2.7 * s], r2 = [0, 1.2 * s, -2.3 * s];
  b.T(p, q, r, sail); b.T(p, r, q, K(sail).clone().multiplyScalar(.9));
  b.T([0, 1.2 * s, -.2 * s], [0, 5.8 * s, -.2 * s], r2, K(sail).clone().multiplyScalar(.97)); b.T([0, 1.2 * s, -.2 * s], r2, [0, 5.8 * s, -.2 * s], K(sail).clone().multiplyScalar(.85));
}
/* classic English cast-iron street lamp: stepped plinth, fluted column, glass lantern with a pyramid hat */
export function lamp(b, x, y, z) {
  const iron = '#232d29', gold = '#c9a24a', glass = '#fff0b8', k = .8; /* a little smaller than before */
  b.at(x, y, z, 0);
  b.box(0, -.3 * k, 0, .74 * k, .72 * k, .74 * k, iron);
  b.box(0, .42 * k, 0, .54 * k, .3 * k, .54 * k, iron);
  b.cyl(0, .72 * k, 0, .3 * k, 1.5 * k, 10, iron);
  b.cyl(0, 2.22 * k, 0, .4 * k, .2 * k, 10, iron);
  b.cyl(0, 2.42 * k, 0, .19 * k, 1.9 * k, 10, iron);
  b.cyl(0, 4.32 * k, 0, .29 * k, .16 * k, 10, iron);
  b.box(0, 4.48 * k, 0, .84 * k, .14 * k, .84 * k, iron);
  b.cone(0, 4.62 * k, 0, .5 * k, 1.05 * k, 4, glass, .72);
  for (const [dx, dz] of [[.61, 0], [-.61, 0], [0, .61], [0, -.61]]) b.box(dx * k, 4.62 * k, dz * k, .08 * k, 1.05 * k, .08 * k, iron);
  b.cone(0, 5.67 * k, 0, .92 * k, .5 * k, 4, iron);
  b.cyl(0, 6.15 * k, 0, .08 * k, .3 * k, 6, gold);
  b.cone(0, 6.4 * k, 0, .17 * k, .26 * k, 6, gold);
}
