/* Nestville bridges (replaces bridge() and fbridge() in build.js).
   Fixes: the arch stones no longer poke up through the deck; decks follow the real sidewalk heights at both ends (they can slope),
   and the footbridge has no stone lip at its ends. */
import { qd } from './build.js';

/* the footbridge: size, and the deck height at t (0 = north end, 1 = south end) */
export const FB = { L: 12.6, W: 3.2, N: 14, hump: .5 };
export const fbY = (yN, yS, t) => yN + (yS - yN) * t + FB.hump * Math.sin(Math.PI * t) + .004;

/* stone bridge over the river: 20 long, 6 wide. The deck top sits at y+1 and is tilted by `slope` (radians) along its length. */
export function bridge(b, x, y, z, yaw = 0, slope = 0) {
  b.at(x, y, z, yaw);
  const STONE = '#cbc3b0', WALL = '#b4ac98', DARK = '#a69e8b';
  b.sub(0, 0, 0, 0, () => {
    b.box(0, 0, 0, 20, 1, 6, STONE);
    b.box(0, 1, 2.7, 20, 1.1, .6, WALL); b.box(0, 1, -2.7, 20, 1.1, .6, WALL);
    for (const s of [-1, 1]) { b.box(s * 9.6, 1, 2.7, .9, 1.7, .9, WALL); b.box(s * 9.6, 1, -2.7, .9, 1.7, .9, WALL); }
    b.box(-8.2, -3.6, 0, 3.4, 4.6, 6, DARK); b.box(8.2, -3.6, 0, 3.4, 4.6, 6, DARK); /* abutments, top flush with the deck */
    b.box(0, -.3, 0, 13, .3, 5.6, '#9a927f'); /* underside between the abutments */
    /* stone arch ring under the deck, on both faces: crown just below the deck */
    const R = 8.75, cy0 = -9.0, n = 11;
    for (let i = 0; i < n; i++) {
      const a = (42 + 96 * (i + .5) / n) * Math.PI / 180, cx = Math.cos(a) * R, cy = Math.sin(a) * R + cy0;
      for (const s of [-1, 1]) b.sub(cx, cy, s * 2.8, 0, () => b.box(0, -.4, 0, 1.15, .8, .5, i % 2 ? '#bdb5a2' : '#c9c1ae'), a - Math.PI / 2);
    }
  }, slope);
}

/* little arched footbridge over the lakeside canal. It spans north-south, centred on (x, z).
   yN / yS are the sidewalk top heights at its north and south end, so both ends meet the pavement exactly. */
export function fbridge(b, x, z, yN, yS) {
  b.at(x, 0, z, 0);
  const { L, W, N } = FB, DECK = '#d9d2c0', STONE = '#c3bba6', DARK = '#a79f8b', CAP = '#e3dccb', hw = W / 2, th = .45, ph = .55, pt = .26;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N, z0 = -L / 2 + t0 * L, z1 = -L / 2 + t1 * L, h0 = fbY(yN, yS, t0), h1 = fbY(yN, yS, t1);
    qd(b, [-hw, h0, z0], [hw, h0, z0], [hw, h1, z1], [-hw, h1, z1], [0, 1, 0], DECK);
    qd(b, [-hw, h0 - th, z0], [hw, h0 - th, z0], [hw, h1 - th, z1], [-hw, h1 - th, z1], [0, -1, 0], DARK);
    for (const s of [-1, 1]) {
      const xo = s * hw, xi = s * (hw - pt);
      qd(b, [xo, h0 - th, z0], [xo, h0 + ph, z0], [xo, h1 + ph, z1], [xo, h1 - th, z1], [s, 0, 0], STONE);
      qd(b, [xi, h0, z0], [xi, h0 + ph, z0], [xi, h1 + ph, z1], [xi, h1, z1], [-s, 0, 0], STONE);
      qd(b, [xo, h0 + ph, z0], [xi, h0 + ph, z0], [xi, h1 + ph, z1], [xo, h1 + ph, z1], [0, 1, 0], CAP);
    }
  }
  /* abutments under both ends: their tops stay below the deck, so nothing sticks up */
  for (const e of [-1, 1]) { const ye = e < 0 ? yN : yS; b.box(0, ye - 3.5, e * (L / 2 - .5), W, 3.1, 1.2, DARK); }
  for (const e of [-1, 1]) { const ye = (e < 0 ? yN : yS) + .004; for (const s of [-1, 1]) b.box(s * (hw - .13), ye, e * (L / 2 - .1), .34, .95, .34, CAP); }
}

/* THE footbridge: a brown timber bridge over the river beside the road bridge. 20 long, 7 wide, planked deck, heavy side beams, wooden arch ribs, lamp posts at the ends. */
export function bigBridge(b, x, y, z, yaw = 0, slope = 0) {
  b.at(x, y, z, yaw);
  const WOOD = '#7a5236', DARK = '#4a2f1c', LIGHT = '#a77b52';
  b.sub(0, 0, 0, 0, () => {
    b.box(0, 0, 0, 20, 1, 7, WOOD);
    for (let i = 0; i < 20; i++) b.box(-9.5 + i, 1, 0, .94, .05, 6.8, i % 2 ? LIGHT : '#8f6540'); /* planks */
    for (const s of [-1, 1]) {
      b.box(0, 1, s * 3.2, 20, .45, .6, DARK); b.box(0, 2.05, s * 3.2, 20, .22, .5, DARK); /* low wall + hand rail */
      for (let i = 0; i <= 10; i++) b.box(-10 + i * 2 - (i === 10 ? .3 : 0) + (i === 0 ? .3 : 0), 1, s * 3.2, .4, 1.3, .4, DARK);
      for (const e of [-1, 1]) { b.box(e * 9.6, 1, s * 3.4, .7, 2.6, .7, DARK); b.box(e * 9.6, 3.6, s * 3.4, .46, 1.2, .46, '#e8c36a'); } /* lantern posts */
    }
    b.box(-8.2, -3.6, 0, 3.4, 4.6, 7, '#6b4a30'); b.box(8.2, -3.6, 0, 3.4, 4.6, 7, '#6b4a30'); /* abutments */
    b.box(0, -.3, 0, 13, .3, 6.6, '#5a3d27');
    const R = 8.75, cy0 = -9.0, n = 13;
    for (let i = 0; i < n; i++) { /* wooden arch ribs under the deck on both faces and in the middle */
      const a = (42 + 96 * (i + .5) / n) * Math.PI / 180, cx = Math.cos(a) * R, cy = Math.sin(a) * R + cy0;
      for (const s of [-1, 0, 1]) b.sub(cx, cy, s * 2.9, 0, () => b.box(0, -.45, 0, 1.2, .9, s ? .6 : .5, i % 2 ? '#6b4a30' : '#7e5638'), a - Math.PI / 2);
    }
  }, slope);
}
