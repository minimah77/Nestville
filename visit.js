/* Nestville visits: tap any unsold house, shop, cottage or penthouse, then "Look inside" to walk around the empty home before buying.
   (The green dots are gone: empty houses are marked by the small sign from extras.js.)
   Runs next to town.js and reads the same scene (window.__nv). */
import * as THREE from './lib.js';
import { buildRoom } from './rooms.js';
import { IG_DM, KINDS, fmt, PH_PRICES, SHOP_PRICE, COT_PRICES } from './shared.js';

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const OX = 6000, OZ = 6000;

ready(nv => {
  const S = nv.S, scene = nv.scene, camera = nv.camera, ents = nv.ents;
  const empty = e => e.kind === 'house' ? !S.houses[e.ref.idx] : e.kind === 'shop' ? !S.shops[e.ref.i] : e.kind === 'cot' ? !S.cot[e.ref.i] : e.kind === 'ph' ? !S.ph[e.ref.i] : false;
  const specOf = e => e.kind === 'house' ? { kind: 'house', n: e.ref.idx } : e.kind === 'shop' ? { kind: 'shop', n: e.ref.i, name: KINDS[e.ref.i] } : e.kind === 'cot' ? { kind: 'cot', n: e.ref.i } : { kind: 'ph', n: e.ref.i };
  const priceOf = e => e.kind === 'ph' ? PH_PRICES[e.ref.i] : e.kind === 'shop' ? SHOP_PRICE : e.kind === 'cot' ? COT_PRICES[e.ref.i] : 0;
  const word = { house: 'house', shop: 'shop', cot: 'cottage', ph: 'penthouse' };

  /* ---------- "Look inside" button on the card ---------- */
  const card = $('card');
  function addBtn() {
    const e = nv.sel; if (!e || visiting || !empty(e) || card.querySelector('[data-visit]')) return;
    const w = word[e.kind]; if (!w) return;
    card.insertAdjacentHTML('beforeend', '<div style="display:flex;align-items:center;gap:8px;margin-top:10px"><span style="font-size:12px;font-weight:700;color:#1c7a4c">This ' + w + ' is empty</span><span style="flex:1"></span><button data-visit class="pb g" style="height:28px;padding:0 11px;font-size:12px;border-radius:12px">Look inside</button></div>');
  }
  new MutationObserver(addBtn).observe(card, { childList: true });
  card.addEventListener('click', ev => { if (ev.target.closest('[data-visit]') && nv.sel) enter(nv.sel); });

  /* ---------- the visit screen ---------- */
  const ico = {
    cut: '<path d="M4 9l8-5 8 5v8l-8 5-8-5zM4 9l8 5 8-5M12 14v8"/>',
    liv: '<path d="M5 12V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4H3zM6 17v2M18 17v2"/>',
    bed: '<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11.5" r="1.3"/>',
    view: '<path d="M3 19l6-9 4 6 2-3 6 6z"/><circle cx="17" cy="6.5" r="1.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  const bar = document.createElement('div');
  bar.id = 'visit'; bar.className = 'gl';
  bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);max-width:540px;margin:auto;border-radius:22px;padding:8px 10px;display:none;z-index:6';
  document.body.appendChild(bar);
  const hint = document.createElement('div');
  hint.className = 'gl'; hint.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 12px);transform:translateX(-50%);border-radius:99px;padding:6px 14px;font-weight:700;font-size:12px;display:none;z-index:6;white-space:nowrap';
  hint.textContent = 'Drag to look around'; document.body.appendChild(hint);
  const HIDE = ['labels', 'card', 'bar', 'views', 'sheet', 'top'];

  /* ---------- panorama: mountains and lake seen through the windows ---------- */
  let panoTex = null, discTex = null;
  function mkRng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function ridge(ctx, W, base, amp, seed, color, snowY) {
    const R = mkRng(seed), ks = [1, 2, 3, 5, 8, 13, 21, 34], ph = ks.map(() => R() * 6.28), am = ks.map((k, i) => (1 / (1 + i * .9)) * (.6 + R() * .8));
    const hgt = x => { let s = 0; for (let i = 0; i < ks.length; i++) s += am[i] * Math.sin(2 * Math.PI * ks[i] * x / W + ph[i]); return s; };
    const path = () => { ctx.beginPath(); ctx.moveTo(0, base + 4); for (let x = 0; x <= W; x += 4) ctx.lineTo(x, base - amp * (.5 + hgt(x) / 5)); ctx.lineTo(W, base + 4); ctx.closePath(); };
    path(); ctx.fillStyle = color; ctx.fill();
    if (snowY) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, snowY); ctx.clip(); path(); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill(); ctx.restore(); }
  }
  function makeTex() {
    if (panoTex) return;
    const W = 2048, Hc = 512, c = document.createElement('canvas'); c.width = W; c.height = Hc; const x = c.getContext('2d');
    let g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#4f9bd0'); g.addColorStop(1, '#d6eaf0'); x.fillStyle = g; x.fillRect(0, 0, W, 257);
    const R = mkRng(55); x.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < 16; i++) { const cx = R() * W, cy = 40 + R() * 100; for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(cx + k * 34 - 50, cy + (k % 2) * 6, 50 + R() * 30, 12 + R() * 6, 0, 0, 6.3); x.fill(); } }
    ridge(x, W, 256, 120, 11, '#9ab7cf', 168); ridge(x, W, 256, 78, 23, '#6f9690', 0); ridge(x, W, 258, 40, 37, '#4d7a5e', 0);
    g = x.createLinearGradient(0, 256, 0, 512); g.addColorStop(0, '#a5d0d8'); g.addColorStop(1, '#8cc7d2'); x.fillStyle = g; x.fillRect(0, 258, W, 254);
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; for (let i = 0; i < 90; i++) { const px = R() * W, py = 266 + R() * 220; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 14 + R() * 26, py); x.stroke(); }
    panoTex = new THREE.CanvasTexture(c); panoTex.colorSpace = THREE.SRGBColorSpace;
    const d = document.createElement('canvas'); d.width = d.height = 256; const y = d.getContext('2d');
    const rg = y.createRadialGradient(128, 128, 0, 128, 128, 128); rg.addColorStop(0, '#1f7886'); rg.addColorStop(.5, '#3f9aaa'); rg.addColorStop(1, '#a5d0d8'); y.fillStyle = rg; y.fillRect(0, 0, 256, 256);
    discTex = new THREE.CanvasTexture(d); discTex.colorSpace = THREE.SRGBColorSpace;
  }

  /* ---------- camera state ---------- */
  let visiting = false, snap = null, room = null, ent = null, outer = null, pano = null, disc = null, mode = 'cut', camIdx = 0, hemi = null, hemiSave = null;
  const P = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 60 };
  const D = { oyaw: .25, opitch: .7, dist: 20, fyaw: 0, fpitch: 0, fpos: new THREE.Vector3(), ffov: 72, tgt: new THREE.Vector3() };
  const tmpO = new THREE.Object3D(), eul = new THREE.Euler(0, 0, 0, 'YXZ'), want = new THREE.Vector3(), wantQ = new THREE.Quaternion();
  let lastT = 0, snapNext = false;

  function setMode(m, i) {
    mode = m; camIdx = i || 0; room.cap.visible = m !== 'cut';
    if (m === 'cut') { D.oyaw = .25; D.opitch = .7; D.tgt.set(OX, 1.1, OZ); D.dist = Math.max(room.W, room.D * 1.3) * 1.18; }
    else { const c = room.cams[i]; D.fpos.set(OX + c.x, c.y, OZ + c.z); D.fyaw = c.yaw; D.fpitch = c.pitch; D.ffov = c.fov; }
    bar.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === m + (m === 'cut' ? '' : i)));
  }
  function applyCam() {
    const now = performance.now(), dt = Math.min(.1, (now - (lastT || now)) / 1000); lastT = now;
    const k = 1 - Math.exp(-dt * 5);
    if (mode === 'cut') {
      const cp = Math.cos(D.opitch);
      want.set(D.tgt.x + Math.sin(D.oyaw) * cp * D.dist, D.tgt.y + Math.sin(D.opitch) * D.dist, D.tgt.z + Math.cos(D.oyaw) * cp * D.dist);
      tmpO.position.copy(want); tmpO.lookAt(D.tgt); wantQ.copy(tmpO.quaternion);
    } else { want.copy(D.fpos); eul.set(D.fpitch, D.fyaw, 0); wantQ.setFromEuler(eul); }
    const fov = mode === 'cut' ? 52 : D.ffov;
    if (snapNext) { P.pos.copy(want); P.quat.copy(wantQ); P.fov = fov; snapNext = false; }
    else { P.pos.lerp(want, k); P.quat.slerp(wantQ, k); P.fov += (fov - P.fov) * k; }
    camera.position.copy(P.pos); camera.quaternion.copy(P.quat); camera.fov = P.fov * (innerWidth / innerHeight < .75 ? 1.12 : 1);
    camera.near = .1; camera.far = 700; camera.updateProjectionMatrix();
  }
  const rend = nv.renderer, origRender = rend.render.bind(rend);
  rend.render = function (s, c) { if (visiting) applyCam(); origRender(s, c); };

  /* ---------- drag to look ---------- */
  const cv = nv.renderer.domElement, ptrs = new Set(); let lx = 0, ly = 0;
  cv.addEventListener('pointerdown', e => { ptrs.add(e.pointerId); lx = e.clientX; ly = e.clientY; });
  const up = e => { ptrs.delete(e.pointerId); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointermove', e => {
    if (!visiting || !ptrs.has(e.pointerId) || ptrs.size !== 1) { lx = e.clientX; ly = e.clientY; return; }
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    if (mode === 'cut') { D.oyaw = clamp(D.oyaw - dx * .006, -1.4, 1.4); D.opitch = clamp(D.opitch + dy * .005, .2, 1.35); }
    else { D.fyaw += dx * .005; D.fpitch = clamp(D.fpitch - dy * .004, -.7, .7); }
  });
  cv.addEventListener('wheel', e => { if (visiting && mode === 'cut') D.dist = clamp(D.dist * Math.exp(e.deltaY * .001), 8, 60); }, { passive: true });

  /* ---------- enter / leave ---------- */
  let toastT = 0;
  function say(m) { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
  function enter(e) {
    if (visiting) return; makeTex();
    ent = e; room = buildRoom(specOf(e));
    snap = { cam: { ...nv.cam }, goal: { ...nv.goal }, mode: nv.view.mode, fog: scene.fog, near: camera.near, far: camera.far };
    outer = new THREE.Group(); outer.position.set(OX, 0, OZ);
    outer.add(room.group);
    const eye = room.isPh ? 1.7 : 1.6;
    pano = new THREE.Mesh(new THREE.CylinderGeometry(160, 160, 300, 48, 1, true), new THREE.MeshBasicMaterial({ map: panoTex, side: THREE.BackSide, fog: false, toneMapped: false }));
    pano.position.y = eye; outer.add(pano);
    disc = new THREE.Mesh(new THREE.CircleGeometry(160, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: discTex, fog: false, toneMapped: false }));
    disc.position.y = room.isPh ? -40 : -.6; outer.add(disc);
    scene.add(outer);
    scene.fog = null; hemi = scene.children.find(o => o.isHemisphereLight);
    if (hemi) { hemiSave = [hemi.intensity, hemi.groundColor.getHex()]; hemi.intensity = 1.55; hemi.groundColor.set('#fff1dc'); }
    HIDE.forEach(id => { const el = $(id); if (el) el.style.display = 'none'; });
    const price = priceOf(e), title = room.title + ' · ' + room.sub;
    const btn = (id, ic, label) => '<button class="ib" data-cam="' + id + '" aria-label="' + label + '" title="' + label + '"><svg viewBox="0 0 24 24">' + ico[ic] + '</svg></button>';
    bar.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:0 4px 6px"><b style="font:600 16px var(--fd)">' + title + '</b><span style="font-size:12.5px;color:var(--mute);font-weight:700">' + (price ? fmt(price) : 'Empty') + '</span></div>' +
      '<div style="display:flex;gap:2px;align-items:center">' + btn('cut', 'cut', 'Cut-away view') + btn('fp0', 'liv', e.kind === 'shop' ? 'From the door' : 'Living room') + btn('fp1', 'bed', e.kind === 'shop' ? 'From the back' : 'Bedroom') +
      (room.isPh ? '<button class="ib" data-cam="roof" aria-label="View from the roof" title="View from the roof"><svg viewBox="0 0 24 24">' + ico.view + '</svg></button>' : '') +
      '<span style="flex:1"></span>' + (price ? '<button class="pb gold" data-b="buy" style="height:34px;padding:0 14px;font-size:13px;border-radius:13px">Buy</button>' : '') + '<button class="ib" data-b="exit" aria-label="Leave" title="Leave"><svg viewBox="0 0 24 24">' + ico.x + '</svg></button></div>';
    bar.style.display = 'block'; hint.style.display = 'block'; setTimeout(() => { hint.style.display = 'none'; }, 3200);
    visiting = true; snapNext = true; lastT = 0; setMode('cut');
  }
  function leave(toRoof) {
    if (!visiting) return; visiting = false;
    scene.remove(outer); [pano, disc].forEach(m => { m.geometry.dispose(); m.material.dispose(); }); pano = disc = outer = null;
    scene.fog = snap.fog; if (hemi && hemiSave) { hemi.intensity = hemiSave[0]; hemi.groundColor.setHex(hemiSave[1]); }
    camera.near = 1; camera.far = 3500; camera.quaternion.identity(); camera.updateProjectionMatrix();
    Object.assign(nv.cam, snap.cam); Object.assign(nv.goal, snap.goal); nv.view.mode = snap.mode;
    bar.style.display = 'none'; hint.style.display = 'none';
    HIDE.forEach(id => { const el = $(id); if (el) el.style.display = ''; });
    const e = ent; ent = null;
    if (toRoof && e && e.kind === 'ph') { nv.select(null); nv.view.pi = e.ref.i; nv.setView('ph'); }
    else if (e) nv.select(e, true);
  }
  bar.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.b === 'exit') leave(false);
    else if (b.dataset.b === 'buy') { if (IG_DM) window.open(IG_DM, '_blank', 'noopener'); else say('Buying opens soon. Message me on Instagram to reserve it.'); }
    else if (b.dataset.cam === 'cut') setMode('cut');
    else if (b.dataset.cam === 'roof') leave(true);
    else if (b.dataset.cam) setMode('fp', +b.dataset.cam.slice(2));
  });
});
