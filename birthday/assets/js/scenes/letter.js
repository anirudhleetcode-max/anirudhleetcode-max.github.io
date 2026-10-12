// Chapter Seven — A Letter, Sealed with Sunlight.
// A wax-sealed envelope; tap the seal, and the letter writes itself out in ink.
import { sunEmblem, esc } from '../core/art.js';

function pressedFlower() {
  const petals = [0, 72, 144, 216, 288].map((a) => `<path transform="rotate(${a})" d="M0 0 C10 -8 12 -26 0 -34 C-12 -26 -10 -8 0 0 Z"/>`).join('');
  return `<svg class="lt-flower" viewBox="-60 -60 140 160" aria-hidden="true">
    <path d="M4 10 C10 40 2 70 14 96" stroke="#7d9a62" stroke-width="2.4" fill="none"/>
    <path d="M10 52 C26 44 34 30 36 22 C24 26 12 38 10 52 Z" fill="#8aa96e" opacity=".8"/>
    <g fill="#e7a3bf" opacity=".85" stroke="#c97d9c" stroke-width=".8">${petals}</g>
    <circle r="6" fill="#f2c46a"/>
  </svg>`;
}

const fmt = (sec) => (Number.isFinite(sec) ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : '');
const VOICE_TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg; codecs=opus', webm: 'audio/webm' };

/**
 * The voice note under the letter: play / pause, a thin progress line and the time, the music ducked only
 * while it really plays, paused when the tab is hidden; a file that is missing or can't play here hides
 * the player with one gentle line instead of a button that says "Pause" over silence.
 */
function setupVoice(el, { voice, audio, labels, signal }) {
  const wrap = el.querySelector('.lt-voice-wrap');
  const btn = wrap.querySelector('.lt-voice');
  const label = btn.querySelector('.lt-voice-label');
  const bar = wrap.querySelector('.lt-voice-bar i');
  const time = wrap.querySelector('.lt-voice-time');
  const note = wrap.querySelector('.lt-voice-note');
  const a = new Audio();
  a.preload = 'metadata';
  let ducked = false;
  let failed = false;
  const duck = (on) => {
    if (on === ducked) return;
    ducked = on;
    try { audio.duck(on ? 0.1 : 1, on ? 3600 : 0.1); } catch { /* sound is optional */ }
  };
  // its words say what a press does (Play / Pause / again), so it is a plain button, not a toggle
  const show = (state) => {
    label.textContent = state === 'playing' ? labels.pause : state === 'ended' ? labels.again : labels.play;
    btn.dataset.state = state;
    wrap.classList.toggle('is-playing', state === 'playing');
  };
  const fail = () => {
    if (failed) return;
    failed = true;
    duck(false);
    a.removeAttribute('src');
    btn.hidden = true;
    wrap.querySelector('.lt-voice-bar').hidden = true;
    time.hidden = true;
    note.textContent = 'The voice note couldn’t play on this device. The letter says it all.';
  };
  const ext = String(voice).split(/[?#]/)[0].split('.').pop().toLowerCase();
  if (VOICE_TYPES[ext] && !a.canPlayType(VOICE_TYPES[ext])) { wrap.hidden = false; fail(); return { stop() {}, destroy() {} }; }
  a.src = voice;
  wrap.hidden = false;
  show('idle');
  a.addEventListener('playing', () => { duck(true); show('playing'); });
  a.addEventListener('pause', () => { duck(false); if (!a.ended) show('idle'); });
  a.addEventListener('ended', () => { duck(false); show('ended'); bar.style.transform = 'scaleX(1)'; });
  a.addEventListener('error', fail);
  const tick = () => {
    const d = a.duration;
    if (Number.isFinite(d) && d > 0) {
      bar.style.transform = `scaleX(${Math.min(1, a.currentTime / d)})`;
      time.textContent = `${fmt(a.currentTime)} / ${fmt(d)}`;
    }
  };
  a.addEventListener('timeupdate', tick);
  a.addEventListener('loadedmetadata', tick);
  btn.addEventListener('click', () => {
    if (failed) return;
    if (a.paused) a.play().catch((err) => { if (err && err.name !== 'AbortError') fail(); });
    else a.pause();
  });
  // a hidden tab pauses it (she taps to go on)
  const onHide = () => { if (document.hidden && !a.paused) a.pause(); };
  document.addEventListener('visibilitychange', onHide);
  signal.addEventListener('abort', () => document.removeEventListener('visibilitychange', onHide), { once: true });
  return {
    stop() { if (!a.paused) a.pause(); duck(false); },
    destroy() { document.removeEventListener('visibilitychange', onHide); a.removeAttribute('src'); try { a.load(); } catch { /* ignore */ } },
  };
}

export default {
  id: 'letter',
  title: 'A Letter',
  async enter(ctx, el) {
    const { gsap, ui, audio, fx } = ctx;
    this.audio = audio;
    const t = ctx.text.letter || {};
    const from = ctx.site.from || {};
    const pics = ctx.photos('letter', { limit: 3 });
    // fetch the copy the polaroid's srcset will use on this screen (its slot matches `sizes` below)
    const slot = window.innerWidth <= 700 ? window.innerWidth * 0.42 : 240;
    await Promise.all(pics.map((p) => ctx.preload(ctx.photoSrc ? ctx.photoSrc(p, slot) : p.url)));
    const voice = ctx.media('voice');
    const reduced = !!ctx.device.reducedMotion;
    // the voice note's words are the owner's (Messages → The letter), with gentle defaults
    const voiceLabels = {
      play: ctx.fill(String(t.voicePlay || '')).trim() || '▶  Hear it in my voice',
      pause: ctx.fill(String(t.voicePause || '')).trim() || '❚❚  Pause',
      again: ctx.fill(String(t.voiceAgain || '')).trim() || '▶  Hear it again',
    };
    // paragraphs built on a memory that hasn't been written yet fill to '' and are left out
    const body = (t.body || []).filter(Boolean).map((b) => ctx.fill(b)).filter(Boolean);
    const ps = t.ps ? ctx.fill(t.ps) : '';
    const mid = Math.max(1, Math.ceil(body.length / 2));
    const pin = (p, k) => p ? `<figure class="lt-pin lt-pin-${k + 1} polaroid"><i class="lt-tape"></i><div class="ph" style="aspect-ratio:${p.ratio}"><img alt="${esc(p.alt)}"${p.srcset ? ` srcset="${esc(p.srcset)}" sizes="(max-width: 700px) 42vw, 240px"` : ''} src="${esc(p.url)}" style="object-position:${esc(p.objectPosition)}"></div>${p.caption ? `<figcaption class="cap">${esc(p.caption)}</figcaption>` : ''}</figure>` : '';

    el.innerHTML = `
      <div class="lt-bg"></div>
      <div class="lt-desk" aria-hidden="true">
        <div class="lt-candle"><i class="lt-wax"></i><i class="lt-wick"></i><i class="lt-flame"></i><i class="lt-candleglow"></i></div>
        <svg class="lt-quill" viewBox="0 0 200 60"><path d="M6 52 C60 40 120 22 194 6 C170 26 120 40 70 48 C46 52 22 54 6 52 Z" fill="#efe3cf" opacity=".9"/><path d="M8 52 C70 38 130 22 192 7" stroke="#b79b72" stroke-width="1.4" fill="none"/></svg>
      </div>
      <div class="lt-env-wrap">
        <div class="lt-env">
          <div class="lt-back"></div>
          <div class="lt-peek"></div>
          <div class="lt-front"></div>
          <div class="lt-flap"><div class="lt-flap-in"></div></div>
          <button type="button" class="lt-seal" aria-label="Open the letter">${sunEmblem({ glow: false, fill: '#8a2d4d', inner: '#5e1a33', stroke: '#c75a7d' })}</button>
          <p class="lt-to">${esc(ctx.fill('for {name}'))}</p>
        </div>
        <p class="lt-tap">${esc(ctx.fill(t.tapSeal || 'Tap the seal to open'))}</p>
      </div>
      <div class="lt-paper" hidden>
        <div class="lt-scroll">
          <div class="lt-inner">
            ${pin(pics[0], 0)}
            <h3 class="lt-salute">${esc(ctx.fill(t.salutation || 'Dear {name},'))}</h3>
            ${body.slice(0, mid).map((p) => `<p class="lt-p">${esc(p)}</p>`).join('')}
            ${pin(pics[1], 1)}
            ${body.slice(mid).map((p) => `<p class="lt-p">${esc(p)}</p>`).join('')}
            ${pin(pics[2], 2)}
            <p class="lt-sign">${esc(ctx.fill(t.signoff || from.signoff || ''))}</p>
            <p class="lt-from">${esc(ctx.fill(from.name || ''))}</p>
            ${ps ? `<p class="lt-p lt-ps">${esc(ps)}</p>` : ''}
            ${voice ? `<div class="lt-voice-wrap" hidden><button type="button" class="btn-ghost lt-voice" data-state="idle"><span class="lt-voice-label">${esc(voiceLabels.play)}</span></button><div class="lt-voice-bar" aria-hidden="true"><i></i></div><span class="lt-voice-time" aria-hidden="true"></span><p class="lt-voice-note" role="status"></p></div>` : ''}
            ${pressedFlower()}
          </div>
        </div>
      </div>`;

    const env = el.querySelector('.lt-env');
    const seal = el.querySelector('.lt-seal');
    const flap = el.querySelector('.lt-flap');
    const peek = el.querySelector('.lt-peek');
    const tap = el.querySelector('.lt-tap');
    const paper = el.querySelector('.lt-paper');
    const scroller = el.querySelector('.lt-scroll');

    fx.dust({ density: 0.35 });
    audio.setMood('tender');
    ctx.letterbox(true);
    await ui.chapterCard(t.kicker || 'Chapter Seven', t.title || 'A Letter You Were Supposed to Read');

    gsap.fromTo(env, { y: reduced ? 0 : 60, opacity: 0, rotationX: reduced ? 0 : 20 }, { y: 0, opacity: 1, rotationX: 0, duration: reduced ? 0.8 : 1.8, ease: 'power3.out' });
    gsap.fromTo(tap, { opacity: 0 }, { opacity: 0.8, duration: 1, delay: reduced ? 0.6 : 1.6 });
    if (!reduced) {
      gsap.to(seal, { scale: 1.06, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.to(env, { y: -6, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.8 });
    }

    await new Promise((resolve) => {
      seal.addEventListener('click', resolve, { once: true });
      env.addEventListener('click', resolve, { once: true });
    });
    if (ctx.signal.aborted) return;
    gsap.killTweensOf([seal, env]);
    audio.sfx('magic');
    const sr = seal.getBoundingClientRect();
    fx.sparkle(sr.left + sr.width / 2, sr.top + sr.height / 2, 24, { spread: 70 });
    gsap.to(tap, { opacity: 0, duration: 0.4 });
    gsap.fromTo(el.querySelector('.lt-flame'), { scaleY: 1 }, { scaleY: 1.35, scaleX: 0.8, duration: 0.18, yoyo: true, repeat: 5, transformOrigin: '50% 100%' });
    const open = gsap.timeline();
    open.to(seal, { scale: 1.3, opacity: 0, rotation: 25, duration: 0.7, ease: 'power2.in' })
      .to(flap, { rotationX: 180, duration: 1.1, ease: 'power2.inOut' }, 0.4)
      .set(flap, { zIndex: 0 }, 0.95)
      .to(peek, { yPercent: -55, duration: 1.2, ease: 'power2.out' }, 1.2)
      .to(env, { y: '30vh', opacity: 0, scale: 0.9, duration: 1.1, ease: 'power2.in' }, 2.4);
    audio.sfx('pageTurn');
    await open.then();

    // the letter (focus leaves the seal, which has gone: the paper itself, so arrow keys scroll it)
    paper.hidden = false;
    scroller.tabIndex = 0; // a scrollable region she can reach and scroll by keyboard (Continue won't take its focus)
    scroller.setAttribute('role', 'region');
    scroller.setAttribute('aria-label', 'The letter');
    if (document.activeElement === seal || !document.activeElement || document.activeElement === document.body) scroller.focus({ preventScroll: true });
    gsap.fromTo(paper, { opacity: 0, y: 50, scale: 0.94, rotationX: 12 }, { opacity: 1, y: 0, scale: 1, rotationX: 0, duration: 1.4, ease: 'power3.out' });
    audio.sfx('pageTurn');

    // split every written element into characters (the drawing only: screen readers get each paragraph whole)
    const writeEls = [...el.querySelectorAll('.lt-salute, .lt-p, .lt-sign, .lt-from')];
    const chunks = writeEls.map((w) => {
      const text = w.textContent;
      w.textContent = '';
      const said = document.createElement('span');
      said.className = 'sr-only';
      said.textContent = text;
      const drawn = document.createElement('span');
      drawn.className = 'lt-ink';
      drawn.setAttribute('aria-hidden', 'true');
      w.append(said, drawn);
      const spans = [];
      for (const word of text.split(/(\s+)/)) {
        if (!word) continue;
        if (/^\s+$/.test(word)) { drawn.appendChild(document.createTextNode(' ')); continue; }
        const ws = document.createElement('span');
        ws.className = 'lt-w';
        for (const ch of word) {
          const c = document.createElement('span');
          c.className = 'lt-c';
          c.textContent = ch;
          ws.appendChild(c);
          spans.push(c);
        }
        drawn.appendChild(ws);
      }
      return { el: w, spans };
    });
    const pins = [...el.querySelectorAll('.lt-pin')];
    gsap.set(pins, { opacity: 0 });

    // the voice note can play while she reads (it never starts by itself)
    if (voice) this.voice = setupVoice(el, { voice, audio, labels: voiceLabels, signal: ctx.signal });

    const cps = 34; // characters per second
    let lastChar = null;
    const tl = gsap.timeline({ paused: true });
    let at = 0.6;
    if (pins[0] && pins[0].nextElementSibling === chunks[0]?.el) tl.call(() => dropPin(0), [], at);
    chunks.forEach((c, idx) => {
      const k = pins.indexOf(c.el.previousElementSibling);
      if (k > 0) tl.call(() => dropPin(k), [], at);
      if (reduced) {
        // reduced motion: each paragraph simply appears, no blur, no letter-by-letter
        tl.set(c.spans, { opacity: 1 }, at);
        at += 0.05;
        return;
      }
      tl.fromTo(c.spans, { opacity: 0, filter: 'blur(3px)' }, {
        opacity: 1, filter: 'blur(0px)', duration: 0.35, ease: 'none',
        stagger: { each: 1 / cps, onStart() { lastChar = this.targets()[0]; } },
      }, at);
      tl.call(() => follow(c.el), [], at + 0.1);
      at += c.spans.length / cps + (idx === 0 ? 0.9 : 0.7);
    });
    if (reduced) gsap.set(chunks.flatMap((c) => c.spans), { opacity: 0 });
    const dropPin = (k) => {
      if (reduced) gsap.set(pins[k], { opacity: 1, y: 0, rotation: k % 2 ? -4 : 6, scale: 1 });
      else gsap.fromTo(pins[k], { opacity: 0, y: -40, rotation: k % 2 ? -14 : 14, scale: 1.1 }, { opacity: 1, y: 0, rotation: k % 2 ? -4 : 6, scale: 1, duration: 1.1, ease: 'back.out(1.6)' });
      if (!jumping) audio.sfx('chime');
    };

    // never fight the reader: once she scrolls back up (to re-read), the letter stops scrolling for her
    // until she comes back down to the newest line herself
    let scripted = false;
    let away = false;
    let jumping = false; // "Show it all" in progress
    let lastTop = 0;
    const atHead = () => {
      if (!lastChar || scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8) return true;
      const r = lastChar.getBoundingClientRect();
      const sr2 = scroller.getBoundingClientRect();
      return r.bottom <= sr2.bottom + 4 && r.bottom >= sr2.top + sr2.height * 0.45;
    };
    const onScroll = () => {
      const top = scroller.scrollTop;
      if (!scripted) {
        if (top < lastTop - 2) away = true;
        else if (top > lastTop && atHead()) away = false;
      }
      lastTop = top;
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    // her own wheel, touch or scroll key always wins over a glide that is under way (it stops right there)
    const hers = () => { if (scripted) { gsap.killTweensOf(scroller, 'scrollTop'); scripted = false; } };
    scroller.addEventListener('wheel', hers, { passive: true });
    scroller.addEventListener('touchstart', hers, { passive: true });
    scroller.addEventListener('pointerdown', hers);
    scroller.addEventListener('keydown', (e) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) hers(); });
    const glide = (top, duration) => {
      scripted = true;
      gsap.to(scroller, { scrollTop: top, duration, ease: 'power2.inOut', overwrite: true, onComplete: () => { scripted = false; } });
    };
    const follow = (node) => {
      if (away || jumping) return;
      const target = node.offsetTop - scroller.clientHeight * 0.35;
      if (target > scroller.scrollTop) glide(target, 1.4);
    };
    // keep the newest line in view while writing
    const keepUp = setInterval(() => {
      if (lastChar && !away) {
        const r = lastChar.getBoundingClientRect();
        const sr2 = scroller.getBoundingClientRect();
        if (r.bottom > sr2.bottom - sr2.height * 0.22) glide(scroller.scrollTop + (r.bottom - (sr2.bottom - sr2.height * 0.45)), 1.2);
      }
    }, 900);
    ctx.signal.addEventListener('abort', () => clearInterval(keepUp));

    await ctx.wait(reduced ? 0.4 : 1.2);
    // tap the letter to write faster; "Show it all" writes the rest at once (also by keyboard)
    const faster = (e) => { if (e.target.closest('button')) return; tl.timeScale(Math.min(8, tl.timeScale() * 2.5)); };
    // writes the rest at once where she is reading: no scroll down to the sign-off, no burst of chimes
    function showAll() {
      jumping = true;
      tl.progress(1);
      jumping = false;
      gsap.killTweensOf(scroller, 'scrollTop');
      scripted = false;
      pins.forEach((pin, k) => gsap.set(pin, { opacity: 1, y: 0, rotation: k % 2 ? -4 : 6, scale: 1 }));
    }
    let allBtn = null;
    let hint = null;
    if (!reduced) {
      paper.addEventListener('click', faster);
      hint = ui.hint(t.fasterHint || 'Tap the letter to write faster');
      setTimeout(() => hint.remove(), 4500);
      allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'lt-all';
      allBtn.textContent = ctx.fill(String(t.showAll || '')).trim() || 'Show it all';
      el.appendChild(allBtn);
      gsap.fromTo(allBtn, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.6 });
      allBtn.addEventListener('click', showAll);
    }
    // by keyboard: Enter (or Space, away from a button) writes the rest at once, like "Show it all"
    const onKey = (e) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || tl.progress() >= 1) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target && e.target.closest && e.target.closest('button, a[href], input, textarea, select')) return;
      e.preventDefault();
      showAll();
    };
    window.addEventListener('keydown', onKey);
    ctx.signal.addEventListener('abort', () => window.removeEventListener('keydown', onKey), { once: true });
    tl.play();
    await tl.then();
    window.removeEventListener('keydown', onKey);
    clearInterval(keepUp);
    paper.removeEventListener('click', faster);
    if (allBtn) gsap.to(allBtn, { opacity: 0, duration: 0.4, onComplete: () => allBtn.remove() });
    audio.sfx('sparkle');
    await ctx.wait(1.5);
    await ui.waitContinue('Keep going');
    if (this.voice) this.voice.stop();
    const fl = el.querySelector('.lt-flame').getBoundingClientRect();
    ctx.next({ kind: 'ember', x: fl.left + fl.width / 2, y: fl.top + fl.height / 2, color: '#ffb347' });
  },
  async exit() {
    if (this.voice) { this.voice.stop(); this.voice.destroy(); this.voice = null; }
  },
};
