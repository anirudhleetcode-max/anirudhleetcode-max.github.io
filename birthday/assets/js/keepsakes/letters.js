// Letters from different moments (the Keepsake Box): the owner's letters (admin → Keepsake Box → Letters),
// each in its own envelope. A letter with a date stays sealed with wax until that day (by the clock of the
// device she uses); without a date it opens at once. An open envelope unfolds into a letter on paper;
// "Fold it back" (or Escape) folds it away again. Nothing is stored and nothing is sent.
// An owner's preview link opens every letter; a preview link with &today=YYYY-MM-DD tests a real date.
import { KEEPSAKE_TEXT } from '../shared/keepsakes.js';

const sealSVG = '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><circle cx="20" cy="20" r="11.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="1.6 2.2"/><path d="M20 12.5l1.9 4.4 4.7.4-3.6 3.1 1.1 4.6L20 22.6 15.9 25l1.1-4.6-3.6-3.1 4.7-.4z" fill="currentColor"/></svg>';

/** Every letter open: an owner's preview, unless the link asks for a particular day (&today=…). */
export function opensEverything(preview, search = '') {
  if (!preview) return false;
  try { return !new URLSearchParams(search).has('today'); } catch { return true; }
}

/** Sealed: it has a real date, and that day hasn't come yet on this device (`now`). */
export const isSealed = (day, now, everything = false) => !!day && !everything && day > now;

/** "3 March 2027" */
export const formatDay = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export default {
  open(api, el) {
    const { esc, gsap, reduced } = api;
    const everyLetter = opensEverything(api.preview, location.search);
    const now = api.now();
    const intro = api.t('intro');
    const lockedLine = api.t('locked') || api.fill(KEEPSAKE_TEXT.letters.locked);
    const uid = Math.random().toString(36).slice(2, 8);
    el.classList.toggle('is-reduced', !!reduced);

    const letters = [];
    for (const it of api.items()) {
      if (!it || typeof it !== 'object') continue;
      const body = api.fill(it.body);
      if (!body) continue;
      const day = api.localDay(typeof it.opensOn === 'string' ? it.opensOn : '');
      const n = letters.length + 1;
      letters.push({
        n,
        body,
        label: api.fill(it.label) || `Letter ${n}`,
        day,
        dayText: day ? formatDay(day) : '',
        sealed: isSealed(day, now, everyLetter),
      });
    }

    el.innerHTML = `
      ${intro ? `<p class="ks-lead lm-intro" tabindex="-1" data-autofocus>${esc(intro)}</p>` : ''}
      ${letters.length ? `
      <ul class="lm-list" role="list">
        ${letters.map((l, i) => `<li class="lm-item">${l.sealed ? `
          <div class="lm-env is-sealed">
            <span class="lm-flap" aria-hidden="true"></span>
            <span class="lm-seal" aria-hidden="true">${sealSVG}</span>
            <span class="lm-label">${esc(l.label)}</span>
            <span class="lm-when">${esc(lockedLine.replace(/\{date\}/g, l.dayText))}</span>
          </div>` : `
          <button type="button" class="lm-env" data-i="${i}">
            <span class="lm-flap" aria-hidden="true"></span>
            <span class="lm-label">${esc(l.label)}</span>
            <span class="lm-open"><span class="sr-only">, </span>Open</span>
          </button>`}</li>`).join('')}
      </ul>
      <article class="lm-paper" aria-labelledby="lm-title-${uid}" tabindex="-1" data-own-escape hidden>
        <p class="lm-date" hidden></p>
        <h3 class="lm-title" id="lm-title-${uid}"></h3>
        <div class="lm-body"></div>
        <div class="lm-actions"><button type="button" class="lm-fold">Fold it back</button></div>
      </article>` : '<p class="ks-empty">There are no letters here yet.</p>'}`;
    if (!intro) { const first = el.querySelector('.lm-env[data-i]') || el.querySelector('.ks-empty'); if (first) { first.setAttribute('data-autofocus', ''); if (!first.matches('button')) first.tabIndex = -1; } }

    const tweens = new Set();
    const stop = () => { for (const t of tweens) t.kill(); tweens.clear(); };
    api.signal.addEventListener('abort', stop, { once: true });
    if (!letters.length) return stop;

    const list = el.querySelector('.lm-list');
    const paper = el.querySelector('.lm-paper');
    const title = paper.querySelector('.lm-title');
    const date = paper.querySelector('.lm-date');
    const body = paper.querySelector('.lm-body');
    const panel = el.closest('.ks-panel');
    let openIndex = -1;

    function unfold(i) {
      const l = letters[i];
      if (!l || l.sealed) return;
      stop();
      openIndex = i;
      title.textContent = l.label;
      body.textContent = l.body;
      date.textContent = l.dayText;
      date.hidden = !l.dayText;
      list.hidden = true;
      paper.hidden = false;
      if (panel) panel.scrollTop = 0;
      paper.focus({ preventScroll: true });
      api.announce(`${l.label}. The letter is open.`);
      api.audio.sfx('pageTurn');
      if (reduced) tweens.add(gsap.fromTo(paper, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'none' }));
      else tweens.add(gsap.fromTo(paper, { opacity: 0, scaleY: 0.12, rotateX: -24, transformPerspective: 900, transformOrigin: '50% 0%' }, { opacity: 1, scaleY: 1, rotateX: 0, duration: 0.75, ease: 'power3.out', clearProps: 'transform' }));
    }

    function foldBack() {
      if (openIndex < 0) return;
      const i = openIndex;
      openIndex = -1;
      stop();
      const done = () => {
        paper.hidden = true;
        body.textContent = '';
        title.textContent = '';
        list.hidden = false;
        gsap.set(paper, { clearProps: 'opacity,transform' });
        const env = list.querySelector(`.lm-env[data-i="${i}"]`);
        if (env) { env.focus({ preventScroll: true }); env.scrollIntoView({ block: 'nearest' }); }
        api.announce('The letter is folded back.');
      };
      api.audio.sfx('tap');
      if (reduced) tweens.add(gsap.to(paper, { opacity: 0, duration: 0.18, ease: 'none', onComplete: done }));
      else tweens.add(gsap.to(paper, { opacity: 0, scaleY: 0.12, rotateX: -24, transformPerspective: 900, transformOrigin: '50% 0%', duration: 0.4, ease: 'power2.in', onComplete: done }));
    }

    list.addEventListener('click', (e) => {
      const env = e.target.closest('.lm-env[data-i]');
      if (env) unfold(Number(env.dataset.i));
    });
    paper.querySelector('.lm-fold').addEventListener('click', foldBack);
    // Escape folds the open letter back first (the box leaves the room only on the next one)
    paper.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); foldBack(); }
    });

    return () => { stop(); paper.hidden = true; };
  },
};
