/* Nestville street life (step 2 of "make the town like the photo").
   Everything here is built from the street data of world.js / streets.js, so it moves with the streets if you edit them:
     - NO CARS: Nestville is a car-free town. The car, parked-car and fire-truck code that used to live here is gone on purpose.
     - street lamps on the sidewalk side of every row street
     - traffic lights at the intersections (east-west green, north-south red; decoration)
     - little people strolling along the row sidewalks and the lakeside walk
     - round green trees in the gaps between the houses
   All of it is instanced (a handful of draw calls). Runs next to town.js and streets.js and reads the same scene (window.__nv).
   Add  import './props.js';  after the streets.js import. The knobs are in CFG just below. */
import * as THREE from './lib.js';
import { H, L, ROAD_W, XW, crossBlock, canalDist, xr, polyDist } from './world.js';
import { Builder, sample, at } from './streets.js';
import { surfaceY } from './paths.js';

const CFG = {
  people: 40,       /* walkers */
  treeChance: .55,  /* chance that a gap between two houses gets a tree */
  lampEvery: 26
};
const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c', '#ff7aa2'];
const LEAF = ['#3f7a3a', '#4f8f45', '#5ea244', '#346b38'];
const SKIN = ['#f1c9a5', '#e0ac82', '#c68a5c', '#8d5a3b'];

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }
const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const hwOf = st => st.k === 'ew' ? ROAD_W / 2 : XW;

ready(nv => {
  const scene = nv.scene, R = rng(20261107), dm = new THREE.Object3D(), tint = new THREE.Color();
  const rows = (L.streets || []).filter(s => s.k === 'ew').map(st => {
    const S = sample(st.pts, hwOf(st)); return { st, S, total: S[S.length - 1].s, dir: st.row % 2 === 0 ? 1 : -1 };
  });
  if (!rows.length) return;
  const inter = L.inter || [];
  const nearInter = (x, z, r) => inter.some(p => Math.hypot(x - p.x, z - p.z) < r);
  const sideY = (x, z, fallback) => { const y = surfaceY(x, z); return y === null || y === undefined ? fallback + .14 : y; }; /* top of the sidewalk at (x, z) */

  /* ---------- street lamps (sidewalk side of every row street) and traffic lights ---------- */
  { const lb = Builder();
    lb.box(0, .15, 0, .36, .3, .36, '#2e3b36'); lb.box(0, 1.8, 0, .14, 3.6, .14, '#2e3b36'); lb.box(0, 3.55, -.45, .1, .1, 1.0, '#2e3b36'); lb.box(0, 3.44, -.95, .52, .16, .36, '#fff1bd');
    const spots = [];
    rows.forEach(r => { for (let s = 12; s < r.total - 6; s += CFG.lampEvery) { const p = at(r.S, s); if (nearInter(p.x, p.z, 7)) continue; const lat = ROAD_W / 2 + .45; spots.push([p.x - p.tz * lat, p.z + p.tx * lat, p.y + .14]); } });
    const lamps = new THREE.InstancedMesh(lb.geo(), new THREE.MeshLambertMaterial({ vertexColors: true }), Math.max(1, spots.length));
    spots.forEach((q, i) => { dm.position.set(q[0], q[2], q[1]); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); lamps.setMatrixAt(i, dm.matrix); });
    lamps.count = spots.length; lamps.frustumCulled = false; scene.add(lamps);

    const tb = Builder(), tl = Builder(); /* tb: pole and light housings, tl: the lit and dim lenses */
    tb.box(0, 1.7, 0, .12, 3.4, .12, '#3b3f45'); tb.box(-.25, 3.0, 0, .25, 1.0, .4, '#24272b'); tb.box(0, 3.0, -.25, .4, 1.0, .25, '#24272b');
    [['#5a1b1b', 3.3], ['#5a4a1b', 3.0], ['#39e36b', 2.7]].forEach(([c, y]) => tl.box(-.39, y, 0, .06, .2, .2, c)); /* faces west: east-west traffic, green */
    [['#ff3b30', 3.3], ['#5a4a1b', 3.0], ['#1b4a2a', 2.7]].forEach(([c, y]) => tl.box(0, y, -.39, .2, .2, .06, c)); /* faces north: north-south traffic, red */
    const poles = new THREE.InstancedMesh(tb.geo(), new THREE.MeshLambertMaterial({ vertexColors: true }), Math.max(1, inter.length));
    const lights = new THREE.InstancedMesh(tl.geo(), new THREE.MeshBasicMaterial({ vertexColors: true }), Math.max(1, inter.length));
    inter.forEach((p, i) => {
      const x = p.x + XW + .55, z = p.z + ROAD_W / 2 + .55; dm.position.set(x, sideY(x, z, H(x, z)), z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); dm.updateMatrix();
      poles.setMatrixAt(i, dm.matrix); lights.setMatrixAt(i, dm.matrix);
    });
    poles.count = lights.count = inter.length; poles.frustumCulled = lights.frustumCulled = false; scene.add(poles, lights);
  }

  /* ---------- trees in the gaps between neighbouring houses ---------- */
  { const homes = [...L.houses.filter(h => !h.old), ...L.shops, ...L.pent];
    const offPaving = (x, z) => !(L.streets || []).some(st => polyDist(st.pts, x, z) < hwOf(st) + 1.2) && !(L.walks || []).some(w => polyDist(w.pts, x, z) < w.w / 2 + 1.4);
    const free = (x, z) => offPaving(x, z) && !homes.some(h => Math.abs(x - h.x) < 6.4 && Math.abs(z - h.z) < 6.2) && !crossBlock(x, z, 2.6) && canalDist(x, z) > 6 && Math.abs(x - xr(z)) > 9 &&
      H(x, z) > 1.4 && !(L.squares || []).some(q => Math.hypot(x - q.x, z - q.z) < q.r + 2) && !L.castles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 6) &&
      !(L.church && Math.abs(x - L.church.x) < 17 && z > L.church.z - 27 && z < L.church.z + 15) && !(L.plaza && Math.hypot(x - L.plaza.x, z - L.plaza.z) < L.plaza.r + 5);
    const T = [];
    L.houses.filter(h => !h.old && !h.built && h.row >= 0).forEach(h => {
      if (R() > CFG.treeChance) return; const x = h.x + 8.25 + (R() - .5) * 1.2, z = h.z + 1 + (R() - .5) * 2.4;
      if (free(x, z) && !T.some(t => Math.hypot(t[0] - x, t[1] - z) < 7)) T.push([x, z, .85 + R() * .5, Math.floor(R() * LEAF.length)]);
    });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.2, .3, 2.3, 6).translate(0, 1.15, 0), new THREE.MeshLambertMaterial({ color: '#6b4a32' }), Math.max(1, T.length));
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.9, 1).translate(0, 3.7, 0), new THREE.MeshLambertMaterial({ color: '#ffffff' }), Math.max(1, T.length));
    T.forEach((t, i) => { dm.position.set(t[0], H(t[0], t[1]) - .05, t[1]); dm.rotation.set(0, R() * 6.28, 0); dm.scale.setScalar(t[2]); dm.updateMatrix(); trunks.setMatrixAt(i, dm.matrix); crowns.setMatrixAt(i, dm.matrix); crowns.setColorAt(i, tint.set(LEAF[t[3]])); });
    trunks.count = crowns.count = T.length; if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true; trunks.frustumCulled = crowns.frustumCulled = false; scene.add(trunks, crowns);
  }

  /* ---------- people ---------- */
  const walks = (L.walks || []).filter(w => (w.kind === 'row' || w.kind === 'bank') && w.pts.length > 2).map(w => {
    const cum = [0]; for (let i = 1; i < w.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(w.pts[i][0] - w.pts[i - 1][0], w.pts[i][1] - w.pts[i - 1][1]));
    return { pts: w.pts, cum, total: cum[cum.length - 1], hw: w.w / 2 };
  }).filter(w => w.total > 20);
  const N = walks.length ? CFG.people : 0, folks = [];
  for (let i = 0; i < N; i++) { const w = walks[Math.floor(R() * walks.length)]; folks.push({ w, s: R() * w.total, dir: R() < .5 ? 1 : -1, speed: .8 + R() * .7, lat: (R() - .5) * (w.hw * 1.2), ph: R() * 6.28, shirt: SHIRTS[i % SHIRTS.length], skin: SKIN[Math.floor(R() * SKIN.length)] }); }
  if (N) {
    const mk = (g, c) => new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: c }), N);
    const body = mk(new THREE.CylinderGeometry(.2, .23, .62, 8).translate(0, .82, 0), '#ffffff'), legs = mk(new THREE.CylinderGeometry(.15, .15, .52, 6).translate(0, .26, 0), '#3b4660'), head = mk(new THREE.SphereGeometry(.17, 8, 6).translate(0, 1.3, 0), '#ffffff');
    folks.forEach((f, i) => { body.setColorAt(i, tint.set(f.shirt)); head.setColorAt(i, tint.set(f.skin)); });
    body.instanceColor.needsUpdate = head.instanceColor.needsUpdate = true; body.frustumCulled = legs.frustumCulled = head.frustumCulled = false; scene.add(body, legs, head);
    folks.body = body; folks.legs = legs; folks.head = head;
  }
  function walkPos(w, s) { /* point and heading at distance s along a walk */
    let i = 1; while (i < w.cum.length - 1 && w.cum[i] < s) i++;
    const a = w.pts[i - 1], b = w.pts[i], t = Math.max(0, Math.min(1, (s - w.cum[i - 1]) / ((w.cum[i] - w.cum[i - 1]) || 1))), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l };
  }

  /* ---------- animation ---------- */
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(.1, (now - last) / 1000); last = now; const t = now / 1000;
    if (N) {
      folks.forEach((f, i) => {
        f.s += f.dir * f.speed * dt; if (f.s < 0) { f.s = 0; f.dir = 1; } else if (f.s > f.w.total) { f.s = f.w.total; f.dir = -1; }
        const p = walkPos(f.w, f.s), x = p.x - p.tz * f.lat, z = p.z + p.tx * f.lat, y = sideY(x, z, H(x, z)) + Math.abs(Math.sin(t * f.speed * 6 + f.ph)) * .05;
        dm.position.set(x, y, z); dm.rotation.set(0, -Math.atan2(p.tz * f.dir, p.tx * f.dir), 0); dm.scale.set(1.15, 1.15, 1.15); dm.updateMatrix();
        folks.body.setMatrixAt(i, dm.matrix); folks.legs.setMatrixAt(i, dm.matrix); folks.head.setMatrixAt(i, dm.matrix);
      });
      folks.body.instanceMatrix.needsUpdate = folks.legs.instanceMatrix.needsUpdate = folks.head.instanceMatrix.needsUpdate = true;
    }
  }
  requestAnimationFrame(tick);
});
