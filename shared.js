/* Nestville shared data: state, demo residents, avatars, preview stats */
export const KINDS = ['Bakery', 'Nail salon', 'Hair salon', 'Cafe', 'Flower shop', 'Barber'];
export const PH_PRICES = Array.from({ length: 10 }, (_, i) => 150000 + i * 10000);
export const SHOP_PRICE = 50000;
export const IG_DM = ''; /* Paste your Instagram DM link here when buying goes live */
export const fmt = n => n.toLocaleString('en-US') + ' IRT';

export const DEMO = ['mia.codes', 'alex_trav', 'sofia.lens', 'noor.designs', 'leo_makes', 'kian.fit', 'zara.eats', 'omid.dev',
  'luna_art', 'dara.films', 'sam.builds', 'yara.moves', 'jay_wanders', 'tina.bakes', 'arman.pix', 'eli.writes', 'niko_reels',
  'bella.home', 'rami.sounds', 'chloe.cafe', 'amir_gym', 'sara.plants', 'ben.studio', 'maya.cooks', 'kaveh.tv', 'ola_travels',
  'pari.nails', 'theo.skate', 'nila.glow', 'hugo.drone', 'ava.styles', 'reza.cuts', 'ida.paints', 'finn.trails', 'roya.lens',
  'milo.codes', 'sina.sets', 'lia.daily', 'cyrus.fx', 'emma.yoga'];

const KEY = 'nv3';
export function load() {
  let S = { houses: [], ph: Array(10).fill(null), shops: Array(6).fill(null), seeded: 0 };
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (x && x.houses) S = Object.assign(S, x);
    else {
      const old = JSON.parse(localStorage.getItem('nv2') || 'null');
      if (old && old.houses) {
        S.houses = old.houses.filter(h => h.code !== 'DEMO');
        if (old.shops) S.shops = old.shops;
        if (old.ph) S.ph = old.ph;
      }
    }
  } catch (e) { }
  if (!S.seeded) {
    DEMO.forEach(u => { if (!S.houses.some(h => h.u === u)) S.houses.push({ u, code: 'DEMO' }); });
    S.seeded = 1;
  }
  return S;
}
export function save(S) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

export const hs = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/* Friendly round avatar generated from the handle */
const SKIN = ['#f1c9a5', '#e0a97d', '#c68a5c', '#a56a43', '#7b4a2e'];
const HAIR = ['#2b2118', '#5a3a22', '#b5732f', '#d9a441', '#8c8c8c', '#1d1d24'];
const SHIRT = ['#3f7fb5', '#d9623f', '#4f9d69', '#8a62c4', '#e0a526', '#d9577f', '#2f8f9d'];
const BG = ['#fbeed0', '#e1f0f4', '#f6dfe0', '#e4efd8', '#ece3f7'];
export function avatar(u, size = 44) {
  const r = rng(hs(u) + 11), p = a => a[(r() * a.length) | 0];
  const sk = p(SKIN), hr = p(HAIR), sh = p(SHIRT), bg = p(BG), long = r() > .55;
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="${bg}"/>` +
    `<path d="M10 64c2-14 12-20 22-20s20 6 22 20z" fill="${sh}"/>` +
    `<rect x="27" y="36" width="10" height="10" rx="4" fill="${sk}"/>` +
    (long ? `<path d="M15 34c-3-16 6-24 17-24s20 8 17 24c-2 3-5 4-7 4V26H22v12c-2 0-5-1-7-4z" fill="${hr}"/>` : '') +
    `<ellipse cx="32" cy="30" rx="12" ry="13" fill="${sk}"/>` +
    `<path d="M19.500 28c-1-9 5-14 12.500-14s13.500 5 12.500 14c-3-4-7-6-12.500-6S22.500 24 19.500 28z" fill="${hr}"/>` +
    `<circle cx="27" cy="31" r="1.500" fill="#2b2118"/><circle cx="37" cy="31" r="1.500" fill="#2b2118"/>` +
    `<path d="M28 37c2.500 2 5.500 2 8 0" stroke="#7a3f2c" stroke-width="1.600" fill="none" stroke-linecap="round"/></svg>`;
}

/* Preview standings. Deterministic from the handle so the board feels alive before launch. */
export function stats(u) {
  const r = rng(hs(u) * 7 + 3);
  return { coins: 90000 + Math.floor(r() * 820000), land: 1 + Math.floor(r() * 9), streak: 2 + Math.floor(r() * 120) };
}
