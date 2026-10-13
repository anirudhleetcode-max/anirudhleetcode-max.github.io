// A lantern for your wish (the Keepsake Box): she writes a wish and lets a paper lantern go into a small night
// sky, where it becomes one more distant light. Pure DOM + SVG (no WebGL, no canvas).
//
// Her wish never leaves this screen, and the room's privacy line says so, so it has to be true:
//   • it is never stored (no localStorage, sessionStorage, IndexedDB or cookie), never sent (no request of any
//     kind), never put in the address or the history, never logged;
//   • there is no <form> and the box has no name, so nothing can ever submit it anywhere;
//   • the words are read from the box exactly once (writeWishOn), straight onto the lantern, and the box is
//     emptied in the same step; no variable or callback here keeps them;
//   • once the lantern is far away its words are removed from the page; closing the room removes them at once.
// Release: the button, Enter in the box, or (pointer) dragging the lantern upwards. Reduced motion: the lantern
// simply appears high in the sky and fades to a light (no rising, no sway).
import { lanternSVG } from '../core/art.js';
import { KEEPSAKE_TEXT } from '../shared/keepsakes.js';

const MAX_LIGHTS = 30; // distant lights kept in the sky (the oldest goes first)
const MAX_FLYING = 6; // lanterns in the air at once (a quick run of wishes hurries the oldest along)
const FLIGHT = 7; // seconds from her hands to a distant light

/** A fixed little starfield (the same every visit). */
function starfield(n) {
  let s = 20;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = (rnd() * 100).toFixed(2);
    const y = (rnd() * 78).toFixed(2);
    const size = (1 + rnd() * 1.8).toFixed(2);
    const d = (rnd() * 4).toFixed(2);
    out += `<i class="wl-star${i % 3 === 0 ? ' is-twinkle' : ''}" style="left:${x}%;top:${y}%;--s:${size}px;--d:-${d}s"></i>`;
  }
  return out;
}

const hills = '<svg class="wl-hills" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 34 C40 22 70 26 104 34 S170 18 214 28 S300 40 340 26 S386 22 400 28 V60 H0 Z"/><path class="wl-hills-near" d="M0 46 C50 36 96 40 140 48 S236 38 280 46 S360 52 400 42 V60 H0 Z"/></svg>';

export default {
  open(api, el) {
    const { esc, gsap, reduced } = api;
    const base = KEEPSAKE_TEXT.wish;
    const word = (k) => api.t(k) || api.fill(base[k]);
    const intro = api.t('intro');
    const uid = Math.random().toString(36).slice(2, 8);
    el.classList.toggle('is-reduced', !!reduced);
    el.innerHTML = `
      ${intro ? `<p class="ks-lead wl-intro" tabindex="-1" data-autofocus>${esc(intro)}</p>` : ''}
      <div class="wl-sky" aria-hidden="true">
        <div class="wl-stars">${starfield(46)}</div>
        <div class="wl-lights"></div>
        ${hills}
        <div class="wl-flying"></div>
        <div class="wl-ready"><div class="wl-ready-bob">${lanternSVG({ lit: true, className: 'wl-svg' })}</div></div>
        <p class="wl-hint">Drag the lantern up to let it go</p>
      </div>
      <div class="wl-form">
        <label class="wl-label" for="wl-wish-${uid}">Your wish</label>
        <div class="wl-field">
          <input id="wl-wish-${uid}" class="wl-input" type="text"${intro ? '' : ' data-autofocus'} maxlength="200" autocomplete="off" spellcheck="false" autocorrect="off" enterkeyhint="go" placeholder="${esc(word('placeholder'))}" aria-describedby="wl-privacy-${uid}">
          <button type="button" class="ks-btn wl-go">${esc(word('button'))}</button>
        </div>
        <p class="ks-small wl-privacy" id="wl-privacy-${uid}">${esc(word('privacy'))}</p>
      </div>
      <div class="wl-after" hidden>
        <p class="wl-after-text">${esc(word('after'))}</p>
        <button type="button" class="ks-btn is-quiet wl-again">${esc(word('again'))}</button>
      </div>`;

    const sky = el.querySelector('.wl-sky');
    const lights = el.querySelector('.wl-lights');
    const flyingHost = el.querySelector('.wl-flying');
    const ready = el.querySelector('.wl-ready');
    const input = el.querySelector('.wl-input');
    const goBtn = el.querySelector('.wl-go');
    const after = el.querySelector('.wl-after');
    const againBtn = el.querySelector('.wl-again');
    const afterWords = word('after');

    const tweens = new Set(); // every tween, timeline and delayed call this room starts
    const keep = (t) => {
      if (tweens.size > 40) for (const old of tweens) if (!old.isActive() && old.totalProgress() >= 1) tweens.delete(old);
      tweens.add(t);
      return t;
    };
    const flying = []; // { el, tl, sway } in the air, oldest first
    let stopped = false;

    /* ---- the sky's distant lights ---- */
    function addLight(xPct, yPct) {
      const light = document.createElement('i');
      light.className = 'wl-light';
      light.style.left = `${xPct}%`;
      light.style.top = `${yPct}%`;
      light.style.setProperty('--d', `-${(Math.random() * 5).toFixed(2)}s`);
      lights.appendChild(light);
      while (lights.children.length > MAX_LIGHTS) lights.firstElementChild.remove();
      if (reduced) keep(gsap.fromTo(light, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'none' }));
      else keep(gsap.fromTo(light, { opacity: 0, scale: 2.2 }, { opacity: 1, scale: 1, duration: 1.1, ease: 'power2.out' }));
    }

    /* ---- the lantern waiting in her hands ---- */
    let readyAway = false;
    let readyCall = null;
    function hideReady() {
      readyAway = true;
      gsap.killTweensOf(ready);
      gsap.set(ready, { opacity: 0, y: 0 });
      if (readyCall) { readyCall.kill(); tweens.delete(readyCall); }
      readyCall = keep(gsap.delayedCall(reduced ? 0.5 : 2.2, () => {
        readyAway = false;
        if (reduced) keep(gsap.to(ready, { opacity: 1, duration: 0.35, ease: 'none' }));
        else keep(gsap.fromTo(ready, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }));
      }));
    }

    /** The only place the wish is read: from the box onto the lantern, and the box is emptied at once. */
    function writeWishOn(words) {
      words.textContent = input.value.trim();
      input.value = '';
    }

    function makeFlyer() {
      const f = document.createElement('div');
      f.className = 'wl-flyer';
      f.innerHTML = `<div class="wl-sway">${lanternSVG({ lit: true, className: 'wl-svg' })}<span class="wl-words" translate="no"></span></div>`;
      return f;
    }

    /** A lantern far away: its words leave the page, and a small light stays (quietly, when hurried along). */
    function arrive(item, hurried = false) {
      const i = flying.indexOf(item);
      if (i < 0) return;
      flying.splice(i, 1);
      item.tl.kill(); tweens.delete(item.tl);
      if (item.sway) { item.sway.kill(); tweens.delete(item.sway); }
      const words = item.el.querySelector('.wl-words');
      if (words) words.remove();
      addLight(item.x, item.y);
      const f = item.el;
      keep(gsap.to(f, { opacity: 0, duration: reduced ? 0.5 : 0.8, ease: 'power1.out', onComplete: () => f.remove() }));
      if (!stopped && !hurried) api.audio.sfx('sparkle');
    }

    function release() {
      if (stopped) return;
      const sr = sky.getBoundingClientRect();
      const rr = ready.getBoundingClientRect();
      const W = sr.width || 1;
      const H = sr.height || 1;
      const flyer = makeFlyer();
      const words = flyer.querySelector('.wl-words');
      writeWishOn(words);
      // where it ends up: a distant light somewhere in the upper sky
      const xPct = 12 + Math.random() * 76;
      const yPct = 7 + Math.random() * 36;
      const sx = rr.width ? rr.left - sr.left + rr.width / 2 : W / 2;
      const sy = rr.height ? rr.top - sr.top + rr.height / 2 : H * 0.7;
      const tx = (xPct / 100) * W;
      const ty = (yPct / 100) * H;
      flyingHost.appendChild(flyer);
      const sway = flyer.querySelector('.wl-sway');
      const item = { el: flyer, tl: null, sway: null, x: xPct, y: yPct };
      if (reduced) {
        // it simply appears high in the sky, lingers, and fades to a light
        flyer.style.left = `${xPct}%`;
        flyer.style.top = `${Math.min(yPct + 8, 50)}%`;
        gsap.set(flyer, { xPercent: -50, yPercent: -50, scale: 0.42, opacity: 0 });
        gsap.set(words, { opacity: 0.85 });
        item.tl = keep(gsap.timeline({ onComplete: () => arrive(item) })
          .to(flyer, { opacity: 1, duration: 0.3, ease: 'none' })
          .to({}, { duration: 1.8 }));
      } else {
        flyer.style.left = `${sx}px`;
        flyer.style.top = `${sy}px`;
        gsap.set(flyer, { xPercent: -50, yPercent: -50 });
        gsap.set(words, { opacity: 0.9 });
        item.sway = keep(gsap.fromTo(sway, { x: -9, rotation: -3.5 }, { x: 9, rotation: 3.5, duration: 1.7, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
        item.tl = keep(gsap.timeline({ onComplete: () => arrive(item) })
          // further away, it seems to slow and shrink, as a real one does
          .to(flyer, { x: tx - sx, duration: FLIGHT, ease: 'sine.inOut' }, 0)
          .to(flyer, { y: ty - sy, duration: FLIGHT, ease: 'sine.out' }, 0)
          .to(flyer, { scale: 0.1, duration: FLIGHT, ease: 'power1.out' }, 0)
          .to(words, { opacity: 0, duration: FLIGHT * 0.42, ease: 'power2.in' }, 0.9)
          // far enough away: the words are gone from the page, not just invisible
          .call(() => { const w = flyer.querySelector('.wl-words'); if (w) w.remove(); }, null, FLIGHT * 0.62));
      }
      flying.push(item);
      // a quick run of wishes: the oldest lantern in the air hurries to its light
      while (flying.length > MAX_FLYING) arrive(flying[0], true);
      hideReady();
      after.hidden = false;
      api.announce(afterWords);
      api.audio.sfx('magic');
    }

    /* ---- the three ways to let it go ---- */
    goBtn.addEventListener('click', () => release());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); release(); }
    });
    input.addEventListener('input', () => { after.hidden = true; });
    againBtn.addEventListener('click', () => { after.hidden = true; input.focus(); });

    // drag the waiting lantern upwards (the button and Enter are the keyboard's way)
    let drag = null;
    const threshold = () => Math.min(90, Math.max(40, sky.getBoundingClientRect().height * 0.2));
    ready.addEventListener('pointerdown', (e) => {
      if (readyAway || stopped || (e.pointerType === 'mouse' && e.button !== 0)) return;
      drag = { id: e.pointerId, y0: e.clientY, dy: 0 };
      try { ready.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      gsap.killTweensOf(ready);
      ready.classList.add('is-held');
      e.preventDefault();
    });
    ready.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = e.clientY - drag.y0;
      drag.dy = dy;
      gsap.set(ready, { y: dy < 0 ? Math.max(dy, -sky.getBoundingClientRect().height * 0.6) : Math.min(dy * 0.25, 12) });
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const far = drag.dy <= -threshold() && e.type === 'pointerup';
      drag = null;
      ready.classList.remove('is-held');
      if (far) release();
      else if (reduced) gsap.set(ready, { y: 0 });
      else keep(gsap.to(ready, { y: 0, duration: 0.45, ease: 'back.out(2)' }));
    };
    ready.addEventListener('pointerup', endDrag);
    ready.addEventListener('pointercancel', endDrag);

    /* ---- leaving: everything stops, and no wish stays on the page ---- */
    const stop = () => {
      if (stopped) return;
      stopped = true;
      for (const t of tweens) t.kill();
      tweens.clear();
      gsap.killTweensOf(ready);
      for (const item of flying.splice(0)) item.el.remove();
      el.querySelectorAll('.wl-words').forEach((w) => w.remove());
      input.value = '';
    };
    api.signal.addEventListener('abort', stop, { once: true });
    return stop;
  },
};
