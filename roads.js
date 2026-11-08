/* Nestville roads: cross streets (step 3 of the look fix, to match the photo).
   Until now the town only had the east-west row streets, so there were no intersections. This adds six north-south cross streets.
   world.js already knows how to build them from the XSTREETS list (the row sidewalks stop at each one, a zebra crossing goes on every side,
   intersections are marked so the dashes and curbs leave a gap), and streets.js draws them.
   IMPORTANT: this file is loaded BEFORE town.js in index.html, because the list has to be filled before the layout is made.
   The x positions were tested offline on a copy of the repo: every house and shop stays exactly where it was (so no claim moves),
   and no street tree or lamp stands in a new road. To move one, change its number to another gap between two houses
   (houses are 22 apart, the gaps are at -149 + 22k), and keep it away from the church (x -36 to 4), the squares (x -104, -52, 76) and the river.
   The little tree cleaner below only removes a tree if one ever lands inside a cross street (for example a forest tree south of the village). */
import * as THREE from './lib.js';
import { XSTREETS, L, polyDist } from './world.js';

XSTREETS.push(-148, -83, -39, 71, 115, 137);

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }
ready(nv => {
  const world = nv.scene.children.find(o => o.isGroup); if (!world) return;
  const ns = (L.streets || []).filter(s => s.k === 'ns'); if (!ns.length) return;
  const done = new WeakSet(), m4 = new THREE.Matrix4(), e = m4.elements, zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const clean = () => {
    for (const o of world.children) {
      if (!o.isInstancedMesh || !o.instanceColor || done.has(o)) continue; done.add(o);
      let changed = false;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4);
        if (ns.some(s => polyDist(s.pts, e[12], e[14]) < 4.9)) { o.setMatrixAt(i, zero); changed = true; }
      }
      if (changed) o.instanceMatrix.needsUpdate = true;
    }
  };
  clean(); setInterval(clean, 1000); /* trees are replanted when the graphics quality changes */
});
