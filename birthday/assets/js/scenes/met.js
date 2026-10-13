// Chapter — The Day We Met, From My Side.
//
// The owner's own cards (messages.json → met.cards; admin → Messages → The day we met), told from his side
// only. Each card is a page in a night-and-gold journal: a small heading, his words, how it felt to him
// ("From my side"), and one or two of the photos he chose for it, as polaroids. Continue turns the page.
// Nothing here is made up: a page shows only what he wrote and the photos he picked (each line through the
// filler, so a line that still needs an unwritten memory is left out), and with no cards the chapter isn't
// in the film at all (main.js). The words around the cards (kicker, title, intro, end) are his where
// written, else the generic built-in ones (shared/keepsakes.js → KEEPSAKE_TEXT.met; intro and end are empty).
import { metCards } from '../shared/model.js';
import { wordsFor } from '../shared/keepsakes.js';
import { liveControl } from '../core/ui.js';
import { esc } from '../core/art.js';

/** The label over his feelings on a card (generic: it claims nothing). */
const SIDE = 'From my side';
/** A page holds one or two polaroids. */
const MAX_PHOTOS = 2;

/** The owner's words as paragraphs (each line break starts a new one). */
const paras = (s) => String(s || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
/** About how long a line takes to read, unhurried. */
const readTime = (s) => Math.max(2.6, 1 + String(s).split(/\s+/).filter(Boolean).length * 0.34);

export default {
  id: 'met',
  title: 'The Day We Met, From My Side',
  async enter(ctx, el) {
    const { gsap, ui, audio, fx, device } = ctx;
    const reduced = !!device.reducedMotion;
    const low = device.tier === 'low' || !!device.lowPower;
    const t = wordsFor(ctx.site, 'met');
    const fill = (s) => String(ctx.fill(String(s ?? '')) || '').trim();
    this.cleanups = [];
    const tws = (this.tweens = []);
    const keep = (tw) => { tws.push(tw); return tw; };
    const tween = (target, vars) => new Promise((res) => keep(gsap.to(target, { ...vars, onComplete: res })));
    const sfx = (n) => { try { audio.sfx(n); } catch { /* sound is optional */ } };

    /* ---------------------------------------------------------- the pages (his cards, as she will see them) */
    const pages = metCards(ctx.site).map((c) => ({
      heading: fill(c.heading),
      text: paras(fill(c.text)),
      feeling: paras(fill(c.feeling)),
      photos: c.photos.map((id) => ctx.photo(id)).filter((p) => p && !p.isPlaceholder).slice(0, MAX_PHOTOS),
    })).filter((pg) => pg.text.length || pg.feeling.length || pg.photos.length);
    // (main.js only plays this chapter with a card; should every line still fill to nothing, nothing is shown)
    if (!pages.length) { ctx.next(); return; }

    const W = () => el.clientWidth || window.innerWidth;
    const H = () => el.clientHeight || window.innerHeight;
    /** wide screens set a page as a spread: words on the left, polaroids on the right (met.css) */
    const spread = () => W() > H() && W() >= 640;
    /** about how wide a polaroid is on this screen (the same rules as met.css), for the copy it loads */
    const slotFor = (pg) => {
      const two = pg.photos.length > 1;
      const w = W();
      const h = H();
      return spread() ? Math.min(two ? 220 : 340, w * (two ? 0.2 : 0.34), h * (two ? 0.5 : 0.58)) : Math.min(two ? 230 : 300, w * (two ? 0.42 : 0.72));
    };
    const ready = Promise.race([
      Promise.all(pages.flatMap((pg) => pg.photos.map((p) => ctx.preload(ctx.photoSrc ? ctx.photoSrc(p, slotFor(pg)) : p.url)))),
      ctx.wait(5),
    ]).catch(() => {});

    /* ---------------------------------------------------------- the stage */
    const title = fill(t.title) || 'The Day We Met, From My Side';
    el.innerHTML = `
      <div class="mt-sky" aria-hidden="true"><i class="mt-stars"></i><i class="mt-glow cam-layer" style="--depth:.25"></i></div>
      <div class="mt-scroll" role="region" aria-label="${esc(title)}" tabindex="0">
        <div class="mt-page" aria-live="polite"></div>
      </div>`;
    const scroller = el.querySelector('.mt-scroll');
    const pageEl = el.querySelector('.mt-page');

    function polaroid(p, slot, i) {
      const f = document.createElement('figure');
      const cap = fill(p.caption); // like the album: a caption that still holds a [PLACEHOLDER] is left out
      f.className = `mt-pol${cap ? ' has-cap' : ''}`;
      f.style.setProperty('--r', String(p.ratio || 0.75));
      f.style.setProperty('--tilt', `${i % 2 ? 2.4 : -2.2}deg`);
      f.innerHTML = `<div class="ph"><img alt="${esc(p.alt)}" decoding="async" src="${esc(p.url)}"${p.srcset ? ` srcset="${esc(p.srcset)}" sizes="${Math.round(slot)}px"` : ''} style="object-position:${esc(p.objectPosition)}"></div>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}`;
      // on a slow connection the photo develops in when it arrives, instead of popping onto a blank card
      const img = f.querySelector('img');
      if (!img.complete) {
        img.classList.add('is-wait');
        const done = () => img.classList.remove('is-wait');
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
      return f;
    }

    function cardEl(pg, i) {
      const a = document.createElement('article');
      const words = !!(pg.heading || pg.text.length || pg.feeling.length);
      a.className = `mt-card${pg.photos.length ? ' has-photos' : ''}${pg.photos.length > 1 ? ' is-two' : ''}${words ? '' : ' only-photos'}`;
      const count = pages.length > 1 ? `<p class="mt-count">${i + 1} of ${pages.length}</p>` : '';
      a.innerHTML = `
        <div class="mt-body">
          ${count}
          ${pg.heading ? `<h2 class="mt-head">${esc(pg.heading)}</h2>` : ''}
          ${pg.text.length ? `<div class="mt-text">${pg.text.map((s) => `<p>${esc(s)}</p>`).join('')}</div>` : ''}
          ${pg.feeling.length ? `<div class="mt-feel"><p class="mt-feel-label">${esc(SIDE)}</p><div class="mt-feel-text">${pg.feeling.map((s) => `<p>${esc(s)}</p>`).join('')}</div></div>` : ''}
        </div>`;
      if (pg.photos.length) {
        const ph = document.createElement('div');
        ph.className = 'mt-photos';
        const slot = slotFor(pg);
        pg.photos.forEach((p, k) => ph.appendChild(polaroid(p, slot, k)));
        a.appendChild(ph);
      }
      return a;
    }

    /** A page taller than the screen: keyboard users scroll it with the arrow keys (Enter still turns the page). */
    function offerScroll() {
      if (scroller.scrollHeight > scroller.clientHeight + 4 && !liveControl(document.activeElement)) scroller.focus({ preventScroll: true });
    }

    async function showCard(pg, i) {
      const card = cardEl(pg, i);
      pageEl.replaceChildren(card);
      scroller.scrollTop = 0;
      sfx('pageTurn');
      const bits = [...card.querySelectorAll('.mt-count, .mt-head, .mt-text > p, .mt-feel')];
      const pols = [...card.querySelectorAll('.mt-pol')];
      if (reduced) {
        // a calm page: it simply appears
        keep(gsap.fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out' }));
      } else {
        // a page turning in from the right, its words settling line by line, the polaroids laid down on it
        keep(gsap.fromTo(card, { opacity: 0, x: 26, rotationY: -7, transformPerspective: 1400, transformOrigin: '0% 50%' }, { opacity: 1, x: 0, rotationY: 0, duration: 1.1, ease: 'power3.out', clearProps: 'transform' }));
        if (bits.length) keep(gsap.fromTo(bits, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', stagger: 0.16, delay: 0.25 }));
        pols.forEach((f, k) => keep(gsap.fromTo(f, { opacity: 0, y: 24, rotation: k % 2 ? 4 : -4, scale: 1.04 }, { opacity: 1, y: 0, rotation: 0, scale: 1, duration: 1.4, ease: 'settle', delay: 0.45 + k * 0.35 })));
      }
      await ctx.wait(reduced ? 0.6 : 1.1);
      offerScroll();
    }

    /** The intro or the end: his line(s), on their own. */
    function showLines(text) {
      const box = document.createElement('div');
      box.className = 'mt-lines';
      for (const s of paras(text)) {
        const p = document.createElement('p');
        p.className = 'mt-line';
        p.textContent = s;
        box.appendChild(p);
      }
      pageEl.replaceChildren(box);
      scroller.scrollTop = 0;
      keep(gsap.fromTo(box.children, reduced ? { opacity: 0 } : { opacity: 0, y: 12, filter: 'blur(6px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: reduced ? 0.6 : 1.2, ease: 'power3.out', stagger: reduced ? 0 : 0.45, clearProps: 'filter' }));
    }

    async function clearPage() {
      const cur = pageEl.firstElementChild;
      if (!cur) return;
      await tween(cur, reduced ? { opacity: 0, duration: 0.4 } : { opacity: 0, x: -22, rotationY: 6, transformPerspective: 1400, transformOrigin: '100% 50%', duration: 0.6, ease: 'power2.in' });
      cur.remove();
    }

    /* ============================================================ play */
    ctx.grade('candle');
    audio.setMood('tender');
    fx.dust({ density: low ? 0.2 : 0.32, alpha: 0.7 });
    keep(gsap.fromTo(el.querySelector('.mt-sky'), { opacity: 0.4 }, { opacity: 1, duration: reduced ? 0.6 : 1.8 }));
    // the title card stays up until his photos have arrived (at most a few seconds)
    await ui.chapterCard(t.kicker || 'Chapter Three', title, { until: ready });

    const intro = fill(t.intro);
    if (intro) {
      showLines(intro);
      await ctx.wait(readTime(intro));
      await clearPage();
    }
    for (const [i, pg] of pages.entries()) {
      if (i > 0) await clearPage();
      await showCard(pg, i);
      await ui.waitContinue('Continue', { delay: 0.3 });
    }
    await clearPage();

    const end = fill(t.end);
    if (end) {
      showLines(end);
      await ctx.wait(reduced ? 0.6 : 1.2);
      offerScroll();
      await ui.waitContinue('Continue', { delay: Math.min(2.4, readTime(end) * 0.5) });
      await clearPage();
    }
    // the warm light of the page carries on into the golden thread
    ctx.next({ kind: 'glow', x: W() * 0.5, y: H() * 0.55, color: '#ffd98a' });
  },

  async exit() {
    (this.tweens || []).forEach((tw) => tw && tw.kill && tw.kill());
    (this.cleanups || []).forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    this.tweens = [];
    this.cleanups = [];
  },
};
