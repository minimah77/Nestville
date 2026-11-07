/* Nestville folks: little people strolling along the sidewalks of both villages.
   Low-poly, instanced (two meshes: tinted clothes and fixed skin/hair/legs), a gentle walking bob.
   Runs next to town.js and reads the same scene (window.__nv). */
import * as THREE from './lib.js';
import { MB } from './build.js';
import { H, L } from './world.js';
import { rng } from './shared.js';

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

ready(nv => {
  const scene = nv.scene, R = rng(2026), rr = (a, b) => a + (b - a) * R();

  /* ---- the person: clothes (white, tinted per person) and body parts with fixed colours ---- */
  const cl = new MB(), bd = new MB();
  cl.at(0, 0, 0, 0); bd.at(0, 0, 0, 0);
  cl.box(0, .55, 0, .5, .62, .3, '#ffffff'); cl.box(-.33, .6, 0, .14, .5, .16, '#ffffff'); cl.box(.33, .6, 0, .14, .5, .16, '#ffffff');
  bd.box(-.12, 0, 0, .17, .56, .2, '#3d4658'); bd.box(.12, 0, 0, .17, .56, .2, '#3d4658');
  bd.box(0, 1.17, 0, .3, .3, .3, '#f1c9a5'); bd.box(0, 1.4, -.02, .33, .12, .33, '#4a3426');
  const bodyGeo = bd.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })).geometry, clothGeo = cl.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })).geometry;

  /* ---- routes: every long sidewalk piece of both villages ---- */
  const routes = [];
  const add = (pts, tag) => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); if (cum[cum.length - 1] > 24) routes.push({ pts, cum, len: cum[cum.length - 1], tag }); };
  L.walks.filter(w => w.kind !== 'bank' || w.pts.length > 4).forEach(w => add(w.pts, w.kind));
  if (L.walk) {
    add([[L.walk.x0, L.walk.prom], [L.walk.x1, L.walk.prom]], 'prom');
    L.walk.z.forEach(z => add([[L.walk.x0, z], [L.walk.x1, z]], 'cot'));
    L.walk.conn.forEach(x => add([[x, L.walk.prom], [x, L.walk.z[3]]], 'conn'));
  }
  if (!routes.length) return;
  const at = (rt, u) => { let i = 1; while (i < rt.cum.length - 1 && rt.cum[i] < u) i++; const t = (u - rt.cum[i - 1]) / ((rt.cum[i] - rt.cum[i - 1]) || 1), a = rt.pts[i - 1], b = rt.pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / l, (b[1] - a[1]) / l]; };

  /* ---- the crowd: more in the main village, a handful in the cottage village ---- */
  const SHIRT = ['#d9623f', '#3f7fb5', '#4f9d69', '#8a62c4', '#e0a526', '#d9577f', '#2f8f9d', '#f2efe6', '#c94f4f'];
  const folks = [];
  const mainR = routes.filter(r => r.tag === 'row' || r.tag === 'river'), cotR = routes.filter(r => r.tag === 'prom' || r.tag === 'cot' || r.tag === 'conn');
  const spawn = (list, n) => { for (let i = 0; i < n && list.length; i++) { const rt = list[(R() * list.length) | 0]; folks.push({ rt, u: rr(0, rt.len * 2), v: rr(.9, 1.5), lat: rr(-.5, .5), ph: rr(0, 6.28), sc: rr(.85, 1.1), col: SHIRT[(R() * SHIRT.length) | 0], pause: 0 }); } };
  spawn(mainR, 26); spawn(cotR, 12);

  const mkInst = (geo, withColor) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), folks.length); m.frustumCulled = false; if (withColor) { const c = new THREE.Color(); folks.forEach((f, i) => m.setColorAt(i, c.set(f.col))); } scene.add(m); return m; };
  const cloth = mkInst(clothGeo, true), body = mkInst(bodyGeo, false);
  const dm = new THREE.Object3D();
  let last = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now; const T = now / 1000;
    folks.forEach((f, i) => {
      if (f.pause > 0) f.pause -= dt; else { f.u += f.v * dt; if (R() < dt * .02) f.pause = rr(1.5, 4); }
      const L2 = f.rt.len * 2, u = f.u % L2, fwd = u < f.rt.len, d = fwd ? u : L2 - u, p = at(f.rt, Math.max(.01, Math.min(f.rt.len - .01, d))), sg = fwd ? 1 : -1;
      const dx = p[2] * sg, dz = p[3] * sg, x = p[0] - dz * f.lat, z = p[1] + dx * f.lat;
      const moving = f.pause <= 0, bob = moving ? Math.abs(Math.sin(T * 7 + f.ph)) * .07 : 0, sway = moving ? Math.sin(T * 3.5 + f.ph) * .08 : 0;
      dm.position.set(x, H(x, p[1]) + .14 + bob, z); dm.rotation.set(0, Math.atan2(dx, dz), sway); dm.scale.setScalar(f.sc); dm.updateMatrix();
      cloth.setMatrixAt(i, dm.matrix); body.setMatrixAt(i, dm.matrix);
    });
    cloth.instanceMatrix.needsUpdate = true; body.instanceMatrix.needsUpdate = true;
  })(performance.now());
});
