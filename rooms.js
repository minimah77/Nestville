/* Nestville interiors: cozy cut-away rooms built from boxes, with a few tiny canvas textures (wood, wallpaper, rugs).
   Room space: x left/right, z from the lake side (-z, big windows) to the entrance (+z). Floor is y = 0.
   houses: 5 looks (3 of them from your Blender references) | cottages: calm minimal rooms, 8 soft colours (same colour as the outside) | penthouses: 2 pastel looks | each shop has its own look */
import * as THREE from './lib.js';

const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 18), sph: new THREE.SphereGeometry(1, 14, 10), cone: new THREE.CylinderGeometry(1, .14, 1, 18), bkt: new THREE.CylinderGeometry(1, .8, 1, 22) };
const MC = {}, TC = {};
const GLASS = new THREE.MeshLambertMaterial({ color: '#c6e9f2', transparent: true, opacity: .14, depthWrite: false });
const GLOW = new THREE.MeshLambertMaterial({ color: '#fff3d6', emissive: '#ffcf86', emissiveIntensity: .9 });
const PI = Math.PI;
function rg(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* ---------- tiny textures, drawn once and cached ---------- */
function motif(x, cx, cy, s) {
  x.beginPath(); x.moveTo(cx, cy - s); x.bezierCurveTo(cx + s * .7, cy - s * .4, cx + s * .7, cy + s * .4, cx, cy + s); x.bezierCurveTo(cx - s * .7, cy + s * .4, cx - s * .7, cy - s * .4, cx, cy - s); x.fill();
  x.beginPath(); x.arc(cx, cy - s * 1.15, s * .18, 0, 6.3); x.fill();
  x.beginPath(); x.ellipse(cx - s * .7, cy + s * .4, s * .35, s * .14, .8, 0, 6.3); x.fill();
  x.beginPath(); x.ellipse(cx + s * .7, cy + s * .4, s * .35, s * .14, -.8, 0, 6.3); x.fill();
}
const DRAW = {
  wood(x, S, a) {
    const R = rg(7); x.fillStyle = a; x.fillRect(0, 0, S, S); const n = 4, ph = S / n;
    for (let i = 0; i < n; i++) {
      x.fillStyle = i % 2 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.05)'; x.fillRect(0, i * ph, S, ph);
      x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, i * ph, S, 2); x.fillRect(R() * S, i * ph, 2, ph);
      for (let k = 0; k < 14; k++) { x.strokeStyle = R() < .5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.08)'; const yy = i * ph + 4 + R() * (ph - 8), x0 = R() * S; x.beginPath(); x.moveTo(x0, yy); x.lineTo(x0 + 20 + R() * 50, yy); x.stroke(); }
    }
  },
  damask(x, S, a, b) {
    x.fillStyle = a; x.fillRect(0, 0, S, S); x.fillStyle = b; x.globalAlpha = .6;
    [[0, 0], [S, 0], [0, S], [S, S], [S / 2, S / 2]].forEach(p => motif(x, p[0], p[1], S * .2));
    x.globalAlpha = .22; x.strokeStyle = b; x.lineWidth = 2; x.beginPath(); x.moveTo(S / 2, 0); x.lineTo(S, S / 2); x.lineTo(S / 2, S); x.lineTo(0, S / 2); x.closePath(); x.stroke(); x.globalAlpha = 1;
  },
  persian(x, S, a) {
    x.fillStyle = a || '#8a2a24'; x.fillRect(0, 0, S, S);
    x.strokeStyle = '#e8d6a8'; x.lineWidth = S * .03; x.strokeRect(S * .05, S * .05, S * .9, S * .9);
    x.strokeStyle = '#1f2f4a'; x.lineWidth = S * .05; x.strokeRect(S * .13, S * .13, S * .74, S * .74);
    x.fillStyle = '#e8d6a8'; x.beginPath(); x.moveTo(S / 2, S * .2); x.lineTo(S * .8, S / 2); x.lineTo(S / 2, S * .8); x.lineTo(S * .2, S / 2); x.closePath(); x.fill();
    x.fillStyle = '#1f2f4a'; x.beginPath(); x.moveTo(S / 2, S * .32); x.lineTo(S * .68, S / 2); x.lineTo(S / 2, S * .68); x.lineTo(S * .32, S / 2); x.closePath(); x.fill();
    x.fillStyle = a || '#8a2a24'; x.beginPath(); x.arc(S / 2, S / 2, S * .08, 0, 6.3); x.fill();
    x.fillStyle = '#e8d6a8'; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(S * (.2 + i * .08), S * .09, S * .012, 0, 6.3); x.arc(S * (.2 + i * .08), S * .91, S * .012, 0, 6.3); x.fill(); }
  },
  check(x, S, a, b) { const n = 8, c = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? b : a; x.fillRect(i * c, j * c, c, c); } },
  brick(x, S, a, b) { x.fillStyle = b; x.fillRect(0, 0, S, S); const R = rg(3), rh = S / 6; for (let r = 0; r < 6; r++) for (let c = -1; c < 3; c++) { x.fillStyle = a; const ox = (r % 2 ? S / 4 : 0) + c * S / 2, sh = (R() - .5) * 20; x.fillRect(ox + 3, r * rh + 3, S / 2 - 6, rh - 6); x.fillStyle = 'rgba(255,255,255,' + (.04 + R() * .04) + ')'; x.fillRect(ox + 3, r * rh + 3, S / 2 - 6, rh - 6); } },
  tile(x, S, a, b) { x.fillStyle = a; x.fillRect(0, 0, S, S); x.strokeStyle = b; x.lineWidth = 3; x.strokeRect(0, 0, S, S); x.strokeRect(S / 2, 0, 1, S); x.strokeRect(0, S / 2, S, 1); },
  blinds(x, S, a) { x.fillStyle = a; x.fillRect(0, 0, S, S); x.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 16; i++) x.fillRect(0, i * S / 16, S, 2); }
};
const TILE = { wood: 2.4, damask: 1.7, brick: 1.3, tile: .9 };
function tex(key) {
  if (TC[key]) return TC[key];
  const p = key.split('|'), c = document.createElement('canvas'); c.width = c.height = 256; DRAW[p[0]](c.getContext('2d'), 256, p[1], p[2]);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return TC[key] = t;
}
function mat(c) {
  if (c === 'glass') return GLASS; if (c === 'glow') return GLOW;
  return MC[c] || (MC[c] = new THREE.MeshLambertMaterial(c[0] === '@' ? { map: tex(c.slice(1)) } : { color: c }));
}
/* box with texture coordinates scaled to its real size, so wallpaper and planks keep a natural scale */
function tg(w, h, d, key) {
  const t = TILE[key.slice(1).split('|')[0]] || 0, g = new THREE.BoxGeometry(w, h, d);
  if (t) { const uv = g.attributes.uv, f = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let k = 0; k < 24; k++) { const q = f[(k / 4) | 0]; uv.setXY(k, uv.getX(k) * q[0] / t, uv.getY(k) * q[1] / t); } }
  g.userData.own = true; return g;
}
function put(g, geo, c, x, y, z, sx, sy, sz) { const m = new THREE.Mesh(geo, mat(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); g.add(m); return m; }
function box(g, x, y, z, w, h, d, c) {
  if (c[0] === '@') { const m = new THREE.Mesh(tg(w, h, d, c), mat(c)); m.position.set(x, y + h / 2, z); g.add(m); return m; }
  return put(g, G.box, c, x, y + h / 2, z, w, h, d);
}
function cyl(g, x, y, z, r, h, c) { return put(g, G.cyl, c, x, y + h / 2, z, r, h, r); }
function sph(g, x, y, z, r, c, sy) { return put(g, G.sph, c, x, y, z, r, r * (sy || 1), r); }
function rod(g, x, y, z, r, len, c, ax) { const m = put(g, G.cyl, c, x, y, z, r, len, r); if (ax === 'x') m.rotation.z = PI / 2; else if (ax === 'z') m.rotation.x = PI / 2; return m; }
function sub(g, x, z, ry) { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry || 0; g.add(s); return s; }

/* ---------- looks ---------- */
const HT = [ /* houses: nordic white | vintage green | cream | sage | rose */
  { wall: '#f1eee7', floor: '@wood|#e6c99d', trim: '#ffffff', sofa: '#eee7dc', acc: '#8fb4d0', acc2: '#e8c264', wood: '#d9b685', curtain: '#ffffff', kit: '#f3efe6', top: '#e9e4da', lamp: 'arc', focal: 'tv', sheet: '#f4efe6', rug: '#a9b9c6', fl: 'daisy', flc: ['#ffffff', '#fff3d6', '#ffe3ef'] },
  { wall: '@damask|#eadbbd|#cfa56a', floor: '@wood|#b98550', trim: '#7a4a2a', sofa: '#2f5a3c', acc: '#f0a7b4', acc2: '#e2dc7a', wood: '#8a5a34', curtain: '#2c5a3a', kit: '#7d5a3a', top: '#d9c9a8', lamp: 'tri', focal: 'fire', sheet: '#efe6d2', rug: '@persian|#2f5a3c', vint: 1, chair: '#2f5a3c', fl: 'poppy', flc: ['#e8452f', '#ff7a45'] },
  { wall: '#f3ebdd', floor: '@wood|#efcb90', trim: '#fffaf0', sofa: '#f6f0e4', acc: '#f2b45a', acc2: '#e0705a', wood: '#e9b868', curtain: '#ffffff', kit: '#f7efe0', top: '#e8b866', lamp: 'shade', focal: 'tv', sheet: '#fff8ea', rug: '@check|#fff6ea|#f2b27a', cloth: '@check|#c9505a|#f6ece0', fl: 'sun', flc: ['#f6bf2a'] },
  { wall: '#cfdcc2', floor: '@wood|#e4bd8e', trim: '#ffffff', sofa: '#f0b99a', acc: '#f7e1a0', acc2: '#8fc29d', wood: '#d49b66', curtain: '#f7f0e2', kit: '#ece6d6', top: '#f6f2ea', lamp: 'arc', focal: 'tv', sheet: '#f4efe6', rug: '#f7e1a0', fl: 'tulip', flc: ['#f08aa8', '#f5c94a', '#fff3d6'] },
  { wall: '#f0d4cf', floor: '@wood|#dcae86', trim: '#fff7f1', sofa: '#c98a88', acc: '#ecc57e', acc2: '#8fb4a2', wood: '#c48858', curtain: '#f6e8e2', kit: '#f6ece4', top: '#d8b7a0', lamp: 'shade', focal: 'tv', sheet: '#f8efe8', rug: '#e9c9c0', fl: 'iris', flc: ['#9a7fd8', '#c58ae0'] }
];
const CT = [ /* cottages: calm minimal rooms, one soft colour each. The order matches the outside walls (COTW in build.js): rose, apricot, lemon, mint, sky, lilac, coral, cream */
  { wall: '#f9e1e6', floor: '@wood|#ecd4b4', trim: '#ffffff', sofa: '#f7f1e8', acc: '#e58a9e', acc2: '#f2c978', wood: '#e4c29a', curtain: '#fffaf4', kit: '#f8f3ea', top: '#efe6d8', lamp: 'shade', focal: 'tv', sheet: '#fffaf2', rug: '#f3c4cd', fl: 'tulip', flc: ['#e5455a', '#f08aa8', '#fff3d6'] },
  { wall: '#fbeccd', floor: '@wood|#e8cfa6', trim: '#ffffff', sofa: '#f6efe2', acc: '#e9a55a', acc2: '#8fc29d', wood: '#e2b886', curtain: '#fffaf4', kit: '#f8f3ea', top: '#efe6d8', lamp: 'shade', focal: 'fire', sheet: '#fffaf2', rug: '#f7dca0', fl: 'poppy', flc: ['#ff7a45', '#f5c94a'] },
  { wall: '#faf5cc', floor: '@wood|#ecd8b0', trim: '#ffffff', sofa: '#f8f3e6', acc: '#f0c94a', acc2: '#9fd0a8', wood: '#e6c694', curtain: '#fffaf4', kit: '#f8f3ea', top: '#efe6d8', lamp: 'shade', focal: 'tv', sheet: '#fffaf2', rug: '#f2e49a', fl: 'sun', flc: ['#f6bf2a'] },
  { wall: '#e1f2e0', floor: '@wood|#e6d3b0', trim: '#ffffff', sofa: '#f6f1e6', acc: '#7fc29a', acc2: '#f2b27a', wood: '#dfbf92', curtain: '#fffaf4', kit: '#f8f3ea', top: '#efe6d8', lamp: 'shade', focal: 'fire', sheet: '#fffaf2', rug: '#cfe9cf', fl: 'daisy', flc: ['#ffffff', '#fff6dc'] },
  { wall: '#dcedf8', floor: '@wood|#e9d6b6', trim: '#ffffff', sofa: '#f5f1ea', acc: '#7fb4dc', acc2: '#f2c978', wood: '#e0c096', curtain: '#fffaf4', kit: '#f8f3ea', top: '#efe6d8', lamp: 'shade', focal: 'tv', sheet: '#fffaf2', rug: '#c6e0f2', fl: 'iris', flc: ['#7c9be6', '#9a7fd8'] },
  { wall: '#ebe3f8', floor: '@wood|#e8d4b8', trim: '#ffffff', sofa: '#f6f1ea', acc: '#a58cdc', acc2: '#f2c0cf', wood: '#e2c4a0', curtain: '#fffaf4', kit: '#f8f3ea', top: '#efe6d8', lamp: 'shade', focal: 'fire', sheet: '#fffaf2', rug: '#dcd0f2', fl: 'iris', flc: ['#b79cf0', '#c58ae0'] },
  { wall: '#fadccf', floor: '@wood|#ead0ae', trim: '#ffffff', sofa: '#f8f0e6', acc: '#ec8a6e', acc2: '#8fc29d', wood: '#e3bd90', curtain: '#fffaf4', kit: '#f8f3ea', top: '#efe6d8', lamp: 'shade', focal: 'tv', sheet: '#fffaf2', rug: '#f6c2ae', fl: 'poppy', flc: ['#e8452f', '#ff7a45', '#f7a8c0'] },
  { wall: '#fff8ee', floor: '@wood|#ebd6b4', trim: '#ffffff', sofa: '#f2ebe0', acc: '#d9a15a', acc2: '#9fc99a', wood: '#e5c79e', curtain: '#fffaf4', kit: '#f8f3ea', top: '#efe6d8', lamp: 'shade', focal: 'fire', sheet: '#fffaf2', rug: '#f0e0c4', fl: 'daisy', flc: ['#ffffff', '#ffe3ef'] }
];
const PT = [ /* penthouses */
  { fl: 'tulip', flc: ['#f08aa8', '#fff3d6', '#f5c94a'], wall: '#e3f1c9', floor: '@wood|#f0b878', trim: '#ffffff', sofa: '#f3e8c3', sofa2: '#a9dd9a', acc: '#f2a27a', acc2: '#f6c25b', wood: '#e8a25c', curtain: '#ffffff', kit: '#f4efe0', top: '#d9c9a8', lamp: 'arc', sheet: '#fbf6e8', rug: '#f4967d' },
  { fl: 'sun', flc: ['#f6bf2a'], wall: '#f8f3ea', floor: '@wood|#9b6b4a', trim: '#ffffff', sofa: '#e89a3e', acc: '#f2b27a', acc2: '#f8e7c8', wood: '#e9dcc4', curtain: '#ffffff', kit: '#ffffff', top: '#b9a58a', lamp: 'arc', sheet: '#ffffff', rug: '@check|#f8e7c8|#f2b27a', bubble: 1 }
];

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
function backWall(g, W, D, Hh, wins, c, trim) {
  const z = -D / 2; let cur = -W / 2;
  for (const w of wins) {
    const a = w.x - w.w / 2, b = w.x + w.w / 2, y0 = w.y0 === undefined ? .85 : w.y0, y1 = w.y1 === undefined ? 2.45 : w.y1;
    if (a > cur) box(g, (cur + a) / 2, 0, z, a - cur, Hh, .2, c);
    if (y0 > 0) box(g, w.x, 0, z, w.w, y0, .2, c);
    if (y1 < Hh) box(g, w.x, y1, z, w.w, Hh - y1, .2, c);
    box(g, w.x, y0, z, w.w, y1 - y0, .05, 'glass');
    box(g, a + .04, y0, z, .08, y1 - y0, .12, trim); box(g, b - .04, y0, z, .08, y1 - y0, .12, trim); box(g, w.x, y0, z, w.w, .06, .26, trim); box(g, w.x, y1 - .04, z, w.w, .06, .14, trim);
    if (w.w > 2.4) box(g, w.x, y0, z, .05, y1 - y0, .08, trim);
    cur = b;
  }
  if (W / 2 > cur) box(g, (cur + W / 2) / 2, 0, z, W / 2 - cur, Hh, .2, c);
}
function curtains(g, o, D) {
  if (o.ph || o.noCur) return; const z = -D / 2 + .2, c = o.th.curtain;
  for (const w of o.wins) {
    const a = w.x - w.w / 2, b = w.x + w.w / 2, y1 = w.y1 === undefined ? 2.45 : w.y1;
    for (const s of [a, b]) { const sg = s === a ? -1 : 1; box(g, s + sg * .24, 0, z + .14, .5, y1 + .3, .09, c); }
    rod(g, w.x, y1 + .32, z + .14, .03, w.w + 1.1, '#c9a24a', 'x');
  }
}
function shell(R, o) {
  const { g, cap, W, D, Hh } = R, th = o.th;
  box(g, 0, -.3, 0, W, .3, D, '#d8d0c2'); box(g, 0, 0, 0, W - .3, .02, D - .3, th.floor);
  wallZ(g, -W / 2 + .09, -D / 2, D / 2, [], Hh, o.wall); wallZ(g, W / 2 - .09, -D / 2, D / 2, [], Hh, o.wall);
  backWall(g, W, D, Hh, o.wins, o.wall, o.trim);
  wallX(cap, D / 2 - .09, -W / 2, W / 2, [o.door], Hh, o.wall);
  box(cap, 0, Hh, 0, W + .4, .25, D + .4, '#faf6ee');
  /* skirting boards and a picture rail */
  box(g, -W / 2 + .2, 0, 0, .04, .16, D - .3, o.trim); box(g, W / 2 - .2, 0, 0, .04, .16, D - .3, o.trim);
  if (th.vint) { box(g, -W / 2 + .2, .16, 0, .04, .9, D - .3, th.wood); box(g, W / 2 - .2, .16, 0, .04, .9, D - .3, th.wood); box(g, -W / 2 + .19, 1.06, 0, .07, .06, D - .3, th.trim); box(g, W / 2 - .19, 1.06, 0, .07, .06, D - .3, th.trim); }
  curtains(g, o, D);
  /* balcony outside the big windows (the real village shows beyond it) */
  box(g, 0, -.3, -D / 2 - 1.2, W - .2, .3, 2.4, '#cdc4b2');
  box(g, 0, 0, -D / 2 - 2.35, W - .2, 1.0, .04, 'glass'); box(g, 0, 1.0, -D / 2 - 2.35, W - .2, .06, .1, '#f2f2f2');
  box(g, -W / 2 + .1, 0, -D / 2 - 2.35, .1, 1.06, .1, '#f2f2f2'); box(g, W / 2 - .1, 0, -D / 2 - 2.35, .1, 1.06, .1, '#f2f2f2');
  pendant(cap, 0, 0, Hh, th); if (W > 12) { pendant(cap, -W / 4, 0, Hh, th); pendant(cap, W / 4, 0, Hh, th); }
}
function pendant(c, x, z, Hh, th) { rod(c, x, Hh - .45, z, .012, .9, '#333333'); if (th && th.vint) put(c, G.cone, 'glow', x, Hh - .95, z, .38, .3, .38).rotation.x = PI; else sph(c, x, Hh - .95, z, .24, 'glow'); }

/* ---------- furniture (every piece faces +z; the back or head is at -z) ---------- */
function bed(g, x, z, ry, th, w, alt) {
  w = w || 1.8; const s = sub(g, x, z, ry), duv = alt ? th.acc2 : th.acc, run = alt ? th.acc : th.acc2;
  box(s, 0, 0, 0, w, .3, 2.1, th.wood); box(s, 0, .3, .02, w - .1, .26, 2.0, th.sheet); box(s, 0, .56, .3, w - .06, .1, 1.45, duv); box(s, 0, .6, .75, w - .06, .07, .5, run);
  for (const a of [-1, 1]) { const p = box(s, a * w * .25, .56, -.78, w * .4, .17, .42, '#ffffff'); p.rotation.x = -.12; }
  box(s, 0, .3, -1.08, w + .1, 1.0, .12, th.wood); box(s, 0, .55, -1.0, w - .1, .6, .04, th.sheet);
  for (const a of [-1, 1]) { box(s, a * (w / 2 + .35), 0, -.8, .45, .5, .45, th.wood); cyl(s, a * (w / 2 + .35), .5, -.8, .09, .26, 'glow'); }
  box(s, 0, 0, 1.1, w - .1, .22, .12, th.wood);
}
function sofa(g, x, z, ry, th, len, c) {
  len = len || 2.4; c = c || th.sofa; const s = sub(g, x, z, ry);
  box(s, 0, .12, 0, len, .33, .95, c); box(s, 0, .45, -.38, len, .62, .22, c);
  box(s, -len / 2 + .11, .45, .05, .22, .34, .85, c); box(s, len / 2 - .11, .45, .05, .22, .34, .85, c);
  const n = Math.max(2, Math.round(len / 1.1)), cw = (len - .5) / n;
  for (let i = 0; i < n; i++) box(s, -len / 2 + .25 + cw * (i + .5), .45, .12, cw - .04, .14, .68, c);
  for (const a of [-1, 1]) for (const b of [-1, 1]) box(s, a * (len / 2 - .12), 0, b * .35, .08, .12, .08, '#5a4030');
  const p1 = box(s, -len / 2 + .5, .6, .0, .38, .38, .12, th.acc); p1.rotation.x = -.25; p1.rotation.z = .12;
  const p2 = box(s, len / 2 - .5, .6, .0, .38, .38, .12, th.acc2); p2.rotation.x = -.25; p2.rotation.z = -.12;
  if (th.vint) for (let i = 0; i < 6; i++) sph(s, -len / 2 + .5 + i * (len - 1) / 5, .86, -.27, .035, '#3a2a1c');
  return s;
}
function armchair(g, x, z, ry, c, wing) {
  const s = sub(g, x, z, ry); box(s, 0, .15, 0, .9, .3, .85, c); box(s, 0, .3, -.35, .9, .9, .2, c);
  box(s, -.4, .3, .05, .16, .3, .8, c); box(s, .4, .3, .05, .16, .3, .8, c); box(s, 0, .45, .08, .62, .12, .6, c);
  if (wing) { box(s, -.42, .9, -.28, .12, .45, .28, c); box(s, .42, .9, -.28, .12, .45, .28, c); }
  for (const a of [-1, 1]) for (const b of [-1, 1]) box(s, a * .38, 0, b * .35, .08, .15, .08, '#4a2e1c');
  return s;
}
function coffee(g, x, z, th) {
  if (th.vint || th.round) { cyl(g, x, 0, z, .07, .4, th.wood); cyl(g, x, .4, z, .55, .05, th.wood); vaseF(g, x + .12, .45, z - .05, th.fl, th.flc); return; }
  box(g, x, .38, z, 1.2, .06, .7, th.wood); for (const a of [-.5, .5]) for (const b of [-.28, .28]) box(g, x + a, 0, z + b, .06, .38, .06, '#6b4a30');
  box(g, x - .2, .44, z, .35, .04, .25, th.acc); vaseF(g, x + .3, .44, z, th.fl, th.flc);
}
function rug(g, x, z, w, d, th) {
  if (th.rug[0] === '@') { const m = box(g, x, .02, z, w, .015, d, th.rug); return m; }
  if (th.round) return cyl(g, x, .02, z, Math.min(w, d) / 2, .015, th.rug);
  box(g, x, .02, z, w, .015, d, th.rug);
}
function tvUnit(g, x, z, ry, w, th) {
  const s = sub(g, x, z, ry); box(s, 0, .16, 0, w, .5, .5, th.wood); box(s, 0, 0, 0, w - .1, .16, .42, th.trim);
  box(s, 0, .95, -.2, w * .85, .62, .06, '#14181d'); box(s, 0, .98, -.165, w * .85 - .1, .54, .01, '#1b3a52');
  cyl(s, w * .36, .66, 0, .06, .26, '#fff3d0'); cyl(s, w * .36 + .16, .66, 0, .05, .2, '#fff3d0'); box(s, -w * .3, .66, 0, .3, .14, .2, th.acc);
}
function fireplace(g, x, z, ry, w, th, Hh) {
  const s = sub(g, x, z, ry); box(s, 0, 0, -.05, w, 1.25, .5, th.wood); box(s, 0, 1.25, -.02, w + .3, .08, .6, th.wood);
  box(s, 0, 0, .21, w - .5, .95, .06, '#1c1411'); sph(s, 0, .22, .26, .2, 'glow', 1.2); sph(s, -.2, .12, .26, .12, '#ff9a3c'); sph(s, .2, .12, .26, .12, '#ffb347'); rod(s, 0, .1, .26, .06, .6, '#5a3a22', 'x');
  box(s, 0, 1.33, -.14, w - .3, Hh - 1.33, .3, th.wood);
  box(s, -w * .3, 1.33, .06, .3, .42, .16, th.wood); sph(s, -w * .3, 1.62, .15, .09, '#f3ead2'); cyl(s, w * .3, 1.33, .06, .05, .3, '#fff3d0'); cyl(s, w * .3 + .15, 1.33, .06, .05, .22, '#fff3d0');
}
function gramophone(g, x, z, ry, th) {
  const s = sub(g, x, z, ry); cyl(s, 0, 0, 0, .05, .7, th.wood); cyl(s, 0, 0, 0, .26, .04, th.wood); box(s, 0, .7, 0, .55, .28, .5, th.wood); cyl(s, 0, .98, 0, .2, .03, '#1c1c1c');
  const h = put(s, G.cone, '#d9a93c', .12, 1.4, -.05, .42, .6, .42); h.rotation.z = -.55; rod(s, -.04, 1.1, 0, .025, .3, '#d9a93c');
}
function lampF(g, x, z, th) {
  cyl(g, x, 0, z, .2, .04, '#3a3030'); cyl(g, x, 0, z, .03, 1.5, '#3a3030');
  if (th.lamp === 'arc') cyl(g, x, 1.2, z, .2, .5, 'glow'); else put(g, G.cone, 'glow', x, 1.75, z, .32, .4, .32).rotation.x = PI;
}
function sconce(g, x, y, z, ry) { const s = sub(g, x, z, ry); box(s, 0, y, 0, .06, .06, .12, '#c9a24a'); put(s, G.cone, 'glow', 0, y + .22, .1, .12, .26, .12); }
function art(g, x, y, z, ry, w, h, c1, c2) {
  const s = sub(g, x, z, ry); box(s, 0, y, 0, w, h, .05, '#7a5230'); box(s, 0, y + .05, .03, w - .1, h - .1, .02, c1);
  box(s, -w * .14, y + h * .38, .045, w * .34, h * .26, .01, c2); sph(s, w * .18, y + h * .3, .05, Math.min(w, h) * .12, '#ffffff', .1);
}
function plant(g, x, z, k, big) {
  k = k || 1; cyl(g, x, 0, z, .25 * k, .4 * k, '#c0764f'); const gr = ['#4f9d5a', '#5fb069', '#3f8a4c'];
  if (big) { for (let i = 0; i < 6; i++) { const m = sph(g, x + Math.cos(i * 1.05) * .35 * k, .95 * k + (i % 2) * .3 * k, z + Math.sin(i * 1.05) * .35 * k, .34 * k, gr[i % 3], .16); m.rotation.z = Math.cos(i * 1.05) * .6; m.rotation.x = Math.sin(i * 1.05) * .6; } cyl(g, x, .35 * k, z, .03, .7 * k, '#3f6a3a'); return; }
  sph(g, x, .75 * k, z, .38 * k, gr[0]); sph(g, x + .15 * k, 1.0 * k, z, .26 * k, gr[1]); sph(g, x - .15 * k, .95 * k, z + .1 * k, .24 * k, gr[2]);
}
function wardrobe(g, x, z, ry, w, th) { const s = sub(g, x, z, ry); w = w || 1.8; box(s, 0, 0, 0, w, 2.3, .6, th.wood); box(s, 0, 0, .31, .03, 2.3, .02, th.trim); box(s, -.12, 1.0, .32, .05, .3, .03, '#e6c07a'); box(s, .12, 1.0, .32, .05, .3, .03, '#e6c07a'); }
function desk(g, x, z, ry, th) { const s = sub(g, x, z, ry); box(s, 0, .72, 0, 1.4, .05, .65, th.wood); box(s, -.65, 0, 0, .06, .72, .6, th.wood); box(s, .65, 0, 0, .06, .72, .6, th.wood); box(s, 0, .77, -.15, .55, .35, .04, '#15181c'); box(s, 0, 0, .6, .45, .45, .45, th.acc); cyl(s, .5, .77, .1, .05, .18, 'glow'); }
function shelf(g, x, z, ry, w, cols, wood) {
  const s = sub(g, x, z, ry); w = w || 2; wood = wood || '#e7dccb'; box(s, 0, 0, 0, w, 2, .4, wood);
  for (let r = 0; r < 4; r++) { box(s, 0, .45 + r * .5, .02, w - .1, .04, .38, wood); for (let i = 0; i < Math.floor(w / .3); i++) box(s, -w / 2 + .25 + i * .3, .5 + r * .5, .08, .18, .3 + (i % 3) * .05, .2, cols[(i + r) % cols.length]); }
}
function kitchen(g, x, z, ry, len, fridge, th) {
  const s = sub(g, x, z, ry); box(s, 0, 0, 0, len, .9, .65, th.kit); box(s, 0, .9, 0, len, .05, .72, th.top); box(s, 0, 1.55, -.18, len, .75, .35, th.kit);
  box(s, -len * .2, .95, .05, .6, .03, .4, '#aab4ba'); box(s, len * .22, .95, .05, .6, .02, .5, '#22262a');
  cyl(s, -len * .38, .95, .0, .1, .22, '#7fb3d5'); vaseF(s, len * .36, .95, .05, th.fl, th.flc, .9);
  for (let i = 0; i < Math.floor(len / .6); i++) box(s, -len / 2 + .3 + i * .6, .42, .335, .05, .05, .02, '#e6c07a');
  if (fridge) box(s, len / 2 + .45, 0, -.05, .8, 1.9, .7, '#e8ecee');
}
function island(g, x, z, ry, len, th) { const s = sub(g, x, z, ry); box(s, 0, 0, 0, len, .9, .9, th.kit); box(s, 0, .9, 0, len + .1, .05, 1.0, th.top); for (const a of [-len / 3, 0, len / 3]) { cyl(s, a, 0, 1.05, .2, .45, th.wood); cyl(s, a, .45, 1.05, .22, .05, th.acc); } }
function dining(g, x, z, ry, n, th) {
  const s = sub(g, x, z, ry); n = n || 4;
  box(s, 0, .74, 0, 1.7, .06, .95, th.wood); if (th.cloth) box(s, 0, .8, 0, 1.4, .015, .8, th.cloth);
  for (const a of [-.75, .75]) for (const b of [-.4, .4]) box(s, a, 0, b, .07, .74, .07, th.wood);
  for (let i = 0; i < n; i++) { const a = (i % 2 ? .45 : -.45), b = i < 2 ? -.8 : .8; box(s, a, 0, b, .45, .45, .45, th.acc2); box(s, a, .45, b + (b < 0 ? -.2 : .2), .45, .45, .06, th.acc2); }
  vaseF(s, 0, .8, 0, th.fl, th.flc, 1.2);
}
function tea(g, x, z, th) {
  cyl(g, x, 0, z, .06, .68, th.wood); cyl(g, x, .68, z, .5, .05, th.wood); vaseF(g, x, .73, z, th.fl, th.flc); cyl(g, x + .25, .73, z + .1, .07, .07, '#ffffff'); cyl(g, x - .25, .73, z - .1, .07, .07, '#ffffff');
  armchair(g, x, z - 1.05, 0, th.chair, 1); armchair(g, x, z + 1.05, PI, th.chair, 1);
}
function bath(g, x, z, ry) { /* 1.5 wide, 2 deep, door side +z */
  const s = sub(g, x, z, ry); box(s, .38, 0, -.2, .75, .55, 1.6, '#ffffff'); box(s, .38, .5, -.2, .6, .04, 1.45, '#cfe9f2');
  box(s, -.4, 0, .72, .4, .4, .55, '#ffffff'); box(s, -.4, .4, .5, .4, .4, .15, '#ffffff'); box(s, -.45, 0, -.45, .5, .85, .45, '#e9e2d6'); box(s, -.45, .85, -.45, .5, .05, .4, '#ffffff'); box(s, -.45, 1.2, -.7, .5, .6, .04, '#cfe3ea');
}
/* ---------- real flowers: stems, leaves and petals (tulip, sunflower, iris, daisy, poppy) in silver buckets, vases and pots ---------- */
const UPV = new THREE.Vector3(0, 1, 0), FLC = ['#f08aa8', '#ffffff', '#f5c94a'];
function shd(h, f) { const n = parseInt(h.slice(1), 16), c = v => Math.max(0, Math.min(255, Math.round(v * f))); return '#' + ((1 << 24) | (c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).slice(1); }
function stem(g, x0, y0, z0, x1, y1, z1, r, c) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dx, dy, dz) || .001, m = put(g, G.cyl, c, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, r, L, r);
  m.quaternion.setFromUnitVectors(UPV, new THREE.Vector3(dx / L, dy / L, dz / L)); return m;
}
function leafR(g, x, y, z, len, ry, lean, c) { /* a leaf that starts at (x,y,z) and grows up and outward */
  const m = put(g, G.sph, c, x + Math.sin(lean) * Math.sin(ry) * len / 2, y + Math.cos(lean) * len / 2, z + Math.sin(lean) * Math.cos(ry) * len / 2, len * .13, len / 2, len * .03);
  m.rotation.set(lean, ry, 0, 'YXZ'); return m;
}
function headR(g, x, y, z, n, rc, rp, pw, tilt, pc, cc, off) { /* a ring of petals around a domed centre, facing forward and up */
  const hd = new THREE.Group(); hd.position.set(x, y, z); hd.rotation.x = -tilt; g.add(hd);
  const rm = (rc + rp) / 2, o = off || 0;
  for (let i = 0; i < n; i++) {
    const a = (i + o) / n * PI * 2, m = put(hd, G.sph, i % 2 ? shd(pc, .93) : pc, Math.cos(a) * rm, Math.sin(a) * rm, 0, pw, (rp - rc) / 2, pw * .3);
    m.rotation.z = a - PI / 2;
  }
  put(hd, G.sph, cc, 0, 0, rc * .12, rc, rc, rc * .55); return hd;
}
/* one flower: stem from the base (bx,by,bz) up to the head at (tx,ty,tz). k scales the head (1 = full size) */
function bloom(g, kind, bx, by, bz, tx, ty, tz, col, k) {
  k = k || 1; const gr = '#4f8f45';
  stem(g, bx, by, bz, tx, ty, tz, (kind === 'sun' ? .02 : .009) * Math.max(.6, k), gr);
  if (kind === 'tulip') {
    sph(g, tx, ty, tz, .095 * k, col, 1.3);
    for (const q of [-1, 1]) put(g, G.sph, shd(col, 1.12), tx + q * .055 * k, ty + .04 * k, tz + .03 * k, .055 * k, .13 * k, .05 * k).rotation.z = -q * .24;
    put(g, G.sph, shd(col, 1.2), tx, ty + .15 * k, tz + .02 * k, .04 * k, .07 * k, .04 * k);
  } else if (kind === 'sun') {
    headR(g, tx, ty, tz, 12, .075 * k, .17 * k, .058 * k, .45, col, '#6b4423');
  } else if (kind === 'iris') headR(g, tx, ty, tz, 5, .03 * k, .11 * k, .052 * k, .7, col, '#f5c94a');
  else if (kind === 'poppy') headR(g, tx, ty, tz, 5, .03 * k, .12 * k, .07 * k, .6, col, '#2b2b2b');
  else headR(g, tx, ty, tz, 10, .03 * k, .095 * k, .022 * k, .6, col, '#f5c431');
}
/* silver bucket or tall vase: base at y, top at y + h */
function bucket(g, x, y, z, r, h, c) {
  put(g, G.bkt, c || '#c5ccd2', x, y + h / 2, z, r, h, r); put(g, G.cyl, '#dfe5ea', x, y + h - .015, z, r * 1.04, .03, r * 1.04); put(g, G.cyl, '#6f7a80', x, y + h + .004, z, r * .93, .01, r * .93);
}
/* a bunch of flowers fanning out of a container whose top is at y. h = how tall the bunch is */
function bouquet(g, x, y, z, kind, cols, n, spread, h, k) {
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + x * 3, rr = i ? spread * (.3 + ((i * 37) % 10) / 14) : 0;
    bloom(g, kind, x + Math.cos(a) * .03, y, z + Math.sin(a) * .03, x + Math.cos(a) * rr, y + h * (.82 + ((i * 53) % 10) / 45) - rr * .25, z + Math.sin(a) * rr, cols[i % cols.length], k);
  }
  const nl = n > 4 ? 5 : 2;
  for (let i = 0; i < nl; i++) leafR(g, x + Math.cos(i * 1.3) * .05, y, z + Math.sin(i * 1.3) * .05, h * .42 + (i % 2) * .08, i * 1.26 + x * 2, .5 + .12 * (i % 3), i % 2 ? '#4f9a4a' : '#5fae52');
}
function vaseF(g, x, y, z, kind, cols, sc) { /* small ceramic vase with a few flowers, standing on y */
  sc = sc || 1; put(g, G.bkt, '#f6f1e8', x, y + .08 * sc, z, .06 * sc, .16 * sc, .06 * sc);
  bouquet(g, x, y + .16 * sc, z, kind || 'tulip', cols || FLC, 3, .08 * sc, .3 * sc, .7 * sc);
}
function potF(g, x, y, z, kind, cols, sc) { /* clay pot with a flowering plant */
  sc = sc || 1; put(g, G.bkt, '#cf8760', x, y + .1 * sc, z, .12 * sc, .2 * sc, .12 * sc); sph(g, x, y + .22 * sc, z, .13 * sc, '#4f9a4a', .6);
  bouquet(g, x, y + .2 * sc, z, kind, cols, 3, .09 * sc, .28 * sc, .65 * sc);
}
function gallery(g, x, y, z, ry) { /* a little wall of framed flower prints, like the references */
  const s = sub(g, x, z, ry), fr = '#efe2c9';
  [[-.52, 0, .5, .64, '#f6d9cb', '#e58a7a'], [.08, .1, .72, .56, '#e4efdc', '#6faa6a'], [.68, -.04, .46, .56, '#f8eec4', '#e8b93a'], [-.2, -.66, .52, .42, '#d9e6f2', '#7aa6cf'], [.46, -.64, .56, .44, '#f2dcec', '#c978b2']].forEach(f => {
    box(s, f[0], y + f[1], 0, f[2], f[3], .04, fr); box(s, f[0], y + f[1] + .05, .025, f[2] - .1, f[3] - .1, .012, f[4]);
    for (let k = 0; k < 3; k++) put(s, G.sph, f[5], f[0] + (k - 1) * f[2] * .22, y + f[1] + f[3] * (.5 + (k % 2) * .14), .045, Math.min(f[2], f[3]) * .1, Math.min(f[2], f[3]) * .1, .01);
  });
}
function pouf(g, x, z, c) { cyl(g, x, 0, z, .3, .36, c); sph(g, x, .36, z, .3, c, .35); }

function arch(g, x, z, ry, w, h, frame, back) {
  const s = sub(g, x, z, ry); box(s, 0, 0, 0, w, h - w / 2, .1, back);
  const f = rod(s, 0, h - w / 2, -.01, w / 2 + .1, .12, frame, 'z'); const b = rod(s, 0, h - w / 2, .04, w / 2, .1, back, 'z');
  for (const a of [-1, 1]) box(s, a * (w / 2 + .05), 0, 0, .1, h - w / 2, .16, frame);
  return s;
}
function chairS(g, x, z, ry, c, seat) { const s = sub(g, x, z, ry); box(s, 0, .42, 0, .55, .06, .55, seat || c); box(s, 0, .5, -.26, .55, .55, .05, c); for (const a of [-1, 1]) for (const b of [-1, 1]) box(s, a * .24, 0, b * .24, .04, .42, .04, c); }
function stool(g, x, z, c) { cyl(g, x, .35, z, .22, .06, c); for (const a of [-1, 1]) for (const b of [-1, 1]) box(g, x + a * .12, 0, z + b * .12, .04, .35, .04, '#5a3a22'); }
function tableR(g, x, z, c, r) { r = r || .55; cyl(g, x, 0, z, .07, .72, '#6b4a30'); cyl(g, x, .72, z, r, .05, c); cyl(g, x, 0, z, .3, .03, '#6b4a30'); }
function mirror(g, x, y, z, ry, w) { const s = sub(g, x, z, ry); box(s, 0, y, 0, w, 1.3, .04, '#cfe3ea'); box(s, 0, y - .05, -.01, w + .12, 1.4, .02, '#c9a24a'); }
function ovalMirror(g, x, y, z, ry) { const s = sub(g, x, z, ry); rod(s, 0, y, 0, .62, .05, '#fff4e0', 'z').scale.set(.62, .05, .85); rod(s, 0, y, .03, .5, .03, '#cfe3ea', 'z').scale.set(.5, .03, .72); }
function counterBase(g, x, z, ry, len, c, top) { const s = sub(g, x, z, ry); box(s, 0, 0, 0, len, 1.0, .8, c); box(s, 0, 1.0, 0, len + .1, .06, .9, top); return s; }

/* ---------- camera helper ---------- */
function cam(x, z, tx, tz, y, fov) { return { x, y: y || 1.6, z, yaw: Math.atan2(-(tx - x), -(tz - z)), pitch: -.05, fov: fov || 72 }; }

/* ---------- house / cottage designs ---------- */
function focal(g, o, x, z, ry, w, Hh) { if (o.th.focal === 'fire') fireplace(g, x, z, ry, w, o.th, Hh); else tvUnit(g, x, z, ry, w, o.th); }
function studio(R, o) {
  const { g, Hh } = R, th = o.th; shell(R, o);
  wallZ(g, 2.8, 1.3, 3.5, [2.4], Hh, o.wall); wallX(g, 1.3, 2.8, 4.5, [], Hh, o.wall);
  bath(g, 3.65, 2.4, 0);
  bed(g, -3.2, -2.3, 0, th, 1.8); wardrobe(g, -4.2, 1.4, PI / 2, 1.8, th); focal(g, o, -4.15, -.4, PI / 2, 1.3, Hh);
  kitchen(g, 4.05, -1.7, -PI / 2, 3.2, true, th);
  sofa(g, -1.1, 1.3, PI, th, 2.4); coffee(g, -1.1, -.1, th); rug(g, -1.1, .1, 2.8, 2.2, th);
  if (th.vint) tea(g, 1.6, .6, th); else dining(g, 1.9, .8, 0, 2, th);
  plant(g, -4.0, 3.0, 1, 1); lampF(g, -2.6, 2.3, th); if (th.focal === 'tv') gallery(g, -4.33, 2.3, -.4, PI / 2); else art(g, -4.33, 1.7, -.4, PI / 2, 1.0, .7, th.acc, th.acc2);
  pouf(g, -2.4, .2, th.sofa); potF(g, -3.2, 0, 2.9, th.fl, th.flc, 1.1);
  if (th.vint) { sconce(g, -4.3, 1.9, .55, PI / 2); gramophone(g, 0.7, 2.9, 0, th); }
  R.cams = [cam(.2, 3.0, 0, -4.5), cam(-1.0, -1.4, 4.5, -.6)];
}
function oneBR(R, o) {
  const { g, Hh } = R, th = o.th; shell(R, o);
  wallZ(g, 1.8, -4, 4, [-1.0, 2.6], Hh, o.wall); wallX(g, 1.0, 1.8, 5.5, [], Hh, o.wall);
  bed(g, 3.9, -2.4, 0, th, 2.0, 1); wardrobe(g, 5.15, -.1, -PI / 2, 1.6, th); rug(g, 3.9, -1.2, 2.6, 2.2, { rug: th.acc2 });
  bath(g, 4.6, 2.5, 0);
  kitchen(g, -5.1, -.6, PI / 2, 3.4, true, th);
  sofa(g, -1.4, .2, PI, th, 2.6); coffee(g, -1.4, -1.4, th); rug(g, -1.4, -.8, 3.2, 2.8, th);
  if (th.vint) { tea(g, -3.3, 2.7, th); gramophone(g, 1.45, -3.7, -PI / 2, th); } else dining(g, -3.2, 2.7, 0, 4, th);
  focal(g, o, 1.44, -2.55, -PI / 2, 1.6, Hh);
  plant(g, -4.9, -3.2, 1, 1); plant(g, .9, -3.3, .9); desk(g, 0.2, 3.2, PI, th); lampF(g, -3.2, .9, th);
  art(g, 1.7, 1.6, 2.2, -PI / 2 + PI, .9, .7, th.acc, th.acc2); if (th.focal === 'tv') gallery(g, -5.4, 2.1, -3.0, PI / 2); else art(g, -5.4, 1.6, -3.0, PI / 2, .9, .7, th.acc2, th.acc);
  pouf(g, -3.0, -1.0, th.sofa); potF(g, -1.5, 0, 3.7, th.fl, th.flc, 1.1);
  if (th.vint) { sconce(g, 1.66, 1.9, -1.8, -PI / 2); sconce(g, 1.66, 1.9, -3.5, -PI / 2); }
  R.cams = [cam(-3.8, 3.2, -2.5, -4), cam(2.6, -.2, 4.0, -2.6)];
}
function twoBR(R, o) {
  const { g, Hh } = R, th = o.th; shell(R, o);
  wallZ(g, .8, -4.5, 4.5, [-2.0, 2.2], Hh, o.wall); wallX(g, 0, .8, 6.5, [], Hh, o.wall);
  wallZ(g, -3.8, 1.8, 4.5, [3.2], Hh, o.wall); wallX(g, 1.8, -6.5, -3.8, [], Hh, o.wall);
  bed(g, 4.3, -2.5, 0, th, 2.0); wardrobe(g, 6.0, -.6, -PI / 2, 1.6, th); rug(g, 4.3, -1.3, 2.8, 2.4, { rug: th.acc2 });
  bed(g, 5.1, 2.3, -PI / 2, th, 1.5, 1); desk(g, 2.4, 3.9, PI, th); wardrobe(g, 2.2, .45, 0, 1.4, th);
  bath(g, -5.1, 3.1, 0);
  kitchen(g, -6.05, -1.6, PI / 2, 3.2, true, th);
  sofa(g, -3.0, .4, PI, th, 2.8); coffee(g, -3.0, -1.2, th); rug(g, -3.0, -.6, 3.6, 3.0, th);
  if (th.vint) { tea(g, -1.6, 3.2, th); } else dining(g, -1.8, 3.5, 0, 4, th);
  focal(g, o, .55, -3.6, -PI / 2, 1.5, Hh);
  plant(g, -.6, -3.6, 1, 1); plant(g, -6.0, 1.4, .9); lampF(g, -4.9, .6, th);
  art(g, .72, 1.6, -.3, -PI / 2 + PI, .8, .6, th.acc, th.acc2);
  pouf(g, -4.7, -1.0, th.sofa); potF(g, -.2, 0, 3.9, th.fl, th.flc, 1.1);
  if (th.vint) { gramophone(g, .5, -1.1, -PI / 2, th); sconce(g, .7, 1.9, -3.0, -PI / 2); }
  R.cams = [cam(-2.2, 3.6, -3.0, -4.5), cam(2.0, -.9, 4.3, -2.7)];
}

/* ---------- penthouses: 0 = mint and butter, 1 = white with the orange bubble sofa ---------- */
function penthouse(R, o) {
  const { g, W, D, Hh } = R, n = o.beds, cl = -W / 2 + 7, cr = W / 2 - 7, hz = D / 2, th = o.th;
  shell(R, o);
  wallZ(g, cl, -hz, hz, [-3.0, 3.5], Hh, o.wall); wallX(g, 0, -W / 2, cl, [], Hh, o.wall);
  wallZ(g, cr, -hz, hz, [-3.0, 3.5], Hh, o.wall); wallX(g, 0, cr, W / 2, [], Hh, o.wall);
  bed(g, -W / 2 + 1.3, -3.2, PI / 2, th, 1.8); wardrobe(g, cl - .5, -5.6, -PI / 2, 1.4, th); rug(g, -W / 2 + 3.2, -3.2, 3, 2.8, { rug: th.acc2 });
  bed(g, -W / 2 + 1.3, 3.3, PI / 2, th, 1.6, 1); desk(g, cl - 1.2, 5.6, PI, th); plant(g, -W / 2 + .9, 6.0, 1);
  bed(g, W / 2 - 1.4, -3.2, -PI / 2, th, 2.1, 1); wardrobe(g, cr + .5, -5.6, PI / 2, 1.8, th); wardrobe(g, cr + .5, -1.4, PI / 2, 1.4, th); rug(g, W / 2 - 3.4, -3.2, 3.2, 3.2, { rug: th.acc2 });
  sofa(g, W / 2 - 1.4, -.9, -PI / 2, th, 1.6, th.acc);
  if (n === 3) { bath(g, W / 2 - 3.4, 4.8, 0); box(g, W / 2 - 3.4, 0, 4.8, 3, .02, 2.4, '#e6eef0'); }
  else { bed(g, W / 2 - 1.3, 3.3, -PI / 2, th, 1.6); desk(g, cr + 1.2, 5.6, PI, th); }
  if (n === 4) { wallZ(g, cr - 4, 1.5, hz, [4.0], Hh, o.wall); wallX(g, 1.5, cr - 4, cr, [], Hh, o.wall); bath(g, cr - 2.0, 4.9, 0); }
  if (n === 5) {
    wallZ(g, cr - 6, 1.5, hz, [4.0], Hh, o.wall); wallX(g, 1.5, cr - 6, cr, [], Hh, o.wall);
    bed(g, cr - 1.3, 4.3, -PI / 2, th, 1.6); desk(g, cr - 4.3, 5.7, PI, th);
    wallZ(g, cr - 10, 1.5, hz, [4.0], Hh, o.wall); wallX(g, 1.5, cr - 10, cr - 6, [], Hh, o.wall); bath(g, cr - 8.0, 5.0, 0);
  }
  /* great room between the two wings */
  if (th.bubble) { /* orange bubble sofa against the glass, checkered rug, glass table with a mushroom lamp */
    rug(g, 0, -2.6, 4.6, 3.4, th);
    const bs = sub(g, 0, -5.4, 0), oc = ['#e89a3e', '#eea64a', '#e48e34'];
    for (let i = 0; i < 6; i++) { sph(bs, -1.6 + i * .64, .45, 0, .46, oc[i % 3], .9); sph(bs, -1.3 + i * .64, 1.0, -.25, .45, oc[(i + 1) % 3], .85); }
    for (let i = 0; i < 5; i++) sph(bs, -1.3 + i * .66, .4, .55, .4, oc[(i + 2) % 3], .85);
    box(bs, .9, .62, .5, 1.1, .1, .8, '#ffffff');
    box(g, 0, .38, -2.9, 1.4, .05, .8, 'glass'); box(g, 0, .36, -2.9, 1.4, .02, .8, '#d9ecef'); cyl(g, .3, .43, -2.9, .04, .22, '#ffffff'); sph(g, .3, .7, -2.9, .18, '#ffffff', .55);
    cyl(g, -1.3, 0, -1.6, .35, .4, '#ffffff'); plant(g, -3.3, -5.6, 1.3, 1);
    box(g, -3.55, 0, -1.2, .4, 2.2, 1.4, '#ffffff'); box(g, -3.5, .4, -1.2, .3, .08, 1.2, '#e9dcc4'); box(g, -3.5, 1.2, -1.2, .3, .08, 1.2, '#e9dcc4'); cyl(g, -3.5, .48, -1.4, .07, .3, '#2b2b2b'); sph(g, -3.5, 1.45, -1.0, .16, '#8fbf7a');
  } else { /* mint and butter: cream and mint sofas facing each other over a round peach rug */
    rug(g, 0, -2.6, 4.2, 4.2, { rug: th.rug, round: 1 });
    sofa(g, 0, -.4, PI, th, 3.2, th.sofa); sofa(g, 0, -4.8, 0, th, 3.0, th.sofa2);
    box(g, 0, .36, -2.6, 1.5, .08, .8, th.acc2); box(g, -.6, 0, -2.6, .08, .36, .7, th.acc2); box(g, .6, 0, -2.6, .08, .36, .7, th.acc2); cyl(g, 0, .44, -2.6, .1, .22, '#fff7e0'); sph(g, 0, .75, -2.6, .13, '#f28ab0');
    plant(g, 3.2, -5.8, 1.3, 1); plant(g, -3.2, -5.8, 1.1, 1);
  }
  kitchen(g, cl + .45, 4.0, PI / 2, 4.2, true, th); island(g, cl + 2.8, 3.8, PI / 2, 2.4, th);
  dining(g, 0.4, 4.9, 0, 4, th); lampF(g, 2.6, 0.6, th);
  R.cams = [cam(.2, 5.4, 0, -6.5, 1.7, 74), cam(cr + 1.0, -1.0, W / 2 - 1.4, -4.0, 1.7, 74)];
}

/* ---------- the six shops, each from its reference picture ---------- */
const SHOPS = [
  { wall: '#f4e8d8', floor: '@wood|#dba56a', trim: '#fff6ea', th: { floor: '@wood|#dba56a', wood: '#6b2a2e', trim: '#fff6ea', curtain: null, acc: '#f1b8c4', acc2: '#9fb4a2', lamp: 'shade' } },
  { wall: '#e6d9f2', floor: '@wood|#f1dcc8', trim: '#ffffff', th: { floor: '@wood|#f1dcc8', wood: '#d9c6ee', trim: '#ffffff', curtain: null, acc: '#f28ab0', acc2: '#b79cf0', lamp: 'shade' } },
  { wall: '#f4b3c7', floor: '@wood|#f0d2b8', trim: '#ffe4ee', th: { floor: '@wood|#f0d2b8', wood: '#d98aa5', trim: '#ffe4ee', curtain: null, acc: '#f19ab8', acc2: '#ffffff', lamp: 'shade' } },
  { wall: '#f7f1e4', floor: '@tile|#f2d79a|#dcb668', trim: '#d9805a', th: { floor: '@tile|#f2d79a|#dcb668', wood: '#d49a5a', trim: '#d9805a', curtain: null, acc: '#9fc99a', acc2: '#e0705a', lamp: 'shade' } },
  { wall: '#f8e0b4', floor: '@tile|#c9e27c|#b2cc64', trim: '#e9b57a', th: { floor: '@tile|#c9e27c|#b2cc64', wood: '#e0a766', trim: '#e9b57a', curtain: null, acc: '#f28ab0', acc2: '#ffd24a', lamp: 'shade' } },
  { wall: '@brick|#4a3a35|#2c2220', floor: '@wood|#7b5a3c', trim: '#3a2a22', th: { floor: '@wood|#7b5a3c', wood: '#4a2e22', trim: '#3a2a22', curtain: null, acc: '#9b2e2e', acc2: '#c9a24a', lamp: 'shade' } }
];
function shop(R, o) {
  const { g, W, D, Hh } = R, k = o.n, th = o.th; shell(R, o);
  if (k === 0) { /* bakery: burgundy arched shelves, tiled counter with a glass case, bistro table */
    const breads = ['#d9a15a', '#c98b44', '#e6b878', '#b87832'];
    for (let i = 0; i < 3; i++) {
      const z = -2.4 + i * 2.4, ax = -W / 2 + .3; arch(g, ax, z, PI / 2, 1.8, 2.7, '#6b2a2e', '#f1e0cc');
      for (let r = 0; r < 3; r++) { box(g, ax + .2, .55 + r * .6, z, .35, .04, 1.55, '#f6efe4'); for (let j = 0; j < 4; j++) { if (i === 1 && r === 1) break; const b = sph(g, ax + .2, .7 + r * .6, z - .55 + j * .37, .13, breads[(i + j + r) % 4], .75); b.scale.x = .2; if ((j + r) % 2) b.scale.z = .22; } }
    }
    box(g, -W / 2 + .45, 1.2, -.0, .45, .4, .5, '#f1ece4'); sph(g, -W / 2 + .5, 1.8, 0, .12, '#dddddd'); cyl(g, -W / 2 + .5, 1.2, -.3, .1, .22, '#ffffff'); cyl(g, -W / 2 + .5, 1.2, .3, .1, .22, '#ffffff');
    counterBase(g, -1.5, -.2, PI / 2, 4.6, '@tile|#6e2c31|#e8cfc4', '#f7f3ee'); box(g, -1.5, 1.06, -.2, .55, .55, 3.2, 'glass'); box(g, -1.5, 1.06, -.2, .6, .04, 3.3, '#6b2a2e');
    for (let i = 0; i < 8; i++) { cyl(g, -1.5, 1.1, -1.6 + i * .42, .12, .12, ['#f1b8c4', '#c98b44', '#8a6fb5', '#f6e0a0'][i % 4]); }
    box(g, -1.7, 1.06, 1.9, .5, .3, .4, '#2b3036'); cyl(g, -1.5, 1.06, -1.9, .22, .02, '#f7f3ee'); sph(g, -1.5, 1.33, -1.9, .18, '#f7e3e8', .8);
    tableR(g, 2.2, 1.6, '#f1ece4', .5); chairS(g, 2.2, 2.6, PI, '#9a9a94'); chairS(g, 1.2, 1.6, PI / 2, '#9a9a94'); cyl(g, 2.2, .77, 1.6, .06, .26, '#d6e5d0'); sph(g, 2.2, 1.12, 1.6, .12, '#f1b8c4');
    box(g, 3.6, 0, -2.6, 2.2, .5, .6, '#a5a39b'); for (let i = 0; i < 8; i++) sph(g, 2.7 + i * .26, .65 + (i % 2) * .08, -2.6, .13 + (i % 3) * .02, i % 3 ? '#4f9d5a' : '#a9c7e8', .9);
    art(g, W / 2 - .3, 1.6, -1.8, -PI / 2, .7, .9, '#ffffff', '#222222'); plant(g, 4.1, 1.0, 1.4, 1);
  } else if (k === 1) { /* nail salon: lilac, three manicure tables */
    for (let i = 0; i < 3; i++) { const x = -3.0 + i * 3.0; box(g, x, .72, 1.5, 1.3, .05, .7, '#ffffff'); box(g, x - .5, 0, 1.5, .06, .72, .6, '#bbbbbb'); box(g, x + .5, 0, 1.5, .06, .72, .6, '#bbbbbb'); chairS(g, x, 2.5, PI, '#b79cf0'); chairS(g, x, .55, 0, '#f2d1d8'); sph(g, x + .3, .85, 1.5, .06, ['#f28ab0', '#b79cf0', '#ff8a5c'][i], 1); cyl(g, x - .3, .77, 1.5, .1, .14, 'glow'); }
    shelf(g, -4.3, -1.0, PI / 2, 3, ['#f28ab0', '#b79cf0', '#ff8a5c', '#f2d1d8', '#e0705a'], '#f1e7f7'); counterBase(g, 2.8, -1.4, 0, 3.4, '#d9c6ee', '#ffffff'); plant(g, 4.1, 3.0, 1, 1);
    art(g, 4.9, 1.6, 0, -PI / 2, 1.1, .8, '#f28ab0', '#ffffff');
  } else if (k === 2) { /* hair salon: all pink, cloud wall, mirror stations, pink tree, balloons */
    for (let i = 0; i < 3; i++) { const z = -2.4 + i * 2.0; mirror(g, W / 2 - .3, 1.0, z, -PI / 2, 1.3); chairS(g, W / 2 - 1.6, z, PI / 2, '#d9577f'); cyl(g, W / 2 - 1.6, 0, z, .09, .3, '#bbbbbb'); box(g, W / 2 - .6, .85, z, .4, .05, 1.0, '#ffffff'); }
    const dx = -W / 2 + 1.9; box(g, dx, 0, -2.4, 2.6, 1.0, .8, '#f19ab8'); cyl(g, dx - 1.3, 0, -2.4, .4, 1.0, '#f19ab8'); cyl(g, dx + 1.3, 0, -2.4, .4, 1.0, '#f19ab8'); box(g, dx, 1.0, -2.4, 2.7, .05, .9, '#fff3f6'); box(g, dx - .6, 1.05, -2.5, .5, .3, .4, '#2b3036'); sph(g, dx + .7, 1.2, -2.4, .12, '#ffffff', .7);
    for (let i = 0; i < 5; i++) sph(g, -W / 2 + .35, 1.9 + (i % 2) * .4, -1.2 + i * .45, .26 + (i % 2) * .06, '#ffffff', .75);
    tableR(g, -2.0, 1.6, '#ffffff', .6); tableR(g, 0.6, 2.2, '#ffffff', .6); for (const t of [[-2.0, 1.6], [0.6, 2.2]]) for (let a = 0; a < 3; a++) { const r = a * 2.1; sph(g, t[0] + Math.cos(r) * 1.0, .32, t[1] + Math.sin(r) * 1.0, .34, '#e48aa8', .8); }
    cyl(g, 2.0, 0, 3.0, .35, .5, '#d9a93c'); cyl(g, 2.0, .5, 3.0, .07, 1.4, '#7a5230'); for (let i = 0; i < 6; i++) sph(g, 2.0 + Math.cos(i * 1.05) * .55, 2.2 + (i % 2) * .3, 3.0 + Math.sin(i * 1.05) * .55, .42, ['#f28ab0', '#f7b6cb', '#ee7aa0'][i % 3]);
    const bc = ['#f28ab0', '#ffffff', '#d9a93c', '#f7b6cb']; for (let i = 0; i < 12; i++) sph(g, -W / 2 + .6, .5 + i * .22, 3.0 - Math.sin(i / 11 * 3.1) * .3 - i * .1, .24 + (i % 3) * .05, bc[i % 4]);
  } else if (k === 3) { /* cafe: green counter, espresso machine, chalkboard menu, wooden tables and stools */
    counterBase(g, 3.6, -.8, -PI / 2, 4.6, '#9fc99a', '#d49a5a'); counterBase(g, 1.6, -3.2, 0, 3.0, '#9fc99a', '#d49a5a');
    box(g, 3.5, 1.06, -2.0, .5, .5, .5, '#9aa0a6'); for (const c of [-.12, .12]) cyl(g, 3.5, 1.56, -2.0 + c, .07, .08, '#ffffff'); box(g, 3.5, 1.06, -.8, .45, .35, .4, '#22262a'); cyl(g, 3.5, 1.41, -.8, .14, .3, '#c9a24a');
    cyl(g, 3.5, 1.06, .5, .13, .3, '#7fb3d5'); box(g, 3.5, 1.06, 1.3, .35, .3, .4, '#2b3036'); for (let i = 0; i < 4; i++) cyl(g, 1.0 + i * .3, 1.06, -3.2, .09, .2 + i * .02, '#ffffff');
    box(g, W / 2 - .3, 1.5, -1.6, .08, 1.1, 2.0, '#d9805a'); box(g, W / 2 - .36, 1.56, -1.6, .02, .98, 1.88, '#2f4a3a'); for (let i = 0; i < 6; i++) box(g, W / 2 - .38, 1.8 + (i % 3) * .22, -2.1 + (i > 2 ? 1.0 : 0) + (i % 3) * .05, .01, .03, .8, '#ffffff');
    for (let r = 0; r < 4; r++) box(g, -3.0, .4 + r * .5, -3.0, 1.2, .04, .4, '#2b3036'); for (let r = 0; r < 4; r++) for (let j = 0; j < 4; j++) box(g, -3.5 + j * .3, .45 + r * .5, -3.0, .18, .3, .2, ['#4a76b8', '#4f9d69', '#ffffff', '#c9a24a'][(r + j) % 4]);
    box(g, 0, 0, -.2, 1.5, .1, 1.1, '#d49a5a'); box(g, 0, .9, -.2, 1.5, .06, 1.1, '#d49a5a'); for (const a of [-.65, .65]) box(g, a, 0, -.2, .05, .95, .05, '#2b3036'); for (let i = 0; i < 5; i++) cyl(g, -.5 + i * .25, .96, -.2, .1, .1 + (i % 2) * .05, ['#7a4a2a', '#c24a3a', '#f0d7a0'][i % 3]);
    tableR(g, -3.0, 1.6, '#d49a5a', .6); tableR(g, 0.2, 2.4, '#d49a5a', .6); stool(g, -3.8, 1.6, '#c28a52'); stool(g, -2.2, 1.9, '#c28a52'); stool(g, -.6, 2.4, '#c28a52'); stool(g, 1.0, 2.5, '#c28a52');
    for (let i = 0; i < 10; i++) box(g, -W / 2 + .2, .6 + (i * 37 % 20) / 10, -3 + i * .6, .04, .1, .22, '#f2d27a');
    plant(g, -4.2, 3.0, 1, 1);
  } else if (k === 4) { /* flower shop, like the reference: cream walls, lime tiles, a flower step with silver buckets, sunflowers, a wooden work table */
    const RED = ['#e5455a', '#f26b7c'], YEL = ['#f5c94a', '#ffd86a'], PNK = ['#f08aa8', '#f7b6cb'], PUR = ['#9a7fd8', '#7c9be6', '#b79cf0'], SUNC = ['#f6bf2a'];
    /* the flower step along the right wall: two tiers of cream stone */
    box(g, 3.75, 0, -1.2, 1.5, .3, 3.8, '#f6e3bd'); box(g, 4.3, .3, -1.2, .8, .3, 3.8, '#f6e3bd');
    bucket(g, 4.35, .6, -2.7, .27, .9, '#c9d0d6'); bouquet(g, 4.35, 1.5, -2.7, 'sun', SUNC, 5, .22, .85, 1.1);
    bucket(g, 4.35, .6, -1.1, .27, .9, '#c9d0d6'); bouquet(g, 4.35, 1.5, -1.1, 'sun', SUNC, 4, .2, .75, 1.1);
    bucket(g, 4.3, .6, .4, .24, .5, '#c9d0d6'); bouquet(g, 4.3, 1.1, .4, 'iris', PUR, 5, .16, .5, 1);
    bucket(g, 3.5, .3, -2.4, .22, .42, '#c9d0d6'); bouquet(g, 3.5, .72, -2.4, 'tulip', RED, 5, .13, .55, 1);
    bucket(g, 3.5, .3, -1.2, .22, .42, '#c9d0d6'); bouquet(g, 3.5, .72, -1.2, 'tulip', YEL, 5, .13, .55, 1);
    bucket(g, 3.5, .3, .0, .22, .42, '#c9d0d6'); bouquet(g, 3.5, .72, .0, 'tulip', PNK, 5, .13, .55, 1);
    /* floor buckets in front */
    bucket(g, 1.9, 0, 2.5, .27, .46, '#f6efe2'); bouquet(g, 1.9, .46, 2.5, 'iris', PUR, 6, .2, .6, 1);
    bucket(g, -.4, 0, 2.9, .24, .42, '#c9d0d6'); bouquet(g, -.4, .42, 2.9, 'tulip', RED, 7, .15, .6, 1);
    bucket(g, -2.3, 0, 2.6, .24, .42, '#f4e9c6'); bouquet(g, -2.3, .42, 2.6, 'tulip', PNK, 7, .15, .6, 1);
    /* wooden work table in the middle, with a pot, candles, a trowel and scissors */
    box(g, .2, .76, -.7, 2.2, .07, 1.1, '#e0a766'); for (const a of [-1, 1]) for (const c of [-.4, .4]) box(g, .2 + a * .95, 0, -.7 + c, .09, .76, .09, '#d49a5a');
    potF(g, -.5, .83, -.8, 'daisy', ['#ffffff', '#fff6dc'], 1); cyl(g, .5, .83, -.6, .06, .2, '#fff3d0'); cyl(g, .68, .83, -.7, .05, .14, '#fff3d0');
    box(g, 0, .83, -.35, .3, .015, .07, '#aeb6bd'); box(g, .25, .83, -.38, .2, .015, .05, '#8a929a'); cyl(g, -1.15, .83, -.7, .13, .12, '#c9d0d6');
    /* honey wood shelves on the left wall with little pots */
    shelf(g, -W / 2 + .5, -.6, PI / 2, 3.6, ['#e8a07a', '#f0d6c0', '#d9805a', '#f6e3bd'], '#e9b57a');
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) potF(g, -W / 2 + .55, .5 + r * .5, -2.0 + i * .8 + (r % 2) * .2, ['daisy', 'tulip', 'poppy', 'iris'][(i + r) % 4], ['#ffffff', '#f08aa8', '#e8452f', '#9a7fd8'].slice((i + r) % 4, (i + r) % 4 + 1), .55);
    /* green wall shelf and a watering can */
    box(g, 0, 1.9, -D / 2 + .3, 2.8, .06, .4, '#c9e27c'); for (let i = 0; i < 4; i++) potF(g, -1.0 + i * .65, 1.96, -D / 2 + .3, ['tulip', 'daisy', 'iris', 'poppy'][i], ['#f08aa8', '#ffffff', '#9a7fd8', '#e8452f'].slice(i, i + 1), .6);
    cyl(g, 2.2, 0, 1.5, .2, .38, '#aeb6bd'); rod(g, 2.38, .35, 1.5, .02, .5, '#aeb6bd', 'x').rotation.z = -.7; plant(g, -3.9, 3.1, 1.5, 1);
    for (let i = 0; i < 16; i++) { const x = -4.5 + i * .6; sph(g, x, 2.75 - Math.sin(i / 15 * 3.14) * .3, -D / 2 + .35, .06, 'glow'); }
  } else { /* barber: brick, vanity with oval mirror, red leather chair, chesterfield, gramophone */
    box(g, -W / 2 + .5, 0, -.8, .6, .9, 3.2, '#4a2e22'); box(g, -W / 2 + .5, .9, -.8, .7, .05, 3.3, '#5a3a2a'); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) box(g, -W / 2 + .8, .2 + j * .4, -1.9 + i * 1.1, .02, .04, .26, '#d9a93c');
    ovalMirror(g, -W / 2 + .3, 1.9, -.8, PI / 2); for (let i = 0; i < 5; i++) cyl(g, -W / 2 + .5, .95, -2.1 + i * .6, .06, .2 + (i % 2) * .08, i % 2 ? '#1f2428' : '#cfe3ea');
    for (let i = 0; i < 3; i++) box(g, -W / 2 + .26, 1.4 + (i % 2) * .45, -3.0 + i * .55, .04, .5, .5, '#e8e0d0');
    const cs = sub(g, -2.0, -.8, -PI / 2); cyl(cs, 0, 0, 0, .35, .06, '#c7ccd1'); cyl(cs, 0, 0, 0, .08, .4, '#c7ccd1'); box(cs, 0, .4, 0, .7, .2, .7, '#9b2e2e'); box(cs, 0, .6, -.35, .7, .95, .15, '#9b2e2e'); box(cs, -.4, .6, 0, .1, .1, .6, '#c7ccd1'); box(cs, .4, .6, 0, .1, .1, .6, '#c7ccd1'); box(cs, 0, .1, .55, .5, .06, .4, '#c7ccd1');
    box(g, -2.0, .02, -.8, 2.4, .015, 2.4, '@persian|#6b1f1f');
    const sf = sofa(g, W / 2 - 1.0, 1.2, -PI / 2, { sofa: '#1d1b1c', acc: '#9b2e2e', acc2: '#c9a24a', vint: 1 }, 2.8);
    tableR(g, 3.0, 3.3, '#2b2220', .4); gramophone(g, 3.0, 3.3, 0, { wood: '#4a2e22' });
    for (const a of [[-.5, 0], [.5, .5], [0, 1.0]]) box(g, W / 2 - .3, 1.8 + a[1], -3 + (a[0] + .5) * 1.6, .04, .5, .62, '#e8e0d0');
    box(g, 3.9, 0, -3.2, .5, 1.6, .5, '#ffffff'); box(g, 3.9, .2, -3.2, .52, .2, .52, '#d9423a'); box(g, 3.9, .8, -3.2, .52, .2, .52, '#d9423a'); box(g, 3.9, 1.4, -3.2, .52, .2, .52, '#2f5d8a');
    for (const w of o.wins) { box(g, w.x, 1.45, -D / 2 + .15, w.w - .1, 1.1, .03, '@blinds|#ece6da'); }
  }
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
  let th;
  if (spec.kind === 'house') th = HT[n % 5]; else if (spec.kind === 'cot') th = CT[(n * 3 + Math.floor(n / 10) * 5) % CT.length]; else if (spec.kind === 'ph') th = PT[n % 2]; else th = SHOPS[n % 6].th;
  const sh = spec.kind === 'shop' ? SHOPS[n % 6] : null;
  const o = { n, ph: info.design === 'ph', beds: info.beds, th, wall: sh ? sh.wall : th.wall, trim: sh ? sh.trim : th.trim, door: -1.5 };
  const { W, D, Hh } = R;
  if (info.design === 'ph') {
    const k = Math.floor((W - 1) / 3.5), step = (W - 1) / k; o.wins = [];
    for (let i = 0; i < k; i++) o.wins.push({ x: -W / 2 + .5 + step * (i + .5), w: step - .25, y0: .05, y1: Hh - .25 });
  } else if (info.design === 'studio') o.wins = [{ x: -.3, w: 2.6 }, { x: 3.0, w: 1.8 }];
  else if (info.design === 'one') o.wins = [{ x: -3.6, w: 3.4 }, { x: -.2, w: 2.0 }, { x: 3.7, w: 2.2 }];
  else if (info.design === 'two') o.wins = [{ x: -3.2, w: 5.0 }, { x: 3.7, w: 2.6 }];
  else o.wins = [{ x: -2.6, w: 3.6, y0: .5, y1: 2.6 }, { x: 2.6, w: 3.6, y0: .5, y1: 2.6 }];
  if (sh) o.noCur = true;
  ({ studio, one: oneBR, two: twoBR, ph: penthouse, shop })[info.design](R, o);
  return { group: g, cap, W, D, Hh, cams: R.cams, title: info.title, sub: info.sub, isPh: o.ph, design: info.design };
}
