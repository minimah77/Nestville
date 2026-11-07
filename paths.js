/* Nestville paths: sidewalks, a lakeside promenade and gray stone stairs for the lakeview cottages.
   Every tread is a stone block whose top snaps to a shared 0.35 grid following the real terrain height,
   so flat ground becomes a smooth sidewalk and slopes become stairs automatically. */
import { H } from './world.js';

const TREAD = '#a7a69e', WALK = '#cfcabc', CURB = '#8d8c85', Q = .35;
const topAt = (x, z) => Math.ceil(H(x, z) / Q) * Q + .08;

/* one lane along axis-aligned points: w = width, step = tread length, curb = side wall height (0 = none) */
function lane(b, pts, w, step, curb, col) {
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, z0] = pts[s], [x1, z1] = pts[s + 1], alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = Math.abs(alongX ? x1 - x0 : z1 - z0), n = Math.max(1, Math.round(len / step)), L = len / n;
    const sx = Math.sign(x1 - x0), sz = Math.sign(z1 - z0);
    for (let i = 0; i < n; i++) {
      const t = (i + .5) * L, cx = x0 + (alongX ? sx * t : 0), cz = z0 + (alongX ? 0 : sz * t);
      const hc = H(cx, cz); if (hc < .75) continue; /* never into the lake */
      const top = topAt(cx, cz), bot = Math.min(top - .6, hc - .35);
      if (alongX) {
        b.box(cx, bot, cz, L, top - bot, w, col);
        if (curb) for (const o of [-1, 1]) b.box(cx, top, cz + o * (w / 2 - .11), L, curb, .22, CURB);
      } else {
        b.box(cx, bot, cz, w, top - bot, L, col);
        if (curb) for (const o of [-1, 1]) b.box(cx + o * (w / 2 - .11), top, cz, .22, curb, L, CURB);
      }
    }
  }
}

export function paths(b, L) {
  const cot = L.cot; if (!cot.length) return;
  const rowZ = L.walk.z, ROWS = rowZ.length, prom = L.walk.prom, X0 = L.walk.x0, X1 = L.walk.x1;
  /* the lakeside promenade and a sidewalk in front of each terrace row */
  lane(b, [[X0, prom], [X1, prom]], 3.2, 1.6, 0, WALK);
  rowZ.forEach(z => lane(b, [[X0, z], [X1, z]], 2.2, 1.6, 0, WALK));
  cot.forEach(c => {
    const r = Math.floor(c.i / 10);
    /* from the garden gate out to this row's sidewalk */
    lane(b, [[c.x, c.z + 4.0], [c.x, rowZ[r] - 1.1]], 1.3, .45, .22, TREAD);
    if (r === 0) lane(b, [[c.x, rowZ[0] + 1.1], [c.x, prom - 1.6]], 1.6, .9, .25, TREAD);
    /* upper rows: stairs go forward, turn right, then forward again down to the sidewalk below */
    else {
      const zU = rowZ[r], zD = rowZ[r - 1], x2 = c.x - 2.6;
      lane(b, [[c.x, zU + 1.1], [c.x, zU + 5], [x2, zU + 5], [x2, zD - 1.1]], 1.7, .55, .3, TREAD);
    }
  });
}
