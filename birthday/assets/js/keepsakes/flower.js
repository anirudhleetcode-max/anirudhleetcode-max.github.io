// A birthday flower (the Keepsake Box): one petal for every line (the owner's, or the generic built-in wishes; at
// most twelve), each petal a real button. Opening one (tap, Enter, Space) unfolds and colours it and shows its line
// under the flower; an open petal stays open and keeps its line (tap it again to read it again, or read them all
// under “Read the open petals”). Arrow keys, Home and End move between petals. Every petal open: the last line.
// A few soft under-petals (decoration only) keep it a flower even with one or two lines.
// Taps: a petal's button is a rectangle turned round the core, and with many petals neighbouring rectangles
// overlap. So the button itself takes no pointer; its .fl-hit (the button's own box cut down to the petal's slice
// of the flower) does, and the flower grows a little with more petals so each slice still holds 44 px.
// (The summary of “Read the open petals” carries tabindex="0" so the box's Tab loop, which lists buttons, links,
// fields and [tabindex], reaches it after the last petal.)
// Reduced motion: no unfurling turn and no growing; a petal simply takes its colour.
import { KEEPSAKE_TEXT } from '../shared/keepsakes.js';

const MAX = 12;
const UNDER = 10;
const PETAL = 'M20 99 C9 88 2 62 3 40 C4 18 12 3 20 1 C28 3 36 18 37 40 C38 62 31 88 20 99 Z';
let uid = 0;

/** Where each petal points (degrees, 0 = up): evenly round from three petals; one or two lean up like a bud. */
const anglesFor = (n) => (n === 1 ? [0] : n === 2 ? [-42, 42] : Array.from({ length: n }, (_, i) => (i * 360) / n));
/** A petal's width (% of the flower), so few petals are broad and twelve still leave room for each other. */
const widthFor = (n) => (n <= 4 ? 30 : n <= 5 ? 28 : n <= 6 ? 25 : n <= 8 ? 21 : n <= 10 ? 18 : 16);
/** Half the angle between a petal and its nearest neighbour (degrees): each petal's tap area is its own slice of
 *  the flower, so a neighbour (a later button, drawn on top) never takes its taps. One petal: no neighbour. */
const sliceFor = (n) => (n >= 3 ? 180 / n : n === 2 ? 42 : 89);
/** The smallest flower (px) whose slices each still hold a whole 44 px square inside the petal's own button:
 *  200 px up to seven petals, then a little more for each one (269 px for twelve). The panel scrolls, so a
 *  taller flower is fine; on the narrowest phones the room's width still caps it. */
const minSizeFor = (n, t) => (n >= 3 ? Math.max(200, Math.ceil((22 / t + 44) / 0.47)) : 200);

export default {
  open(api, el) {
    const { esc, gsap, reduced } = api;
    const id = `fl${++uid}`;
    let lines = api.list('petals');
    if (!lines.length) lines = (KEEPSAKE_TEXT.flower.petals || []).map((s) => api.fill(s)).filter(Boolean);
    lines = lines.slice(0, MAX);
    const n = lines.length;
    const intro = api.t('intro');
    const done = api.t('done');
    if (!n) {
      el.innerHTML = `${intro ? `<p class="ks-lead">${esc(intro)}</p>` : ''}<p class="ks-empty">Nothing here yet.</p>`;
      return undefined;
    }
    const open = new Array(n).fill(false);
    const tweens = new Set();
    const keep = (t) => { tweens.add(t); t.eventCallback('onComplete', () => tweens.delete(t)); return t; };
    const label = (i) => `Petal ${i + 1} of ${n}${open[i] ? ', open' : ''}`;
    const angles = anglesFor(n);
    const slice = Math.tan((sliceFor(n) * Math.PI) / 180);

    const under = Array.from({ length: UNDER }, (_, k) => `<span class="fl-under" style="--a:${(k * 360) / UNDER + 18}deg"></span>`).join('');
    const petals = lines.map((_, i) => `
      <span class="fl-arm" style="--a:${angles[i]}deg">
        <button type="button" class="fl-petal" data-i="${i}" aria-label="${label(i)}"${i === 0 ? ' data-autofocus' : ''}><span class="fl-hit" aria-hidden="true"></span><span class="fl-petal-in"><span class="fl-turn"><svg viewBox="0 0 40 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="fl-bud" d="${PETAL}"/><path class="fl-bloom" d="${PETAL}" fill="url(#${id}-g)"/><path class="fl-vein" d="M20 93 C19 72 19.5 46 20 20"/></svg></span></span></button>
      </span>`).join('');

    el.innerHTML = `
      ${intro ? `<p class="ks-lead">${esc(intro)}</p>` : ''}
      <svg class="fl-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}-g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" class="fl-g0"/><stop offset="1" class="fl-g1"/></linearGradient></defs></svg>
      <div class="fl-wrap" style="--fs-min:${minSizeFor(n, slice)}px">
        <div class="fl-stage">
          <svg class="fl-stem" viewBox="0 0 100 72" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path class="fl-stalk" d="M50 0 C47 22 54 44 50 72"/>
            <path class="fl-leaf" d="M50.6 40 C40 33 30 34 24 39 C33 45 43 45 50.6 40 Z"/>
            <path class="fl-leaf" d="M50.2 54 C60 47 70 47 77 52 C68 58 58 59 50.2 54 Z"/>
          </svg>
          <div class="fl-head" role="group" aria-label="The flower, ${n} ${n === 1 ? 'petal' : 'petals'}" style="--pw:${widthFor(n)}%;--slice:${slice.toFixed(4)}">
            <span class="fl-unders" aria-hidden="true">${under}</span>
            ${petals}
            <span class="fl-core" aria-hidden="true"></span>
          </div>
        </div>
        <div class="fl-side">
          <p class="fl-count ks-small">0 of ${n} open</p>
          <p class="fl-line" aria-live="polite"></p>
          <p class="fl-done" hidden>${esc(done)}</p>
          <details class="fl-read" hidden>
            <summary tabindex="0">Read the open petals</summary>
            <ol class="fl-list"></ol>
          </details>
        </div>
      </div>`;

    const head = el.querySelector('.fl-head');
    const buttons = [...el.querySelectorAll('.fl-petal')];
    const count = el.querySelector('.fl-count');
    const line = el.querySelector('.fl-line');
    const doneEl = el.querySelector('.fl-done');
    const read = el.querySelector('.fl-read');
    const list = el.querySelector('.fl-list');

    const showLine = (text) => {
      if (line.textContent === text) api.announce(text); // the same line again: the live area wouldn't speak twice
      line.textContent = text;
      // on a small screen the line may sit below the flower's fold: bring it into view (only as far as needed)
      line.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      if (!reduced) keep(gsap.fromTo(line, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', clearProps: 'transform' }));
    };
    const syncList = () => {
      const opened = lines.filter((_, i) => open[i]);
      list.innerHTML = opened.map((s) => `<li>${esc(s)}</li>`).join('');
      read.hidden = !opened.length;
      count.textContent = `${opened.length} of ${n} open`;
    };

    function openPetal(i) {
      const b = buttons[i];
      if (!b) return;
      if (open[i]) { showLine(lines[i]); return; }
      open[i] = true;
      b.classList.add('is-open');
      b.setAttribute('aria-label', label(i));
      if (!reduced) {
        // it unfurls: a small turn back into place while it grows (CSS grows .fl-petal-in; the turn is on its
        // own inner element, because gsap would fold the CSS `scale` into its transform and stop the growing)
        keep(gsap.fromTo(b.querySelector('.fl-turn'), { rotation: i % 2 ? 14 : -14 }, { rotation: 0, duration: 0.9, ease: 'back.out(2)', clearProps: 'transform' }));
      }
      showLine(lines[i]);
      syncList();
      api.audio.sfx('tap');
      if (open.every(Boolean)) {
        head.classList.add('is-complete');
        if (done) {
          doneEl.hidden = false;
          if (!reduced) keep(gsap.fromTo(doneEl, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.3 }));
          api.announce(done);
        }
        api.audio.sfx('sparkle');
      }
    }

    head.addEventListener('click', (e) => {
      const b = e.target.closest('.fl-petal');
      if (b) openPetal(Number(b.dataset.i));
    });
    head.addEventListener('keydown', (e) => {
      const b = e.target.closest('.fl-petal');
      if (!b) return;
      const i = Number(b.dataset.i);
      let j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % n;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + n) % n;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = n - 1;
      if (j == null) return;
      e.preventDefault();
      buttons[j].focus();
    });

    const stop = () => {
      for (const t of tweens) t.progress(1).kill();
      tweens.clear();
    };
    api.signal.addEventListener('abort', stop, { once: true });
    return stop;
  },
};
