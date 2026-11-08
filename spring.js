/* Nestville spring: the river used to stop half way up the valley (and the old code kept digging a deeper and deeper trench above that point).
   Now the stream keeps climbing the valley to a real SOURCE: a little mountain spring pool ringed with boulders.
   - world.js digs the channel up to RIVER_SRC and ends it in a round pool (and the channel follows the ground, so there is no gorge any more)
   - town.js already draws the river water from RIVER_Z0 to RIVER_Z1; this file draws the rest: RIVER_Z1 up to RIVER_SRC, plus the spring pool and the boulders
   Runs next to town.js and reads the same scene (window.__nv), like realwater.js.
   Tune: HALF (half width of the stream), POOL (radius of the spring pool water). */
import * as THREE from './lib.js';
import { H, xr, Rs, RIVER_Z1, RIVER_SRC } from './world.js';

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

const HALF = 3.6, POOL = 8.6;
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

ready(nv => {
  const world = nv.scene.children.find(o => o.isGroup);
  if (!world) return;
  const water = new THREE.MeshPhongMaterial({ color: '#69bfd8', specular: '#ffffff', shininess: 90, transparent: true, opacity: .82, depthWrite: false });

  /* the upper stretch of the stream: same look as the river ribbon in town.js */
  const P = [], I = [];
  let k = 0;
  for (let z = RIVER_Z1; z <= RIVER_SRC + .01; z += 3, k++) {
    const x = xr(z), y = Rs(z) + .04;
    P.push(x - HALF, y, z, x + HALF, y, z);
    if (k > 0) { const a = (k - 1) * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  const stream = new THREE.Mesh(g, water); stream.renderOrder = 2; world.add(stream);

  /* the spring pool at the head of the stream */
  const cx = xr(RIVER_SRC), cz = RIVER_SRC, wy = Rs(RIVER_SRC) + .05;
  const pool = new THREE.Mesh(new THREE.RingGeometry(.01, POOL, 40).rotateX(-Math.PI / 2), water);
  pool.position.set(cx, wy, cz); pool.renderOrder = 2; world.add(pool);

  /* boulders round the upstream side of the pool, where the water comes out of the hill */
  const rock = new THREE.MeshLambertMaterial({ color: '#8e8f88', flatShading: true });
  const rock2 = new THREE.MeshLambertMaterial({ color: '#a9a69b', flatShading: true });
  const geo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * (.05 + .9 * i / 10) + (hash(i + 3) - .5) * .25, r = POOL + .6 + hash(i + 40) * 2.4;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, s = .9 + hash(i + 80) * 1.7;
    const m = new THREE.Mesh(geo, i % 3 ? rock : rock2);
    m.position.set(x, Math.max(H(x, z), wy - .3) + s * .3, z);
    m.scale.set(s * 1.25, s * .8, s); m.rotation.set(hash(i + 5) * 3, hash(i + 9) * 6, hash(i + 13) * 3);
    world.add(m);
  }
});
