/* Nestville extras: "empty house" signs with a green light, and three quick camera views.
   Runs next to town.js and reads the same state (window.__nv). */
import * as THREE from './lib.js';
import { MB } from './build.js';
import { sz, xr } from './world.js';

const $ = id => document.getElementById(id);
function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

ready(nv => {
  const S = nv.S, scene = nv.scene;
  const houses = nv.ents.filter(e => e.kind === 'house');

  /* ---------- little sign: green board + glowing light ---------- */
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
  const boards = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.8, 1.05), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), N);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.3, 10, 8), new THREE.MeshBasicMaterial({ color: '#8dffa8', fog: false }), N);
  const haloMat = new THREE.MeshBasicMaterial({ color: '#5dff8a', transparent: true, opacity: .25, depthWrite: false });
  const halos = new THREE.InstancedMesh(new THREE.SphereGeometry(.95, 12, 8), haloMat, N);
  [boards, bulbs, halos].forEach(m => { m.frustumCulled = false; m.count = 0; scene.add(m); });
  halos.renderOrder = 6;
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
        b.box(4.4, 0, 3.4, .16, 2.7, .16, '#5b3f2c');
        b.box(4.4, 2.7, 3.4, .5, .14, .5, '#33373f');
        place(boards, k, h, 4.4, 1.95, 3.5);
        place(bulbs, k, h, 4.4, 3.05, 3.4);
        place(halos, k, h, 4.4, 3.05, 3.4);
      });
      posts = b.mesh(postMat); posts.castShadow = false; scene.add(posts);
    }
    [boards, bulbs, halos].forEach(m => { m.count = empty.length; m.instanceMatrix.needsUpdate = true; });
    /* empty houses get the sign instead of a text label */
    houses.forEach(e => { e.el.style.visibility = S.houses[e.ref.idx] ? '' : 'hidden'; });
  }
  let last = -1;
  setInterval(() => { const n = S.houses.length; if (n !== last) { last = n; rebuild(); } }, 300);
  (function pulse(t) { requestAnimationFrame(pulse); haloMat.opacity = .2 + .13 * Math.sin(t * .0024); })(0);

  return; /* the three views now live in town.js */
  const mobile = innerWidth / innerHeight < .8;
  const phs = nv.ents.filter(e => e.kind === 'ph').sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
  const VIEWS = {
    village: () => ({ x: 0, z: mobile ? 84 : 66, y: 8, yaw: Math.PI + .25, pitch: mobile ? .36 : .32, dist: mobile ? 275 : 255 }),
    canals: () => { const z = sz(0) + 50; return { x: xr(z), z, yaw: Math.PI - .3, pitch: .2, dist: 56 }; },
    sky: () => { const p = phs[0]; return { x: p.x, z: p.z - 140, y: p.y + 12, yaw: 0, pitch: .093, dist: 150 }; }
  };
  const st = document.createElement('style');
  st.textContent = '#views{position:fixed;right:12px;top:calc(env(safe-area-inset-top,0px) + 74px);display:flex;flex-direction:column;gap:3px;padding:5px;border-radius:20px;z-index:3}' +
    '#views button{border:0;background:transparent;color:var(--ink);height:36px;min-width:84px;padding:0 12px;border-radius:14px;font:700 12.5px var(--fb);cursor:pointer;text-align:left}' +
    '#views button.on{background:#fff;box-shadow:0 2px 8px rgba(16,56,70,.15)}';
  document.head.appendChild(st);
  const bar = document.createElement('div'); bar.id = 'views'; bar.className = 'gl';
  bar.innerHTML = '<button data-v="village">Village</button><button data-v="canals">Canal walk</button><button data-v="sky">Penthouse view</button>';
  document.body.appendChild(bar);
  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const tour = $('bTour'); if (tour && tour.classList.contains('on')) tour.click();
    nv.select(null);
    nv.fly(VIEWS[b.dataset.v]());
    bar.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    setTimeout(() => b.classList.remove('on'), 4000);
  });
});
