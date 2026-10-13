// Memory stars (the Keepsake Box): one star for every memory with words (How it began), in film order, along a
// gentle constellation curve, joined in order by thin lines. Tapping a star (or Enter / Space on it) shows that
// memory underneath: its name, its When, its words and its first photo. ← → move between the stars.
//   • the places are worked out from the number of stars and the sky's width alone (the same sky every time)
//   • the lines are drawn in one by one; with reduced motion everything is simply there
// Only the owner's memories and photos; nothing is added.

const MIN_GAP = 66; // px between neighbouring stars: a 46px target each, with room to spare
const ROW_H = 108;
const PAD_X = 40;
const PAD_Y = 44;
const MAX_PER_ROW = 6;
const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/** A small, fixed wobble for star i (the golden angle keeps neighbours from lining up): never random. */
const wobble = (i, seed, amp) => Math.sin(i * 2.39996 + seed) * amp;

/**
 * Where the stars sit in a sky `W` px wide: one gentle arc when they fit on one line, else a softly waving
 * path that winds back and forth down the sky (each row set in a little from the side it turns on, so the
 * turns run on the diagonal). Deterministic: the same count and width always give the same sky.
 */
export function starLayout(n, W) {
  const usable = Math.max(0, W - 2 * PAD_X);
  const shift = Math.min(36, usable * 0.1);
  // one arc when they all fit across; else rows (each a little shorter, for the diagonal turns)
  const oneRow = n <= MAX_PER_ROW && (n < 2 || usable / (n - 1) >= MIN_GAP);
  const fit = Math.max(1, Math.floor((usable - shift) / MIN_GAP) + 1);
  let perRow = oneRow ? n : Math.max(1, Math.min(n, fit, MAX_PER_ROW));
  const rows = Math.max(1, Math.ceil(n / perRow));
  perRow = Math.ceil(n / rows); // balanced rows
  const H = rows === 1 ? 230 : rows * ROW_H + 2 * PAD_Y;
  const pts = [];
  for (let i = 0; i < n; i++) {
    let x;
    let y;
    if (n === 1) {
      x = W / 2;
      y = H / 2;
    } else if (rows === 1) {
      const t = i / (n - 1);
      x = PAD_X + t * usable + (i > 0 && i < n - 1 ? wobble(i, 0.7, 6) : 0);
      y = H / 2 + 30 - Math.sin(Math.PI * t) * 58 + wobble(i, 1.9, 9);
    } else {
      const row = Math.floor(i / perRow);
      const k = i % perRow;
      const t = perRow > 1 ? k / (perRow - 1) : 0.5;
      const ltr = row % 2 === 0;
      const a = PAD_X + (ltr ? 0 : shift);
      const b = W - PAD_X - (ltr ? shift : 0);
      x = ltr ? a + t * (b - a) : b - t * (b - a);
      y = PAD_Y + row * ROW_H + ROW_H / 2 + Math.sin(Math.PI * 1.5 * t + row * 1.3) * 15 + wobble(i, 1.9, 6);
    }
    pts.push({ x: Math.round(clamp(x, 26, W - 26) * 10) / 10, y: Math.round(clamp(y, 26, H - 26) * 10) / 10 });
  }
  return { W, H, pts };
}

/** A few faint stars behind the memories: the same ones every time (a small fixed-seed sequence). */
function specks(count = 34) {
  let s = 20070103;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  return Array.from({ length: count }, (_, i) => ({ x: rnd() * 100, y: rnd() * 100, r: rnd() < 0.25 ? 2 : 1, d: (i % 7) * 0.6 }));
}

const GLYPH = '<svg viewBox="-12 -12 24 24" aria-hidden="true" focusable="false"><path d="M0-11C1-3 3-1 11 0 3 1 1 3 0 11-1 3-3 1-11 0-3-1-1-3 0-11Z"/></svg>';

export default {
  open(api, el) {
    const { esc, gsap, reduced, signal } = api;
    const mems = api.memories();
    const intro = api.t('intro');
    if (!mems.length) {
      el.innerHTML = `${intro ? `<p class="ks-lead">${esc(intro)}</p>` : ''}<p class="ks-empty" tabindex="-1" data-autofocus>There aren’t any memories in the sky yet.</p>`;
      return undefined;
    }
    /** How a memory is named: its title; with none, its own words when they are short (else its first words). */
    const nameOf = (m) => {
      const title = String(m.title || '').trim();
      if (title) return title;
      if (wordCount(m.text) <= 24) return String(m.text || '').trim();
      return (m.name || `Memory ${mems.indexOf(m) + 1}`).replace(/[.,;:!?]…$/, '…');
    };
    el.innerHTML = `
      ${intro ? `<p class="ks-lead kst-intro">${esc(intro)}</p>` : ''}
      <div class="kst-sky" role="group" aria-label="${esc(mems.length === 1 ? 'One memory star' : `${mems.length} memory stars`)}">
        <div class="kst-specks" aria-hidden="true">${specks().map((p) => `<i style="left:${p.x.toFixed(2)}%;top:${p.y.toFixed(2)}%;--r:${p.r}px;--d:${p.d.toFixed(1)}s"></i>`).join('')}</div>
        <svg class="kst-lines" aria-hidden="true" focusable="false">${mems.slice(1).map(() => '<line/>').join('')}</svg>
        ${mems.map((m, i) => `<button type="button" class="kst-star" data-i="${i}" aria-controls="kst-detail" aria-label="${esc(nameOf(m) + (m.when ? `, ${m.when}` : ''))}"${i === 0 ? ' data-autofocus' : ''}>${GLYPH}</button>`).join('')}
      </div>
      <div class="kst-detail" id="kst-detail" aria-live="polite"></div>`;
    const sky = el.querySelector('.kst-sky');
    const svg = el.querySelector('.kst-lines');
    const lines = [...svg.querySelectorAll('line')];
    const stars = [...el.querySelectorAll('.kst-star')];
    const detail = el.querySelector('.kst-detail');
    let pts = [];
    let drawn = reduced;
    let tl = null;
    let ro = null;
    let lastW = 0;

    const place = () => {
      const W = Math.round(sky.clientWidth);
      if (!W || Math.abs(W - lastW) < 1) return;
      lastW = W;
      const lay = starLayout(mems.length, W);
      pts = lay.pts;
      sky.style.height = `${lay.H}px`;
      svg.setAttribute('viewBox', `0 0 ${lay.W} ${lay.H}`);
      svg.setAttribute('width', String(lay.W));
      svg.setAttribute('height', String(lay.H));
      stars.forEach((b, i) => { b.style.left = `${pts[i].x}px`; b.style.top = `${pts[i].y}px`; });
      lines.forEach((ln, i) => {
        const a = pts[i];
        const b = pts[i + 1];
        ln.setAttribute('x1', a.x); ln.setAttribute('y1', a.y);
        // a line still waiting to be drawn starts as a point on its first star
        ln.setAttribute('x2', drawn ? b.x : a.x); ln.setAttribute('y2', drawn ? b.y : a.y);
      });
    };
    const finishDrawing = () => {
      if (tl) { tl.kill(); tl = null; }
      drawn = true;
      lines.forEach((ln, i) => { ln.setAttribute('x2', pts[i + 1].x); ln.setAttribute('y2', pts[i + 1].y); });
      gsap.set(stars, { clearProps: 'opacity,scale' });
      sky.classList.add('is-drawn');
    };
    place();

    if (reduced) {
      sky.classList.add('is-drawn');
    } else {
      // the stars wake in order, each line drawn from one to the next
      const seg = Math.min(0.32, 2.4 / mems.length);
      tl = gsap.timeline({ delay: 0.25, onComplete: finishDrawing });
      stars.forEach((s, i) => {
        tl.fromTo(s, { opacity: 0.25, scale: 0.6 }, { opacity: 1, scale: 1, duration: seg * 1.2, ease: 'back.out(2)' }, i * seg);
        if (lines[i]) {
          const a = () => pts[i];
          const b = () => pts[i + 1];
          tl.fromTo(lines[i], { attr: { x2: () => a().x, y2: () => a().y } }, { attr: { x2: () => b().x, y2: () => b().y }, duration: seg, ease: 'none' }, i * seg + seg * 0.35);
        }
      });
    }

    // the sky follows the room's width (a turned phone, a resized window): same stars, new places, in the same
    // frame (an observer's callback runs after layout and before paint)
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(() => {
        if (signal.aborted) return;
        const before = lastW;
        place();
        if (lastW !== before && !drawn) finishDrawing();
      });
      ro.observe(sky);
    }

    /* ---------------- a memory, under the sky ---------------- */
    let current = -1;
    const cardWords = (m) => {
      const heading = nameOf(m);
      return { heading, body: heading === String(m.text || '').trim() ? '' : m.text };
    };
    const show = (i, { sound = true } = {}) => {
      current = i;
      const m = mems[i];
      stars.forEach((s, k) => { if (k === i) s.setAttribute('aria-current', 'true'); else s.removeAttribute('aria-current'); s.classList.toggle('is-on', k === i); });
      lines.forEach((ln, k) => ln.classList.toggle('is-on', k === i || k === i - 1));
      const { heading, body } = cardWords(m);
      const p = (m.photos || [])[0];
      detail.innerHTML = `
        <article class="kst-card ks-card${p ? ' has-photo' : ''}">
          ${p ? `<div class="kst-photo ks-photo" style="aspect-ratio:${clamp(Number(p.ratio) || 1, 0.66, 1.5).toFixed(4)}"><img loading="lazy" decoding="async" alt="${esc(p.alt || '')}" src="${esc(p.thumbUrl || p.url)}"${p.srcset ? ` srcset="${esc(p.srcset)}" sizes="(max-width: 520px) 80vw, 260px"` : ''} style="object-position:${esc(p.objectPosition || '50% 40%')}"></div>` : ''}
          <div class="kst-words">
            <p class="kst-count">${esc(`Star ${i + 1} of ${mems.length}`)}</p>
            <h3 class="kst-name">${esc(heading)}</h3>
            ${m.when ? `<p class="kst-when">${esc(m.when)}</p>` : ''}
            ${body ? `<p class="kst-text">${esc(body)}</p>` : ''}
          </div>
        </article>`;
      if (!reduced) gsap.fromTo(detail.firstElementChild, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' });
      if (sound) api.audio.sfx('sparkle');
    };
    sky.addEventListener('click', (e) => {
      const b = e.target.closest('.kst-star');
      if (b) show(Number(b.dataset.i));
    });
    sky.addEventListener('keydown', (e) => {
      const b = e.target.closest && e.target.closest('.kst-star');
      if (!b) return;
      const i = Number(b.dataset.i);
      let to = null;
      if (e.key === 'ArrowRight') to = (i + 1) % stars.length;
      else if (e.key === 'ArrowLeft') to = (i - 1 + stars.length) % stars.length;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = stars.length - 1;
      if (to == null) return;
      e.preventDefault();
      stars[to].focus();
      if (to !== current) show(to);
    });

    const teardown = () => {
      if (tl) { tl.kill(); tl = null; }
      if (ro) { ro.disconnect(); ro = null; }
      gsap.killTweensOf([...stars, ...lines, detail.firstElementChild].filter(Boolean));
    };
    signal.addEventListener('abort', teardown, { once: true });
    return teardown;
  },
};
