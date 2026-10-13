// Kuchu Puchu's secret drawer (the Keepsake Box). Locked until she types her other name (any of her names
// but the first: Kuchu Puchu), or opens by itself once she has found three of the film's secrets. Inside: the
// owner's secret message (only if they wrote one) and every secret in the film: the ones she found by name,
// the rest with a fair hint that says where to look and what to do (never pixel hunting).
//
// A game, not security: unlocking is remembered on this device only (a preview link keeps its own key, so
// the owner checking it never opens hers). Nothing typed here is saved or sent anywhere.
import { chapterPlays } from '../shared/model.js';

const AUTO_OPEN = 3; // secrets found in the film that open the drawer by themselves

/** Case-, space- and punctuation-insensitive: "kuchu-puchu!" is "Kuchu Puchu". */
const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** The chapters' built-in names (the owner's own titles, from Messages, win). */
const CHAPTER_TITLES = {
  prologue: 'Once Upon a {name}',
  tower: 'A Tower Full of You',
  names: 'A Legend of Many Names',
  dance: 'Somewhere Between Chaos and Magic',
  lanterns: 'The Night of Lanterns',
  cake: 'Twenty Candles',
  constellation: 'Every Little Piece of You',
};

/**
 * Where each secret is and how it is found, read from the code that finds it:
 *   sun-taps      scenes/prologue.js      three taps on the sun
 *   pan           scenes/tower.js         the frying pan on its hook (a button: tap, or Enter)
 *   chameleon     names.js / dance.js / credits.js  the little chameleon (bottom corner; behind a photo; the credits' walk)
 *   pink-lantern  scenes/lanterns.js      the one pink lantern among the golden ones
 *   constellation scenes/constellation    her initial in faint stars, upper left, brightening every few seconds
 *   cake-wish     scenes/cake.js          after the cut, the sun topper on the cake
 *   keyboard      main.js                 her name typed anywhere (keyboard only; not counted or listed on a phone)
 *   post-credits  scenes/credits.js       staying on the end card (or “wait…”)
 * `in`: the chapters it lives in (none of them playing → it can't be found right now).
 */
const HINTS = {
  'sun-taps': { in: ['prologue'], say: (c) => `In “${c.title('prologue')}”, the sun is listening. Tap it three times.` },
  pan: { in: ['tower'], say: (c) => `In “${c.title('tower')}”, a frying pan hangs on a hook on the tower wall. Tap it.` },
  chameleon: {
    in: ['names', 'dance', 'credits'],
    say: (c) => {
      const places = [];
      if (c.on('names')) places.push(`in the bottom corner of “${c.title('names')}”`);
      if (c.on('dance')) places.push(`behind one of the photos in “${c.title('dance')}”`);
      places.push('walking along the bottom of the screen during the credits');
      const where = places.length > 1 ? `${places.slice(0, -1).join(', ')} and ${places[places.length - 1]}` : places[0];
      return `A small, shy chameleon turns up ${places.length > 1 ? 'in a few places' : 'once'}: ${where}. Tap it.`;
    },
  },
  'pink-lantern': { in: ['lanterns'], say: (c) => `In “${c.title('lanterns')}”, one lantern among the golden ones is pink. Watch for it, then tap it.` },
  constellation: { in: ['constellation'], say: (c) => `In “${c.title('constellation')}”, a few faint stars in the upper left of the sky make a letter, and every few seconds they glow a little brighter. Tap them (or Tab to them and press Enter).` },
  'cake-wish': { in: ['cake'], say: (c) => `In “${c.title('cake')}”, once the cake is cut, tap the little sun on top of it.` },
  // (listed only where it counts: on a phone without a keyboard it is left out, like the film's own count)
  keyboard: { in: [], say: () => 'With a keyboard, type her name anywhere in the film (outside this box). This one needs a keyboard, so it isn’t counted on a phone.' },
  'post-credits': { in: ['credits'], say: () => 'When the credits end, don’t leave straight away: stay on the last screen for a little while (or press “wait…”).' },
};

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5v2.4"/></svg>';
const UNLOCKED = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 7.7-1.6"/><path d="M12 14.5v2.4"/></svg>';

export default {
  open(api, el) {
    const { esc, gsap, reduced } = api;
    const storeKey = api.preview ? 'deepu-secret-drawer-preview' : 'deepu-secret-drawer';
    const remembered = () => { try { return localStorage.getItem(storeKey) === '1'; } catch { return false; } };
    const remember = () => { try { localStorage.setItem(storeKey, '1'); } catch { /* private mode: it just asks again next time */ } };
    const tweens = [];
    const timers = [];
    const stop = () => { tweens.forEach((t) => t && t.kill()); tweens.length = 0; timers.forEach(clearTimeout); timers.length = 0; };
    api.signal.addEventListener('abort', stop, { once: true });
    const later = (fn, ms) => { timers.push(setTimeout(() => { if (!api.signal.aborted) fn(); }, ms)); };

    // her other names: every name she has but the first (case, spaces and punctuation don't matter)
    const first = norm(api.herName);
    const others = [...new Set(api.nicknames.map(norm).filter((n) => n && n !== first))];
    const allIds = Object.keys(api.secrets);
    const keyboard = api.eggs.total >= allIds.length; // the typed secret isn't counted on a phone
    // on a phone the typed secret isn't counted, so it isn't listed either (the list matches “of M”)
    const ids = keyboard ? allIds : allIds.filter((id) => id !== 'keyboard');
    const counts = () => `Found ${api.eggs.count} of ${api.eggs.total}`;

    /* ---------------- locked ---------------- */
    function renderLocked() {
      // the built-in intro speaks of her other name: without one to type, the line below says how it opens
      const intro = others.length ? api.t('intro') : '';
      const count = api.eggs.count;
      el.innerHTML = `
        <div class="sd-locked">
          <div class="sd-lock" aria-hidden="true">${LOCK}</div>
          ${intro ? `<p class="ks-lead sd-intro" tabindex="-1" data-autofocus>${esc(intro)}</p>` : ''}
          ${others.length ? `
          <form class="sd-form" novalidate>
            <label class="sd-label" for="sd-name">${esc(api.t('prompt') || 'Her other name')}</label>
            <div class="sd-field">
              <input class="sd-input" id="sd-name" name="sd-name" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-describedby="sd-wrong"${intro ? '' : ' data-autofocus'}>
              <button type="submit" class="ks-btn">${esc(api.t('button') || 'Open')}</button>
            </div>
            <p class="sd-wrong" id="sd-wrong" aria-live="polite"></p>
          </form>` : `<p class="ks-lead"${intro ? '' : ' tabindex="-1" data-autofocus'}>Find ${AUTO_OPEN} secrets in the film and it opens by itself.</p>`}
          <p class="ks-small sd-progress">You’ve found ${count} of the film’s ${api.eggs.total} secrets so far${count < AUTO_OPEN ? `; at ${AUTO_OPEN} it opens by itself` : ''}.</p>
        </div>`;
      const form = el.querySelector('.sd-form');
      if (!form) return;
      const input = form.querySelector('.sd-input');
      const wrong = form.querySelector('.sd-wrong');
      const field = form.querySelector('.sd-field');
      input.addEventListener('input', () => { if (input.getAttribute('aria-invalid')) input.removeAttribute('aria-invalid'); });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const typed = norm(input.value);
        if (!typed) { input.focus(); return; }
        if (others.includes(typed)) { remember(); renderOpen({ by: 'name' }); return; }
        input.setAttribute('aria-invalid', 'true');
        // the same words again are still read out: empty the live line first, then say it
        wrong.textContent = '';
        later(() => { wrong.textContent = api.t('wrong') || 'Not quite.'; }, 40);
        api.audio.sfx('tap');
        if (!reduced) {
          // a small head-shake that only ever leans left (never out past the room's right edge)
          gsap.killTweensOf(field);
          const tl = gsap.timeline({ onComplete: () => gsap.set(field, { clearProps: 'transform' }) });
          [-8, 0, -5, 0, -2, 0].forEach((x) => tl.to(field, { x, duration: 0.07, ease: 'sine.inOut' }));
          tweens.push(tl);
        }
        input.select();
      });
    }

    /* ---------------- open ---------------- */
    function hintFor(id) {
      const h = HINTS[id];
      const on = (ch) => { const c = (api.site.chapters || []).find((x) => x && x.id === ch); return (!c || c.enabled !== false) && chapterPlays(api.site, ch); };
      const title = (ch) => api.fill(api.site.text && api.site.text[ch] && api.site.text[ch].title) || api.fill(CHAPTER_TITLES[ch] || '') || ch;
      if (!h) return 'Somewhere in the film. Keep an eye out.';
      if (h.in.length && !h.in.some(on)) return 'Its chapter isn’t in the film right now, so this one can’t be found yet.';
      // the festival hides its chameleon only among two or more photos (scenes/dance.js)
      const dancePhotos = api.photos('dance').length;
      return h.say({ on: (ch) => on(ch) && (ch !== 'dance' || dancePhotos >= 2), title });
    }

    function renderOpen({ by = null } = {}) {
      const opened = api.t('open');
      const message = api.t('message');
      const why = by === 'secrets' ? `You’ve found ${api.eggs.count} secrets, so it’s open.` : '';
      const rows = ids.map((id) => {
        if (api.eggs.has(id)) {
          return `<li class="sd-item is-found"><span class="sd-mark" aria-hidden="true">✓</span><span class="sd-text"><span class="sr-only">Found: </span><span class="sd-name">${esc(api.secrets[id])}</span></span></li>`;
        }
        return `<li class="sd-item"><span class="sd-mark" aria-hidden="true"></span><span class="sd-text"><span class="sd-tag">Not found yet</span><span class="sd-hint">${esc(hintFor(id))}</span></span></li>`;
      }).join('');
      el.innerHTML = `
        <div class="sd-open">
          <div class="sd-lock is-open" aria-hidden="true">${UNLOCKED}</div>
          ${why || opened ? `<div class="sd-opened" tabindex="-1" data-autofocus>
            ${why ? `<p class="sd-why">${esc(why)}</p>` : ''}
            ${opened ? `<p class="ks-lead">${esc(opened)}</p>` : ''}
          </div>` : ''}
          ${message ? `<div class="sd-paper"><p class="sd-message">${esc(message)}</p></div>` : ''}
          <section class="sd-finds" aria-labelledby="sd-finds-title">
            <h3 class="sd-title" id="sd-finds-title"${why || opened ? '' : ' tabindex="-1" data-autofocus'}>Kuchu Puchu’s discoveries</h3>
            <p class="sd-count">${esc(counts())}</p>
            <ul class="sd-list" role="list">${rows}</ul>
          </section>
        </div>`;
      const wrap = el.querySelector('.sd-open');
      if (by === 'name') {
        api.audio.sfx('magic');
        api.announce([opened, counts()].filter(Boolean).join(' '));
        if (reduced) tweens.push(gsap.fromTo(wrap, { opacity: 0 }, { opacity: 1, duration: 0.25 }));
        else {
          tweens.push(gsap.fromTo(wrap, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform' }));
          tweens.push(gsap.fromTo(wrap.querySelector('.sd-lock'), { scale: 0.85 }, { scale: 1, duration: 0.7, ease: 'back.out(2)' }));
        }
        later(() => { const f = el.querySelector('[data-autofocus]'); if (f) f.focus({ preventScroll: true }); }, 30);
      } else {
        api.audio.sfx('sparkle');
        if (why) api.announce([why, opened, counts()].filter(Boolean).join(' '));
      }
    }

    if (remembered()) renderOpen();
    else if (api.eggs.count >= AUTO_OPEN) { remember(); renderOpen({ by: 'secrets' }); }
    else renderLocked();

    return stop;
  },
};
