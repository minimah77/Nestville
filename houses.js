/* Nestville houses: the resident chalet in 7 pastel colours, and the hillside "villa" (same house, plus a little back garden).
   Colour is picked from the 7 pastels below. Everything else about the chalet is unchanged from build.js. */
import { ramp } from './build.js';
import { rng, hs } from './shared.js';

/* rose, apricot, lemon, mint, sky, lavender, coral */
export const PASTELS = ['#f5b7cb', '#f8cd98', '#f5ec9b', '#b6e3b8', '#acd6f2', '#cfc0f0', '#f2a894'];
const FL = ['#e0527a', '#f3a6c0', '#d9463a', '#fff3d6', '#f0b13a'];
const TIM = ['#6e4a31', '#8a5b39', '#5b3f2c', '#7a5a3a'];
const ROOFS = ['#5a3f33', '#b4532e', '#6e7684', '#7a3b2c', '#6b4a38', '#8a4a34'];
const SHUT = ['#4a7c4a', '#b3372d', '#3f6a8f', '#2f6e62', '#c9772f'];

function win(b, x, y, zf, w, h, sh, flower, fcol) {
  b.box(x, y - .12, zf + .03, w + .5, h + .28, .1, '#f8f4e8');
  b.box(x, y, zf + .08, w, h, .06, '#4f7894');
  b.box(x, y + h * .5 - .04, zf + .12, w, .08, .04, '#f8f4e8');
  b.box(x - .04, y, zf + .12, .08, h, .04, '#f8f4e8');
  b.box(x - w / 2 - .5, y - .05, zf + .08, .62, h + .1, .08, sh);
  b.box(x + w / 2 + .5, y - .05, zf + .08, .62, h + .1, .08, sh);
  if (flower) {
    b.box(x, y - .62, zf + .4, w + .5, .42, .62, '#6a4a32');
    for (let i = 0; i < 4; i++) b.box(x - w / 2 + .3 + i * (w - .6) / 3, y - .28, zf + .4, .5, .42, .5, fcol[i % fcol.length]);
  }
}

/* the little back garden: patio with table and parasol, raised beds, fruit tree, hedge, picket sides, sometimes a shed.
   Local frame: the house door faces +z, so the garden lies at negative z. */
function backGarden(b, seed, w, d, floors, fh, sh) {
  const g = rng(hs(seed) + 99), pick = a => a[(g() * a.length) | 0];
  const zb = -d / 2, gw = w / 2 + 3.2, z1 = zb - 9.6;
  /* back door and windows (drawn in a frame turned around, so they face the garden) */
  b.sub(0, 0, 0, Math.PI, () => {
    b.box(0, .6, d / 2 + .03, 1.5, 2.8, .12, '#5c3a20'); b.box(0, 3.3, d / 2 + .03, 1.7, .22, .14, '#f8f4e8');
    win(b, -w * .3, 1.9, d / 2, 1.3, 1.5, sh, false, FL); win(b, w * .3, 1.9, d / 2, 1.3, 1.5, sh, false, FL);
    for (let f = 1; f < floors; f++) { const yy = 4.3 + (f - 1) * fh + .9; win(b, -w * .3, yy, d / 2, 1.3, 1.7, sh, false, FL); win(b, w * .3, yy, d / 2, 1.3, 1.7, sh, false, FL); }
  });
  /* patio, table, stools, parasol */
  b.box(0, -.05, zb - 1.9, w * .7, .14, 3.4, '#d6cebb');
  const tx = -w * .2, tz = zb - 2.4, pc = pick(['#e9a93a', '#d9623f', '#3f7fb5', '#4f9d69']);
  b.cyl(tx, 0, tz, .08, .8, 6, '#6a4a32'); b.cyl(tx, .8, tz, .8, .08, 10, '#a77b4e', '#a77b4e');
  b.box(tx - 1.25, 0, tz, .45, .45, .45, '#8a5b39'); b.box(tx + 1.25, 0, tz, .45, .45, .45, '#8a5b39');
  b.cyl(tx, 0, tz, .04, 2.6, 5, '#d8d2c4'); b.cone(tx, 2.4, tz, 1.9, .55, 8, pc);
  /* raised beds */
  const bed = (x, z) => {
    b.box(x, 0, z, 2.6, .4, 1.2, '#8a5b39'); b.box(x, .4, z, 2.3, .04, .9, '#5b4030');
    for (let i = 0; i < 5; i++) b.box(x - 1 + i * .5, .42, z + (g() - .5) * .3, .3, .3 + g() * .25, .3, g() < .5 ? pick(FL) : pick(['#4f9a4a', '#6aa84a', '#5ea244']));
  };
  bed(w * .22 + 1.2, zb - 6.4); bed(-w * .22 - 1.2, zb - 7.9);
  /* fruit tree in one back corner, shed in the other */
  const side = g() < .5 ? -1 : 1, trx = side * (gw - 2.3), trz = z1 + 2.5;
  b.cyl(trx, -.3, trz, .26, 2.6, 6, '#6b4a32');
  b.cone(trx, 1.9, trz, 2.2, 1.5, 9, '#5ea244', 1.7); b.cone(trx, 3.3, trz, 1.8, 1.3, 9, '#6db04a', 1.0); b.cone(trx, 4.5, trz, 1.2, 1.0, 9, '#7cba50', .3);
  for (let i = 0; i < 5; i++) { const a = g() * 6.28, rr = 1 + g() * .9; b.box(trx + Math.cos(a) * rr, 2.3 + g() * 1.4, trz + Math.sin(a) * rr, .24, .24, .24, g() < .5 ? '#d9463a' : '#f0b13a'); }
  if (g() < .55) {
    const sx = -side * (gw - 2.2), sz = z1 + 2;
    b.box(sx, -.1, sz, 2.6, 2.1, 2.2, '#a67856'); b.gable(sx, 2.0, sz, 2.6, 2.2, .9, .25, '#6e4a31', '#a67856');
    b.box(sx, 0, sz + 1.13, .8, 1.5, .08, '#5c3a20');
  }
  /* picket fence down both sides, hedge along the back, flower patches */
  const hedge = ['#4f8f45', '#5ea244', '#3f7a3a'];
  for (const sx of [-gw, gw]) {
    const len = zb - .3 - z1;
    for (let i = 0; i <= 10; i++) b.box(sx, -.35, zb - .3 - i * len / 10, .14, 1.35, .1, '#f5f0e4');
    b.box(sx, .45, (zb - .3 + z1) / 2, .08, .08, len, '#f5f0e4'); b.box(sx, .9, (zb - .3 + z1) / 2, .08, .08, len, '#f5f0e4');
  }
  for (let x = -gw; x <= gw + .01; x += 1.4) b.box(x, -.35, z1, 1.5, 1.3 + g() * .3, .9, pick(hedge));
  for (let i = 0; i < 7; i++) { const sx = (i % 2 ? 1 : -1) * (gw - .9); b.box(sx, 0, zb - 1.5 - g() * 7, .5, .5 + g() * .3, .5, pick(FL)); }
}

function house(b, x, y, z, yaw, seed, smoke, ci, villaMode) {
  const r = rng(hs(seed) + 5), pick = a => a[(r() * a.length) | 0];
  const w = 8 + r() * 2.2, d = 7 + r() * 1.4; r(); /* this call used to choose the old cream colour: kept so every house keeps its shape */
  const wall = PASTELS[ci % 7], tim = pick(TIM), roof = pick(ROOFS), sh = pick(SHUT);
  const floors = r() < .3 ? 3 : 2, hip = r() < .26, fence = villaMode || r() < .55;
  b.at(x, y, z, yaw);
  b.box(0, -3.2, 0, w + .5, 3.8, d + .5, '#8f897d');
  b.box(0, .6, 0, w, 3.7, d, wall);
  let top = 4.3;
  const fh = 3.5, zu = d / 2 + .6;
  for (let f = 1; f < floors; f++) { b.box(0, top, .3, w + .7, fh, d + .6, f % 2 ? tim : wall); top += fh; }
  b.box(0, .6, d / 2 + .03, 1.7, 2.9, .12, '#5c3a20');
  b.box(0, 3.3, d / 2 + .03, 1.7, .25, .14, '#f8f4e8');
  ramp(b, 0, d / 2 + .02, 3.3, .6, -.1, 2.6, '#cfc8b8', '#b9b2a2');
  win(b, -w * .29, 1.9, d / 2, 1.5, 1.7, sh, true, FL); win(b, w * .29, 1.9, d / 2, 1.5, 1.7, sh, true, FL);
  for (let f = 1; f < floors; f++) {
    const yy = 4.3 + (f - 1) * fh + .9;
    win(b, -w * .3, yy, zu, 1.5, 1.8, sh, f > 1, FL); win(b, w * .3, yy, zu, 1.5, 1.8, sh, f > 1, FL);
    if (f === 1) {
      b.box(0, yy - .1, zu + .03, 1.4, 2, .1, '#4f7894'); b.box(0, yy - .15, zu + .02, 1.9, 2.15, .08, '#f8f4e8');
      b.box(0, 4.15, zu + .8, w * .62, .22, 1.6, '#7a5336');
      for (let i = 0; i <= 8; i++) b.box(-w * .31 + i * w * .62 / 8, 4.37, zu + 1.5, .1, .85, .1, '#8a5b39');
      b.box(0, 5.2, zu + 1.5, w * .62, .1, .16, '#8a5b39');
      for (let i = 0; i < 5; i++) b.box(-w * .27 + i * w * .135, 5.3, zu + 1.5, .5, .4, .4, FL[(i + 1) % 5]);
    }
  }
  let rh;
  if (hip) { rh = 3.6; b.hip(0, top, .3, w + .7, d + .6, rh, .9, roof); }
  else { rh = (w / 2 + .35 + .9) * .8; b.gable(0, top, .3, w + .7, d + .6, rh, .9, roof, tim); }
  const cxm = w * .24, czm = -d * .12;
  b.box(cxm, top + .3, czm, 1, rh + 1.1, 1, '#a67856'); b.box(cxm, top + rh + 1.4, czm, 1.35, .3, 1.35, '#8c6244');
  if (smoke) smoke.push(b.world(cxm, top + rh + 1.9, czm));
  if (fence) {
    const zf = d / 2 + 3.4, y0 = villaMode ? -.3 : 0, hh = villaMode ? 1.3 : 1.0;
    for (let i = -5; i <= 5; i++) { if (Math.abs(i) < 1) continue; b.box(i * .85, y0, zf, .2, hh, .12, '#f5f0e4'); }
    b.box(-2.6, .75, zf, 5, .1, .1, '#f5f0e4'); b.box(2.6, .75, zf, 5, .1, .1, '#f5f0e4');
  }
  if (villaMode) backGarden(b, seed, w, d, floors, fh, sh);
}

/* a resident's chalet in the village rows: colour from the handle */
export function chalet(b, x, y, z, yaw, u, smoke) { house(b, x, y, z, yaw, u, smoke, hs(u) % 7, false); }
/* a hillside villa with a back garden. ci (0-6) picks the pastel */
export function villa(b, x, y, z, yaw, seed, ci, smoke) { house(b, x, y, z, yaw, seed, smoke, ci, true); }
