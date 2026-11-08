/* Nestville realwater: a lake that looks and moves like real water.
   Adds to the lake's existing water material in place (same material, so polish.js colours and the season tint in seasons.js still work):
   - REAL WAVES: four long swells roll across the lake (they lift and lower the surface, and shade the water light and dark on the crests and troughs),
     plus two finer ripple trains for texture. The shore stays calm, so boats and piers are not swallowed.
   - the old little glitter dots and white sparkles are switched off, and the sun shine on the water is much softer
   - colour by DEPTH: pale minty aqua near the shore, clear turquoise-blue in the middle (depth is baked once from the terrain height)
   - soft see-through shallows, and a thin pale rim where the water meets the land
   The sky reflection comes from polish.js.
   The depth colours are multiplied by (current water colour / its base colour), so polish.js and the seasons recolour them.
   Runs next to town.js and reads the same scene (window.__nv).
   Tune: SWELL (how high the big waves are, 1 = normal), BUMP (how strongly the waves shade the water), SHINE (sun shine left, 0 = none),
   SHAL / DEEP (colours, linear), DEEPAT (smaller = brighter lake), FOAM (rim strength). */
import * as THREE from './lib.js';
import { H, WL } from './world.js';

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

const SHAL = 'vec3(.38, .75, .64)', DEEP = 'vec3(.08, .42, .52)', DEEPAT = '5.', FOAM = '.6';
const SWELL = '1.', BUMP = '6.', SHINE = '.12';

/* the wave functions, shared by the vertex and the fragment shader. p = world x, z. Height h (units) and its slope g (for the shading) */
const WAVES = `
float nvSwH(vec2 p, float t) {
  return (.22 * sin(dot(p, vec2(.74, .67)) * .045 + t * .55) + .15 * sin(dot(p, vec2(-.6, .8)) * .07 + t * .7) + .08 * sin(dot(p, vec2(.97, -.25)) * .13 + t * 1.0) + .05 * sin(dot(p, vec2(-.3, -.95)) * .21 + t * 1.25)) * ${SWELL};
}
vec2 nvSwG(vec2 p, float t) {
  return (vec2(.74, .67) * (.22 * .045) * cos(dot(p, vec2(.74, .67)) * .045 + t * .55) + vec2(-.6, .8) * (.15 * .07) * cos(dot(p, vec2(-.6, .8)) * .07 + t * .7)
    + vec2(.97, -.25) * (.08 * .13) * cos(dot(p, vec2(.97, -.25)) * .13 + t * 1.0) + vec2(-.3, -.95) * (.05 * .21) * cos(dot(p, vec2(-.3, -.95)) * .21 + t * 1.25)
    + vec2(.5, .87) * .012 * cos(dot(p, vec2(.5, .87)) * .4 + t * 1.5) + vec2(-.9, .43) * .013 * cos(dot(p, vec2(-.9, .43)) * .65 + t * 1.9)) * ${SWELL};
}
`;

ready(nv => {
  const world = nv.scene.children.find(o => o.isGroup);
  const lake = world && world.children.find(o => o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 420 && o.geometry.parameters.height === 250);
  if (!lake) return;
  const geo = lake.geometry, mat = lake.material, p = geo.attributes.position.array, n = p.length / 3, d = new Float32Array(n);
  /* how deep is the lake under every water vertex (negative = land) */
  for (let i = 0; i < n; i++) d[i] = Math.max(-1, WL - H(lake.position.x + p[i * 3], lake.position.z + p[i * 3 + 2]));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(d, 1));
  const LZ = lake.position.z.toFixed(1); /* the lake plane sits at this z, so local z + LZ = world z */

  const prev = mat.onBeforeCompile; /* town.js added the old ripples: keep the plumbing, then add the depth look and the real waves on top */
  mat.onBeforeCompile = function (sh) {
    if (prev) prev.call(mat, sh);
    /* the lake's base colour (what the seasons start from); the shader divides by it, so summer = 1 and other seasons tint the depth colours */
    const b = mat.userData.c0 || mat.color, base = 'vec3(' + Math.max(.001, b.r).toFixed(4) + ',' + Math.max(.001, b.g).toFixed(4) + ',' + Math.max(.001, b.b).toFixed(4) + ')';
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDepth;\nvarying float vDepth;\nuniform float uT;' + WAVES)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDepth = aDepth;\ntransformed.y += nvSwH(vec2(position.x, position.z + ' + LZ + '), uT) * smoothstep(0., 2.5, aDepth);');
    sh.fragmentShader = sh.fragmentShader
      /* switch the old glitter off: the old ripple bend and the white crest sparkles */
      .replace('(nvG.x, 0., nvG.y, 0.)).xyz * 0.20', '(nvG.x, 0., nvG.y, 0.)).xyz * 0.00')
      .replace('smoothstep(.95, 1.35, nvCrest) * 0.20', 'smoothstep(.95, 1.35, nvCrest) * 0.00')
      .replace('#include <common>', '#include <common>\nvarying float vDepth;' + WAVES)
      .replace('#include <color_fragment>', `#include <color_fragment>
float nvDk = smoothstep(.15, ${DEEPAT}, vDepth);
vec3 nvTint = clamp(diffuseColor.rgb / ${base}, 0., 4.);
diffuseColor.rgb = mix(${SHAL}, ${DEEP}, nvDk) * nvTint;
diffuseColor.rgb *= 1. + nvSwH(vWP.xz, uT) * .12;
diffuseColor.a = mix(.72, .97, smoothstep(0., 3., vDepth));
float nvSh = 1. - smoothstep(0., .6, vDepth + sin(vWP.x * .9 + uT * 1.1) * .08 + sin(vWP.z * 1.1 - uT * .9) * .08);
float nvFo = clamp(nvSh * (.6 + .4 * sin(vWP.x * 2.3 + vWP.z * 1.7 + uT * 1.5)), 0., 1.);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.85, .92, .92), nvFo * ${FOAM});
diffuseColor.a = mix(diffuseColor.a, 1., nvFo * .5);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec2 nvWg = nvSwG(vWP.xz, uT);
normal = normalize(normal + (viewMatrix * vec4(-nvWg.x, 0., -nvWg.y, 0.)).xyz * ${BUMP});`)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directSpecular *= ' + SHINE + ';');
  };
  mat.customProgramCacheKey = () => 'nvwater4';
  mat.needsUpdate = true;
});
