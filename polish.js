/* Nestville polish: a smaller sun and more natural water.
   Works on the live scene (window.__nv), next to town.js and seasons.js. It is loaded from streets.js, so index.html does not change.
   The sun is set HERE and only here (smallsun.js is retired). Tune: SUN_DISC (size of the sun, smaller number = smaller sun), the three WATER colours, FRESNEL (how much sky shows on the water at a low angle).
   The lake's depth colours, shallows and shore foam are in realwater.js and sit on top of this. */
function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

/* ---------- sun: a small bright disc with a tight soft glow (it was a huge hazy halo) ---------- */
const SUN_DISC = 0.6; /* 1 = about the size of a coin at arm's length. 0.6 is a small sun, 0.4 smaller, 1.5 bigger */
const e1 = (1 - 0.00018 * SUN_DISC * SUN_DISC).toFixed(6), e2 = (1 - 0.00008 * SUN_DISC * SUN_DISC).toFixed(6);
const SKY_FRAG = 'uniform vec3 top,mid,hor,sunDir;varying vec3 vP;void main(){float h=clamp(vP.y,0.,1.);vec3 c=mix(hor,mid,smoothstep(0.,.18,h));c=mix(c,top,smoothstep(.15,.85,h));float s=max(dot(normalize(vP),sunDir),0.);c+=vec3(1.,.95,.8)*(smoothstep(' + e1 + ',' + e2 + ',s)*1.4+pow(s,700.)*.2+pow(s,250.)*.06);gl_FragColor=vec4(c,1.);}';
function fixSun(nv) {
  const sky = nv.scene.children.find(o => o.isMesh && o.material && o.material.isShaderMaterial && o.material.uniforms && o.material.uniforms.sunDir);
  if (!sky || sky.material.userData.nvSun) return;
  sky.material.userData.nvSun = 1; sky.material.fragmentShader = SKY_FRAG; sky.material.needsUpdate = true;
}

/* ---------- water: deep natural blue-green, softer glint, calmer ripples, and the sky shows on it at a low angle ---------- */
const WATER = { lake: '#2f7a93', river: '#4d9db4', canal: '#3f90a6' };
const FRESNEL = 'float nvFr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);\noutgoingLight = mix(outgoingLight, vec3(.66, .8, .9), clamp(nvFr * .55, 0., .55));\n';
function fixWater(nv) {
  let changed = false;
  nv.scene.traverse(o => {
    if (!o.isMesh || !o.material || !o.material.isMeshPhongMaterial) return;
    const m = o.material; if (m.userData.nvWater) return; m.userData.nvWater = 1; changed = true;
    const lake = m.transparent && m.opacity > .9, river = m.transparent && !lake, c = lake ? WATER.lake : river ? WATER.river : WATER.canal;
    m.color.set(c); if (m.userData.c0) m.userData.c0.set(c); /* seasons.js keeps its own copy of the colour */
    m.specular.set('#c9d6da'); m.shininess = 140; if (lake) m.opacity = .96;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      sh.fragmentShader = sh.fragmentShader
        .replace('(nvG.x, 0., nvG.y, 0.)).xyz * 0.20', '(nvG.x, 0., nvG.y, 0.)).xyz * 0.11')
        .replace('smoothstep(.95, 1.35, nvCrest) * 0.20', 'smoothstep(1.1, 1.5, nvCrest) * 0.08')
        .replace('#include <opaque_fragment>', FRESNEL + '#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => 'nvwater-real';
    m.needsUpdate = true;
  });
  if (changed && nv.season && nv.season.get) nv.season.set(nv.season.get()); /* re-applies the season tint on top of the new colours */
}

ready(nv => {
  const go = () => { try { fixSun(nv); fixWater(nv); } catch (e) { console.warn('polish', e); } };
  go(); setTimeout(go, 700); setTimeout(go, 2500);
});
