/* Nestville landmarks: the stadium, the billiards salon, Main Street, the mall, and the park fountains, ponds and gazebos.
   town.js calls landmarks(b, L, H) once while it builds the static scene. Everything is drawn into the mesh builder b.
   Where things stand comes from world.js (L.lm, L.squares, L.ponds, L.gazebos); to move one, change it there.
   The mall is placed by world.js next to a big fountain plaza that joins sidewalks (see HUBS in world.js).
   Local coordinates: x runs along the front, +z is the front (with yaw PI the front looks north to the lake), y is up from the ground. */
import './spring.js'; /* the river source: the stream and spring pool above the village (spring.js) */
import { K, fountain } from './build.js';

const PAVE = '#cfc8b5', WHITE = '#f4f6f4', DARK = '#2a3036', GLASS = '#9fd3e0', WOOD = '#5b3f2c';

/* a shop-front on the +z side: walls, big window, door, striped awning and a gable roof */
function shopFront(b, x, w, d, h, wall, roof, awn1, awn2, signCol) {
  b.box(x, 0, 0, w, h, d, wall);
  const zf = d / 2;
  b.box(x - w * .2, .9, zf + .03, w * .46, h * .55, .08, GLASS);
  b.box(x + w * .3, 0, zf + .03, 1.5, 2.5, .1, WOOD);
  b.box(x, h - .8, zf + .04, w * .8, .7, .1, signCol);
  const x0 = x - w / 2 + .3, sw = (w - .6) / 6;
  for (let i = 0; i < 6; i++) {
    const a = x0 + i * sw, c = a + sw, col = i % 2 ? awn2 : awn1;
    b.Q([a, 3.6, zf + .1], [a, 2.8, zf + 1.9], [c, 2.8, zf + 1.9], [c, 3.6, zf + .1], col);
    b.Q([a, 2.8, zf + 1.9], [a, 2.55, zf + 1.9], [c, 2.55, zf + 1.9], [c, 2.8, zf + 1.9], K(col).clone().multiplyScalar(.8));
  }
  b.gable(x, h, 0, w, d, 2.6, .5, roof, wall);
}

/* a round table with a striped umbrella */
function umbrella(b, x, z, canopy) {
  b.cyl(x, 0, z, .7, .08, 10, '#e8e2d0', '#e8e2d0');
  b.cyl(x, .08, z, .07, .8, 6, '#6b6b6b');
  b.cyl(x, .85, z, .55, .05, 10, '#e8e2d0', '#e8e2d0');
  b.cyl(x, 0, z + 1.1, .22, .5, 6, '#7a5236', '#a0734b');
  b.cyl(x, 0, z - 1.1, .22, .5, 6, '#7a5236', '#a0734b');
  b.cyl(x + 1.1, 0, z, .22, .5, 6, '#7a5236', '#a0734b');
  b.cyl(x, .85, z, .06, 2.1, 6, '#444');
  b.cone(x, 2.4, z, 2.1, .75, 8, canopy, .1);
}

function stadium(b, d, H) {
  b.at(d.x, d.y, d.z, d.yaw);
  b.box(0, 0, 0, 78, .14, 54, PAVE);                          /* paved surround */
  b.box(0, .14, 0, 66, .08, 42, '#4e9a45');                   /* pitch */
  for (let i = 0; i < 10; i++) b.box(-29.7 + i * 6.6, .22, 0, 3.3, .02, 42, '#5aa850'); /* mowing stripes */
  const line = (x, z, w, dd) => b.box(x, .24, z, w, .02, dd, WHITE);
  line(0, 20.8, 64, .3); line(0, -20.8, 64, .3); line(32.8, 0, .3, 42); line(-32.8, 0, .3, 42); line(0, 0, .3, 41.6);
  for (const s of [-1, 1]) {
    line(s * 28, 0, .3, 18); line(s * 31.2, 0, 3, .3); line(s * 31.2, 0, .3, 0.3);
    line(s * 28, 9, 9.3, .3); line(s * 28, -9, 9.3, .3);
    line(s * 24, 9, .3, .3);
  }
  b.cyl(0, .22, 0, 5.2, .02, 24, WHITE); b.cyl(0, .23, 0, 4.9, .02, 24, '#5aa850');

  /* goals with nets */
  for (const s of [-1, 1]) {
    const gx = s * 33.4;
    b.box(gx, 0, -3.66, .28, 2.44, .28, WHITE); b.box(gx, 0, 3.66, .28, 2.44, .28, WHITE); b.box(gx, 2.3, 0, .28, .26, 7.6, WHITE);
    b.box(gx + s * 2, 0, 0, .06, 2.3, 7.4, '#dfe6e8');
    b.box(gx + s * 1, 2.3, 0, 2, .05, 7.4, '#dfe6e8');
    b.box(gx + s * 1, 0, -3.66, 2, 2.3, .05, '#dfe6e8'); b.box(gx + s * 1, 0, 3.66, 2, 2.3, .05, '#dfe6e8');
  }

  /* long stands north and south: seven stepped rows, blue seats, a roof on pillars */
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const z = s * (26 + i * 1.5), top = .5 + i * 1.1;
      b.box(0, 0, z, 64, top, 1.5, '#c8c3b8');
      b.box(0, top, z, 63.4, .12, .9, i % 2 ? '#2f6fb0' : '#e9a93a');
    }
    b.box(0, 0, s * 36.5, 64, 9.4, .6, '#b9b4a8');            /* back wall */
    b.box(0, 9.4, s * 31.5, 66, .35, 12, '#e9eef0');          /* roof */
    for (let k = -3; k <= 3; k++) b.box(k * 10, 0, s * 35.6, .5, 9.4, .5, '#8e8f88');
  }
  /* low stands behind the goals */
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = s * (37 + i * 1.5);
    b.box(x, 0, 0, 1.5, .5 + i * 1.0, 36, '#c8c3b8'); b.box(x, .5 + i * 1.0, 0, .9, .12, 35.4, '#2f6fb0');
  }
  /* fence all round */
  const post = (x, z) => b.box(x, 0, z, .25, 1.8, .25, DARK);
  for (let x = -36; x <= 36; x += 6) { post(x, -34); post(x, 34); }
  for (let z = -34; z <= 34; z += 6) { post(-36, z); post(36, z); }
  for (const y of [.9, 1.6]) {
    b.box(0, y, -34, 72.2, .1, .1, DARK); b.box(0, y, 34, 72.2, .1, .1, DARK);
    b.box(-36, y, 0, .1, .1, 68.2, DARK); b.box(36, y, 0, .1, .1, 68.2, DARK);
  }
  /* floodlights */
  for (const [x, z] of [[-34, -32], [34, -32], [-34, 32], [34, 32]]) {
    b.cyl(x, 0, z, .35, 22, 6, '#8a8f93'); b.box(x, 22, z, 3.4, 1.6, .5, '#fff4c8'); b.box(x, 22.2, z, 3.6, 1.8, .3, '#4b5057');
  }
}

function billiards(b, d) {
  b.at(d.x, d.y, d.z, d.yaw);
  b.box(0, 0, 3, 24, .12, 22, PAVE);                          /* terrace */
  const w = 14, dp = 10, h = 4.6;
  b.box(0, .12, -2, w, h, dp, '#9b5a43');
  b.box(0, .12, 3.02, w, .5, .1, '#6f3d2d');
  b.box(-3.5, 1.1, 3.06, 4.4, 2.4, .1, GLASS); b.box(3.5, 1.1, 3.06, 4.4, 2.4, .1, GLASS);
  b.box(0, .12, 3.06, 1.8, 2.7, .12, WOOD);
  b.box(0, 3.5, 3.1, 8, .9, .14, '#1f4a38'); b.box(0, 3.66, 3.18, 6.4, .12, .1, '#c9a24a');
  b.gable(0, h + .12, -2, w, dp, 2.8, .6, '#3d3f46', '#9b5a43');
  b.box(4.6, h + .12, -4, 1.1, 3.4, 1.1, '#7a4636');          /* chimney */
  for (const x of [-4.5, 4.5]) {                              /* little awnings */
    for (let i = 0; i < 4; i++) { const a = x - 2.2 + i * 1.1, c = a + 1.1; b.Q([a, 3.4, 3.1], [a, 2.7, 4.7], [c, 2.7, 4.7], [c, 3.4, 3.1], i % 2 ? '#f4f6f4' : '#b8352f'); }
  }
  umbrella(b, -7.5, 8, '#b8352f'); umbrella(b, 7.5, 8, '#b8352f');
  b.box(0, .12, 9.5, 5, .04, 9, '#b8352f');                   /* red carpet down the steps */
}

function mainStreet(b, d) {
  b.at(d.x, d.y, d.z, d.yaw);
  b.box(0, 0, 4, 54, .12, 30, PAVE);
  const defs = [
    [-17, 10, 8.5, 5.4, '#a65a45', '#4a3f3a', '#d9623f', '#f4f6f4', '#2f4f73'],
    [-6, 10, 8.5, 6.2, '#d9b98a', '#7a4b3a', '#3f7fb5', '#f4f6f4', '#7a4b3a'],
    [5, 10, 8.5, 5.0, '#7d9bb0', '#4a3f3a', '#4f9d69', '#f4f6f4', '#2a3441']
  ];
  for (const [x, w, dp, h, wall, roof, a1, a2, sign] of defs) { b.at(d.x, d.y, d.z, d.yaw); b.sub(0, 0, -6, 0, () => shopFront(b, x, w, dp, h, wall, roof, a1, a2, sign)); }
  b.at(d.x, d.y, d.z, d.yaw);
  /* cafe on the right: terrace with yellow umbrellas */
  b.sub(0, 0, -6, 0, () => shopFront(b, 16, 10, 8.5, 4.8, '#f0d2a0', '#7a4b3a', '#e9c22a', '#f4f6f4', '#8a3b2c'));
  b.at(d.x, d.y, d.z, d.yaw);
  umbrella(b, 13, 4, '#e9c22a'); umbrella(b, 19.5, 4, '#e9c22a'); umbrella(b, 16.5, 9.5, '#e9c22a');
  /* flower tubs along the pavement */
  for (const x of [-21, -11.5, -0.5, 10.5]) { b.cyl(x, 0, 0, .55, .6, 8, '#a8603f', '#4a3a28'); b.cyl(x, .6, 0, .45, .35, 8, '#d9577f'); }
}

/* the mall: a two-storey block with a wall of big glass shop windows, white mullions, a striped awning along the whole front,
   a tall glass entrance hall with a blue sign band, a roof parapet and a paved terrace that runs out to the fountain plaza.
   34 wide, 14 deep (world.js reserves exactly this footprint). */
function mall(b, d) {
  b.at(d.x, d.y, d.z, d.yaw);
  const w = 34, dp = 14, h = 8.4, zf = dp / 2;
  b.box(0, 0, zf + 4, w + 8, .14, 12, PAVE);                              /* front terrace, joins the fountain ring */
  b.box(0, .14, 0, w, h, dp, '#ece6d8');                                  /* main block */
  b.box(0, h + .14, 0, w + .8, .5, dp + .8, '#cfc8b5');                   /* roof edge */
  b.box(0, .14, zf + .5, w + .4, .5, 1, '#b9b2a0');                       /* plinth */
  const n = 8, pw = (w - 4) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 2 + pw * (i + .5);
    if (Math.abs(x) < 5) continue;                                        /* the middle bays are the entrance hall */
    b.box(x, .8, zf + .05, pw - .6, 3.6, .1, GLASS);                      /* ground floor shop window */
    b.box(x, 5.0, zf + .05, pw - .9, 2.6, .1, GLASS);                     /* upper floor window */
    const a = x - pw / 2 + .2, c = x + pw / 2 - .2, col = i % 2 ? '#f4f6f4' : '#d9623f';
    b.Q([a, 4.6, zf + .1], [a, 3.9, zf + 1.9], [c, 3.9, zf + 1.9], [c, 4.6, zf + .1], col);   /* striped awning */
    b.Q([a, 3.9, zf + 1.9], [a, 3.65, zf + 1.9], [c, 3.65, zf + 1.9], [c, 3.9, zf + 1.9], K(col).clone().multiplyScalar(.8));
  }
  for (let i = 0; i <= n; i++) b.box(-w / 2 + 2 + pw * i, .14, zf + .1, .2, 7.4, .12, WHITE);   /* white mullions */
  /* entrance hall: a taller glass box with dark frame, two doors and the sign band */
  b.box(0, .14, zf + 2.6, 9.2, 9.4, .12, GLASS);
  b.box(-4.6, .14, zf + 1.3, .12, 9.4, 2.7, GLASS); b.box(4.6, .14, zf + 1.3, .12, 9.4, 2.7, GLASS);
  for (const x of [-4.6, 4.6]) b.box(x, .14, zf + 2.6, .3, 9.6, .3, DARK);
  b.box(0, 9.6, zf + 1.4, 10, .45, 3.4, '#cfc8b5');
  b.box(-1.3, .14, zf + 2.68, 2.2, 3.3, .12, DARK); b.box(1.3, .14, zf + 2.68, 2.2, 3.3, .12, DARK);
  b.box(0, 6.9, zf + 2.75, 8, 1.5, .2, '#2f4f73'); b.box(0, 7.55, zf + 2.85, 6.4, .14, .1, '#c9a24a');
  /* roof: air-con boxes and a little skylight */
  b.box(-10, h + .64, -1, 3.2, 1.3, 2.4, '#9aa0a4'); b.box(9, h + .64, 1, 3.2, 1.3, 2.4, '#9aa0a4'); b.box(0, h + .64, -2, 6, .6, 3, GLASS);
  /* flower tubs and benches on the terrace */
  for (const x of [-14, -9.5, 9.5, 14]) { b.cyl(x, .14, zf + 6.4, .6, .6, 8, '#a8603f', '#4a3a28'); b.cyl(x, .74, zf + 6.4, .5, .35, 8, '#d9577f'); }
  for (const x of [-12, 12]) { b.box(x, .5, zf + 8.6, 2.4, .1, .6, WOOD); b.box(x - .9, .14, zf + 8.6, .12, .4, .5, '#3a3f44'); b.box(x + .9, .14, zf + 8.6, .12, .4, .5, '#3a3f44'); }
}

function parkFountain(b, q, H) {
  const y = H(q.x, q.z);
  fountain(b, { x: q.x, z: q.z }, y);
  b.at(q.x, y, q.z, 0);
  b.cyl(0, 0, 0, 4.2, .1, 16, PAVE, PAVE);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    b.sub(Math.cos(a) * 6.2, 0, Math.sin(a) * 6.2, -a + Math.PI / 2, () => { b.box(0, .5, 0, 2, .1, .6, WOOD); b.box(-.8, 0, 0, .12, .5, .5, '#3a3f44'); b.box(.8, 0, 0, .12, .5, .5, '#3a3f44'); });
  }
}

function pond(b, p, H) {
  const y = H(p.x, p.z), seg = 28;
  b.at(p.x, y, p.z, 0);
  const wy = .16;
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
    const x0 = Math.cos(a0) * p.rx, z0 = Math.sin(a0) * p.rz, x1 = Math.cos(a1) * p.rx, z1 = Math.sin(a1) * p.rz;
    b.T([0, wy, 0], [x1, wy, z1], [x0, wy, z0], '#4fb4cc');
    /* stone rim */
    const ox0 = Math.cos(a0) * (p.rx + 1.1), oz0 = Math.sin(a0) * (p.rz + 1.1), ox1 = Math.cos(a1) * (p.rx + 1.1), oz1 = Math.sin(a1) * (p.rz + 1.1);
    b.Q([x0, .3, z0], [x1, .3, z1], [ox1, .3, oz1], [ox0, .3, oz0], '#b8b1a0');
    b.Q([ox0, 0, oz0], [ox1, 0, oz1], [ox1, .3, oz1], [ox0, .3, oz0], '#a39c8b');
  }
  for (let i = 0; i < 7; i++) { const a = i * 2.4, r = .45 + (i % 3) * .1; b.cyl(Math.cos(a) * p.rx * .5, wy, Math.sin(a) * p.rz * .5, r, .03, 8, '#4f9d3a'); }
}

function gazebo(b, q, H) {
  const y = H(q.x, q.z);
  b.at(q.x, y, q.z, 0);
  b.cyl(0, 0, 0, 5, .3, 8, '#d9d2bd', '#d9d2bd');
  b.cyl(0, .3, 0, 4.4, .08, 8, '#b8b1a0', '#b8b1a0');
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8;
    b.cyl(Math.cos(a) * 4.1, .3, Math.sin(a) * 4.1, .17, 3.2, 6, WHITE, WHITE);
    if (i % 2 === 0) b.sub(Math.cos(a) * 3.5, 0, Math.sin(a) * 3.5, -a + Math.PI / 2, () => b.box(0, .6, 0, 2.4, .1, .6, WOOD));
  }
  b.cone(0, 3.5, 0, 5.4, 2.2, 8, '#7a4b3a');
  b.cyl(0, 5.6, 0, .12, 1.0, 6, '#c9a24a');
}

export function landmarks(b, L, H) {
  for (const d of L.lm) {
    if (d.id === 'stadium') stadium(b, d, H);
    else if (d.id === 'billiards') billiards(b, d);
    else if (d.id === 'mainstreet') mainStreet(b, d);
    else if (d.id === 'mall') mall(b, d);
  }
  (L.squares || []).forEach(q => parkFountain(b, q, H));
  (L.ponds || []).forEach(p => pond(b, p, H));
  (L.gazebos || []).forEach(q => gazebo(b, q, H));
}
