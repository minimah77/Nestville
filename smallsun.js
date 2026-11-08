/* Nestville smallsun: the sun in the sky is smaller (step 2 of the look fix).
   The sky shader in town.js drew the sun as a tight glow (power 48) plus a very wide halo (power 6), so it looked huge.
   Here the same shader line is swapped in place for a smaller disc and a much tighter halo. Season colours are untouched.
   Tune: DISC (higher = smaller sun), HALO (higher = smaller glow), the two numbers after them are brightness.
   Runs next to town.js and reads the same scene (window.__nv). */
function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

const OLD = 'pow(s,48.)*.5+pow(s,6.)*.12';
const DISC = '160.', HALO = '14.', DISC_I = '.6', HALO_I = '.08';

ready(nv => {
  const sky = nv.scene.children.find(o => o.isMesh && o.material && o.material.isShaderMaterial && o.material.uniforms && o.material.uniforms.sunDir);
  if (!sky) return;
  const m = sky.material;
  if (m.fragmentShader.indexOf(OLD) < 0) return;
  m.fragmentShader = m.fragmentShader.replace(OLD, 'pow(s,' + DISC + ')*' + DISC_I + '+pow(s,' + HALO + ')*' + HALO_I);
  m.needsUpdate = true;
});
