// Twelve little doors (the Keepsake Box): one door for each month of her twentieth year (api.doors()), each
// opening on its day by the clock of the device she uses. Behind each one, a wish for that month: the owner's
// own line for that door when written (admin → Keepsake Box), otherwise the built-in one. Wishes, never
// predictions. Nothing is stored and nothing is sent: a door is simply open once its day has come.
// An owner's preview link shows every door open; a preview link with &today=YYYY-MM-DD tests a real date.
import { KEEPSAKE_TEXT } from '../shared/keepsakes.js';

const lockSVG = '<svg class="md-lock" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14.2v2.2"/></svg>';

/** Every door open: an owner's preview, unless the link asks for a particular day (&today=…). */
export function showsEveryDoor(preview, search = '') {
  if (!preview) return false;
  try { return !new URLSearchParams(search).has('today'); } catch { return true; }
}

/** Door i's wish: the owner's line for that door when written (and fillable), else the built-in one. */
export function doorWish(i, own, fill) {
  const mine = Array.isArray(own) && typeof own[i] === 'string' ? fill(own[i]) : '';
  return mine || fill(KEEPSAKE_TEXT.months.doors[i] || '');
}

export default {
  open(api, el) {
    const { esc, gsap, reduced } = api;
    const doors = api.doors();
    const everyDoor = showsEveryDoor(api.preview, location.search);
    const now = api.now();
    const intro = api.t('intro');
    const lockedLine = api.t('locked') || api.fill(KEEPSAKE_TEXT.months.locked);
    const uid = Math.random().toString(36).slice(2, 8);
    el.classList.toggle('is-reduced', !!reduced);

    const cells = doors.map((d, i) => {
      const open = everyDoor || now >= d.opensAt;
      const month = d.opensAt.toLocaleDateString('en-IN', { month: 'long' });
      const year = d.opensAt.getFullYear();
      const wish = open ? doorWish(i, api.text.doors, api.fill) : '';
      const locked = lockedLine.replace(/\{date\}/g, d.label);
      return { i, open, month, year, wish, locked, label: d.label };
    });

    el.innerHTML = `
      ${intro ? `<p class="ks-lead md-intro" tabindex="-1" data-autofocus>${esc(intro)}</p>` : ''}
      <ul class="md-grid" role="list">
        ${cells.map((c) => `
          <li class="md-cell${c.open ? '' : ' is-locked'}" data-i="${c.i}">
            <div class="md-frame">
              ${c.open ? `<div class="md-inside" id="md-in-${uid}-${c.i}"><p class="md-inside-month" aria-hidden="true">${esc(c.month)}</p><p class="md-wish">${esc(c.wish)}</p></div>` : ''}
              <button type="button" class="md-door" ${c.open ? `aria-expanded="false" aria-controls="md-in-${uid}-${c.i}"` : 'aria-disabled="true"'}>
                <span class="md-num" aria-hidden="true">${c.i + 1}</span>
                <span class="md-month">${esc(c.month)}</span>
                <span class="md-year">${c.year}</span>
                ${c.open ? '<span class="md-knob" aria-hidden="true"></span>' : `${lockSVG}<span class="md-locked-msg">${esc(c.locked)}</span>`}
              </button>
            </div>
          </li>`).join('')}
      </ul>`;
    if (!intro) { const first = el.querySelector('.md-door'); if (first) first.setAttribute('data-autofocus', ''); }

    const tweens = new Set();
    const toggle = (cell, { focus = false } = {}) => {
      const c = cells[Number(cell.dataset.i)];
      const door = cell.querySelector('.md-door');
      if (!c.open) {
        // a closed door: say when it opens (it stays closed)
        if (!cell.classList.contains('is-told')) cell.classList.add('is-told');
        api.announce(c.locked);
        api.audio.sfx('tap');
        if (!reduced) {
          gsap.killTweensOf(door);
          tweens.add(gsap.fromTo(door, { x: 0 }, { keyframes: [{ x: -3, duration: 0.06 }, { x: 3, duration: 0.08 }, { x: -2, duration: 0.07 }, { x: 0, duration: 0.07 }], ease: 'none' }));
        }
        return;
      }
      const opening = !cell.classList.contains('is-open');
      cell.classList.toggle('is-open', opening);
      door.setAttribute('aria-expanded', String(opening));
      if (opening) {
        api.announce(`${c.month}: ${c.wish}`);
        api.audio.sfx('sparkle');
      } else {
        api.audio.sfx('tap');
      }
      if (focus) door.focus({ preventScroll: true });
    };

    // the door, or the wish behind an open door, both answer a tap
    el.querySelector('.md-grid').addEventListener('click', (e) => {
      const cell = e.target.closest('.md-cell');
      if (!cell) return;
      const onDoor = e.target.closest('.md-door');
      const onInside = e.target.closest('.md-inside');
      if (!onDoor && !onInside) return;
      toggle(cell, { focus: !onDoor });
    });

    const stop = () => { for (const t of tweens) t.kill(); tweens.clear(); };
    api.signal.addEventListener('abort', stop, { once: true });
    return stop;
  },
};
