/* Nestville economy panel: shows coins, streak and the daily reward in the menu.
   Runs next to town.js and reads the same state object. */
import './extras.js';
import './life.js';
import './visit.js';
import { save, ensure, dailyDone, dailyAmount, rentDue, claimDaily, coins, liveStreak, owned } from './shared.js';

const $ = id => document.getElementById(id);
function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }

ready(nv => {
  const S = nv.S, pane = $('pane'), stat = $('stat');
  const me = () => S.houses.find(h => h.u === S.me);
  let tt = 0;
  function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3600); }

  function fixStat() {
    const n = S.houses.length, t = n === 1 ? '1 resident' : n + ' residents';
    if (stat.textContent !== t) stat.textContent = t;
  }
  fixStat();
  new MutationObserver(fixStat).observe(stat, { childList: true, characterData: true, subtree: true });

  function panelHTML(r) {
    const st = liveStreak(r), done = dailyDone(r), amt = dailyAmount(r), rent = rentDue(S, r), land = owned(S, r.u).length;
    const box = a => '<div style="flex:1;background:rgba(255,255,255,.55);border-radius:14px;padding:8px 10px"><small style="color:var(--mute);font-weight:700">' + a[0] + '</small><div style="font:700 15px var(--fb)">' + a[1] + '</div></div>';
    return '<div id="eco" style="margin:8px 0 12px"><div style="display:flex;gap:8px">' +
      [['Coins', coins(r.coins)], ['Land', (1 + land) + (land ? ' plots' : ' plot')], ['Streak', st + (st === 1 ? ' day' : ' days')]].map(box).join('') + '</div>' +
      (rent.per ? '<p class="note">Your properties pay ' + coins(rent.per) + ' coins a day in rent.' + (rent.amt ? ' ' + coins(rent.amt) + ' waiting.' : '') + '</p>' : '') +
      (done ? '<button class="pb g" disabled style="width:100%;opacity:.7;margin-top:8px">Reward collected. Come back tomorrow</button>'
        : '<button class="pb gold" data-eco="daily" style="width:100%;margin-top:8px">Collect ' + coins(amt + rent.amt) + ' coins</button>') +
      '<p class="note">Nest coins are free to earn and only decide the leaderboard. They are not IRT.</p></div>';
  }
  function panel() {
    const r = me(), h = pane.querySelector('h4');
    if (!r || !h || h.textContent !== 'Your house' || pane.querySelector('#eco')) return;
    ensure(r);
    const row = pane.querySelector('.row'); if (!row) return;
    row.insertAdjacentHTML('afterend', panelHTML(r));
  }
  new MutationObserver(panel).observe(pane, { childList: true });

  pane.addEventListener('click', e => {
    const b = e.target.closest('[data-eco="daily"]'); if (!b) return;
    const r = me(); if (!r) return;
    const g = claimDaily(S, r);
    if (!g) { toast('You already collected today.'); return; }
    save(S);
    const old = pane.querySelector('#eco'); if (old) old.remove();
    panel();
    toast('+' + coins(g.amount + g.rent) + ' coins. Streak: ' + g.streak + (g.streak === 1 ? ' day' : ' days') + (g.rent ? ' (rent ' + coins(g.rent) + ' included)' : ''));
  });
});
