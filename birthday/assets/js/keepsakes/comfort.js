// If you ever forget how special you are (the Keepsake Box): four gentle choices for a hard day. Each one opens a
// small panel; “Something else” (or Escape) comes back to the choices, with focus on the one she picked.
//   reminder — the reminder (the owner's words, or the generic built-in ones) in a soft card
//   smile    — the smile line, and the film's small shy chameleon (a gentle wiggle; still under reduced motion)
//   memory   — one of her real memories (How it began), photo first; “Another one” never shows the same one twice
//              in a row; with no memory written yet, the gentle empty line. Its photo: the memory's first one
//              whose words don't read as romantic (like the film's other friendship moments); no photo at all
//              when every one of its photos does
//   breathe  — a circle that grows for 4 s and shrinks for 4 s, with the cues; under reduced motion a still circle
// Nothing here is made up: the words are the owner's or the generic built-in ones, the memories are hers.
// The open panel is itself a (script-only) focus target, so a tap on its words keeps focus inside it and Escape
// still steps back to the choices rather than closing the room; Tab from its heading is the box's (page order).
import { chameleonSVG, memoryGlyphSVG } from '../core/art.js';
import { KEEPSAKE_TEXT } from '../shared/keepsakes.js';
import { readsRomantic } from '../shared/model.js';

const ICONS = {
  // a small sun, a smile, a photo, rings of breath (stroke drawings in the accent colour; no hearts)
  reminder: '<circle cx="12" cy="12" r="3.4"/><path d="M12 3.5v2.6M12 17.9v2.6M3.5 12h2.6M17.9 12h2.6M6 6l1.8 1.8M16.2 16.2L18 18M6 18l1.8-1.8M16.2 7.8L18 6"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 13.6c1 1.6 2.3 2.4 3.7 2.4s2.7-.8 3.7-2.4"/><path d="M9.3 9.4v.6M14.7 9.4v.6"/>',
  memory: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.8 16.2l4.8-4.4 3.9 3.4 2.9-2.4 5 4"/><circle cx="15.6" cy="9.4" r="1.6"/>',
  breathe: '<circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="12" r="5.8" stroke-opacity=".7"/><circle cx="12" cy="12" r="9" stroke-opacity=".4"/>',
};
const IN = 'Breathe in…';
const OUT = 'and out…';
let uid = 0;

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default {
  open(api, el) {
    const { esc, gsap, reduced } = api;
    const id = `cf${++uid}`;
    const intro = api.t('intro');
    const back = api.t('back') || KEEPSAKE_TEXT.comfort.back;
    // her memories, the ones with a photo first (each group in its own random order); “Another one” walks the
    // circle, so the same memory never comes twice in a row
    const mems = api.memories().filter((m) => m && m.text);
    // a memory's photo: its first one whose words don't read as romantic; never one that does
    const photoOf = (m) => (m.photos || []).find((p) => !readsRomantic(p)) || null;
    const order = [...shuffle(mems.filter((m) => photoOf(m))), ...shuffle(mems.filter((m) => !photoOf(m)))];
    let mi = -1;

    const choices = [
      { key: 'reminder', label: api.t('reminderLabel'), ok: !!api.t('reminder') },
      { key: 'smile', label: api.t('smileLabel'), ok: !!api.t('smile') },
      { key: 'memory', label: api.t('memoryLabel'), ok: order.length > 0 || !!api.t('memoryEmpty') },
      { key: 'breathe', label: api.t('breatheLabel'), ok: true },
    ].filter((c) => c.label && c.ok);

    el.innerHTML = `
      ${intro ? `<p class="ks-lead cf-lead">${esc(intro)}</p>` : ''}
      <ul class="cf-menu" role="list">
        ${choices.map((c, i) => `<li><button type="button" class="cf-choice" data-choice="${c.key}"${i === 0 ? ' data-autofocus' : ''}><span class="cf-ic" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${ICONS[c.key]}</svg></span><span class="cf-label">${esc(c.label)}</span></button></li>`).join('')}
      </ul>
      <section class="cf-panel" hidden data-own-escape tabindex="-1" aria-labelledby="${id}-h">
        <h3 class="cf-panel-title" id="${id}-h" tabindex="-1"></h3>
        <div class="cf-body"></div>
        <div class="ks-row cf-actions">
          <button type="button" class="ks-btn cf-another" hidden>Another one</button>
          <button type="button" class="ks-btn is-quiet cf-back"><span aria-hidden="true">‹</span> ${esc(back)}</button>
        </div>
      </section>`;

    const lead = el.querySelector('.cf-lead');
    const menu = el.querySelector('.cf-menu');
    const panel = el.querySelector('.cf-panel');
    const title = panel.querySelector('.cf-panel-title');
    const body = panel.querySelector('.cf-body');
    const another = panel.querySelector('.cf-another');
    const backBtn = panel.querySelector('.cf-back');
    const scroller = () => el.closest('.ks-panel');
    let chosen = null; // the choice she picked (focus goes back to it)
    let stopPanel = null; // stops whatever the open panel is doing (the breathing)
    let enter = null; // the panel's own entrance
    let fade = null; // “Another one”

    /* ---------------- the panels ---------------- */
    const memoryHtml = (m) => {
      const p = photoOf(m);
      const r = p && p.ratio > 0 ? p.ratio : 1;
      const img = p ? `<figure class="cf-photo ks-photo" style="--r:${r.toFixed(4)}"><img src="${esc(p.thumbUrl || p.url)}"${p.srcset ? ` srcset="${esc(p.srcset)}" sizes="(max-height: 460px) and (orientation: landscape) 46vw, (min-width: 700px) 300px, 86vw"` : ''} alt="${esc(p.alt)}" loading="lazy" decoding="async" style="object-position:${esc(p.objectPosition)}"></figure>` : '';
      return `
        <article class="cf-memory${p ? ' has-photo' : ''}">
          ${img}
          <div class="cf-mem-words">
            <p class="cf-mem-kicker"><span class="cf-glyph" aria-hidden="true">${memoryGlyphSVG(m.kind)}</span>${m.when ? `<span class="cf-when">${esc(m.when)}</span>` : ''}</p>
            ${m.title ? `<h4 class="cf-mem-title">${esc(m.title)}</h4>` : ''}
            <p class="cf-words cf-mem-text">${esc(m.text)}</p>
          </div>
        </article>`;
    };
    const showMemory = (animate) => {
      mi = (mi + 1) % order.length;
      const m = order[mi];
      body.innerHTML = memoryHtml(m);
      if (animate) {
        if (fade) fade.progress(1).kill();
        fade = gsap.fromTo(body.firstElementChild, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.2 : 0.5, ease: 'power1.out' });
        api.announce(`${m.title ? `${m.title}. ` : ''}${m.when ? `${m.when}. ` : ''}${m.text}`);
      }
    };

    const PANELS = {
      reminder() {
        body.innerHTML = `<div class="cf-soft"><p class="cf-words">${esc(api.t('reminder'))}</p></div>`;
        return null;
      },
      smile() {
        // the wiggle is CSS: three times, then he rests (none at all under reduced motion)
        body.innerHTML = `
          <div class="cf-smile">
            <div class="cf-cham" aria-hidden="true">${chameleonSVG({ className: 'cf-cham-svg' })}</div>
            <p class="cf-words">${esc(api.t('smile'))}</p>
          </div>`;
        return null;
      },
      memory() {
        if (!order.length) {
          body.innerHTML = `<p class="ks-empty cf-empty">${esc(api.t('memoryEmpty'))}</p>`;
          return null;
        }
        showMemory(false);
        another.hidden = order.length < 2;
        return null;
      },
      breathe() {
        const words = api.t('breathe');
        body.innerHTML = `
          <div class="cf-breathe">
            <div class="cf-orb" aria-hidden="true"><span class="cf-circle"></span>${reduced ? '' : '<span class="cf-cue"></span>'}</div>
            ${words ? `<p class="cf-words">${esc(words)}</p>` : ''}
          </div>`;
        if (reduced) return null; // a still circle and the words
        const circle = body.querySelector('.cf-circle');
        const cue = body.querySelector('.cf-cue');
        let tw = null;
        let cueTw = null;
        let phase = 0;
        let live = true;
        gsap.set(circle, { scale: 0.6 });
        const step = () => {
          if (!live) return;
          const inhale = phase++ % 2 === 0;
          cue.textContent = inhale ? IN : OUT;
          if (cueTw) cueTw.kill();
          cueTw = gsap.fromTo(cue, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power1.out' });
          tw = gsap.to(circle, { scale: inhale ? 1 : 0.6, duration: 4, ease: 'sine.inOut', onComplete: step });
        };
        step();
        return () => {
          live = false;
          if (tw) tw.kill();
          if (cueTw) cueTw.kill();
          tw = null;
          cueTw = null;
        };
      },
    };

    /* ---------------- choosing, and coming back ---------------- */
    const stop = () => {
      if (stopPanel) { try { stopPanel(); } catch { /* already gone */ } }
      stopPanel = null;
      for (const t of [enter, fade]) if (t) t.progress(1).kill(); // never left half-faded
      enter = null;
      fade = null;
    };
    function choose(btn) {
      const c = choices.find((x) => x.key === btn.dataset.choice);
      if (!c) return;
      stop();
      chosen = btn;
      another.hidden = true;
      title.textContent = c.label;
      panel.dataset.choice = c.key;
      stopPanel = PANELS[c.key]();
      menu.hidden = true;
      if (lead) lead.hidden = true;
      panel.hidden = false;
      const sc = scroller();
      if (sc) sc.scrollTop = 0;
      title.focus({ preventScroll: true });
      if (!reduced) enter = gsap.fromTo(body, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', clearProps: 'transform' });
      api.audio.sfx('tap');
    }
    function goBack() {
      if (panel.hidden) return;
      stop();
      panel.hidden = true;
      body.replaceChildren();
      another.hidden = true;
      menu.hidden = false;
      if (lead) lead.hidden = false;
      const b = chosen;
      chosen = null;
      const sc = scroller();
      if (sc) sc.scrollTop = 0;
      if (b && b.isConnected) {
        b.focus({ preventScroll: true });
        b.scrollIntoView({ block: 'nearest' }); // the choices sit at the top; only a low one needs a scroll
      }
    }

    menu.addEventListener('click', (e) => {
      const b = e.target.closest('.cf-choice');
      if (b) choose(b);
    });
    backBtn.addEventListener('click', goBack);
    another.addEventListener('click', () => {
      if (order.length < 2) return;
      showMemory(true);
      api.audio.sfx('pageTurn');
    });
    panel.addEventListener('keydown', (e) => {
      // Escape steps back one level: from a panel to the choices (the box only closes the room after that)
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        goBack();
      }
    });

    if (!choices.length) el.insertAdjacentHTML('beforeend', '<p class="ks-empty">Nothing here yet.</p>');

    api.signal.addEventListener('abort', stop, { once: true });
    return stop;
  },
};
