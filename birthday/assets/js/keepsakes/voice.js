// Hear it in my voice (the Keepsake Box): the owner's voice note (admin → Audio), to play again any time.
// A big play/pause button, a seek slider, −10 s / +10 s, the time, and honest states: "Loading…" (aria-busy)
// until it can play and whenever it is waiting for data, and one gentle line if it can't play on this device.
// Never plays by itself. While it plays the film's music steps back (ducked, like the letter's voice note) and
// comes back on pause, at the end, and when the room closes; a hidden tab pauses it.
const VOICE_TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg; codecs=opus', webm: 'audio/webm' };
const FAIL_TEXT = 'The voice note couldn’t play on this device.';
const SKIP = 10;

/** 65 → "1:05" (and "1:02:05" past an hour); unknown → "–:––". */
export function clock(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '–:––';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

// a drawn waveform for the look of it (the same every time; it is a picture, not a measurement)
function bars(n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const h = 22 + Math.round(Math.abs(Math.sin(i * 0.9) * 0.55 + Math.sin(i * 0.37 + 1) * 0.35) * 70);
    out += `<i style="height:${Math.min(100, h)}%"></i>`;
  }
  return out;
}

const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6.5" y="5.5" width="4" height="13" rx="1"/><rect x="13.5" y="5.5" width="4" height="13" rx="1"/></svg>';

export default {
  open(api, el) {
    const { esc } = api;
    const intro = api.t('intro');
    const src = api.media('voice');
    const uid = Math.random().toString(36).slice(2, 8);
    if (!src) {
      el.innerHTML = `
        ${intro ? `<p class="ks-lead">${esc(intro)}</p>` : ''}
        <p class="ks-empty" tabindex="-1" data-autofocus>There’s no voice note here yet.</p>`;
      return undefined;
    }

    el.innerHTML = `
      ${intro ? `<p class="ks-lead vn-intro">${esc(intro)}</p>` : ''}
      <div class="vn-player">
        <div class="vn-top">
          <button type="button" class="vn-play" aria-pressed="false" aria-label="Play the voice note" data-autofocus>${PLAY_ICON}</button>
          <div class="vn-wave" aria-hidden="true"><div class="vn-bars">${bars(44)}</div><div class="vn-bars is-fill">${bars(44)}</div></div>
        </div>
        <div class="vn-seek-row" aria-busy="true">
          <label class="sr-only" for="vn-seek-${uid}">Where you are in the voice note</label>
          <input type="range" class="vn-seek" id="vn-seek-${uid}" min="0" max="1" step="1" value="0" disabled aria-valuetext="0:00">
          <p class="vn-time" aria-hidden="true"><span class="vn-cur">0:00</span><span class="vn-sep"> / </span><span class="vn-dur">–:––</span></p>
        </div>
        <div class="ks-row vn-skips">
          <button type="button" class="ks-btn is-quiet vn-back" aria-label="Back 10 seconds" disabled><span aria-hidden="true">−10s</span></button>
          <button type="button" class="ks-btn is-quiet vn-fwd" aria-label="Forward 10 seconds" disabled><span aria-hidden="true">+10s</span></button>
        </div>
        <p class="vn-status">Loading…</p>
      </div>`;

    const player = el.querySelector('.vn-player');
    const seekRow = el.querySelector('.vn-seek-row');
    const playBtn = el.querySelector('.vn-play');
    const seek = el.querySelector('.vn-seek');
    const cur = el.querySelector('.vn-cur');
    const dur = el.querySelector('.vn-dur');
    const back = el.querySelector('.vn-back');
    const fwd = el.querySelector('.vn-fwd');
    const status = el.querySelector('.vn-status');
    const wave = el.querySelector('.vn-wave');

    const a = new Audio();
    a.preload = 'auto';
    const on = { signal: api.signal };
    let failed = false;
    let ducked = false;
    let scrubbing = false;
    let stopped = false;

    const duck = (down) => {
      if (down === ducked) return;
      ducked = down;
      try { api.audio.duck(down ? 0.1 : 1, down ? 3600 : 0.1); } catch { /* the music is optional */ }
    };
    const busy = (yes) => {
      seekRow.setAttribute('aria-busy', String(yes)); // on the slider row, not around the play button
      player.classList.toggle('is-loading', yes);
      if (yes) status.textContent = 'Loading…';
      else if (status.textContent === 'Loading…') status.textContent = '';
    };
    const known = () => Number.isFinite(a.duration) && a.duration > 0;
    const show = () => {
      const d = known() ? a.duration : NaN;
      const t = Math.min(a.currentTime || 0, Number.isFinite(d) ? d : Infinity);
      cur.textContent = clock(t);
      dur.textContent = clock(d);
      seek.setAttribute('aria-valuetext', Number.isFinite(d) ? `${clock(t)} of ${clock(d)}` : clock(t));
      if (!scrubbing) seek.value = String(Math.round(t));
      wave.style.setProperty('--p', Number.isFinite(d) ? String(Math.min(1, t / d)) : '0');
    };
    const setPlaying = (playing, ended = false) => {
      playBtn.setAttribute('aria-pressed', String(playing));
      playBtn.setAttribute('aria-label', playing ? 'Playing the voice note (press to pause)' : ended ? 'Play the voice note again' : 'Play the voice note');
      playBtn.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
      player.classList.toggle('is-playing', playing);
    };
    const fail = () => {
      if (failed || stopped) return;
      failed = true;
      const hadFocus = player.contains(document.activeElement);
      duck(false);
      busy(false);
      player.classList.add('is-failed');
      setPlaying(false);
      for (const c of [playBtn, seek, back, fwd]) c.disabled = true;
      el.querySelector('.vn-top').hidden = true;
      el.querySelector('.vn-seek-row').hidden = true;
      el.querySelector('.vn-skips').hidden = true;
      status.textContent = FAIL_TEXT;
      // the controls are gone: focus (now, or when the room first places it) goes to the words instead
      playBtn.removeAttribute('data-autofocus');
      status.tabIndex = -1;
      status.setAttribute('data-autofocus', '');
      if (hadFocus) status.focus({ preventScroll: true });
      api.announce(FAIL_TEXT);
      try { a.removeAttribute('src'); a.load(); } catch { /* ignore */ }
    };

    // a file this browser says it can't play: say so at once, no button that would only fail
    const ext = String(src).split(/[?#]/)[0].split('.').pop().toLowerCase();
    if (VOICE_TYPES[ext] && !a.canPlayType(VOICE_TYPES[ext])) { fail(); return () => {}; }

    a.addEventListener('loadedmetadata', () => {
      if (known()) {
        seek.max = String(Math.max(1, Math.round(a.duration)));
        seek.disabled = false;
        back.disabled = false;
        fwd.disabled = false;
      }
      show();
    }, on);
    a.addEventListener('durationchange', () => { if (known()) seek.max = String(Math.max(1, Math.round(a.duration))); show(); }, on);
    a.addEventListener('canplay', () => busy(false), on);
    a.addEventListener('waiting', () => { if (!a.paused) busy(true); }, on);
    // the browser decided to wait for a press before loading more (phones do): nothing is loading
    a.addEventListener('suspend', () => { if (a.paused && a.readyState < 3) busy(false); }, on);
    a.addEventListener('playing', () => { busy(false); duck(true); setPlaying(true); }, on);
    a.addEventListener('play', () => setPlaying(true), on);
    a.addEventListener('pause', () => { duck(false); if (!a.ended) setPlaying(false); show(); }, on);
    a.addEventListener('ended', () => { duck(false); setPlaying(false, true); show(); api.announce('The voice note has finished.'); }, on);
    a.addEventListener('timeupdate', show, on);
    a.addEventListener('seeked', show, on);
    a.addEventListener('error', fail, on);
    a.src = src;

    playBtn.addEventListener('click', () => {
      if (failed) return;
      if (a.paused || a.ended) {
        const p = a.play();
        if (p && p.catch) {
          p.catch((err) => {
            if (!err || err.name === 'AbortError' || stopped) return;
            if (err.name === 'NotAllowedError') { setPlaying(false); return; } // the browser wants another press
            fail();
          });
        }
      } else {
        a.pause();
      }
    });

    const jump = (to) => {
      if (!known()) return;
      a.currentTime = Math.max(0, Math.min(a.duration, to));
      show();
    };
    seek.addEventListener('pointerdown', () => { scrubbing = true; });
    seek.addEventListener('input', () => jump(Number(seek.value)));
    seek.addEventListener('change', () => { scrubbing = false; jump(Number(seek.value)); });
    seek.addEventListener('pointerup', () => { scrubbing = false; });
    seek.addEventListener('blur', () => { scrubbing = false; });
    back.addEventListener('click', () => { jump(a.currentTime - SKIP); api.announce(seek.getAttribute('aria-valuetext')); });
    fwd.addEventListener('click', () => { jump(a.currentTime + SKIP); api.announce(seek.getAttribute('aria-valuetext')); });

    // a hidden tab pauses it (she presses play to go on)
    const onHide = () => { if (document.hidden && !a.paused) a.pause(); };
    document.addEventListener('visibilitychange', onHide);

    const stop = () => {
      if (stopped) return;
      stopped = true;
      document.removeEventListener('visibilitychange', onHide);
      try { a.pause(); } catch { /* ignore */ }
      duck(false);
      a.removeAttribute('src');
      try { a.load(); } catch { /* ignore */ }
    };
    api.signal.addEventListener('abort', stop, { once: true });
    return stop;
  },
};
