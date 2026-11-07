/* Nestville flowers: real little flowers for the outdoor scenes (window boxes, balconies, gardens, empty plots).
   Every flower has a stem, leaves and real petals around a centre (daisy, tulip, poppy, iris, sunflower), not a coloured block.
   All functions draw into an MB (the mesh builder in build.js) in its current local frame. Colours are '#rrggbb' strings. */
import { rng } from './shared.js';

const hx = h => parseInt(h.slice(1), 16);
export const shade = (h, f) => { const n = hx(h), c = v => Math.max(0, Math.min(255, Math.round(v * f))); return '#' + ((1 << 24) | (c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).slice(1); };
const GREENS = ['#4f9a4a', '#5fae52', '#3f8a44', '#6bb85a'];
const PAL = {
  daisy: ['#ffffff', '#fff6dc', '#ffe3ef'],
  tulip: ['#e5455a', '#f08aa8', '#f5c94a', '#ff8a5c', '#fff3d6', '#c94f9a'],
  poppy: ['#e8452f', '#ff7a45', '#f7a8c0', '#ffd24a'],
  iris: ['#9a7fd8', '#7c9be6', '#c58ae0', '#b79cf0'],
  sun: ['#f6bf2a']
};
export const BLOOMS = ['daisy', 'tulip', 'poppy', 'iris', 'tulip', 'daisy', 'sun'];

/* a triangle whose winding follows the wanted normal, so it always faces the right way */
function tri(b, A, B, C, n, col) {
  const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
  const d = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
  if (d < 0) b.T(A, C, B, col); else b.T(A, B, C, col);
}
/* a pointed leaf lying on its side, rising a little towards its tip */
export function leaf(b, x, y, z, len, ang, col) {
  const ca = Math.cos(ang), sa = Math.sin(ang), w = len * .2, T = [x + ca * len, y + len * .42, z + sa * len], M = [x + ca * len * .5, y + len * .26, z + sa * len * .5], U = [0, 1, 0];
  tri(b, [x, y, z], [M[0] - sa * w, M[1], M[2] + ca * w], T, U, col);
  tri(b, [x, y, z], T, [M[0] + sa * w, M[1], M[2] - ca * w], U, shade(col, .86));
}
/* a head of petals around a domed centre. c = centre, u/v = the two axes of the flower plane, n = the way it faces.
   N petals, from radius rc to rp, half-width pw, cup = how far the tips curl forward */
function head(b, c, u, v, n, N, rc, rp, pw, col, cen, cup) {
  const P = (px, py, pz) => [c[0] + u[0] * px + v[0] * py + n[0] * pz, c[1] + u[1] * px + v[1] * py + n[1] * pz, c[2] + u[2] * px + v[2] * py + n[2] * pz];
  const rm = rc + (rp - rc) * .55;
  for (let i = 0; i < N; i++) {
    const a = i / N * 6.2832, ca = Math.cos(a), sa = Math.sin(a), k = shade(col, .9 + .2 * Math.cos(a + 1));
    const B0 = P(ca * rc, sa * rc, 0), T = P(ca * rp, sa * rp, cup), L = P(ca * rm - sa * pw, sa * rm + ca * pw, cup * .35), R = P(ca * rm + sa * pw, sa * rm - ca * pw, cup * .35);
    tri(b, B0, L, T, n, k); tri(b, B0, T, R, n, shade(k, .94));
  }
  const apex = P(0, 0, rc * .55), seg = 7;
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * 6.2832, a1 = (i + 1) / seg * 6.2832;
    tri(b, apex, P(Math.cos(a0) * rc, Math.sin(a0) * rc, 0), P(Math.cos(a1) * rc, Math.sin(a1) * rc, 0), n, shade(cen, .85 + .3 * (i % 2)));
  }
}
const tilt = t => ({ v: [0, Math.cos(t), -Math.sin(t)], n: [0, Math.sin(t), Math.cos(t)] });

/* one flower standing at (x, y, z). kind: daisy | tulip | poppy | iris | sun. s = size (1 is about 0.8 tall). col = petal colour */
export function flower(b, kind, x, y, z, s, col) {
  const k = s || 1, sd = Math.abs(Math.sin(x * 12.9 + z * 78.2)), g = GREENS[(sd * 4) | 0], u = [1, 0, 0];
  const cl = col || PAL[kind][(sd * PAL[kind].length) | 0];
  const lf = (len, a, yy) => leaf(b, x, y + (yy || .03) * k, z, len * k, a, GREENS[((sd * 9) | 0) % 4]);
  if (kind === 'tulip') {
    const h = .6 * k, r = .15 * k;
    b.cyl(x, y, z, .022 * k, h, 4, g);
    lf(.5, sd * 6.28); lf(.42, sd * 6.28 + 2.6); lf(.34, sd * 6.28 + 4.4);
    b.cone(x, y + h, z, r * .75, .12 * k, 6, shade(cl, .9), r);
    b.cone(x, y + h + .12 * k, z, r, .2 * k, 6, cl, r * .42);
    b.cone(x, y + h + .32 * k, z, r * .42, .15 * k, 6, shade(cl, 1.14), 0);
    return;
  }
  if (kind === 'sun') {
    const h = 1.2 * k, r = .2 * k, { v, n } = tilt(.55);
    b.cyl(x, y, z, .04 * k, h, 5, '#4f8f3f');
    lf(.62, sd * 6.28, .3); lf(.55, sd * 6.28 + 3.3, .55);
    head(b, [x - n[0] * .05 * k, y + h - n[1] * .05 * k, z + .02 * k - n[2] * .05 * k], u, v, n, 14, r * .9, r * 2.1, .1 * k, shade(cl, .92), '#6b4423', .03 * k);
    head(b, [x, y + h, z + .03 * k], u, v, n, 14, r, r * 1.95, .09 * k, cl, '#6b4423', .06 * k);
    return;
  }
  const { v, n } = tilt(1.0), h = (kind === 'poppy' ? .62 : kind === 'iris' ? .5 : .46) * k;
  b.cyl(x, y, z, .018 * k, h, 4, g);
  lf(.34, sd * 6.28); lf(.3, sd * 6.28 + 3.2);
  const c = [x, y + h, z];
  if (kind === 'daisy') head(b, c, u, v, n, 11, .05 * k, .24 * k, .05 * k, cl, '#f5c431', .03 * k);
  else if (kind === 'poppy') head(b, c, u, v, n, 5, .04 * k, .3 * k, .16 * k, cl, '#2b2b2b', .15 * k);
  else head(b, c, u, v, n, 5, .04 * k, .24 * k, .115 * k, cl, '#f5c431', .08 * k);
}

/* a patch of mixed flowers with leaves tucked between them. rect centred on (x, z), ground at y */
export function flowerBed(b, x, y, z, w, d, n, seed, kinds) {
  const r = rng(seed * 977 + 31), ks = kinds || BLOOMS;
  for (let i = 0; i < n; i++) {
    const fx = x + (r() - .5) * w, fz = z + (r() - .5) * d, kind = ks[(r() * ks.length) | 0], p = PAL[kind];
    if (i % 3 === 0) b.cone(fx, y, fz, .3, .26, 6, GREENS[i % 4], .06);
    flower(b, kind, fx, y, fz, .8 + r() * .55, p[(r() * p.length) | 0]);
  }
}
/* a window box (or balcony planter): wooden box, green mound, a row of flowers. y = bottom of the box */
export function windowBox(b, x, y, z, w, seed) {
  b.box(x, y, z, w, .4, .58, '#8a5b39'); b.box(x, y + .3, z, w - .1, .1, .5, '#4a3524');
  b.box(x, y + .06, z + .3, w - .06, .06, .04, '#a8754a');
  const n = Math.max(3, Math.round(w / .42)), r = rng(seed * 313 + 7);
  for (let i = 0; i < n; i++) {
    const fx = x - w / 2 + .22 + i * (w - .44) / (n - 1), kind = ['daisy', 'tulip', 'poppy', 'iris'][(i + ((r() * 4) | 0)) % 4], p = PAL[kind];
    b.cone(fx, y + .36, z, .27, .3, 6, GREENS[i % 4], .07);
    flower(b, kind, fx, y + .38, z + (r() - .5) * .12, .55 + r() * .25, p[(r() * p.length) | 0]);
  }
  b.cone(x - w / 2 + .1, y + .34, z + .22, .2, .3, 5, '#4f9a4a', .04); b.cone(x + w / 2 - .1, y + .34, z + .22, .2, .3, 5, '#5fae52', .04);
}
/* a clay pot with a flowering plant: stands on the ground at y */
export function pottedFlower(b, x, y, z, kind, col, s) {
  const k = s || 1;
  b.cone(x, y, z, .3 * k, .42 * k, 8, '#c0764f', .4 * k); b.cyl(x, y + .38 * k, z, .42 * k, .08 * k, 8, '#cf8760', '#4a3524');
  for (let i = 0; i < 3; i++) b.cone(x + Math.cos(i * 2.1) * .12 * k, y + .46 * k, z + Math.sin(i * 2.1) * .12 * k, .3 * k, .3 * k, 6, GREENS[i], .06);
  flower(b, kind, x, y + .46 * k, z, .8 * k, col);
  flower(b, kind, x + .16 * k, y + .46 * k, z + .1 * k, .62 * k, col);
}
