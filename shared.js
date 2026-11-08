/* Nestville shared data: residents, economy, avatars */
export const NSHOPS = 56; /* 6 original shops + 50 more, all for sale */
const SHOP_TYPES = ['Bakery', 'Nail salon', 'Hair salon', 'Cafe', 'Flower shop', 'Barber'];
/* shop i is the type i % 6 (so its interior matches its name); later ones are numbered: Bakery, ..., Barber, Bakery 2, ... */
export const KINDS = Array.from({ length: NSHOPS }, (_, i) => SHOP_TYPES[i % 6] + (i >= 6 ? ' ' + (Math.floor(i / 6) + 1) : ''));
export const PH_PRICES = Array.from({ length: 10 }, (_, i) => 150000 + i * 10000);
export const SHOP_PRICE = 50000;
/* lakeview cottages are FREE: no price, not for sale. Only penthouses and shops are paid. */
export const IG_DM = ''; /* Paste your Instagram DM link here when buying goes live */
export const fmt = n => n.toLocaleString('en-US') + ' IRT'; /* real prices (Toman) */
export const coins = n => Math.round(n).toLocaleString('en-US'); /* in-game Nest coins */

/* Properties you have sold. After a sale, add the buyer's handle here (index -> handle) and push.
   Example: ph: { 0: 'mia.codes' }, cot: { 3: 'alex_trav' }, shops: { 1: 'sara.plants' }.
   Owners count as land and earn daily rent. */
export const OWNERS = { ph: {}, cot: {}, shops: {} };

/* CITIZENS: the Instagram handles of your followers (lowercase, no @). ONLY these handles can claim a house.
   When you get a "new follower" notification, add their handle here and push. Example: ['mia.codes', 'alex_trav'] */
export const CITIZENS = []; /* add your own handle first so you can test */

/* ---------- economy ----------
   Nest coins are free to earn and only decide the leaderboard. They are not IRT.
   - Moving in gives WELCOME coins.
   - Each day a resident collects DAILY coins plus a streak bonus (+100 per day, up to +2,900).
   - Every property a resident owns pays rent each day, collected together with the daily reward
     (rent builds up for at most RENT_CAP days while away).
   - Richest = coins. Land = house plus properties owned. Streak = consecutive daily check-ins. */
export const WELCOME = 10000, DAILY = 1000, RENT_CAP = 7;
export const RENT = { cot: p => p / 100, sh: p => p / 50, ph: p => p / 60 };
const DAY = 864e5;
export const today = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / DAY); };
export const priceOf = p => p.k === 'ph' ? PH_PRICES[p.i] : p.k === 'sh' ? SHOP_PRICE : 0;

export function ensure(r) {
  if (r.coins === undefined) r.coins = WELCOME;
  if (r.streak === undefined) r.streak = 0;
  if (r.lastDaily === undefined) r.lastDaily = -9;
  if (r.lastRent === undefined) r.lastRent = today();
  if (!r.joined) r.joined = Date.now();
  return r;
}

const KEY = 'nv4';
let CUR = null;
export function load() {
  let S = { houses: [], ph: Array(10).fill(null), shops: Array(NSHOPS).fill(null), cot: Array(60).fill(null) };
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (x && x.houses) S = Object.assign(S, x);
    else {
      /* older saves: keep real claims, drop the preview residents that used to be seeded */
      for (const k of ['nv3', 'nv2']) {
        const old = JSON.parse(localStorage.getItem(k) || 'null');
        if (!old || !old.houses) continue;
        old.houses.forEach(h => { if (h && h.u && h.code !== 'DEMO') S.houses.push({ u: h.u, code: 'USER' }); });
        if (old.me) S.me = old.me;
        break;
      }
    }
  } catch (e) { }
  S.houses = (S.houses || []).filter(r => r && r.u && r.code !== 'DEMO' && CITIZENS.includes(r.u));
  S.houses.forEach(ensure);
  /* ownership comes only from the OWNERS list above */
  S.ph = Array(10).fill(null); S.shops = Array(NSHOPS).fill(null); S.cot = Array(60).fill(null);
  for (const k of ['ph', 'cot', 'shops']) for (const [i, u] of Object.entries(OWNERS[k] || {})) S[k][+i] = { u };
  if (S.me && !S.houses.some(r => r.u === S.me)) delete S.me;
  CUR = S; save(S);
  return S;
}
export function save(S) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

export function owned(S, u) {
  const o = [];
  S.ph.forEach((x, i) => x && x.u === u && o.push({ k: 'ph', i }));
  S.shops.forEach((x, i) => x && x.u === u && o.push({ k: 'sh', i }));
  S.cot.forEach((x, i) => x && x.u === u && o.push({ k: 'cot', i }));
  return o;
}
export const liveStreak = r => (r.lastDaily >= today() - 1 ? r.streak : 0);
export const dailyDone = r => r.lastDaily === today();
export const dailyAmount = r => DAILY + Math.min(Math.max(0, (r.lastDaily === today() - 1 ? r.streak : 0)), 29) * 100;
export function rentDue(S, r) {
  const days = Math.min(RENT_CAP, Math.max(0, today() - (r.lastRent === undefined ? today() : r.lastRent)));
  const per = owned(S, r.u).reduce((a, p) => a + RENT[p.k](priceOf(p)), 0);
  return { days, per: Math.round(per), amt: Math.round(days * per) };
}
export function claimDaily(S, r) {
  ensure(r);
  if (dailyDone(r)) return null;
  const amount = dailyAmount(r), rent = rentDue(S, r), t = today();
  r.streak = (r.lastDaily === t - 1 ? r.streak : 0) + 1;
  r.lastDaily = t; r.lastRent = t; r.coins += amount + rent.amt;
  return { amount, rent: rent.amt, streak: r.streak };
}
/* Live standings for a resident, read from the loaded state */
export function stats(u) {
  const r = CUR && CUR.houses.find(h => h.u === u);
  if (!r) return { coins: 0, land: 0, streak: 0 };
  ensure(r);
  return { coins: r.coins, land: 1 + owned(CUR, u).length, streak: liveStreak(r) };
}

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
