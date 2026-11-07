/* Nestville life: darker blue-green lake, fish in the lake and canals, starfish, crabs,
   higher clouds, and label height for the taller penthouses.
   Runs next to town.js and reads the same scene (window.__nv). */
import * as THREE from './lib.js';
import { H, WL, canals } from './world.js';
import { rng } from './shared.js';

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

ready(async nv => {
  const scene = nv.scene;
  let merge = null;
  try { merge = (await import('three/addons/utils/BufferGeometryUtils.js')).mergeGeometries; } catch (e) { return; }

  /* ---------- lake colour: one dark blue-green, not two separate tones ---------- */
  const TINT = { '4fb4cc': '#14697b', '4fb9cd': '#19707f', '69bfd8': '#1f7886' };
  function tint() {
    scene.traverse(o => {
      const m = o.material; if (!m) return;
      if (m.color) { const t = TINT[m.color.getHexString()]; if (t) m.color.set(t); }
      if (o.isReflector || (m.uniforms && m.uniforms.tDiffuse && m.uniforms.color)) m.uniforms.color.value.set('#5f9aa6');
    });
  }
  tint(); setTimeout(tint, 1500); setTimeout(tint, 4000);
  const gb = document.getElementById('bGfx'); if (gb) gb.addEventListener('click', () => { setTimeout(tint, 900); setTimeout(tint, 2500); });

  /* ---------- clouds far above the camera ---------- */
  scene.traverse(o => {
    if (o.isGroup && !o.__up && o.position.y > 140 && o.position.y < 230 && o.children.length > 3 && o.children[0].geometry && o.children[0].geometry.type === 'IcosahedronGeometry') { o.position.y += 340; o.__up = 1; }
  });

  /* ---------- penthouses are taller: lift their labels ---------- */
  nv.ents.filter(e => e.kind === 'ph').forEach(e => { e.top = 58; });

  /* ---------- shared bits ---------- */
  const R = rng(4242), rr = (a, b) => a + (b - a) * R();
  const part = (g, m) => { g = g.index ? g.toNonIndexed() : g; g.applyMatrix4(m); g.deleteAttribute('uv'); return g; };
  const M4 = new THREE.Matrix4();
  const S = (x, y, z) => M4.clone().makeScale(x, y, z);
  const Tm = (x, y, z) => M4.clone().makeTranslation(x, y, z);
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: .96 }); /* drawn after the water so it stays visible */
  const dm = new THREE.Object3D();
  function inst(geo, n, palette, order) {
    const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.renderOrder = order;
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) { c.set(palette[i % palette.length]); c.offsetHSL(rr(-.02, .02), 0, rr(-.05, .05)); m.setColorAt(i, c); }
    scene.add(m); return m;
  }

  /* ---------- fish ---------- */
  const fishGeo = merge([
    part(new THREE.SphereGeometry(1, 10, 8), S(1.25, .5, .42)),
    part(new THREE.ConeGeometry(.6, .9, 5).rotateZ(-Math.PI / 2), M4.clone().makeScale(1, 1, .18).premultiply(Tm(-1.7, 0, 0))),
    part(new THREE.ConeGeometry(.32, .62, 4), M4.clone().makeScale(1, 1, .2).premultiply(Tm(-.1, .62, 0)))
  ]);
  const FISH = ['#ff8a3d', '#ffd24a', '#f2f4f5', '#ff5d5d', '#7fd1ff', '#ffb36b'];

  /* lake schools swim in loops that stay over deep water */
  const LAKE = { cx: 0, cz: -88, rx: 175, rz: 98 };
  const deep = (x, z) => H(x, z) < WL - 1.1;
  const schools = [];
  for (let tries = 0; schools.length < 9 && tries < 200; tries++) {
    const f = rr(.25, .72), ox = rr(-30, 30), oz = rr(-12, 12), ph = rr(0, 6.28), sp = rr(.05, .09) * (R() < .5 ? -1 : 1);
    const at = a => [LAKE.cx + ox + Math.cos(a) * LAKE.rx * f, LAKE.cz + oz + Math.sin(a) * LAKE.rz * f * 1.0];
    let ok = true; for (let k = 0; k < 48; k++) { const p = at(k / 48 * 6.283); if (!deep(p[0], p[1])) { ok = false; break; } }
    if (ok) schools.push({ at, ph, sp, n: 3 + ((R() * 3) | 0) });
  }
  const lake = []; schools.forEach(s => { for (let k = 0; k < s.n; k++) lake.push({ s, off: k * .05 + rr(0, .03), side: rr(-4, 4), sc: rr(1.7, 2.8), jump: rr(3, 12), jt: -1 }); });
  const lakeM = inst(fishGeo, lake.length, FISH, 5);

  /* canal fish swim back and forth along the canals */
  const cf = [];
  canals.forEach(c => {
    const cum = [0]; for (let i = 1; i < c.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1]));
    const len = cum[cum.length - 1]; if (len < 24) return;
    const n = Math.min(4, 1 + Math.floor(len / 55));
    for (let k = 0; k < n; k++) cf.push({ c, cum, len, u0: rr(0, len * 2), v: rr(1.2, 2.6), lat: rr(-1.1, 1.1), sc: rr(.6, .95) });
  });
  const canM = inst(fishGeo, cf.length, FISH, 5);
  function onLine(f, u) { /* point and direction at distance u along the canal */
    const p = f.c.pts, cum = f.cum; let i = 1; while (i < cum.length - 1 && cum[i] < u) i++;
    const t = (u - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), ax = p[i - 1][0], az = p[i - 1][1], bx = p[i][0], bz = p[i][1], l = Math.hypot(bx - ax, bz - az) || 1;
    return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / l, (bz - az) / l];
  }

  /* ---------- starfish in the shallows ---------- */
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? .4 : 1, a = i * Math.PI / 5 - Math.PI / 2, x = Math.cos(a) * r, y = Math.sin(a) * r; i ? star.lineTo(x, y) : star.moveTo(x, y); }
  star.closePath();
  const starGeo = part(new THREE.ExtrudeGeometry(star, { depth: .22, bevelEnabled: true, bevelSize: .07, bevelThickness: .07, bevelSegments: 1 }).rotateX(-Math.PI / 2), S(1, 1, 1));
  const spots = [];
  for (let t = 0; t < 9000 && spots.length < 70; t++) {
    const x = rr(-185, 185), z = rr(-190, 22), h = H(x, z);
    if (h > WL - 1.5 && h < WL - .05) spots.push([x, Math.max(h + .2, WL - .3), z]);
  }
  const starM = inst(starGeo, spots.length, ['#ff7a3d', '#f2545b', '#ffb13b', '#ff8fa3', '#e9684a'], 5);
  spots.forEach((p, i) => { dm.position.set(p[0], p[1], p[2]); dm.rotation.set(0, rr(0, 6.28), 0); dm.scale.setScalar(rr(1, 1.7)); dm.updateMatrix(); starM.setMatrixAt(i, dm.matrix); });
  starM.instanceMatrix.needsUpdate = true;

  /* ---------- crabs on the shore ---------- */
  const crabGeo = merge([
    part(new THREE.SphereGeometry(1, 10, 8), S(1, .45, .7)),
    part(new THREE.SphereGeometry(.34, 8, 6), Tm(-1.05, .05, .8)), part(new THREE.SphereGeometry(.34, 8, 6), Tm(1.05, .05, .8)),
    part(new THREE.BoxGeometry(.15, .5, .15), Tm(-.35, .5, .55)), part(new THREE.BoxGeometry(.15, .5, .15), Tm(.35, .5, .55)),
    ...[-1, 1].flatMap(sx => [-.35, 0, .35].map(z => part(new THREE.BoxGeometry(.9, .09, .09), Tm(sx * 1.2, -.1, z))))
  ]);
  const near = (x, z) => [[5, 0], [-5, 0], [0, 5], [0, -5]].some(d => H(x + d[0], z + d[1]) < WL - .2);
  const shore = [];
  for (let t = 0; t < 12000 && shore.length < 26; t++) {
    const x = rr(-185, 185), z = rr(-190, 30), h = H(x, z);
    if (h > WL + .3 && h < WL + 1.2 && near(x, z)) shore.push({ x, z, y: h, a: rr(0, 6.28), sc: rr(.9, 1.4), ph: rr(0, 6.28), amp: rr(.8, 1.8) });
  }
  const crabM = inst(crabGeo, shore.length, ['#e4572e', '#d9402b', '#f08a3c', '#c9362b'], 4);

  /* ---------- animate ---------- */
  const ep = (x, y, z, yaw, pitch, sc, roll) => { dm.position.set(x, y, z); dm.rotation.set(roll || 0, yaw, pitch || 0); dm.scale.setScalar(sc); dm.updateMatrix(); };
  let t0 = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    const T = (now - t0) / 1000;
    lake.forEach((f, i) => {
      const s = f.s, a = s.ph + (T + f.off * 40) * s.sp * 2, e = .01;
      const p = s.at(a), q = s.at(a + e * (s.sp < 0 ? -1 : 1));
      let dx = q[0] - p[0], dz = q[1] - p[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      let x = p[0] - dz * f.side, z = p[1] + dx * f.side, y = WL - .12, pitch = 0;
      if (f.jt < 0 && T > f.jump) f.jt = T;
      if (f.jt >= 0) { const u = (T - f.jt) / 1.1; if (u >= 1) { f.jt = -1; f.jump = T + rr(6, 16); } else { y += Math.sin(u * Math.PI) * 4.2; pitch = Math.cos(u * Math.PI) * .9; } }
      ep(x, y, z, Math.atan2(-dz, dx) + Math.sin(T * 7 + i) * .12, pitch, f.sc);
      lakeM.setMatrixAt(i, dm.matrix);
    });
    lakeM.instanceMatrix.needsUpdate = true;
    cf.forEach((f, i) => {
      const L2 = f.len * 2, u = (f.u0 + T * f.v) % L2, fwd = u < f.len, d = fwd ? u : L2 - u;
      const p = onLine(f, Math.max(.01, Math.min(f.len - .01, d))), sg = fwd ? 1 : -1, dx = p[2] * sg, dz = p[3] * sg;
      ep(p[0] - dz * f.lat, WL - .06, p[1] + dx * f.lat, Math.atan2(-dz, dx) + Math.sin(T * 9 + i) * .15, 0, f.sc);
      canM.setMatrixAt(i, dm.matrix);
    });
    canM.instanceMatrix.needsUpdate = true;
    shore.forEach((c, i) => { /* scuttle sideways, pause, scuttle back */
      const s = Math.sin(T * .6 + c.ph), k = Math.max(-.5, Math.min(.5, s * 2.2)) * c.amp;
      ep(c.x + Math.cos(c.a) * k, c.y + .35 * c.sc, c.z - Math.sin(c.a) * k, c.a, 0, c.sc, Math.sin(T * 12 + c.ph) * .04 * (Math.abs(s) > .23 ? 1 : 0));
      crabM.setMatrixAt(i, dm.matrix);
    });
    crabM.instanceMatrix.needsUpdate = true;
  })(performance.now());
});