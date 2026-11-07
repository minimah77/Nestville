/* Nestville town: renderer, terrain, camera, UI */
import * as THREE from './lib.js';
import { MB, chalet, openLot, penthouse, castleLake, castleEast, castleIsland, watchtower, church, fountain, shop, bridge, pier, boat, lamp, K } from './build.js';
import { H, B, TOWN, L, layout, baseH, xr, Rs, roadDist, plazas, sz, laneZ, canals, canalDist, WL, RIVER_Z0, RIVER_Z1, sm, fbm } from './world.js';
import { load, save, PH_PRICES, SHOP_PRICE, KINDS, IG_DM, fmt, avatar, stats, rng } from './shared.js';

const $ = id => document.getElementById(id);
const S = load();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const QUAL = {
  low: { step: 6.5, pr: 1, shadow: 0, trees: 1400, fx: 0, refl: 0, label: 'Low' },
  medium: { step: 4.2, pr: 1.5, shadow: 2048, trees: 4200, fx: 1, refl: 0, label: 'Medium' },
  high: { step: 2.9, pr: 2, shadow: 4096, trees: 9000, fx: 1, refl: 1, label: 'High' }
};
let gfx = 'medium';
try { const g = localStorage.getItem('nv-gfx'); if (QUAL[g]) gfx = g; } catch (e) { }

/* ---------- renderer / scene ---------- */
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const HORIZON = '#cfe3ee';
scene.fog = new THREE.Fog(HORIZON, 420, 1900);
const camera = new THREE.PerspectiveCamera(46, 1, 1, 3500);

const hemi = new THREE.HemisphereLight('#cfe6f6', '#8c7d5c', 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 2.5);
const SUN_OFF = new THREE.Vector3(-95, 175, -90), SUN_C = new THREE.Vector3(0, 0, 50);
sun.position.copy(SUN_C).add(SUN_OFF); sun.target.position.copy(SUN_C);
Object.assign(sun.shadow.camera, { left: -185, right: 185, top: 185, bottom: -185, near: 10, far: 520 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.45;
scene.add(sun, sun.target);

/* sky dome */
const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color('#4d93cf') }, mid: { value: new THREE.Color('#9fcbe6') }, hor: { value: new THREE.Color(HORIZON) }, sunDir: { value: SUN_OFF.clone().normalize() } },
  vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'uniform vec3 top,mid,hor,sunDir;varying vec3 vP;void main(){float h=clamp(vP.y,0.,1.);vec3 c=mix(hor,mid,smoothstep(0.,.18,h));c=mix(c,top,smoothstep(.15,.85,h));float s=max(dot(normalize(vP),sunDir),0.);c+=vec3(1.,.9,.7)*(pow(s,48.)*.5+pow(s,6.)*.12);gl_FragColor=vec4(c,1.);}'
}));
sky.renderOrder = -10; scene.add(sky);

const matV = new THREE.MeshLambertMaterial({ vertexColors: true });
const world = new THREE.Group(); scene.add(world);
const dyn = new THREE.Group(), stat = new THREE.Group(), fx = new THREE.Group(); world.add(dyn, stat, fx);

/* ---------- terrain ---------- */
const CL = n => K(n);
const C = { deep: CL('#1f6a86'), shal: CL('#8dd1c8'), sand: CL('#e4d8aa'), g1: CL('#86bf5e'), g2: CL('#62a249'), fo: CL('#3f7a3a'), rock: CL('#8e8f88'), rock2: CL('#aaa79c'), snow: CL('#f6f9fa'), path: CL('#dcd0b4'), quay: CL('#cdc6b2'), cob: CL('#e8e0cc') };
const tmpC = new THREE.Color();
let terrain = null;
function buildTerrain(step) {
  const nx = Math.floor((B.x1 - B.x0) / step) + 1, nz = Math.floor((B.z1 - B.z0) / step) + 1;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), hh = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = B.x0 + i * step, z = B.z0 + j * step, h = H(x, z); hh[k] = h;
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = pos[k * 3], z = pos[k * 3 + 2], h = hh[k];
    const gx = (hh[j * nx + Math.min(nx - 1, i + 1)] - hh[j * nx + Math.max(0, i - 1)]) / (2 * step);
    const gz = (hh[Math.min(nz - 1, j + 1) * nx + i] - hh[Math.max(0, j - 1) * nx + i]) / (2 * step);
    const sl = Math.min(1, Math.hypot(gx, gz) / 2);
    const o = tmpC;
    if (h < .3) o.copy(C.deep).lerp(C.shal, sm(-9, .2, h));
    else {
      const n = fbm(x * .05 + 3, z * .05 + 8, 2), n2 = fbm(x * .011 + 9, z * .011, 2);
      o.copy(C.g1).lerp(C.g2, n);
      o.lerp(C.sand, 1 - sm(.3, 1.9, h));
      o.lerp(C.fo, sm(14, 60, h) * (.4 + n2 * .6));
      o.lerp(C.rock, Math.max(sm(.55, .9, sl), sm(66, 105, h + n * 30)) * (h > 4 ? 1 : 0));
      o.lerp(C.rock2, sm(.45, .8, n) * sm(60, 110, h) * .5);
      o.lerp(C.snow, sm(78, 106, h + (n - .5) * 30) * (sl < .9 ? 1 : .55));
      if (x > TOWN.x0 && x < TOWN.x1 && z > TOWN.z0 && z < TOWN.z1) {
        const cd = canalDist(x, z); if (cd < 2.8) o.lerp(C.quay, 1 - sm(.8, 2.8, cd));
        const d = roadDist(x, z); if (d < 3.4) o.lerp(C.path, 1 - sm(1.7, 3.4, d));
        for (const p of plazas) { const dd = Math.hypot(x - p.x, z - p.z); if (dd < p.r) o.lerp(C.cob, 1 - sm(p.r - 2, p.r, dd)); }
      }
    }
    col[k * 3] = o.r; col[k * 3 + 1] = o.g; col[k * 3 + 2] = o.b;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let q = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals(); g.computeBoundingSphere();
  if (terrain) { world.remove(terrain); terrain.geometry.dispose(); }
  terrain = new THREE.Mesh(g, matV); terrain.receiveShadow = true; world.add(terrain);
}

/* ---------- water ---------- */
const waterGeo = new THREE.PlaneGeometry(420, 250, 126, 76); waterGeo.rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshPhongMaterial({ color: '#4fb4cc', specular: '#ffffff', shininess: 140, transparent: true, opacity: .8, depthWrite: false });
const water = new THREE.Mesh(waterGeo, waterMat); water.position.set(0, WL, -85); water.renderOrder = 2; world.add(water);
const wBase = Float32Array.from(waterGeo.attributes.position.array);
let reflector = null;
async function setReflector(on) {
  if (reflector) { world.remove(reflector); reflector.getRenderTarget().dispose(); reflector = null; }
  if (!on) { waterMat.opacity = .84; return; }
  try {
    const { Reflector } = await import('three/addons/objects/Reflector.js');
    reflector = new Reflector(new THREE.PlaneGeometry(420, 250), { textureWidth: 1024, textureHeight: 1024, color: 0xcfe4ec, clipBias: .003 });
    reflector.rotation.x = -Math.PI / 2; reflector.position.set(0, WL - .05, -85); reflector.renderOrder = 1; world.add(reflector);
    waterMat.opacity = .5;
  } catch (e) { waterMat.opacity = .84; }
}
/* river ribbon */
(function river() {
  const P = [], I = [];
  for (let z = RIVER_Z0, k = 0; z <= RIVER_Z1; z += 3, k++) {
    const x = xr(z), y = Rs(z) + .04;
    P.push(x - 3.6, y, z, x + 3.6, y, z);
    if (k > 0) { const a = (k - 1) * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: '#69bfd8', specular: '#fff', shininess: 90, transparent: true, opacity: .82, depthWrite: false }));
  m.renderOrder = 2; world.add(m);
})();

/* canal water: opaque ribbons at the lake level, one per canal */
const canalMat = new THREE.MeshPhongMaterial({ color: '#4fb9cd', specular: '#ffffff', shininess: 90, side: THREE.DoubleSide });
canals.forEach((c, ci) => {
  const P = [], I = [], n = c.pts.length, hw = c.w + 2.6, y = WL + .004 * ci;
  for (let i = 0; i < n; i++) {
    const a = c.pts[Math.max(0, i - 1)], b = c.pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const p = c.pts[i], nx = -tz, nz = tx;
    P.push(p[0] + nx * hw, y, p[1] + nz * hw, p[0] - nx * hw, y, p[1] - nz * hw);
    if (i > 0) { const k = (i - 1) * 2; I.push(k, k + 2, k + 1, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  const m = new THREE.Mesh(g, canalMat); m.renderOrder = 1; world.add(m);
});

/* ---------- entities ---------- */
layout();
L.church.y = baseH(L.church.x, L.church.z + 1);
const plazaY = baseH(L.plaza.x, L.plaza.z);
const ents = [];
function ent(o) { ents.push(o); return o; }
L.castles.forEach(c => ent({ kind: 'castle', id: 'c-' + c.id, x: c.x, z: c.z, y: c.y, r: c.r, top: c.hgt + 6, label: c.name, cls: 's', vis: 340, ref: c }));
ent({ kind: 'church', id: 'church', x: L.church.x, z: L.church.z, y: L.church.y, r: 12, top: 54, label: 'Village church', cls: 's', vis: 280, ref: L.church });
L.pent.forEach(p => ent({ kind: 'ph', id: 'ph' + p.i, x: p.x, z: p.z, y: p.y, r: 10, top: 30, vis: 165, ref: p }));
L.shops.forEach(s => ent({ kind: 'shop', id: 'sh' + s.i, x: s.x, z: s.z, y: s.y, r: 6, top: 13, vis: 120, ref: s }));
L.houses.forEach(h => ent({ kind: 'house', id: 'h' + h.idx, x: h.x, z: h.z, y: h.y, r: 7, top: 17, vis: 95, ref: h }));
const yp = L.yachtPier;
ent({ kind: 'yacht', id: 'yacht', x: yp.x, z: yp.z0 - 28, y: WL, r: 30, top: 16, label: 'Yacht club', cls: 's', vis: 280, ref: yp });
const entById = {}; ents.forEach(e => entById[e.id] = e);

function entLabel(e) {
  if (e.kind === 'house') { const r = S.houses[e.ref.idx]; return r ? '@' + r.u : 'Open plot'; }
  if (e.kind === 'ph') { const o = S.ph[e.ref.i]; return 'Penthouse ' + (e.ref.i + 1) + (o ? ' · @' + o.u : ' · For sale'); }
  if (e.kind === 'shop') { const o = S.shops[e.ref.i]; return KINDS[e.ref.i] + (o ? ' · @' + o.u : ''); }
  return e.label;
}
function entCls(e) {
  if (e.kind === 'ph') return S.ph[e.ref.i] ? 'lb' : 'lb k';
  if (e.kind === 'house') return S.houses[e.ref.idx] ? 'lb' : 'lb';
  return 'lb' + (e.cls ? ' ' + e.cls : '');
}
const lbWrap = $('labels');
ents.forEach(e => { const d = document.createElement('div'); d.className = 'lb'; d.style.display = 'none'; lbWrap.appendChild(d); e.el = d; e.txt = ''; });
function refreshLabels() { ents.forEach(e => { const t = entLabel(e); if (t !== e.txt) { e.txt = t; e.el.textContent = t; } e.el.className = entCls(e); }); }

/* ---------- buildings ---------- */
const smokeSrc = [];
function disposeGroup(g) { while (g.children.length) { const c = g.children.pop(); if (c.geometry) c.geometry.dispose(); } }
function addMesh(g, mb) { const m = mb.mesh(matV); g.add(m); return m; }
function buildStatic() {
  disposeGroup(stat);
  const b = new MB();
  L.castles.forEach(c => ({ lake: castleLake, east: castleEast, island: castleIsland, tower: watchtower })[c.id](b, c));
  church(b, L.church);
  fountain(b, L.plaza, plazaY);
  /* bridges over the river */
  for (const r of [0, 2, 4]) {
    let bz = laneZ(r, 12) + 8.75; bz = laneZ(r, xr(bz)) + 8.75;
    const cx = xr(bz), bank = Math.max(baseH(cx - 11, bz), baseH(cx + 11, bz));
    bridge(b, cx, bank - .8, bz);
  }
  pier(b, L.pier, .9); pier(b, L.yachtPier, .9);
  for (let x = -52; x <= 40; x += 11.5) { const z = sz(x) + 4.2; lamp(b, x, Math.max(1.2, baseH(x, z)), z); }
  addMesh(stat, b);
}
function buildDyn() {
  disposeGroup(dyn); smokeSrc.length = 0;
  const bh = new MB(), bp = new MB(), bs = new MB();
  L.houses.forEach(h => { const r = S.houses[h.idx]; if (r) chalet(bh, h.x, h.y, h.z, h.yaw, r.u, smokeSrc); else openLot(bh, h.x, h.y, h.z, h.yaw); });
  L.pent.forEach(p => penthouse(bp, p, !!S.ph[p.i]));
  L.shops.forEach(s => shop(bs, s, !!S.shops[s.i]));
  addMesh(dyn, bh); addMesh(dyn, bp); addMesh(dyn, bs);
  buildSmoke();
  $('stat').textContent = S.houses.length + ' residents';
  refreshLabels();
}

/* chimney smoke */
let smoke = null;
function buildSmoke() {
  if (smoke) { fx.remove(smoke); smoke.dispose(); smoke = null; }
  if (!QUAL[gfx].fx || !smokeSrc.length) return;
  smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.9, 0), new THREE.MeshLambertMaterial({ color: '#f4f4f2', transparent: true, opacity: .32, depthWrite: false }), smokeSrc.length * 3);
  smoke.frustumCulled = false; fx.add(smoke);
}
const dm = new THREE.Object3D();
function updateSmoke(t) {
  if (!smoke) return;
  let n = 0;
  smokeSrc.forEach((s, i) => { for (let k = 0; k < 3; k++) {
    const p = ((t * .16 + k / 3 + i * .137) % 1);
    dm.position.set(s.x + p * 4, s.y + p * 9, s.z + p * 1.5); const sc = .35 + p * 1.5; dm.scale.set(sc, sc, sc); dm.updateMatrix(); smoke.setMatrixAt(n++, dm.matrix);
  } });
  smoke.instanceMatrix.needsUpdate = true;
}

/* ---------- trees ---------- */
let treesC = null, treesB = null;
const conGeo = (() => { const b = new MB(); b.cyl(0, 0, 0, .36, 2.2, 5, '#6b4a32'); b.cone(0, 1.4, 0, 2.7, 5.2, 7, '#2f6b3a'); b.cone(0, 3.9, 0, 2.1, 4.6, 7, '#3a7a45'); b.cone(0, 6.2, 0, 1.4, 4.2, 7, '#46894f'); return b.mesh(matV).geometry; })();
const brdGeo = (() => { const b = new MB(); b.cyl(0, 0, 0, .42, 3, 5, '#6b4a32'); b.cone(0, 2.2, 0, 2.5, 2.6, 8, '#ffffff', 3.1); b.cone(0, 4.7, 0, 3.1, 2.4, 8, '#ffffff', 1.7); return b.mesh(matV).geometry; })();
const BRD = ['#6db04a', '#7cba50', '#5ea244', '#8bc14f', '#d9a53a', '#d9703a', '#c9482f'].map(c => new THREE.Color(c));
function plantTrees(n) {
  [treesC, treesB].forEach(m => { if (m) { world.remove(m); m.dispose(); } }); treesC = treesB = null;
  const r = rng(424242), ex = [];
  L.houses.forEach(h => ex.push([h.x, h.z, 8])); L.pent.forEach(p => ex.push([p.x, p.z, 12.5])); L.shops.forEach(s => ex.push([s.x, s.z, 7]));
  L.castles.forEach(c => ex.push([c.x, c.z, c.r + 5])); ex.push([L.church.x, L.church.z, 15], [L.plaza.x, L.plaza.z, 12]);
  const con = [], brd = []; let tries = 0;
  while (con.length + brd.length < n && tries < n * 14) {
    tries++;
    const x = -330 + r() * 660, z = -120 + r() * 500, h = H(x, z);
    if (h < 1.7 || h > 95) continue;
    const town = x > TOWN.x0 && x < TOWN.x1 && z > TOWN.z0 && z < TOWN.z1, f = fbm(x * .022 + 7, z * .022 + 2, 3);
    if (town) { if (r() > .1 + (f > .55 ? .4 : 0)) continue; } else if (f < .44 && h < 60 && r() > .2) continue;
    if (town && roadDist(x, z) < 4.5) continue;
    if (canalDist(x, z) < 4.5) continue;
    if (z > 135 && Math.abs(x - xr(z)) < 9) continue;
    let bad = false; for (const e of ex) { if (Math.hypot(x - e[0], z - e[1]) < e[2]) { bad = true; break; } } if (bad) continue;
    if (Math.hypot(H(x + 2, z) - h, H(x, z + 2) - h) / 2 > 1.05) continue;
    const s = (.8 + r() * .8) * (h > 30 ? 1.25 : 1);
    ((h > 38 || r() < .5) ? con : brd).push([x, h, z, s, r()]);
  }
  const mk = (geo, arr, tint) => {
    const m = new THREE.InstancedMesh(geo, matV, Math.max(1, arr.length)); m.castShadow = QUAL[gfx].shadow > 0; m.frustumCulled = false;
    arr.forEach((t, i) => { dm.position.set(t[0], t[1] - .3, t[2]); dm.rotation.set(0, t[4] * 6.28, 0); dm.scale.set(t[3], t[3] * (.9 + t[4] * .4), t[3]); dm.updateMatrix(); m.setMatrixAt(i, dm.matrix); m.setColorAt(i, tint(t)); });
    m.count = arr.length; world.add(m); return m;
  };
  const cg = new THREE.Color();
  treesC = mk(conGeo, con, t => cg.setScalar(.82 + t[4] * .36));
  treesB = mk(brdGeo, brd, t => { const p = t[4] < .12 ? BRD[4 + ((t[4] * 100) | 0) % 3] : BRD[((t[4] * 31) | 0) % 4]; return cg.copy(p).multiplyScalar(.9 + t[3] * .1); });
  dm.rotation.set(0, 0, 0);
}

/* ---------- clouds + boats ---------- */
const clouds = [];
(function () {
  const r = rng(77), mat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: .93, flatShading: true });
  for (let i = 0; i < 11; i++) {
    const g = new THREE.Group(), n = 4 + ((r() * 4) | 0);
    for (let k = 0; k < n; k++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat); const sc = 14 + r() * 14; s.scale.set(sc * 1.5, sc * .62, sc); s.position.set((k - n / 2) * 20 + r() * 8, r() * 5, (r() - .5) * 16); g.add(s); }
    g.position.set((r() - .5) * 760, 150 + r() * 70, -300 + r() * 520); clouds.push(g); fx.add(g);
  }
})();
const boats = [];
[[-70, -100, 36, 24, '#5a4332', '#f5f0e4'], [20, -122, 62, 26, '#2f4f73', '#e9a93a'], [-118, -80, 24, 16, '#8a3b2c', '#f5f0e4'], [-22, -70, 26, 12, '#3f6a5a', '#d9623f'], [62, -132, 42, 14, '#6a4a32', '#3f7fb5']].forEach((c, i) => {
  const b = new MB(); boat(b, 0, 0, 0, 0, c[4], c[5], 1.25); const m = b.mesh(matV); world.add(m); boats.push({ m, c, ph: i * 1.7, sp: .05 + i * .006 });
});

/* little canal boats: the cars of Nestville */
const cbGeo = (() => {
  const b = new MB(); b.at(0, 0, 0, 0);
  b.box(0, -.1, -.3, 1.5, .8, 3.0, '#ffffff');
  b.T([-.75, -.1, 1.2], [0, -.1, 2.5], [-.75, .7, 1.2], '#e6e6e6'); b.T([-.75, .7, 1.2], [0, -.1, 2.5], [0, .7, 2.5], '#f2f2f2');
  b.T([.75, -.1, 1.2], [.75, .7, 1.2], [0, -.1, 2.5], '#d6d6d6'); b.T([.75, .7, 1.2], [0, .7, 2.5], [0, -.1, 2.5], '#e8e8e8');
  b.T([.75, .7, 1.2], [-.75, .7, 1.2], [0, .7, 2.5], '#ffffff');
  b.box(0, .7, -.5, 1.1, .8, 1.5, '#fff8ea'); b.box(0, 1.5, -.5, 1.4, .12, 1.8, '#e0705a'); b.box(0, .7, -1.55, 1.2, .1, .8, '#c9a76b');
  return b.mesh(matV).geometry;
})();
const CB_TINT = ['#ffffff', '#ffe0a0', '#bfe3f2', '#ffc2b5', '#cfe9c8'].map(c => new THREE.Color(c));
const canalBoats = [];
canals.forEach(c => { c.cum = [0]; for (let i = 1; i < c.pts.length; i++) c.cum.push(c.cum[i - 1] + Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1])); c.len = c.cum[c.cum.length - 1]; });
{
  const r = rng(909);
  canals.forEach((c, ci) => { const n = Math.max(1, Math.round(c.len / 42)), v = 3.2 + (ci % 3) * .7; for (let k = 0; k < n; k++) canalBoats.push({ c, u0: ((k + r() * .4) / n) * c.len * 2, v, lat: .85, t: (r() * 5) | 0 }); });
}
const cbMesh = new THREE.InstancedMesh(cbGeo, matV, canalBoats.length); cbMesh.frustumCulled = false; world.add(cbMesh);
canalBoats.forEach((b, i) => cbMesh.setColorAt(i, CB_TINT[b.t]));
function pathAt(c, s) {
  const cum = c.cum; let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const a = c.pts[i - 1], b = c.pts[i], seg = cum[i] - cum[i - 1] || 1, t = Math.min(1, Math.max(0, (s - cum[i - 1]) / seg));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / seg, (b[1] - a[1]) / seg];
}
function updateCanalBoats(t) {
  canalBoats.forEach((b, i) => {
    const len2 = b.c.len * 2, u = (b.u0 + b.v * t) % len2, fw = u < b.c.len, s = fw ? u : len2 - u, p = pathAt(b.c, s), sg = fw ? 1 : -1, hx = p[2] * sg, hz = p[3] * sg;
    dm.position.set(p[0] - hz * b.lat, WL + .08 + Math.sin(t * 2 + i) * .03, p[1] + hx * b.lat); dm.rotation.set(0, Math.atan2(hx, hz), 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); cbMesh.setMatrixAt(i, dm.matrix);
  });
  cbMesh.instanceMatrix.needsUpdate = true; dm.rotation.set(0, 0, 0);
}

/* three yachts moored in the east bay */
const yachtG = new THREE.Group(); world.add(yachtG);
function yachtMesh(hull, stripe) {
  const b = new MB(); b.at(0, 0, 0, 0);
  b.box(0, 0, 0, 5.4, 2.4, 20, hull);
  b.T([-2.7, 0, 10], [0, 0, 15.5], [-2.7, 2.4, 10], K(hull).clone().multiplyScalar(.86)); b.T([-2.7, 2.4, 10], [0, 0, 15.5], [0, 2.4, 15.5], K(hull).clone().multiplyScalar(.93));
  b.T([2.7, 0, 10], [2.7, 2.4, 10], [0, 0, 15.5], K(hull).clone().multiplyScalar(.74)); b.T([2.7, 2.4, 10], [0, 2.4, 15.5], [0, 0, 15.5], K(hull).clone().multiplyScalar(.82));
  b.T([2.7, 2.4, 10], [-2.7, 2.4, 10], [0, 2.4, 15.5], '#c9a76b');
  b.box(0, .9, .2, 5.46, .36, 21, stripe);
  b.box(0, 2.4, -1.5, 5, .2, 17, '#c9a76b');
  b.box(0, 2.6, -3.5, 4.2, 2.1, 9, '#fbfaf5'); b.box(0, 3.4, -3.5, 4.26, .7, 9.06, '#27465e');
  b.box(0, 4.7, -4.5, 3.4, 1.6, 5.2, '#fbfaf5'); b.box(0, 5.2, -4.5, 3.46, .55, 5.26, '#27465e'); b.box(0, 6.3, -4.5, 3.9, .2, 5.9, hull);
  b.box(0, 6.5, -4.5, .16, 2.6, .16, '#d9d9d9'); b.box(0, 8.6, -4.5, 1.5, .12, .22, '#d9d9d9');
  b.box(0, 2.6, 5.2, 2.4, .5, 3.4, '#e9a93a'); b.box(0, 2.6, 8.6, 1.6, .3, 1.2, '#fbfaf5');
  const m = b.mesh(matV); return m;
}
const yachts = [];
[[yp.x + 15, yp.z0 - 14, Math.PI, '#f7f5ee', '#1f3b57'], [yp.x - 15, yp.z0 - 22, Math.PI + .07, '#2a3441', '#d9a53a'], [yp.x + 2, yp.z0 - 50, Math.PI - .5, '#f7f5ee', '#8a2f2f']].forEach((c, i) => {
  const m = yachtMesh(c[3], c[4]); m.position.set(c[0], WL + .2, c[1]); m.rotation.y = c[2]; yachtG.add(m); yachts.push({ m, c, i });
});
function updateYachts(t) { yachts.forEach(y => { const c = y.c; y.m.position.set(c[0] + Math.sin(t * .2 + y.i) * .5, WL + .2 + Math.sin(t * .9 + y.i * 2) * .06, c[1] + Math.cos(t * .17 + y.i) * .5); y.m.rotation.y = c[2] + Math.sin(t * .15 + y.i) * .05; y.m.rotation.z = Math.sin(t * .8 + y.i) * .012; }); }

/* ---------- camera ---------- */
const HOME = { tx: 0, ty: 8, tz: 66, yaw: Math.PI + .25, pitch: .32, dist: 255 };
if (innerWidth / innerHeight < .8) Object.assign(HOME, { tz: 84, pitch: .36, dist: 275 });
const cam = { ...HOME, zoom: 1 }, goal = { ...HOME, zoom: 1 };
let BASE_FOV = 46;
const view = { mode: 'orbit', minY: 4, floor: 3, row: 3, ri: 0, wx: -96, pi: 4 };
let smooth = 8, tourOn = false, tourI = 0, tourT = 0;
function angTo(from, to) { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return from + d; }
function fly(o) {
  if (o.x !== undefined) { goal.tx = o.x; goal.tz = o.z; }
  goal.ty = o.y !== undefined ? o.y : Math.max(2, H(goal.tx, goal.tz) + 3);
  if (o.yaw !== undefined) goal.yaw = angTo(cam.yaw, o.yaw);
  if (o.pitch !== undefined) goal.pitch = o.pitch; if (o.dist !== undefined) goal.dist = o.dist;
}
function updateCam(dt) {
  const k = 1 - Math.exp(-dt * smooth);
  for (const p of ['tx', 'ty', 'tz', 'yaw', 'pitch', 'dist', 'zoom']) cam[p] += (goal[p] - cam[p]) * k;
  const cp = Math.cos(cam.pitch);
  let x = cam.tx + Math.sin(cam.yaw) * cp * cam.dist, z = cam.tz + Math.cos(cam.yaw) * cp * cam.dist, y = cam.ty + Math.sin(cam.pitch) * cam.dist;
  y = Math.min(Math.max(y, H(x, z) + view.minY, view.floor), 330); /* never up into the clouds (they start near 470) */
  const fv = BASE_FOV * cam.zoom; if (Math.abs(camera.fov - fv) > .01) { camera.fov = fv; camera.updateProjectionMatrix(); }
  camera.position.set(x, y, z); camera.lookAt(cam.tx, cam.ty, cam.tz);
  sky.position.copy(camera.position);
}
function pan(dx, dy) {
  if (view.mode !== 'orbit') return;
  const s = goal.dist * .0016, fx_ = -Math.sin(goal.yaw), fz = -Math.cos(goal.yaw), rx = Math.cos(goal.yaw), rz = -Math.sin(goal.yaw);
  goal.tx = clamp(goal.tx + fx_ * dy * s - rx * dx * s, TOWN.x0 - 60, TOWN.x1 + 60); goal.tz = clamp(goal.tz + fz * dy * s - rz * dx * s, B.z0 + 140, B.z1 - 90);
  goal.ty = Math.max(2, H(goal.tx, goal.tz) + 3);
}
const ptr = new Map(); let down = null, lastPinch = 0, lastMid = null;
const cv = renderer.domElement;
function stopTour() { if (tourOn) { tourOn = false; smooth = 8; $('bTour').classList.remove('on'); } }
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); stopTour();
  if (ptr.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, btn: e.button };
  else { down = null; const [a, b] = [...ptr.values()]; lastPinch = Math.hypot(a.x - b.x, a.y - b.y); lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
});
cv.addEventListener('pointermove', e => {
  const p = ptr.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptr.size === 1 && down) {
    down.moved += Math.abs(dx) + Math.abs(dy);
    if (view.mode !== 'orbit') { goal.yaw += dx * .005; goal.pitch = clamp(goal.pitch - dy * .004, -.5, .9); }
    else if (down.btn === 2 || e.shiftKey || e.ctrlKey) pan(dx, dy); else { goal.yaw -= dx * .006; goal.pitch = clamp(goal.pitch + dy * .005, .1, 1.45); }
  } else if (ptr.size === 2) {
    const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (view.mode === 'walk') { if (lastPinch > 0) stepWalk((d - lastPinch) * .2); }
    else if (view.mode === 'ph') { if (lastPinch > 0) goal.zoom = clamp(goal.zoom * lastPinch / d, .45, 1.15); }
    else {
      if (lastPinch > 0) goal.dist = clamp(goal.dist * lastPinch / d, 24, 400);
      if (lastMid) pan(mid.x - lastMid.x, mid.y - lastMid.y);
    }
    lastPinch = d; lastMid = mid;
  }
});
function endPtr(e) {
  const had = ptr.delete(e.pointerId);
  if (had && down && ptr.size === 0 && down.moved < 7 && performance.now() - down.t < 600 && down.btn !== 2) pick(e.clientX, e.clientY);
  if (ptr.size < 2) { lastPinch = 0; lastMid = null; } if (ptr.size === 0) down = null;
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => {
  e.preventDefault(); stopTour();
  if (view.mode === 'walk') stepWalk(-e.deltaY * .04);
  else if (view.mode === 'ph') goal.zoom = clamp(goal.zoom * Math.exp(e.deltaY * .001), .45, 1.15);
  else goal.dist = clamp(goal.dist * Math.exp(e.deltaY * .0012), 24, 400);
}, { passive: false });
const keys = {};
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; keys[e.key.toLowerCase()] = 1; stopTour(); });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = 0; });
function keyMove(dt) {
  if (view.mode !== 'orbit') {
    if (keys.arrowleft || keys.a || keys.q) goal.yaw += dt * 1.4; if (keys.arrowright || keys.d || keys.e) goal.yaw -= dt * 1.4;
    if (view.mode === 'walk') { if (keys.arrowup || keys.w) stepWalk(dt * 16); if (keys.arrowdown || keys.s) stepWalk(-dt * 16); }
    return;
  }
  const s = 380 * dt; let dx = 0, dy = 0;
  if (keys.arrowleft || keys.a) dx += s; if (keys.arrowright || keys.d) dx -= s; if (keys.arrowup || keys.w) dy += s; if (keys.arrowdown || keys.s) dy -= s;
  if (dx || dy) pan(dx, dy); if (keys.q) goal.yaw += dt * 1.2; if (keys.e) goal.yaw -= dt * 1.2;
  if (keys['+'] || keys['=']) goal.dist = clamp(goal.dist * (1 - dt), 24, 400); if (keys['-']) goal.dist = clamp(goal.dist * (1 + dt), 24, 400);
}

/* ---------- picking + selection ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const ring = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2b640', transparent: true, opacity: .95, depthWrite: false, fog: false }));
ring.visible = false; ring.renderOrder = 8; scene.add(ring);
let sel = null;
function pick(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([terrain, dyn, stat, yachtG], true)[0];
  if (!hit) { select(null); return; }
  let best = null, bd = 1e9;
  for (const e of ents) { const d = Math.hypot(hit.point.x - e.x, hit.point.z - e.z) - e.r * (e.kind === 'house' ? 1 : 1.1); if (d < 0 && d < bd) { bd = d; best = e; } }
  select(best, view.mode !== 'orbit');
}
function select(e, keep) {
  sel = e; const card = $('card');
  if (!e) { card.style.display = 'none'; ring.visible = false; return; }
  if (!keep && view.mode !== 'orbit') leaveFP();
  card.innerHTML = cardHTML(e); card.style.display = 'block';
  ring.visible = true; ring.scale.setScalar(e.r * 1.15); ring.position.set(e.x, e.y + .7, e.z);
  if (!keep) fly({ x: e.x, z: e.z, dist: Math.min(goal.dist, e.kind === 'house' ? 62 : e.kind === 'castle' || e.kind === 'yacht' ? 120 : 85) });
}
function cardHTML(e) {
  const x = '<button class="x" data-a="close" aria-label="Close">×</button>';
  if (e.kind === 'house') {
    const r = S.houses[e.ref.idx];
    if (!r) return x + '<h3>Open plot</h3><p>A home is waiting here. Claim your house and become a resident.</p><button class="pb gold" data-a="claim">Claim a house</button>';
    const st = stats(r.u);
    return x + '<div style="display:flex;gap:12px;align-items:center">' + avatar(r.u, 52) + '<div><h3 style="padding:0">@' + r.u + '</h3><p style="margin:0">Resident of Nestville</p></div></div>' +
      '<div style="display:flex;gap:8px;margin:12px 0 0">' + [['Coins', st.coins.toLocaleString('en-US')], ['Land', st.land + ' plots'], ['Streak', st.streak + ' days']].map(a => '<div style="flex:1;background:rgba(255,255,255,.55);border-radius:14px;padding:8px 10px"><small style="color:var(--mute);font-weight:700">' + a[0] + '</small><div style="font:700 15px var(--fb)">' + a[1] + '</div></div>').join('') + '</div>';
  }
  if (e.kind === 'ph') {
    const i = e.ref.i, o = S.ph[i];
    return x + '<h3>Penthouse ' + (i + 1) + '</h3><p>' + (o ? 'Owned by @' + o.u + '.' : 'Three floors of glass, a rooftop pool and the best view over the lake.') + '</p>' +
      '<div style="display:flex;gap:8px;align-items:center"><b style="font:600 18px var(--fd)">' + fmt(PH_PRICES[i]) + '</b><span style="flex:1"></span>' + (o ? '' : '<button class="pb gold" data-a="buy" data-k="ph" data-i="' + i + '">Buy</button>') + '</div>';
  }
  if (e.kind === 'shop') {
    const i = e.ref.i, o = S.shops[i];
    return x + '<h3>' + KINDS[i] + '</h3><p>' + (o ? 'Run by @' + o.u + '.' : 'A shop on the lakeside promenade, open for your business.') + '</p>' +
      '<div style="display:flex;gap:8px;align-items:center"><b style="font:600 18px var(--fd)">' + fmt(SHOP_PRICE) + '</b><span style="flex:1"></span>' + (o ? '' : '<button class="pb gold" data-a="buy" data-k="shops" data-i="' + i + '">Buy</button>') + '</div>';
  }
  if (e.kind === 'yacht') return x + '<h3>Yacht club</h3><p>Three yachts are moored in the east bay of the lake.</p>';
  const blurb = { lake: 'A white-walled castle on the peninsula, with a tall dark spire.', east: 'Four towers and a tall bell tower on the eastern hill.', island: 'A small keep on its own island in the lake.', tower: 'An old stone watchtower guarding the eastern shore.' };
  if (e.kind === 'castle') return x + '<h3>' + e.label + '</h3><p>' + blurb[e.ref.id] + ' Landmark of Nestville.</p>';
  return x + '<h3>Village church</h3><p>The spire you can see from across the lake.</p>';
}
$('card').addEventListener('click', ev => {
  const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
  if (a === 'close') select(null); else if (a === 'claim') { select(null); openSheet('claim'); } else if (a === 'buy') buy(b.dataset.k, +b.dataset.i);
});
function buy() { if (IG_DM) window.open(IG_DM, '_blank', 'noopener'); else toast('Buying opens soon. For now, explore and pick your spot.'); }
let tt = 0;
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3200); }

/* ---------- sheet ---------- */
let tab = 'claim';
const sheet = $('sheet');
function openSheet(t) { tab = t || tab; sheet.classList.add('open'); renderTab(); }
function closeSheet() { sheet.classList.remove('open'); }
function renderTab() {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  const p = $('pane');
  if (tab === 'claim') {
    p.innerHTML = S.me ? '<h4>Your house</h4><div class="row"><div style="display:flex;gap:10px;align-items:center">' + avatar(S.me, 44) + '<div><b>@' + S.me + '</b><small>Resident of Nestville</small></div></div><button class="pb" data-go="me">Fly there</button></div><p class="note">Preview: your house is saved on this device until launch.</p><button class="pb g" data-a="reset" style="width:100%">Use a different handle</button>'
      : '<h4>Claim your house</h4><p class="note">Every follower gets a house in Nestville. Type your Instagram handle to move in.</p><input id="hIn" placeholder="@yourname" autocapitalize="none" autocomplete="off" aria-label="Instagram handle"><button class="pb gold" data-a="go" style="width:100%;margin-top:6px">Claim my house</button><p class="note">Preview: claims are saved on this device until launch.</p>';
  } else if (tab === 'ph') {
    p.innerHTML = '<h4>Penthouses</h4>' + L.pent.map(q => { const o = S.ph[q.i]; return '<div class="row"><div><b>Penthouse ' + (q.i + 1) + '</b><small class="' + (o ? 'own' : '') + '">' + (o ? 'Owned by @' + o.u : fmt(PH_PRICES[q.i])) + '</small></div><div style="display:flex;gap:6px"><button class="pb g" data-go="ph' + q.i + '">View</button>' + (o ? '' : '<button class="pb gold" data-a="buy" data-k="ph" data-i="' + q.i + '">Buy</button>') + '</div></div>'; }).join('');
  } else {
    p.innerHTML = '<h4>Promenade shops</h4>' + L.shops.map(q => { const o = S.shops[q.i]; return '<div class="row"><div><b>' + KINDS[q.i] + '</b><small class="' + (o ? 'own' : '') + '">' + (o ? 'Run by @' + o.u : fmt(SHOP_PRICE)) + '</small></div><div style="display:flex;gap:6px"><button class="pb g" data-go="sh' + q.i + '">View</button>' + (o ? '' : '<button class="pb gold" data-a="buy" data-k="shops" data-i="' + q.i + '">Buy</button>') + '</div></div>'; }).join('');
  }
}
sheet.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.t; renderTab(); } });
$('pane').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.go) { const id = b.dataset.go === 'me' ? 'h' + S.houses.findIndex(h => h.u === S.me) : b.dataset.go; closeSheet(); const en = entById[id]; if (en) select(en); return; }
  const a = b.dataset.a;
  if (a === 'buy') buy(b.dataset.k, +b.dataset.i);
  else if (a === 'reset') { delete S.me; save(S); renderTab(); }
  else if (a === 'go') claim($('hIn').value);
});
sheet.querySelector('.grab').addEventListener('click', closeSheet);
function cleanName(v) { return String(v || '').trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30); }
function claim(v) {
  const u = cleanName(v); if (u.length < 2) { toast('Type your Instagram handle first.'); return; }
  let i = S.houses.findIndex(h => h.u === u);
  if (i < 0) { if (S.houses.length >= L.houses.length) { toast('The village is full in this preview.'); return; } S.houses.push({ u, code: 'USER' }); i = S.houses.length - 1; }
  S.me = u; save(S); buildDyn(); closeSheet(); toast('Welcome home, @' + u); setTimeout(() => select(entById['h' + i]), 300);
}
function findResident(v) {
  const u = cleanName(v); if (!u) return;
  const i = S.houses.findIndex(h => h.u === u);
  if (i >= 0) { select(entById['h' + i]); } else toast('No resident @' + u + ' yet. Claim your house in the menu.');
}
$('bFind').addEventListener('click', () => findResident($('q').value));
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') { findResident(e.target.value); e.target.blur(); } });
$('bMenu').addEventListener('click', () => sheet.classList.contains('open') ? closeSheet() : openSheet());

/* ---------- three views: village, canal walk, penthouse ---------- */
const ROWS = [3, 4, 5, 0]; /* canals you can walk along */
let vt = 0;
function syncViews() { document.querySelectorAll('#views [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === view.mode)); }
function walkTo(x) { /* stand on the quay beside the canal, at x */
  if (x < -158 || x > 158) return false;
  const lz = laneZ(view.row, x), cx = L.church.x, cz = L.church.z;
  if (Math.abs(x - cx) < 23 && lz > cz - 29 && lz < cz + 15) return false; /* the church square */
  const z = lz + 4.4;
  view.wx = x; goal.tx = x; goal.tz = z; goal.ty = Math.max(H(x, z), WL) + 1.9;
  return true;
}
function stepWalk(d) { walkTo(view.wx + (Math.sin(goal.yaw) > 0 ? -d : d)); }
function leaveFP() { view.mode = 'orbit'; view.minY = 4; view.floor = 3; goal.zoom = 1; goal.dist = Math.max(goal.dist, 110); goal.pitch = .4; syncViews(); }
function setView(m, next) {
  stopTour(); select(null); closeSheet();
  if (m === 'walk') {
    if (next && view.mode === 'walk') view.ri = (view.ri + 1) % ROWS.length;
    view.row = ROWS[view.ri]; view.mode = 'walk'; view.minY = 1.6; view.floor = .8; goal.zoom = 1;
    walkTo(-96); goal.dist = .2; goal.pitch = .05; goal.yaw = angTo(cam.yaw, -Math.PI / 2);
  } else if (m === 'ph') {
    if (next && view.mode === 'ph') view.pi = (view.pi + 1) % L.pent.length;
    const p = L.pent[view.pi]; view.mode = 'ph'; view.minY = 0; view.floor = 0; goal.zoom = 1;
    goal.tx = p.x + 3.6 * Math.sin(p.yaw); goal.tz = p.z + 3.6 * Math.cos(p.yaw); goal.ty = p.y + 49.8;
    goal.dist = .2; goal.pitch = .13; goal.yaw = angTo(cam.yaw, 0);
  } else {
    view.mode = 'orbit'; view.minY = 4; view.floor = 3; goal.zoom = 1;
    fly({ x: HOME.tx, z: HOME.tz, y: HOME.ty, yaw: HOME.yaw, pitch: HOME.pitch, dist: HOME.dist });
  }
  syncViews(); smooth = 3; clearTimeout(vt); vt = setTimeout(() => { if (!tourOn) smooth = 8; }, 2000);
}
$('vHome').addEventListener('click', () => setView('orbit'));
$('vWalk').addEventListener('click', () => setView('walk', true));
$('vPh').addEventListener('click', () => setView('ph', true));

/* ---------- tour ---------- */
const TOUR = () => [
  { x: HOME.tx, z: HOME.tz, yaw: HOME.yaw, pitch: HOME.pitch, dist: HOME.dist },
  { x: L.castles[0].x, z: L.castles[0].z, yaw: Math.PI + .7, pitch: .3, dist: 95 },
  { x: L.church.x, z: L.church.z, yaw: Math.PI - .5, pitch: .33, dist: 80 },
  { x: 0, z: sz(0) + 126, yaw: Math.PI + .2, pitch: .3, dist: 110 },
  { x: xr(sz(0) + 50), z: sz(0) + 50, yaw: Math.PI - .3, pitch: .22, dist: 62 },
  { x: L.yachtPier.x, z: L.yachtPier.z0 - 26, yaw: Math.PI - .9, pitch: .28, dist: 90 },
  { x: L.castles[1].x, z: L.castles[1].z, yaw: Math.PI + 1.1, pitch: .35, dist: 120 },
  { x: L.castles[2].x, z: L.castles[2].z, yaw: Math.PI - .4, pitch: .26, dist: 85 },
  { x: -10, z: sz(0) + 6, yaw: Math.PI - .9, pitch: .22, dist: 70 }
];
$('bTour').addEventListener('click', () => {
  if (tourOn) { stopTour(); return; }
  if (view.mode !== 'orbit') setView('orbit');
  tourOn = true; tourI = 0; tourT = 0; smooth = 1.5; select(null); closeSheet(); $('bTour').classList.add('on');
  const t = TOUR()[0]; fly(t);
});
function updateTour(dt) {
  if (!tourOn) return; tourT += dt; goal.yaw += dt * .035;
  if (tourT > 7) { tourT = 0; const T = TOUR(); tourI = (tourI + 1) % T.length; fly(T[tourI]); }
}

/* ---------- graphics ---------- */
let applying = false;
async function applyGfx(first) {
  if (applying) return; applying = true; const q = QUAL[gfx];
  $('gfx').textContent = q.label; try { localStorage.setItem('nv-gfx', gfx); } catch (e) { }
  if (!first) { $('load').classList.remove('off'); $('loadmsg').textContent = 'Switching to ' + q.label + ' graphics'; await new Promise(r => setTimeout(r, 60)); }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr)); resize();
  renderer.shadowMap.enabled = q.shadow > 0; sun.castShadow = q.shadow > 0;
  if (q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  [matV, waterMat].forEach(m => m.needsUpdate = true);
  dyn.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = q.shadow > 0; } }); stat.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = q.shadow > 0; } });
  boats.forEach(b => { b.m.castShadow = q.shadow > 0; }); yachts.forEach(y => { y.m.castShadow = q.shadow > 0; }); cbMesh.castShadow = q.shadow > 0;
  terrain && (terrain.receiveShadow = q.shadow > 0);
  $('loadmsg').textContent = 'Shaping the valley'; await new Promise(r => setTimeout(r, 30)); buildTerrain(q.step);
  terrain.receiveShadow = q.shadow > 0;
  $('loadmsg').textContent = 'Planting the forest'; await new Promise(r => setTimeout(r, 30)); plantTrees(q.trees);
  fx.visible = !!q.fx; buildSmoke(); await setReflector(!!q.refl);
  applying = false; $('load').classList.add('off');
}
$('bGfx').addEventListener('click', () => { gfx = gfx === 'low' ? 'medium' : gfx === 'medium' ? 'high' : 'low'; applyGfx(false); toast('Graphics: ' + QUAL[gfx].label); });

/* ---------- frame loop ---------- */
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; BASE_FOV = w / h < .75 ? 58 : 46; camera.fov = BASE_FOV * cam.zoom; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
const v3 = new THREE.Vector3(); let last = performance.now(), T = 0, frame = 0;
function frameLoop(now) {
  requestAnimationFrame(frameLoop);
  const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt; frame++;
  keyMove(dt); updateTour(dt); updateCam(dt);
  const q = QUAL[gfx];
  /* water motion */
  if (q.fx) {
    const a = waterGeo.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { const x = wBase[i], z = wBase[i + 2]; a[i + 1] = .08 * (Math.sin(x * .23 + T * 1.2) + Math.sin(z * .19 + T * .9) + Math.sin((x + z) * .12 + T * .6)); }
    waterGeo.attributes.position.needsUpdate = true; if (frame % 2 === 0) waterGeo.computeVertexNormals();
    clouds.forEach(c => { c.position.x += dt * 2.2; if (c.position.x > 420) c.position.x = -420; });
    updateSmoke(T);
  }
  updateCanalBoats(T); updateYachts(T);
  boats.forEach(b => { const t = T * b.sp + b.ph, c = b.c, x = c[0] + Math.cos(t) * c[2], z = c[1] + Math.sin(t) * c[3]; b.m.position.set(x, .1 + Math.sin(T * 1.4 + b.ph) * .12, z); b.m.rotation.set(Math.sin(T + b.ph) * .02, Math.atan2(-Math.sin(t) * c[2], Math.cos(t) * c[3]), Math.cos(T * 1.2 + b.ph) * .03); });
  if (ring.visible) { const p = 1 + Math.sin(T * 3) * .04; ring.scale.setScalar(sel.r * 1.15 * p); ring.material.opacity = .65 + Math.sin(T * 3) * .3; }
  /* labels */
  if (frame % 2 === 0) {
    const cands = [];
    for (const e of ents) {
      v3.set(e.x, e.y + e.top, e.z); const d = v3.distanceTo(camera.position);
      if (d > e.vis) { if (e.shown) { e.el.style.display = 'none'; e.shown = false; } continue; }
      v3.project(camera);
      if (v3.z > 1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) { if (e.shown) { e.el.style.display = 'none'; e.shown = false; } continue; }
      cands.push([e, d, v3.x, v3.y]);
    }
    cands.sort((a, b) => a[1] - b[1]); let hs = 0;
    cands.forEach(c => { const e = c[0]; if (e.kind === 'house' && ++hs > (view.mode === 'walk' ? 5 : 18)) { if (e.shown) { e.el.style.display = 'none'; e.shown = false; } return; }
      if (!e.shown) { e.el.style.display = ''; e.shown = true; }
      e.el.style.transform = 'translate(' + ((c[2] * .5 + .5) * innerWidth) + 'px,' + ((-c[3] * .5 + .5) * innerHeight) + 'px) translate(-50%,-100%)';
      e.el.style.opacity = clamp((e.vis - c[1]) / (e.vis * .25), 0, 1); });
  }
  renderer.render(scene, camera);
}

/* ---------- boot ---------- */
resize(); buildStatic(); buildDyn(); updateCam(1);
applyGfx(true).then(() => {
  const m = location.hash.match(/^#@?([\w.]+)/); if (m) setTimeout(() => findResident(m[1]), 600);
});
requestAnimationFrame(frameLoop);
window.__nv = { S, ents, select, fly, cam, goal, view, setView, renderer, scene, camera, applyGfx: g => { gfx = g; return applyGfx(false); } };
