/* Nestville interiors: small cut-away rooms built from boxes. No DOM, no textures.
   Room space: x left/right, z from the lake side (-z, big windows) to the entrance (+z). Floor is y = 0. */
import * as THREE from './lib.js';

const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 14), sph: new THREE.SphereGeometry(1, 12, 9) };
const MC = {};
const mat = c => MC[c] || (MC[c] = new THREE.MeshLambertMaterial({ color: c }));
const GLASS = new THREE.MeshLambertMaterial({ color: '#c6e9f2', transparent: true, opacity: .2, depthWrite: false });
function box(g, x, y, z, w, h, d, c) { const m = new THREE.Mesh(G.box, c === 'glass' ? GLASS : mat(c)); m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); g.add(m); return m; }
function cyl(g, x, y, z, r, h, c) { const m = new THREE.Mesh(G.cyl, mat(c)); m.scale.set(r, h, r); m.position.set(x, y + h / 2, z); g.add(m); return m; }
function sph(g, x, y, z, r, c, sy) { const m = new THREE.Mesh(G.sph, mat(c)); m.scale.set(r, r * (sy || 1), r); m.position.set(x, y, z); g.add(m); return m; }
function sub(g, x, z, ry) { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry || 0; g.add(s); return s; }

const PAL = ['#f6e7a8', '#f4c8d4', '#bcd9ee', '#cfe8c8', '#e8d3f0', '#f7d3b5', '#d9ecec', '#f3dcc0'];
const FLOOR = ['#caa57a', '#b98f66', '#d9c3a1', '#a98262'];
const SOFA = ['#7d9fb5', '#c98f8f', '#8fae8a', '#b3a0c9', '#d1a86b'];
const SHEET = ['#f2ebe0', '#e8d4d8', '#d6e3ee', '#e5ecd6'];
const ACC = ['#9fb8c8', '#d8a0a8', '#b7c99a', '#c9b3d9', '#e6c07a'];

/* ---------- walls ---------- */
function wallX(g, z, xa, xb, doors, Hh, c) {
  const gaps = (doors || []).map(d => [d - .55, d + .55]).sort((a, b) => a[0] - b[0]); let cur = xa;
  for (const [a, b] of gaps) { if (a > cur) box(g, (cur + a) / 2, 0, z, a - cur, Hh, .18, c); box(g, (a + b) / 2, 2.2, z, b - a, Hh - 2.2, .18, c); cur = b; }
  if (xb > cur) box(g, (cur + xb) / 2, 0, z, xb - cur, Hh, .18, c);
}
function wallZ(g, x, za, zb, doors, Hh, c) {
  const gaps = (doors || []).map(d => [d - .55, d + .55]).sort((a, b) => a[0] - b[0]); let cur = za;
  for (const [a, b] of gaps) { if (a > cur) box(g, x, 0, (cur + a) / 2, .18, Hh, a - cur, c); box(g, x, 2.2, (a + b) / 2, .18, Hh - 2.2, b - a, c); cur = b; }
  if (zb > cur) box(g, x, 0, (cur + zb) / 2, .18, Hh, zb - cur, c);
}
function backWall(g, W, D, Hh, wins, c) {
  const z = -D / 2; let cur = -W / 2;
  for (const w of wins) {
    const a = w.x - w.w / 2, b = w.x + w.w / 2, y0 = w.y0 === undefined ? .85 : w.y0, y1 = w.y1 === undefined ? 2.45 : w.y1;
    if (a > cur) box(g, (cur + a) / 2, 0, z, a - cur, Hh, .2, c);
    if (y0 > 0) box(g, w.x, 0, z, w.w, y0, .2, c);
    if (y1 < Hh) box(g, w.x, y1, z, w.w, Hh - y1, .2, c);
    box(g, w.x, y0, z, w.w, y1 - y0, .05, 'glass');
    box(g, a + .04, y0, z, .08, y1 - y0, .12, '#ffffff'); box(g, b - .04, y0, z, .08, y1 - y0, .12, '#ffffff'); box(g, w.x, y0, z, w.w, .06, .26, '#ffffff');
    cur = b;
  }
  if (W / 2 > cur) box(g, (cur + W / 2) / 2, 0, z, W / 2 - cur, Hh, .2, c);
}
function shell(R, o) {
  const { g, cap, W, D, Hh } = R;
  box(g, 0, -.3, 0, W, .3, D, '#d8d0c2'); box(g, 0, 0, 0, W - .3, .02, D - .3, o.floor);
  wallZ(g, -W / 2 + .09, -D / 2, D / 2, [], Hh, o.wall); wallZ(g, W / 2 - .09, -D / 2, D / 2, [], Hh, o.wall);
  backWall(g, W, D, Hh, o.wins, o.wall);
  wallX(cap, D / 2 - .09, -W / 2, W / 2, [o.door], Hh, o.wall);
  box(cap, 0, Hh, 0, W + .4, .25, D + .4, '#faf6ee');
  /* balcony outside the big windows */
  box(g, 0, -.3, -D / 2 - 1.2, W - .2, .3, 2.4, '#cdc4b2');
  box(g, 0, 0, -D / 2 - 2.35, W - .2, 1.0, .04, 'glass'); box(g, 0, 1.0, -D / 2 - 2.35, W - .2, .06, .1, '#f2f2f2');
  box(g, -W / 2 + .1, 0, -D / 2 - 2.35, .1, 1.06, .1, '#f2f2f2'); box(g, W / 2 - .1, 0, -D / 2 - 2.35, .1, 1.06, .1, '#f2f2f2');
  if (!o.ph) { /* garden below the balcony */
    box(g, 0, -.45, -D / 2 - 9, W + 14, .3, 14, '#8fbf7a');
    const fl = ['#f28ab0', '#ffd24a', '#ffffff', '#b79cf0', '#ff8a5c'];
    for (let i = 0; i < 18; i++) sph(g, -W / 2 - 2 + (i * 37 % 100) / 100 * (W + 4), -.12, -D / 2 - 3.4 - (i * 53 % 100) / 100 * 8, .16, fl[i % 5], .8);
  }
}

/* ---------- furniture (every piece faces +z; the back or head is at -z) ---------- */
function bed(g, x, z, ry, sheet, accent, w) {
  w = w || 1.8; const s = sub(g, x, z, ry);
  box(s, 0, 0, 0, w, .35, 2.1, '#8b6a4a'); box(s, 0, .35, .02, w - .1, .28, 2.0, sheet);
  box(s, -w * .25, .63, -.8, w * .4, .16, .42, '#ffffff'); box(s, w * .25, .63, -.8, w * .4, .16, .42, '#ffffff');
  box(s, 0, .63, .45, w - .1, .08, 1.1, accent); box(s, 0, .35, -1.08, w + .1, .95, .12, '#7a5a3c');
  box(s, -w / 2 - .35, 0, -.8, .45, .5, .45, '#8b6a4a'); box(s, w / 2 + .35, 0, -.8, .45, .5, .45, '#8b6a4a');
  cyl(s, -w / 2 - .35, .5, -.8, .09, .3, '#f4d58a'); cyl(s, w / 2 + .35, .5, -.8, .09, .3, '#f4d58a');
}
function sofa(g, x, z, ry, c, len) {
  len = len || 2.4; const s = sub(g, x, z, ry);
  box(s, 0, 0, 0, len, .45, .95, c); box(s, 0, .45, -.38, len, .55, .2, c);
  box(s, -len / 2 + .1, .45, .05, .2, .3, .8, c); box(s, len / 2 - .1, .45, .05, .2, .3, .8, c);
  box(s, -len / 4, .45, .1, len / 2 - .25, .14, .7, '#ffffff'); box(s, len / 4, .45, .1, len / 2 - .25, .14, .7, '#ffffff');
}
function coffee(g, x, z, ry) { const s = sub(g, x, z, ry); box(s, 0, .38, 0, 1.2, .06, .7, '#8b6a4a'); for (const a of [-.5, .5]) for (const b of [-.28, .28]) box(s, a, 0, b, .06, .38, .06, '#6b4a30'); }
function rug(g, x, z, w, d, c) { box(g, x, .02, z, w, .015, d, c); }
function kitchen(g, x, z, ry, len, fridge) {
  const s = sub(g, x, z, ry);
  box(s, 0, 0, 0, len, .9, .65, '#f3efe6'); box(s, 0, .9, 0, len, .05, .72, '#4a4f55'); box(s, 0, 1.55, -.18, len, .75, .35, '#d9cfbf');
  box(s, -len * .2, .95, .05, .6, .03, .4, '#aab4ba'); box(s, len * .22, .95, .05, .6, .02, .5, '#22262a');
  if (fridge) box(s, len / 2 + .45, 0, -.05, .8, 1.9, .7, '#e8ecee');
}
function island(g, x, z, ry, len) { const s = sub(g, x, z, ry); box(s, 0, 0, 0, len, .9, .9, '#f3efe6'); box(s, 0, .9, 0, len + .1, .05, 1.0, '#2f3438'); for (const a of [-len / 3, 0, len / 3]) { box(s, a, 0, 1.05, .4, .45, .4, '#c9b79c'); } }
function dining(g, x, z, ry, n) {
  const s = sub(g, x, z, ry); n = n || 4;
  box(s, 0, .74, 0, 1.7, .06, .95, '#9b7550'); for (const a of [-.75, .75]) for (const b of [-.4, .4]) box(s, a, 0, b, .07, .74, .07, '#7b5a3c');
  for (let i = 0; i < n; i++) { const a = (i % 2 ? .45 : -.45), b = i < 2 ? -.8 : .8; box(s, a, 0, b, .45, .45, .45, '#c9b79c'); box(s, a, .45, b + (b < 0 ? -.2 : .2), .45, .45, .06, '#c9b79c'); }
  cyl(s, 0, .8, 0, .12, .24, '#ffffff'); sph(s, 0, 1.12, 0, .12, '#ff8fa3');
}
function wardrobe(g, x, z, ry, w) { const s = sub(g, x, z, ry); w = w || 1.8; box(s, 0, 0, 0, w, 2.3, .6, '#e7dccb'); box(s, 0, 0, .31, .03, 2.3, .02, '#bda98c'); box(s, -.12, 1.0, .32, .05, .3, .03, '#8b6a4a'); box(s, .12, 1.0, .32, .05, .3, .03, '#8b6a4a'); }
function bath(g, x, z, ry) {
  const s = sub(g, x, z, ry);
  box(s, 0, 0, 0, 1.7, .55, .8, '#ffffff'); box(s, 0, .5, 0, 1.5, .04, .6, '#cfe9f2');
  box(s, 1.5, 0, .1, .4, .4, .6, '#ffffff'); box(s, 1.5, .4, -.2, .4, .45, .2, '#ffffff');
  box(s, -.3, 0, 1.15, 1.0, .85, .5, '#e9e2d6'); box(s, -.3, .85, 1.15, .6, .05, .4, '#ffffff'); box(s, -.3, 1.2, 1.4, .8, .7, .04, '#cfe3ea');
}
function plant(g, x, z, k) { k = k || 1; cyl(g, x, 0, z, .25 * k, .4 * k, '#c0764f'); sph(g, x, .75 * k, z, .38 * k, '#4f9d5a'); sph(g, x + .15 * k, 1.0 * k, z, .26 * k, '#5fb069'); }
function desk(g, x, z, ry) { const s = sub(g, x, z, ry); box(s, 0, .72, 0, 1.4, .05, .65, '#9b7550'); box(s, -.65, 0, 0, .06, .72, .6, '#7b5a3c'); box(s, .65, 0, 0, .06, .72, .6, '#7b5a3c'); box(s, 0, .77, -.15, .55, .35, .04, '#15181c'); box(s, 0, 0, .6, .45, .45, .45, '#c9b79c'); }
function shelf(g, x, z, ry, w, cols) {
  const s = sub(g, x, z, ry); w = w || 2; box(s, 0, 0, 0, w, 2, .4, '#e7dccb');
  for (let r = 0; r < 4; r++) { box(s, 0, .45 + r * .5, .02, w - .1, .04, .38, '#c9b79c'); for (let i = 0; i < Math.floor(w / .3); i++) box(s, -w / 2 + .25 + i * .3, .5 + r * .5, .08, .18, .3 + (i % 3) * .05, .2, cols[(i + r) % cols.length]); }
}
function counter(g, x, z, ry, len, c) { const s = sub(g, x, z, ry); box(s, 0, 0, 0, len, 1.0, .8, c || '#d8b98f'); box(s, 0, 1.0, 0, len + .1, .06, .9, '#f4efe4'); box(s, len * .25, 1.06, -.1, .4, .3, .35, '#2b3036'); box(s, -len * .25, 1.06, .1, .35, .2, .3, '#ffffff'); }
function tableRound(g, x, z, c) { cyl(g, x, 0, z, .07, .72, '#6b4a30'); cyl(g, x, .72, z, .55, .05, c || '#f4efe4'); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; box(g, x + Math.cos(a) * .95, 0, z + Math.sin(a) * .95, .42, .45, .42, '#c9b79c'); } }
function chair(g, x, z, ry, c) { const s = sub(g, x, z, ry); box(s, 0, 0, 0, .7, .5, .7, c); box(s, 0, .5, -.3, .7, .75, .12, c); box(s, 0, 0, 0, .12, .5, .12, '#333'); }
function mirror(g, x, y, z, ry, w) { const s = sub(g, x, z, ry); box(s, 0, y, 0, w, 1.3, .04, '#cfe3ea'); box(s, 0, y - .05, -.01, w + .12, 1.4, .02, '#c9a24a'); }
function bucket(g, x, z, cols) { cyl(g, x, 0, z, .3, .5, '#9aa7ad'); for (let i = 0; i < 5; i++) sph(g, x + Math.cos(i * 1.3) * .16, .75 + (i % 2) * .1, z + Math.sin(i * 1.3) * .16, .14, cols[i % cols.length], .9); }

/* ---------- camera helper ---------- */
function cam(x, z, tx, tz, y, fov) { return { x, y: y || 1.6, z, yaw: Math.atan2(-(tx - x), -(tz - z)), pitch: -.05, fov: fov || 72 }; }

/* ---------- designs ---------- */
function studio(R, o) {
  const { g, W, D, Hh } = R;
  shell(R, o);
  wallZ(g, 2.8, 1.3, 3.5, [2.4], Hh, o.wall); wallX(g, 1.3, 2.8, 4.5, [], Hh, o.wall);
  bath(g, 3.55, 2.9, Math.PI);
  bed(g, -3.2, -2.3, 0, o.sheet, o.acc); wardrobe(g, -4.2, 1.4, Math.PI / 2);
  kitchen(g, 4.0, -1.7, -Math.PI / 2, 3.2, true);
  sofa(g, -1.1, 1.3, Math.PI, o.sofa); coffee(g, -1.1, -.1, 0); rug(g, -1.1, .1, 2.8, 2.2, o.acc);
  dining(g, 1.9, .8, 0, 2); plant(g, -4.0, 3.0);
  R.cams = [cam(.2, 3.0, 0, -4.5), cam(-1.0, -1.4, 4.5, -.6)];
}
function oneBR(R, o) {
  const { g, W, D, Hh } = R;
  shell(R, o);
  wallZ(g, 1.8, -4, 4, [-1.0, 2.6], Hh, o.wall); wallX(g, 1.0, 1.8, 5.5, [], Hh, o.wall);
  bed(g, 3.9, -2.4, 0, o.sheet, o.acc, 2.0); wardrobe(g, 5.2, -.2, -Math.PI / 2, 1.6); rug(g, 3.9, -1.2, 2.6, 2.2, o.acc);
  bath(g, 4.0, 3.0, Math.PI);
  kitchen(g, -5.1, -.6, Math.PI / 2, 3.4, true);
  sofa(g, -1.4, .2, Math.PI, o.sofa, 2.6); coffee(g, -1.4, -1.4, 0); rug(g, -1.4, -.8, 3.2, 2.8, o.acc);
  dining(g, -3.2, 2.7, 0, 4); plant(g, -4.9, -3.2); plant(g, .9, -3.3, .9); desk(g, 0.2, 3.2, Math.PI);
  R.cams = [cam(-3.8, 3.2, -2.5, -4), cam(2.6, -.2, 4.0, -2.6)];
}
function twoBR(R, o) {
  const { g, W, D, Hh } = R;
  shell(R, o);
  wallZ(g, .8, -4.5, 4.5, [-2.0, 2.2], Hh, o.wall); wallX(g, 0, .8, 6.5, [], Hh, o.wall);
  wallZ(g, -3.8, 1.8, 4.5, [3.2], Hh, o.wall); wallX(g, 1.8, -6.5, -3.8, [], Hh, o.wall);
  bed(g, 4.3, -2.5, 0, o.sheet, o.acc, 2.0); wardrobe(g, 6.0, -.6, -Math.PI / 2, 1.6); rug(g, 4.3, -1.3, 2.8, 2.4, o.acc);
  bed(g, 5.1, 2.3, -Math.PI / 2, SHEET[(o.n + 1) % 4], ACC[(o.n + 2) % 5], 1.5); desk(g, 2.4, 3.9, Math.PI); wardrobe(g, 2.2, .45, 0, 1.4);
  bath(g, -5.1, 3.4, Math.PI);
  kitchen(g, -6.1, -1.6, Math.PI / 2, 3.2, true);
  sofa(g, -3.0, .4, Math.PI, o.sofa, 2.8); coffee(g, -3.0, -1.2, 0); rug(g, -3.0, -.6, 3.6, 3.0, o.acc);
  dining(g, -1.8, 3.5, 0, 4); plant(g, -.6, -3.6); plant(g, -6.0, 0.2, .9);
  R.cams = [cam(-2.2, 3.6, -3.0, -4.5), cam(2.0, -.9, 4.3, -2.7)];
}
function penthouse(R, o) {
  const { g, W, D, Hh } = R, n = o.beds, cl = -W / 2 + 7, cr = W / 2 - 7, hz = D / 2;
  shell(R, o);
  wallZ(g, cl, -hz, hz, [-3.0, 3.5], Hh, o.wall); wallX(g, 0, -W / 2, cl, [], Hh, o.wall);
  wallZ(g, cr, -hz, hz, [-3.0, 3.5], Hh, o.wall); wallX(g, 0, cr, W / 2, [], Hh, o.wall);
  /* left wing: two bedrooms. right wing: master suite + bedroom or bath */
  bed(g, -W / 2 + 1.3, -3.2, Math.PI / 2, o.sheet, o.acc, 1.8); wardrobe(g, cl - .5, -5.6, -Math.PI / 2, 1.4); rug(g, -W / 2 + 3.2, -3.2, 3, 2.8, o.acc);
  bed(g, -W / 2 + 1.3, 3.3, Math.PI / 2, SHEET[(o.n + 1) % 4], ACC[(o.n + 2) % 5], 1.6); desk(g, cl - 1.2, 5.6, Math.PI); plant(g, -W / 2 + .9, 6.0);
  bed(g, W / 2 - 1.4, -3.2, -Math.PI / 2, o.sheet, o.acc, 2.1); wardrobe(g, cr + .5, -5.6, Math.PI / 2, 1.8); wardrobe(g, cr + .5, -1.4, Math.PI / 2, 1.4); rug(g, W / 2 - 3.4, -3.2, 3.2, 3.2, o.acc);
  sofa(g, W / 2 - 1.4, -.9, -Math.PI / 2, o.sofa, 1.6);
  if (n === 3) { bath(g, W / 2 - 3.4, 3.8, Math.PI); box(g, W / 2 - 3.4, 0, 3.0, 5, .02, 3.2, '#e6eef0'); }
  else { bed(g, W / 2 - 1.3, 3.3, -Math.PI / 2, SHEET[(o.n + 2) % 4], ACC[(o.n + 3) % 5], 1.6); desk(g, cr + 1.2, 5.6, Math.PI); }
  if (n === 4) { wallZ(g, cr - 4, 1.5, hz, [4.0], Hh, o.wall); wallX(g, 1.5, cr - 4, cr, [], Hh, o.wall); bath(g, cr - 2.6, 4.9, Math.PI); }
  if (n === 5) {
    wallZ(g, cr - 6, 1.5, hz, [4.0], Hh, o.wall); wallX(g, 1.5, cr - 6, cr, [], Hh, o.wall);
    bed(g, cr - 1.3, 4.3, -Math.PI / 2, SHEET[o.n % 4], ACC[(o.n + 1) % 5], 1.6); desk(g, cr - 4.3, 5.7, Math.PI);
    wallZ(g, cr - 10, 1.5, hz, [4.0], Hh, o.wall); wallX(g, 1.5, cr - 10, cr - 6, [], Hh, o.wall); bath(g, cr - 8.1, 5.0, Math.PI);
  }
  /* great room: lounge by the glass, kitchen and dining in front */
  sofa(g, -1.5, -1.2, Math.PI, o.sofa, 3.0); sofa(g, -4.6, -3.4, Math.PI / 2, o.sofa, 2.4); sofa(g, 1.7, -3.2, -Math.PI / 2, o.sofa, 2.4);
  coffee(g, -1.5, -3.2, 0); rug(g, -1.5, -2.6, 4.8, 4.2, o.acc);
  kitchen(g, cl + .45, 4.0, Math.PI / 2, 4.2, true); island(g, cl + 2.8, 3.8, Math.PI / 2, 2.4);
  dining(g, 0.4, 4.9, 0, 4); plant(g, -.6, -5.8); plant(g, 3.4, -5.7, 1.2); plant(g, cl + .8, -5.8, 1.1);
  R.cams = [cam(.2, 5.4, 0, -6.5, 1.7, 74), cam(cr + 1.0, -1.0, W / 2 - 1.4, -4.0, 1.7, 74)];
}
function shop(R, o) {
  const { g, W, D, Hh } = R, k = o.n, cols = ['#e9a93a', '#e0705a', '#7fb3d5', '#8fbf7a', '#f2d1d8', '#b79cf0'];
  shell(R, o);
  counter(g, 0, -1.0, 0, 4.2, ['#d8b98f', '#f0b8c6', '#e4c9a5', '#8fb6a2', '#a5d09a', '#4a5560'][k]);
  if (k === 0) { /* bakery */
    box(g, 0, 0, 0.4, 3.2, .9, .8, '#f4efe4'); box(g, 0, .9, .4, 3.2, .7, .8, 'glass');
    for (let i = 0; i < 6; i++) sph(g, -1.3 + i * .52, 1.05, .4, .17, ['#d9a15a', '#c98b44', '#e6b878'][i % 3], .7);
    shelf(g, -4.2, -1.0, Math.PI / 2, 3, ['#d9a15a', '#c98b44', '#e6b878', '#f4dcae']); shelf(g, 4.2, -1.0, -Math.PI / 2, 3, ['#d9a15a', '#e6b878', '#f4dcae']);
  } else if (k === 1) { /* nail salon */
    for (let i = 0; i < 3; i++) { const x = -3.0 + i * 3.0; box(g, x, .72, 1.5, 1.3, .05, .7, '#ffffff'); box(g, x - .5, 0, 1.5, .06, .72, .6, '#bbb'); box(g, x + .5, 0, 1.5, .06, .72, .6, '#bbb'); chair(g, x, 2.5, Math.PI, cols[i * 2 % 6]); chair(g, x, .5, 0, '#f2d1d8'); sph(g, x + .3, .85, 1.5, .06, cols[(i + 1) % 6], 1); }
    shelf(g, -4.2, -1.0, Math.PI / 2, 3, ['#f28ab0', '#b79cf0', '#ff8a5c', '#f2d1d8', '#e0705a']);
  } else if (k === 2) { /* hair salon */
    for (let i = 0; i < 3; i++) { const z = -2.4 + i * 1.9; mirror(g, -4.3, 1.0, z, Math.PI / 2, 1.3); chair(g, -3.2, z, Math.PI / 2, '#d9577f'); box(g, -3.2, 0, z, .12, .25, .12, '#333'); }
    box(g, 3.4, 0, 2.0, 1.6, .9, .9, '#ffffff'); box(g, 3.4, .9, 2.0, 1.0, .1, .6, '#aab4ba'); shelf(g, 4.2, -1.8, -Math.PI / 2, 2.4, ['#7fb3d5', '#f2d1d8', '#ffffff', '#e9a93a']);
  } else if (k === 3) { /* cafe */
    tableRound(g, -3.0, 1.6, '#f4efe4'); tableRound(g, 0, 2.4, '#f4efe4'); tableRound(g, 3.0, 1.6, '#f4efe4'); tableRound(g, -3.2, -2.0, '#f4efe4');
    box(g, 2.9, 1.5, -2.8, 1.3, .4, .5, '#2b3036'); box(g, 2.9, 1.9, -2.8, .5, .35, .4, '#c9a24a'); shelf(g, 4.2, 0, -Math.PI / 2, 2.2, ['#ffffff', '#c9a24a', '#e0705a', '#8b6a4a']);
  } else if (k === 4) { /* flower shop */
    const fc = ['#f28ab0', '#ffd24a', '#ffffff', '#b79cf0', '#ff8a5c', '#e0705a'];
    for (let i = 0; i < 4; i++) { bucket(g, -3.6 + i * .9, 1.6, fc.slice(i)); bucket(g, 3.6 - i * .9, 1.6, fc.slice(i + 1)); }
    for (let i = 0; i < 4; i++) bucket(g, -4.0, -2.4 + i * 1.1, fc.slice(i)); plant(g, 3.8, -2.8, 1.3); plant(g, 3.6, 0.3, 1.1);
  } else { /* barber */
    for (let i = 0; i < 2; i++) { const x = -2.6 + i * 2.8; mirror(g, x, 1.0, -3.2, 0, 1.4); chair(g, x, -2.3, Math.PI, '#1f2428'); box(g, x, 0, -2.3, .14, .3, .14, '#c0c5ca'); }
    box(g, 4.1, 0, 1.0, .5, 1.6, .5, '#ffffff'); box(g, 4.1, .2, 1.0, .52, .2, .52, '#d9423a'); box(g, 4.1, .8, 1.0, .52, .2, .52, '#d9423a'); box(g, 4.1, 1.4, 1.0, .52, .2, .52, '#2f5d8a');
    shelf(g, -4.2, 0.8, Math.PI / 2, 2.4, ['#2f5d8a', '#ffffff', '#d9423a', '#1f2428']);
  }
  plant(g, -4.1, 3.0, .9);
  R.cams = [cam(0, 3.1, 0, -3.6, 1.6, 74), cam(-3.9, -2.9, 2.5, 2.0, 1.6, 74)];
}

export function describe(spec) {
  const k = spec.kind, n = spec.n | 0;
  if (k === 'ph') { const b = 3 + n % 3; return { design: 'ph', beds: b, title: 'Penthouse ' + (n + 1), sub: b + ' bedrooms' }; }
  if (k === 'shop') return { design: 'shop', title: spec.name || 'Shop', sub: 'Shop' };
  const d = ['studio', 'one', 'two'][n % 3];
  const sub2 = { studio: 'Studio', one: '1 bedroom', two: '2 bedrooms' }[d];
  return { design: d, title: (k === 'cot' ? 'Cottage ' : 'House ') + (n + 1), sub: sub2 };
}

export function buildRoom(spec) {
  const info = describe(spec), n = spec.n | 0;
  const g = new THREE.Group(), cap = new THREE.Group(); g.add(cap);
  const dims = { studio: [9, 7, 3], one: [11, 8, 3], two: [13, 9, 3], shop: [10, 8, 3.2], ph: [22 + (info.beds - 3) * 3, 13, 3.6] }[info.design];
  const R = { g, cap, W: dims[0], D: dims[1], Hh: dims[2], cams: [] };
  const o = { n, ph: info.design === 'ph', beds: info.beds, wall: PAL[(n * 3 + ({ house: 0, cot: 1, ph: 3, shop: 2 }[spec.kind] || 0)) % PAL.length], floor: FLOOR[n % 4], sheet: SHEET[n % 4], acc: ACC[n % 5], sofa: SOFA[n % 5], door: -1.5 };
  const { W, D, Hh } = R;
  if (info.design === 'ph') {
    const k = Math.floor((W - 1) / 3.5), step = (W - 1) / k; o.wins = [];
    for (let i = 0; i < k; i++) o.wins.push({ x: -W / 2 + .5 + step * (i + .5), w: step - .25, y0: .05, y1: Hh - .25 });
  } else if (info.design === 'studio') o.wins = [{ x: -.3, w: 2.6 }, { x: 3.0, w: 1.8 }];
  else if (info.design === 'one') o.wins = [{ x: -3.6, w: 3.4 }, { x: -.2, w: 2.0 }, { x: 3.7, w: 2.2 }];
  else if (info.design === 'two') o.wins = [{ x: -3.2, w: 5.0 }, { x: 3.7, w: 2.6 }];
  else o.wins = [{ x: -2.6, w: 3.6, y0: .5, y1: 2.6 }, { x: 2.6, w: 3.6, y0: .5, y1: 2.6 }];
  ({ studio, one: oneBR, two: twoBR, ph: penthouse, shop })[info.design](R, o);
  if (spec.kind === 'shop') o.n = n;
  return { group: g, cap, W, D, Hh, cams: R.cams, title: info.title, sub: info.sub, isPh: o.ph, design: info.design };
}
