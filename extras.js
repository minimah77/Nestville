/* Nestville extras: a small "empty house" sign in front of every unclaimed house.
   Claimed houses have no sign (they show their owner's name instead).
   Runs next to town.js and reads the same state (window.__nv). */
import * as THREE from './lib.js';
import { MB } from './build.js';

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

ready(nv => {
  const S = nv.S, scene = nv.scene;
  const houses = nv.ents.filter(e => e.kind === 'house');

  /* ---------- little green sign ---------- */
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 120;
  const g = cv.getContext('2d');
  (function board() {
    const x = 4, y = 4, w = 312, h = 112, r = 24;
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    g.fillStyle = '#2f9a55'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#f7fff8'; g.stroke();
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.font = '800 38px system-ui, -apple-system, Segoe UI, sans-serif'; g.fillText('EMPTY HOUSE', 160, 55);
    g.font = '600 26px system-ui, -apple-system, Segoe UI, sans-serif'; g.fillStyle = '#d8ffe3'; g.fillText('Claim it free', 160, 92);
  })();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const N = Math.max(1, houses.length);
  const boards = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.9, .71), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), N);
  boards.frustumCulled = false; boards.count = 0; scene.add(boards);
  const postMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  let posts = null;
  const dm = new THREE.Object3D(), base = new THREE.Matrix4(), loc = new THREE.Matrix4(), mm = new THREE.Matrix4();
  function place(inst, k, h, lx, ly, lz) {
    dm.position.set(h.x, h.y, h.z); dm.rotation.set(0, h.yaw, 0); dm.scale.set(1, 1, 1); dm.updateMatrix();
    base.copy(dm.matrix); loc.makeTranslation(lx, ly, lz); mm.multiplyMatrices(base, loc); inst.setMatrixAt(k, mm);
  }
  function rebuild() {
    const empty = houses.filter(e => !S.houses[e.ref.idx]);
    if (posts) { scene.remove(posts); posts.geometry.dispose(); posts = null; }
    if (empty.length) {
      const b = new MB();
      empty.forEach((e, k) => {
        const h = e.ref;
        b.at(h.x, h.y, h.z, h.yaw);
        b.box(4.4, 0, 3.4, .12, 1.7, .12, '#5b3f2c'); /* short wooden post */
        place(boards, k, h, 4.4, 1.35, 3.47);
      });
      posts = b.mesh(postMat); posts.castShadow = false; scene.add(posts);
    }
    boards.count = empty.length; boards.instanceMatrix.needsUpdate = true;
    /* empty houses get the sign instead of a text label */
    houses.forEach(e => { e.el.style.visibility = S.houses[e.ref.idx] ? '' : 'hidden'; });
  }
  let last = -1;
  setInterval(() => { const n = S.houses.length; if (n !== last) { last = n; rebuild(); } }, 300);
});
