/* Nestville realwater: lake water like the photo (bright clear turquoise, pale shallows, soft rim).
   Adds to the lake's existing water material in place (same material, so polish.js colours and the season tint in seasons.js still work):
   - colour by DEPTH: pale minty aqua near the shore, clear turquoise-blue in the middle (depth is baked once from the terrain height)
   - soft see-through shallows, so the lake bed shows near the shore
   - a thin pale rim that moves a little where the water meets the land
   The sky reflection and the sun glint come from polish.js (not doubled here).
   The depth colours are multiplied by (current water colour / its base colour), so polish.js and the seasons recolour them.
   Runs next to town.js and reads the same scene (window.__nv).
   Tune: SHAL / DEEP (colours, linear), DEEPAT (depth in units where it reaches the deep colour; smaller = brighter lake), FOAM (rim strength). */
import * as THREE from './lib.js';
import { H, WL } from './world.js';

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

const SHAL = 'vec3(.38, .75, .64)', DEEP = 'vec3(.08, .42, .52)', DEEPAT = '5.', FOAM = '.6';

ready(nv => {
  const world = nv.scene.children.find(o => o.isGroup);
  const lake = world && world.children.find(o => o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 420 && o.geometry.parameters.height === 250);
  if (!lake) return;
  const geo = lake.geometry, mat = lake.material, p = geo.attributes.position.array, n = p.length / 3, d = new Float32Array(n);
  /* how deep is the lake under every water vertex (negative = land) */
  for (let i = 0; i < n; i++) d[i] = Math.max(-1, WL - H(lake.position.x + p[i * 3], lake.position.z + p[i * 3 + 2]));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(d, 1));

  const prev = mat.onBeforeCompile; /* town.js added the ripples (and polish.js tunes them): keep them and add the depth look on top */
  mat.onBeforeCompile = function (sh) {
    if (prev) prev.call(mat, sh);
    /* the lake's base colour (what the seasons start from); the shader divides by it, so summer = 1 and other seasons tint the depth colours */
    const b = mat.userData.c0 || mat.color, base = 'vec3(' + Math.max(.001, b.r).toFixed(4) + ',' + Math.max(.001, b.g).toFixed(4) + ',' + Math.max(.001, b.b).toFixed(4) + ')';
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDepth;\nvarying float vDepth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDepth = aDepth;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vDepth;')
      .replace('#include <color_fragment>', `#include <color_fragment>
float nvDk = smoothstep(.15, ${DEEPAT}, vDepth);
vec3 nvTint = clamp(diffuseColor.rgb / ${base}, 0., 4.);
diffuseColor.rgb = mix(${SHAL}, ${DEEP}, nvDk) * nvTint;
diffuseColor.a = mix(.72, .97, smoothstep(0., 3., vDepth));
float nvSh = 1. - smoothstep(0., .6, vDepth + sin(vWP.x * .9 + uT * 1.1) * .08 + sin(vWP.z * 1.1 - uT * .9) * .08);
float nvFo = clamp(nvSh * (.6 + .4 * sin(vWP.x * 2.3 + vWP.z * 1.7 + uT * 1.5)), 0., 1.);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.85, .92, .92), nvFo * ${FOAM});
diffuseColor.a = mix(diffuseColor.a, 1., nvFo * .5);`);
  };
  mat.customProgramCacheKey = () => 'nvwater3';
  mat.needsUpdate = true;
});
