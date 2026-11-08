/* Nestville realwater: a more natural lake (step 1 of the look fix).
   Upgrades the lake's existing water material in place (same material, so the season tint in seasons.js still works):
   - colour by DEPTH: clear turquoise near the shore, dark teal in the middle (depth is baked once from the terrain height)
   - soft see-through shallows, so the lake bed shows near the shore like real water
   - a thin moving foam line where the water meets the land
   - sky reflection that grows toward the horizon (fresnel), so the far lake looks like a mirror of the sky
   - a smaller, softer sun glint
   Runs next to town.js and reads the same scene (window.__nv).
   Tune: SHAL / DEEP (colours, linear), DEEPAT (depth in units where it is fully dark), FOAM (foam strength), SKYREF (sky mirror strength). */
import * as THREE from './lib.js';
import { H, WL } from './world.js';
import './smallsun.js'; /* step 2: smaller sun in the sky */

function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

const SHAL = 'vec3(.17, .52, .50)', DEEP = 'vec3(.006, .08, .15)', DEEPAT = '7.', FOAM = '.6', SKYREF = '.55';

ready(nv => {
  const world = nv.scene.children.find(o => o.isGroup);
  const lake = world && world.children.find(o => o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 420 && o.geometry.parameters.height === 250);
  if (!lake) return;
  const geo = lake.geometry, mat = lake.material, p = geo.attributes.position.array, n = p.length / 3, d = new Float32Array(n);
  /* how deep is the lake under every water vertex (negative = land) */
  for (let i = 0; i < n; i++) d[i] = Math.max(-1, WL - H(lake.position.x + p[i * 3], lake.position.z + p[i * 3 + 2]));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(d, 1));

  mat.specular.set('#d9d0bb'); mat.shininess = 110;
  const prev = mat.onBeforeCompile; /* town.js already added the moving ripples: keep them and add the depth look on top */
  mat.onBeforeCompile = function (sh) {
    if (prev) prev.call(mat, sh);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDepth;\nvarying float vDepth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDepth = aDepth;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vDepth;')
      .replace('#include <color_fragment>', `#include <color_fragment>
float nvDk = smoothstep(.15, ${DEEPAT}, vDepth);
vec3 nvTint = clamp(diffuseColor.rgb / vec3(.0612, .381, .565), 0., 4.);
diffuseColor.rgb = mix(${SHAL}, ${DEEP}, nvDk) * nvTint;
diffuseColor.a = mix(.5, .97, smoothstep(0., 3., vDepth));
float nvSh = 1. - smoothstep(0., .6, vDepth + sin(vWP.x * .9 + uT * 1.1) * .08 + sin(vWP.z * 1.1 - uT * .9) * .08);
float nvFo = clamp(nvSh * (.6 + .4 * sin(vWP.x * 2.3 + vWP.z * 1.7 + uT * 1.5)), 0., 1.);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.85, .92, .92), nvFo * ${FOAM});
diffuseColor.a = mix(diffuseColor.a, 1., nvFo * .5);`)
      .replace('#include <tonemapping_fragment>', `{ vec3 nvV = normalize(vViewPosition); float nvF = pow(1. - clamp(dot(nvV, normalize(normal)), 0., 1.), 4.);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(.30, .52, .78), nvF * ${SKYREF} * (1. - nvFo)); }
#include <tonemapping_fragment>`);
  };
  mat.customProgramCacheKey = () => 'nvwater2';
  mat.needsUpdate = true;
});
