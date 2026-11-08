/* Nestville walk pad: two on-screen buttons (hold to walk forward or back) that show up in the canal/sidewalk walk view.
   A phone has no keyboard, and the two-finger pinch is hard to discover. The buttons press the same arrow keys town.js already listens to.
   Runs next to town.js and reads the same scene (window.__nv). */
function ready(fn) { if (window.__nv) fn(window.__nv); else setTimeout(() => ready(fn), 50); }
ready(nv => {
  const pad = document.getElementById('walkpad'); if (!pad) return;
  const key = (type, k) => window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
  [['wFwd', 'ArrowUp'], ['wBack', 'ArrowDown']].forEach(([id, k]) => {
    const el = document.getElementById(id); if (!el) return;
    let held = false;
    const on = e => { e.preventDefault(); if (held) return; held = true; try { el.setPointerCapture(e.pointerId); } catch (x) { } key('keydown', k); };
    const off = () => { if (!held) return; held = false; key('keyup', k); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  });
  setInterval(() => pad.classList.toggle('on', nv.view.mode === 'walk'), 150);
});
