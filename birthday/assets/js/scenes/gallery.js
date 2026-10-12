// The album: extra memories added later, and every photo in the film.
// A dialog (Escape or ✕ closes it, Tab stays inside, focus returns to where it was). Tapping a photo opens it
// large: ✕ / Escape / a tap beside it closes, ‹ › / arrow keys / a swipe go to the previous and next photo,
// and "3 of 36" says where she is (also to screen readers).
import { esc } from '../core/art.js';

export function openGallery(ctx, { only = 'all', onClose = null } = {}) {
  const { gsap, audio } = ctx;
  const reduced = !!(ctx.device && ctx.device.reducedMotion);
  const t = ctx.text.credits || {};
  const g = ctx.text.gallery || {};
  const allKicker = ctx.fill(String(g.allKicker || '')).trim() || 'The album';
  const allTitle = ctx.fill(String(g.allTitle || '')).trim() || 'Every photo in this film';
  const extras = ctx.extras();
  const everything = ctx.allPhotos().filter((p) => !p.isPlaceholder);
  const showExtras = only === 'extras' || (only === 'all' && extras.length);
  const list = only === 'extras' ? extras : everything;
  // a caption or date the owner wrote (tokens filled; a line that still needs an unwritten memory is left out)
  const capOf = (p) => [ctx.fill(String(p.caption || '')).trim(), ctx.fill(String(p.date || '')).trim()];

  const wrap = document.createElement('div');
  wrap.className = 'gal';
  wrap.innerHTML = `
    <div class="gal-head">
      <div>
        <p class="gal-kicker">${only === 'extras' ? esc(t.extrasSub || 'Memories added along the way') : esc(allKicker)}</p>
        <h2 class="gal-title">${only === 'extras' ? esc(t.extrasTitle || 'More pages') : esc(allTitle)}</h2>
      </div>
      <button type="button" class="gal-close" aria-label="Close the album">✕</button>
    </div>
    <div class="gal-grid">
      ${list.map((p, i) => {
        const [cap, date] = capOf(p);
        return `
        <figure class="gal-item" data-i="${i}">
          <div class="ph" style="aspect-ratio:${p.ratio}"><img loading="lazy" decoding="async" alt="${esc(p.alt || '')}" src="${esc(p.thumbUrl || p.url)}" style="object-position:${esc(p.objectPosition || '50% 40%')}"></div>
          ${cap || date ? `<figcaption>${esc(cap)}${date ? `<span class="gal-date">${esc(date)}</span>` : ''}</figcaption>` : ''}
        </figure>`;
      }).join('')}
      ${list.length ? '' : '<p class="gal-empty">More memories are on their way…</p>'}
    </div>
    <div class="gal-light" hidden>
      <div class="gal-light-bar">
        <p class="gal-count" aria-live="polite"></p>
        <button type="button" class="gal-light-close" aria-label="Close the photo">✕</button>
      </div>
      <figure class="gal-light-fig"><img alt=""><figcaption class="gal-light-cap"></figcaption></figure>
      <button type="button" class="gal-nav gal-prev" aria-label="Previous photo">‹</button>
      <button type="button" class="gal-nav gal-next" aria-label="Next photo">›</button>
    </div>`;
  document.getElementById('ui').appendChild(wrap);
  audio.sfx('pageTurn');
  gsap.fromTo(wrap, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.25 : 0.6 });
  if (!reduced) gsap.from(wrap.querySelectorAll('.gal-item'), { opacity: 0, y: 30, duration: 0.8, stagger: 0.04, ease: 'power3.out', delay: 0.2 });

  // the open photo lives beside the album, not inside it: the album's backdrop blur would make it the
  // containing block of the fixed lightbox, which would then open at the top of the scrolled album
  const light = wrap.querySelector('.gal-light');
  document.getElementById('ui').appendChild(light);
  const lightImg = light.querySelector('img');
  const lightCap = light.querySelector('.gal-light-cap');
  const count = light.querySelector('.gal-count');
  const opener = document.activeElement;
  let current = -1;
  let lightTween = null;
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', only === 'extras' ? 'More memories' : allTitle);
  light.setAttribute('role', 'dialog');
  light.setAttribute('aria-modal', 'true');
  light.setAttribute('aria-label', 'Photo');
  lightCap.id = `gal-cap-${Date.now().toString(36)}`;
  light.setAttribute('aria-describedby', lightCap.id);
  light.tabIndex = -1;
  const multi = list.length > 1;
  light.querySelectorAll('.gal-nav').forEach((b) => { b.hidden = !multi; });
  wrap.querySelectorAll('.gal-item').forEach((it) => {
    it.tabIndex = 0;
    it.setAttribute('role', 'button');
    const p = list[Number(it.dataset.i)];
    it.setAttribute('aria-label', `${p.alt || 'Photo'}${capOf(p)[0] ? ` — ${capOf(p)[0]}` : ''}`);
  });

  const showAt = (i, dir = 0) => {
    if (!list.length) return;
    current = (i + list.length) % list.length;
    const p = list[current];
    const [cap, date] = capOf(p);
    // a reused <img>: a photo that failed before is guarded again (main.js guardImages)
    delete lightImg.dataset.fallback;
    lightImg.src = p.url;
    lightImg.alt = p.alt || '';
    light.setAttribute('aria-label', p.alt || 'Photo');
    lightCap.textContent = [cap, date].filter(Boolean).join(' · ');
    lightCap.hidden = !lightCap.textContent;
    count.textContent = multi ? `${current + 1} of ${list.length}` : '';
    if (lightTween) { lightTween.kill(); lightTween = null; } // a quick reopen must not be hidden by the last close
    if (light.hidden) {
      light.hidden = false;
      gsap.fromTo(light, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.2 : 0.4 });
      light.focus({ preventScroll: true });
    } else gsap.set(light, { opacity: 1 });
    if (reduced) gsap.fromTo(lightImg, { opacity: 0.4 }, { opacity: 1, duration: 0.3 });
    else gsap.fromTo(lightImg, { x: dir * 26, scale: 0.96, opacity: 0.4 }, { x: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out' });
    audio.sfx('tap');
  };
  const hideLight = () => {
    if (light.hidden) return;
    lightTween = gsap.to(light, { opacity: 0, duration: reduced ? 0.15 : 0.3, onComplete: () => { light.hidden = true; lightTween = null; } });
    const item = wrap.querySelector(`.gal-item[data-i="${current}"]`);
    item && item.focus({ preventScroll: true });
  };
  wrap.querySelector('.gal-grid').addEventListener('click', (e) => {
    const item = e.target.closest('.gal-item');
    if (item) showAt(Number(item.dataset.i));
  });
  // swipe (touch) or drag (mouse) between photos; the click that ends a drag never closes the photo
  let sx = null;
  let sy = null;
  let dragged = false;
  light.addEventListener('pointerdown', (e) => { dragged = false; if (!e.target.closest('button')) { sx = e.clientX; sy = e.clientY; } });
  light.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    sx = sy = null;
    if (multi && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      // only the click that ends this same drag is ignored (a touch swipe has none, so it clears at once)
      dragged = true;
      setTimeout(() => { dragged = false; }, 0);
      showAt(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
  });
  light.addEventListener('pointercancel', () => { sx = sy = null; });
  light.addEventListener('click', (e) => {
    if (dragged) { dragged = false; return; }
    if (e.target.closest('.gal-prev')) { showAt(current - 1, -1); return; }
    if (e.target.closest('.gal-next')) { showAt(current + 1, 1); return; }
    if (e.target.closest('.gal-light-close')) { hideLight(); return; }
    if (e.target.closest('.gal-light-fig img')) return; // a tap on the photo itself keeps it open
    hideLight(); // a tap beside it
  });

  let closed = false;
  const close = ({ fromHistory = false } = {}) => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey, true);
    gsap.to([wrap, light], { opacity: 0, duration: reduced ? 0.2 : 0.5, onComplete: () => { wrap.remove(); light.remove(); } });
    opener && opener.isConnected && opener.focus && opener.focus({ preventScroll: true });
    if (!fromHistory && onClose) onClose();
  };
  const trap = (root, e) => {
    const f = [...root.querySelectorAll('button, .gal-item')].filter((x) => !x.hidden && !x.disabled && x.getClientRects().length);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
  };
  function onKey(e) {
    if (!light.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hideLight(); } else if (e.key === 'ArrowRight' && multi) { e.preventDefault(); e.stopPropagation(); showAt(current + 1, 1); } else if (e.key === 'ArrowLeft' && multi) { e.preventDefault(); e.stopPropagation(); showAt(current - 1, -1); } else if (e.key === 'Tab') trap(light, e);
      if (['Enter', ' ', 'ArrowRight', 'ArrowLeft'].includes(e.key)) e.stopPropagation(); // never the film's Continue
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('gal-item')) {
      e.preventDefault(); e.stopPropagation(); showAt(Number(e.target.dataset.i)); return;
    }
    if (e.key === 'Tab') trap(wrap, e); // keep focus inside the album
    if (['Enter', ' ', 'ArrowRight', 'ArrowLeft'].includes(e.key)) e.stopPropagation(); // don't trigger the film's Continue
  }
  window.addEventListener('keydown', onKey, true);
  wrap.querySelector('.gal-close').addEventListener('click', () => close());
  setTimeout(() => wrap.querySelector('.gal-close').focus({ preventScroll: true }), 50);
  ctx.signal.addEventListener('abort', () => { window.removeEventListener('keydown', onKey, true); wrap.remove(); light.remove(); });
  return { close, showExtras, el: wrap };
}
