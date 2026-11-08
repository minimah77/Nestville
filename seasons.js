/* Nestville seasons: spring, summer, autumn, winter.
   The village starts in the real season of the visitor (device date; the southern hemisphere is flipped by time zone),
   and the season button (#vSeason) cycles through the four. Recolours the sky, light, water, ground and trees.
   - spring: no falling petals. The slim sidewalk trees around the town turn into pink cherry trees, all other trees are fresh green.
   - summer: nothing falls.
   - autumn: no leaves in the sky. Leaves lie on the sidewalks, on the ground under the trees and around the parks,
     and a few leaves drift down from the tree tops only.
   - winter: small snowflakes fall from the whole sky. Snow piles up on the roofs: they are white after 10 minutes,
     and every 30 minutes the snow resets (the roofs are brown again).
   Runs next to town.js and reads the same scene (window.__nv). */
import * as THREE from './lib.js';
import { L as WORLD, H as groundH } from './world.js';
import { RIB } from './paths.js';

const $ = id => document.getElementById(id);
function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ORDER = ['spring', 'summer', 'autumn', 'winter'];
const NAME = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
const ICON = {
  spring: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z"/>',
  summer: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  autumn: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>',
  winter: '<path d="M12 2v20M4.9 7l14.2 10M4.9 17L19.1 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>'
};

/* the real season, from the device clock. Months are meteorological seasons; the southern hemisphere is flipped by time zone. */
const SOUTH = /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Fiji|Chatham|Tongatapu|Apia|Noumea|Norfolk)|^America\/(Sao_Paulo|Argentina|Santiago|Montevideo|Asuncion|Punta_Arenas)|^Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane)|^Indian\/(Reunion|Mauritius|Antananarivo)/;
function realSeason() {
  let m = new Date().getMonth(), tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { }
  if (SOUTH.test(tz)) m = (m + 6) % 12;
  return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
}

/* ---------- light, sky and water per season ---------- */
const col = h => new THREE.Color(h);
const mk = o => ({ top: col(o.top), mid: col(o.mid), hor: col(o.hor), hemiS: col(o.hemiS), hemiG: col(o.hemiG), sun: col(o.sun), water: col(o.water || '#4fb4cc'), cloud: col(o.cloud || '#ffffff'), hemiI: o.hemiI, sunI: o.sunI, wAmt: o.wAmt || 0 });
const SEA = {
  spring: mk({ top: '#4d9bd8', mid: '#a6d3ec', hor: '#d9ecf1', hemiS: '#d3e9f7', hemiG: '#8fae62', hemiI: 1.1, sun: '#fff3da', sunI: 2.5 }),
  summer: mk({ top: '#4d93cf', mid: '#9fcbe6', hor: '#cfe3ee', hemiS: '#cfe6f6', hemiG: '#8c7d5c', hemiI: 1.05, sun: '#fff1d6', sunI: 2.5 }),
  autumn: mk({ top: '#5d93c3', mid: '#b5cfdb', hor: '#ecdcc2', hemiS: '#d8e2e8', hemiG: '#a67c48', hemiI: 1.05, sun: '#ffd7a0', sunI: 2.3, water: '#3f8da6', wAmt: .35, cloud: '#ece6df' }),
  winter: mk({ top: '#7c9db8', mid: '#c2d3de', hor: '#e6edf1', hemiS: '#dbe8f2', hemiG: '#c9d4dc', hemiI: 1.2, sun: '#eef3ff', sunI: 1.9, water: '#d3e9f0', wAmt: .7, cloud: '#cfd8de' })
};
const cloneL = a => { const o = {}; for (const k in a) o[k] = a[k].isColor ? a[k].clone() : a[k]; return o; };
const copyL = (d, s) => { for (const k in s) { if (s[k].isColor) d[k].copy(s[k]); else d[k] = s[k]; } };
const mixL = (a, b, t, out) => { for (const k in a) { if (a[k].isColor) out[k].lerpColors(a[k], b[k], t); else out[k] = lerp(a[k], b[k], t); } };

/* ---------- ground colours: the terrain keeps its summer colours, each season is computed from them ---------- */
function rgb2hsl(r, g, b, o) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0, s = 0;
  if (d > 1e-6) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  o[0] = h; o[1] = s; o[2] = l;
}
function hue(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < .5) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
function hsl2rgb(h, s, l, o) {
  if (s < 1e-6) { o[0] = o[1] = o[2] = l; return; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  o[0] = hue(p, q, h + 1 / 3); o[1] = hue(p, q, h); o[2] = hue(p, q, h - 1 / 3);
}
const SNOW = [.9, .94, .96];
function terrainTarget(geo, orig, season) {
  const pos = geo.attributes.position.array, n = pos.length / 3, out = new Float32Array(orig.length), hs = [0, 0, 0], c = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const k = i * 3, r = orig[k], g = orig[k + 1], b = orig[k + 2], x = pos[k], y = pos[k + 1], z = pos[k + 2];
    let nr = r, ng = g, nb = b;
    if (y >= .3) { /* below that is lake bed: it stays as it is */
      rgb2hsl(r, g, b, hs);
      const h = hs[0], s = hs[1], l = hs[2], veg = clamp((h - .15) / .05, 0, 1) * clamp((s - .1) / .15, 0, 1) * (h < .5 ? 1 : 0);
      if (season === 'winter') {
        const f = .97 + .03 * Math.sin(x * .2) * Math.sin(z * .17), a = lerp(.62, .93, veg);
        nr = lerp(r, SNOW[0] * f, a); ng = lerp(g, SNOW[1] * f, a); nb = lerp(b, SNOW[2] * f, a);
      } else if (veg > .01) {
        let h2 = h, s2 = s, l2 = l;
        if (season === 'spring') { h2 = h - .012; s2 = Math.min(1, s * 1.1); l2 = Math.min(.8, l * 1.08); }
        else if (season === 'summer') { s2 = Math.min(1, s * 1.18); l2 = l * .94; }
        else { /* autumn: golden meadows with russet patches, darker ground under the forest turns red-brown */
          const n1 = Math.sin(x * .045 + 1.7) * Math.sin(z * .05 + .4), tH = (l < .16 ? .06 : .11) + n1 * .025;
          h2 = lerp(h, tH, .92); s2 = clamp(s * .95, .3, .85); l2 = l * (l < .16 ? 1.15 : .98);
        }
        hsl2rgb(h2, s2, l2, c);
        nr = lerp(r, c[0], veg); ng = lerp(g, c[1], veg); nb = lerp(b, c[2], veg);
      }
    }
    out[k] = nr; out[k + 1] = ng; out[k + 2] = nb;
  }
  return out;
}

/* ---------- trees ---------- */
const pal = a => a.map(col);
const BRD = {
  spring: pal(['#8ccf63', '#9ad66f', '#7fc455', '#86c95c', '#a3d977']),
  summer: pal(['#4f9f3d', '#5fae45', '#6db84d', '#4a9440', '#58a844']),
  autumn: pal(['#d9a53a', '#d9703a', '#c9482f', '#e6b84a', '#b8862e', '#a8452c', '#d98a2f', '#7da23a']),
  winter: pal(['#e8eef0', '#dfe7ea', '#d4dde1', '#f3f6f7', '#cfd9de'])
};
/* the cherry trees: the slim trees along the sidewalks, in spring only */
const CHERRY = pal(['#f4b6c9', '#f8cddb', '#f0a3bb', '#fbe0e8', '#f6c0d0', '#ee98b3']);
const CON = { spring: [1.15, 1.3, .9], summer: [1, 1, 1], autumn: [1.1, .97, .72], winter: [1.35, 1.5, 1.65] };
const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
function whiteVerts(g) {
  const a = g.attributes.color; if (!a) return false;
  for (let i = 0; i < a.array.length; i += 3) if (a.array[i] > .85 && a.array[i + 1] > .85 && a.array[i + 2] > .85) return true;
  return false;
}
function treeTarget(m, season) {
  const orig = m.userData.orig, out = new Float32Array(orig.length), n = m.count;
  out.set(orig);
  for (let i = 0; i < n; i++) {
    const k = i * 3;
    if (m.userData.sk === 'con') { const mu = CON[season]; out[k] = orig[k] * mu[0]; out[k + 1] = orig[k + 1] * mu[1]; out[k + 2] = orig[k + 2] * mu[2]; }
    else { const p = season === 'spring' && m.userData.street ? CHERRY : BRD[season], c = p[Math.floor(hash(i * 3 + 1) * p.length) % p.length], v = .9 + .1 * hash(i * 7 + 2); out[k] = c.r * v; out[k + 1] = c.g * v; out[k + 2] = c.b * v; }
  }
  return out;
}

/* ---------- snow on the roofs ----------
   Roof triangles are found by their colour (the roof browns used in build.js, in all their shades) and an upward-facing normal.
   Snow builds up for 10 minutes (SNOW_BUILD), stays for the rest of the cycle, and every 30 minutes (SNOW_CYCLE) it melts away quickly and starts again. */
const ROOF_BASE = ['#4a2f1f', '#7a5236', '#a77b52', '#7a3b2c'], ROOF_MUL = [1, .9, .82, .8, .7];
const rkey = (r, g, b) => Math.round(r * 2000) * 4004001 + Math.round(g * 2000) * 2001 + Math.round(b * 2000);
const ROOF_KEYS = new Map();
ROOF_BASE.forEach(h => { const c = col(h); ROOF_MUL.forEach(m => ROOF_KEYS.set(rkey(c.r * m, c.g * m, c.b * m), m)); });
const SNOWC = col('#f3f7fa');
const SNOW_BUILD = 600, SNOW_CYCLE = 1800, SNOW_MELT = 4;
function snowAmount(sec) {
  const t = sec % SNOW_CYCLE;
  return t < SNOW_BUILD ? t / SNOW_BUILD : t < SNOW_CYCLE - SNOW_MELT ? 1 : (SNOW_CYCLE - t) / SNOW_MELT;
}
function prepRoof(mesh) {
  mesh.userData.roof = null;
  const g = mesh.geometry, c = g.attributes.color, nrm = g.attributes.normal;
  if (!c || !nrm || g.index) return;
  const ca = c.array, na = nrm.array, idx = [], sh = [], w = [];
  for (let i = 0; i < c.count; i++) {
    const k = i * 3, m = ROOF_KEYS.get(rkey(ca[k], ca[k + 1], ca[k + 2]));
    if (m === undefined) continue;
    const ny = na[k + 1]; if (ny < .3) continue;
    idx.push(i); sh.push(m); w.push(clamp((ny - .3) / .2, 0, 1));
  }
  if (!idx.length) return;
  const orig = new Float32Array(idx.length * 3);
  for (let j = 0; j < idx.length; j++) { const k = idx[j] * 3; orig[j * 3] = ca[k]; orig[j * 3 + 1] = ca[k + 1]; orig[j * 3 + 2] = ca[k + 2]; }
  mesh.userData.roof = { idx: Uint32Array.from(idx), sh: Float32Array.from(sh), w: Float32Array.from(w), orig, amt: 0 };
}
function paintRoof(mesh, a) {
  const r = mesh.userData.roof; if (!r || a === r.amt) return;
  if (a > 0 && a < 1 && Math.abs(a - r.amt) < .004) return; /* ignore tiny changes while it snows slowly */
  const arr = mesh.geometry.attributes.color.array, o = r.orig, n = r.idx.length;
  for (let j = 0; j < n; j++) {
    const k = r.idx[j] * 3, j3 = j * 3, f = a * r.w[j], s = .78 + .22 * r.sh[j];
    arr[k] = o[j3] + (SNOWC.r * s - o[j3]) * f; arr[k + 1] = o[j3 + 1] + (SNOWC.g * s - o[j3 + 1]) * f; arr[k + 2] = o[j3 + 2] + (SNOWC.b * s - o[j3 + 2]) * f;
  }
  mesh.geometry.attributes.color.needsUpdate = true; r.amt = a;
}

ready(nv => {
  const scene = nv.scene, camera = nv.camera, rend = nv.renderer;
  const world = scene.children.find(o => o.isGroup);
  const sky = scene.children.find(o => o.isMesh && o.material && o.material.isShaderMaterial && o.material.uniforms && o.material.uniforms.hor);
  const hemi = scene.children.find(o => o.isHemisphereLight), sun = scene.children.find(o => o.isDirectionalLight);
  if (!world || !sky || !hemi || !sun) return;
  const dynG = world.children.find(o => o.isGroup); /* the houses, shops, cottages and penthouses (first group in the world) */

  /* water and cloud materials (the only Phong materials in the world are water) */
  const waters = []; let cloud = null;
  world.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    if (m.isMeshPhongMaterial && !waters.includes(m)) { m.userData.c0 = m.color.clone(); waters.push(m); }
    else if (m.isMeshLambertMaterial && m.flatShading && m.transparent && m.opacity > .9) cloud = m;
  });
  function applyLights(L) {
    const u = sky.material.uniforms; u.top.value.copy(L.top); u.mid.value.copy(L.mid); u.hor.value.copy(L.hor);
    if (scene.fog) scene.fog.color.copy(L.hor);
    hemi.color.copy(L.hemiS); hemi.groundColor.copy(L.hemiG); hemi.intensity = L.hemiI;
    sun.color.copy(L.sun); sun.intensity = L.sunI;
    waters.forEach(m => { m.color.copy(m.userData.c0).lerp(L.water, L.wAmt); });
    if (cloud) cloud.color.copy(L.cloud);
  }

  /* ---------- falling things: snow (winter) and a few leaves from the tree tops (autumn) ---------- */
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NP = 3200, PS = new Float32Array(NP * 4), pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) { PS[i * 4] = hash(i * 5 + 1); PS[i * 4 + 1] = hash(i * 5 + 2); PS[i * 4 + 2] = hash(i * 5 + 3); PS[i * 4 + 3] = hash(i * 5 + 4); }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const TEX = {};
  function tex(kind) {
    if (TEX[kind]) return TEX[kind];
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    if (kind === 'snow') { const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.55, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
    else {
      x.translate(32, 32); x.rotate(-.6); x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(0, 0, 28, kind === 'leaf' ? 13 : 16, 0, 0, 6.3); x.fill();
      if (kind === 'leaf') { x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 3; x.beginPath(); x.moveTo(-26, 0); x.lineTo(26, 0); x.stroke(); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return TEX[kind] = t;
  }
  const pMat = new THREE.PointsMaterial({ size: 3, vertexColors: true, transparent: true, opacity: .9, depthWrite: false, sizeAttenuation: false, fog: false });
  const pts = new THREE.Points(pGeo, pMat); pts.frustumCulled = false; pts.renderOrder = 9; pts.visible = false; scene.add(pts);
  const LEAF_COLS = ['#d9a53a', '#d9703a', '#c9482f', '#e6b84a', '#a8452c', '#b8862e'];
  const KIND = {
    /* autumn: leaves only drift down from the tree tops (tree: true), nothing falls from the open sky. size is in world units, so they get smaller far away */
    autumn: { k: 'leaf', n: 220, size: 1.15, tree: true, cols: LEAF_COLS },
    /* winter: tiny flakes from the whole sky */
    winter: { k: 'snow', n: 3200, px: 2.6, spd: .07, wind: .003, cols: ['#ffffff'] }
  };
  let fall = null, pCount = 0;
  function setFalling(season) {
    fall = reduced ? null : KIND[season] || null;
    if (!fall) { pts.visible = false; return; }
    let low = false; try { low = localStorage.getItem('nv-gfx') === 'low'; } catch (e) { }
    pCount = Math.min(NP, Math.round(fall.n * (low ? .4 : 1)));
    for (let i = 0; i < NP; i++) { const c = col(fall.cols[i % fall.cols.length]); pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b; }
    pGeo.attributes.color.needsUpdate = true; pGeo.setDrawRange(0, pCount);
    pMat.map = tex(fall.k); pMat.sizeAttenuation = !!fall.tree;
    pMat.size = fall.tree ? fall.size : fall.px * Math.min(rend.getPixelRatio(), 2);
    pMat.needsUpdate = true; pts.visible = true;
    LTR.fill(null);
  }

  /* snow: a big box around the camera target that is as wide and as tall as the view, so the flakes come from the whole sky */
  function moveSnow(dt, T) {
    const cm = nv.cam, E = clamp(cm.dist * .9 + 40, 90, 520), HT = clamp(E * .8, 90, 380), y0 = cm.ty - 4, fs = 55 / HT;
    for (let i = 0; i < pCount; i++) {
      const k = i * 4, ph = PS[k + 3];
      let u = PS[k], v = PS[k + 1], w = PS[k + 2];
      v -= fall.spd * (.7 + ph * .6) * dt * fs; if (v < 0) v += 1;
      u += (fall.wind + Math.sin(T * .6 + ph * 20) * .01) * dt * fs * 2; w += Math.cos(T * .5 + ph * 17) * .006 * dt * fs * 2;
      u -= Math.floor(u); w -= Math.floor(w);
      PS[k] = u; PS[k + 1] = v; PS[k + 2] = w;
      pPos[i * 3] = cm.tx + (u - .5) * 2 * E + Math.sin(T * 1.3 + ph * 40) * 1.2;
      pPos[i * 3 + 1] = y0 + v * HT;
      pPos[i * 3 + 2] = cm.tz + (w - .5) * 2 * E + Math.cos(T * 1.1 + ph * 33) * 1.2;
    }
    pGeo.attributes.position.needsUpdate = true;
  }

  /* autumn leaves that fall from the broadleaf trees (the street trees and the other round trees near the camera) */
  let TREES = [], treesDirty = true, near = [], nearT = -9;
  const LTR = new Array(NP).fill(null), LP = new Float32Array(NP * 6);
  function collectTrees() {
    const out = [], m4 = new THREE.Matrix4(), e = m4.elements;
    for (const o of world.children) {
      if (!o.isInstancedMesh || o.userData.sk !== 'brd') continue;
      const st = !!o.userData.street;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4);
        const sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]);
        out.push({ x: e[12], y: e[13] + .3, z: e[14], r: (st ? 1.3 : 3.1) * sx, top: (st ? 6.2 : 7.1) * sy, low: (st ? 2.5 : 2.4) * sy });
      }
    }
    TREES = out;
  }
  function pickNear(cm) {
    const R = clamp(cm.dist * .9, 70, 230), R2 = R * R; near = [];
    for (const t of TREES) { const dx = t.x - cm.tx, dz = t.z - cm.tz; if (dx * dx + dz * dz < R2) near.push(t); }
    if (near.length > 260) { const s = Math.ceil(near.length / 260); near = near.filter((_, i) => i % s === 0); }
  }
  function moveLeaves(dt, T) {
    const cm = nv.cam;
    if (T - nearT > .6) { nearT = T; pickNear(cm); }
    for (let i = 0; i < pCount; i++) {
      const k = i * 6; let prog = LP[k] + dt / (LP[k + 1] || 7), t = LTR[i];
      if (prog >= 1 || !t) {
        if (!near.length) { LTR[i] = null; pPos[i * 3 + 1] = -9999; LP[k] = Math.random(); LP[k + 1] = 7; continue; }
        const first = !t;
        t = LTR[i] = near[(Math.random() * near.length) | 0];
        prog = first ? Math.random() : 0;
        LP[k + 1] = 6 + Math.random() * 5; LP[k + 2] = Math.random() * 6.283; LP[k + 3] = .1 + Math.random() * .85; LP[k + 4] = .45 + Math.random() * .55; LP[k + 5] = Math.random() * 20;
      }
      LP[k] = prog;
      const a = LP[k + 2], rr = t.r * LP[k + 3], sy = t.low + (t.top - t.low) * LP[k + 4], ph = LP[k + 5];
      const sw = Math.sin(T * 1.4 + ph) * 1.1 * prog + prog * 1.3, sw2 = Math.cos(T * 1.1 + ph * 1.3) * 1.1 * prog;
      pPos[i * 3] = t.x + Math.cos(a) * rr + sw;
      pPos[i * 3 + 1] = t.y + .15 + (sy - .15) * (1 - prog);
      pPos[i * 3 + 2] = t.z + Math.sin(a) * rr + sw2;
    }
    pGeo.attributes.position.needsUpdate = true;
  }
  function moveFalling(dt, T) {
    if (!fall || !pts.visible) return;
    if (fall.tree) moveLeaves(dt, T); else moveSnow(dt, T);
  }

  /* ---------- autumn: leaves lying on the sidewalks, under the trees and around the parks ---------- */
  let leafMesh = null, hi = 0;
  const rnd = () => hash(++hi * 1.37);
  function buildLeaves() {
    if (leafMesh) { scene.remove(leafMesh); leafMesh.dispose(); leafMesh = null; }
    collectTrees(); treesDirty = false;
    let low = false; try { low = localStorage.getItem('nv-gfx') === 'low'; } catch (e) { }
    const kf = low ? .4 : 1, spots = [];
    /* on the sidewalks */
    for (const rb of RIB) {
      const p = rb.pts, hw = rb.tag === 'prom' ? 1.3 : rb.tag === 'conn' ? .5 : 1.0;
      for (let i = 0; i < p.length - 1; i += 3) {
        const a = p[i], b = p[i + 1]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        if (rnd() > .55 * kf + .1) continue;
        const cnt = 1 + ((rnd() * 3) | 0);
        for (let c = 0; c < cnt; c++) { const lat = (rnd() * 2 - 1) * hw, al = rnd() * 3; spots.push([a[0] - tz * lat + tx * al, a[2] + .07, a[1] + tx * lat + tz * al]); }
      }
    }
    /* on the ground under every broadleaf tree */
    for (const t of TREES) {
      const cnt = Math.round((5 + rnd() * 4) * kf);
      for (let c = 0; c < cnt; c++) { const a = rnd() * 6.283, rr = t.r * (.2 + rnd() * 1.0), x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr; spots.push([x, groundH(x, z) + .09, z]); }
    }
    /* the parks: around the fountain squares, the gazebos and the ponds */
    for (const q of WORLD.squares || []) for (let c = 0, n = Math.round(70 * kf); c < n; c++) { const a = rnd() * 6.283, rr = 4.8 + rnd() * Math.max(3, (q.r || 12) - 4.8), x = q.x + Math.cos(a) * rr, z = q.z + Math.sin(a) * rr; spots.push([x, groundH(x, z) + .09, z]); }
    for (const q of WORLD.gazebos || []) for (let c = 0, n = Math.round(40 * kf); c < n; c++) { const a = rnd() * 6.283, rr = 5.8 + rnd() * Math.max(3, (q.r || 10) - 3), x = q.x + Math.cos(a) * rr, z = q.z + Math.sin(a) * rr; spots.push([x, groundH(x, z) + .09, z]); }
    for (const p of WORLD.ponds || []) for (let c = 0, n = Math.round(50 * kf); c < n; c++) { const a = rnd() * 6.283, f = 1.5 + rnd() * 6, x = p.x + Math.cos(a) * (p.rx + f), z = p.z + Math.sin(a) * (p.rz + f); spots.push([x, groundH(x, z) + .09, z]); }
    const n = Math.min(spots.length, 9000);
    if (!n) return;
    const geo = new THREE.CircleGeometry(.42, 5).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const m = new THREE.InstancedMesh(geo, mat, n), o = new THREE.Object3D(), cc = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const s = spots[i], sc = .8 + rnd() * .6;
      o.position.set(s[0], s[1], s[2]); o.rotation.set(0, rnd() * 6.283, 0); o.scale.set(sc, 1, sc * .62); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      cc.set(LEAF_COLS[(rnd() * LEAF_COLS.length) | 0]).multiplyScalar(.85 + rnd() * .25); m.setColorAt(i, cc);
    }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.frustumCulled = false; m.userData.sk = null; m.visible = season === 'autumn';
    scene.add(m); leafMesh = m;
  }

  /* ---------- switching ---------- */
  let season = realSeason(), cur = cloneL(SEA[season]), tw = null, terr = null, winterT0 = performance.now();
  const REAL = season;
  function treeMeshes() { return world.children.filter(o => o.isInstancedMesh && o.instanceColor && typeof o.userData.sk === 'string'); }
  function terrTo(s) { const g = terr.geometry; return g.userData.tc[s] || (g.userData.tc[s] = terrainTarget(g, g.userData.orig, s)); }

  /* meshes can be rebuilt (graphics quality change): a new one gets the current season straight away */
  function scan() {
    for (const o of world.children) {
      if (o.isInstancedMesh) {
        if (!o.instanceColor || o.userData.sk !== undefined) continue;
        const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
        if (g.boundingBox.max.y < 4) { o.userData.sk = null; continue; } /* the little canal boats */
        o.userData.sk = whiteVerts(g) ? 'brd' : 'con';
        o.userData.street = o.userData.sk === 'brd' && g.boundingBox.max.x < 2.2; /* the slim sidewalk tree (the round forest tree is 3.1 wide) */
        if (o.userData.sk === 'brd') treesDirty = true;
        o.userData.orig = Float32Array.from(o.instanceColor.array);
        o.instanceColor.array.set(treeTarget(o, season)); o.instanceColor.needsUpdate = true;
      } else if (o.isMesh && o.geometry.attributes.color && o.geometry.index && o.geometry.attributes.position.count > 3000 && !o.geometry.userData.orig) {
        const g = o.geometry; g.userData.orig = Float32Array.from(g.attributes.color.array); g.userData.tc = {}; terr = o;
        g.attributes.color.array.set(terrTo(season)); g.attributes.color.needsUpdate = true;
      }
    }
    if (dynG) for (const o of dynG.children) if (o.isMesh && o.userData.roof === undefined) prepRoof(o); /* houses can be rebuilt too (a new resident moves in) */
  }
  function setSeason(s, instant) {
    scan(); season = s; setFalling(s); paint();
    if (s === 'winter') winterT0 = performance.now();
    if (leafMesh) leafMesh.visible = s === 'autumn';
    if (instant) {
      tw = null; copyL(cur, SEA[s]); applyLights(cur);
      if (terr) { terr.geometry.attributes.color.array.set(terrTo(s)); terr.geometry.attributes.color.needsUpdate = true; }
      treeMeshes().forEach(m => { m.instanceColor.array.set(treeTarget(m, s)); m.instanceColor.needsUpdate = true; });
      return;
    }
    tw = { t: 0, from: cloneL(cur), to: SEA[s], terr: null, trees: [] };
    if (terr) { const a = terr.geometry.attributes.color; tw.terr = { a, from: Float32Array.from(a.array), to: terrTo(s) }; }
    treeMeshes().forEach(m => tw.trees.push({ m, from: Float32Array.from(m.instanceColor.array), to: treeTarget(m, s) }));
  }
  const lerpInto = (arr, f, t, e) => { for (let i = 0; i < arr.length; i++) arr[i] = f[i] + (t[i] - f[i]) * e; };
  function tick(dt, T) {
    if (camera.position.x > 3000) return; /* inside a home: wait until you are back outside */
    if (tw) {
      tw.t += dt / .9; const k = Math.min(1, tw.t), e = k * k * (3 - 2 * k);
      mixL(tw.from, tw.to, e, cur); applyLights(cur);
      if (tw.terr) { lerpInto(tw.terr.a.array, tw.terr.from, tw.terr.to, e); tw.terr.a.needsUpdate = true; }
      tw.trees.forEach(q => { lerpInto(q.m.instanceColor.array, q.from, q.to, e); q.m.instanceColor.needsUpdate = true; });
      if (k >= 1) tw = null;
    }
    /* snow on the roofs: 0 in every season except winter */
    if (dynG) {
      const sa = season === 'winter' ? snowAmount((performance.now() - winterT0) / 1000) : 0;
      for (const o of dynG.children) if (o.userData.roof) paintRoof(o, sa);
    }
    /* autumn: the leaves on the ground are made when the trees are known (and again when the trees are replanted) */
    if (season === 'autumn' && (!leafMesh || treesDirty)) buildLeaves();
    moveFalling(dt, T);
  }
  const origRender = rend.render.bind(rend); let last = performance.now();
  rend.render = function (s, c) {
    const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
    scan(); tick(dt, now / 1000); origRender(s, c);
  };

  /* ---------- the button ---------- */
  const btn = $('vSeason');
  function paint() {
    if (!btn) return;
    btn.innerHTML = '<svg viewBox="0 0 24 24">' + ICON[season] + '</svg>';
    const l = 'Season: ' + NAME[season] + '. Tap to change'; btn.setAttribute('aria-label', l); btn.title = l;
  }
  let tt = 0;
  if (btn) btn.addEventListener('click', () => {
    const s = ORDER[(ORDER.indexOf(season) + 1) % ORDER.length]; setSeason(s);
    const t = $('toast'); if (!t) return;
    t.textContent = NAME[s] + (s === REAL ? ' (right now)' : ''); t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 1800);
  });
  setSeason(season, true);
  nv.season = { get: () => season, set: s => ORDER.includes(s) && setSeason(s), real: REAL };
});
