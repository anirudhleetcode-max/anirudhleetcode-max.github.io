// The scrapbook (the Keepsake Box): every real photo in the film, page by page.
//   • a page for each memory that has photos (How it began): its words in handwriting, its When, and its
//     photos as taped polaroids (with the owner's caption · date when there is one)
//   • then every other real photo as small taped prints, under the room's “More pages” heading
//   • any photo opens large in a viewer inside the room (a modal <dialog>, so it sits above the box whatever
//     scrolls or moves behind it): ✕, Escape or a tap beside it closes it; ‹ ›, the arrow keys or a swipe move
//     between photos; “3 of 36” says where she is; “From “…”” names its memory; focus comes back to the photo
// Only what is already in the film: her photos, the owner's memories, captions and dates. Nothing is added.
import { memoryTitle } from '../shared/keepsakes.js';

const TILTS = [-2.2, 1.6, -1.1, 2.3, -1.7, 1.2, -2.6, 0.9];
const clampRatio = (r) => Math.min(1.5, Math.max(0.66, Number(r) || 1));
const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

export default {
  open(api, el) {
    const { esc, gsap, reduced, signal } = api;
    const fill = (s) => String(api.fill(String(s ?? '')) || '').trim();
    const memories = api.memories();
    const byId = new Map(memories.map((m) => [m.id, m]));
    /**
     * How a memory is named here: its title; with none, its own words when they are short (else its first words).
     * A title still waiting for an unwritten memory is never shown.
     */
    const labelOf = (m) => {
      if (!m) return '';
      const title = String(m.title || '').trim();
      if (title) return title;
      if (wordCount(m.text) <= 24) return String(m.text || '').trim();
      return (m.name || memoryTitle({ text: m.text })).replace(/[.,;:!?]…$/, '…');
    };

    // every photo in the order the room shows them, each once (by id, and by file: the same picture listed
    // twice in the library is still one photo): memory pages first, then the rest
    const list = [];
    const seen = new Set();
    const add = (p, m) => {
      if (!p || p.isPlaceholder || !p.url || seen.has(`id:${p.id}`) || seen.has(`url:${p.url}`)) return -1;
      seen.add(`id:${p.id}`);
      seen.add(`url:${p.url}`);
      list.push({ p, m: m || null });
      return list.length - 1;
    };
    const pages = [];
    for (const m of memories) {
      const idx = (m.photos || []).map((p) => add(p, m)).filter((i) => i >= 0);
      if (idx.length) pages.push({ m, idx });
    }
    const more = api.realPhotos().map((p) => add(p, p.memory ? byId.get(p.memory) : null)).filter((i) => i >= 0);

    const intro = api.t('intro');
    if (!list.length) {
      el.innerHTML = `${intro ? `<p class="ks-lead">${esc(intro)}</p>` : ''}<p class="ks-empty" tabindex="-1" data-autofocus>There are no photos in this scrapbook yet.</p>`;
      return undefined;
    }

    /** The owner's caption and date for a photo, as one line ('' when there are none). */
    const capLine = (p) => [fill(p.caption), fill(p.date)].filter(Boolean).join(' · ');
    const img = (p, sizes) => `<img loading="lazy" decoding="async" alt="${esc(p.alt || '')}" src="${esc(p.thumbUrl || p.url)}"${p.srcset ? ` srcset="${esc(p.srcset)}" sizes="${sizes}"` : ''} style="object-position:${esc(p.objectPosition || '50% 40%')}">`;
    const polaroid = (i) => {
      const { p } = list[i];
      const cap = capLine(p);
      return `<li class="ksb-pol-li" style="--tilt:${TILTS[i % TILTS.length]}deg">
        <button type="button" class="ksb-pol" data-i="${i}" aria-haspopup="dialog">
          <span class="ksb-tape" aria-hidden="true"></span>
          <span class="ksb-photo ks-photo" style="aspect-ratio:${clampRatio(p.ratio).toFixed(4)}">${img(p, '(max-width: 520px) 44vw, 220px')}</span>
          ${cap ? `<span class="ksb-cap">${esc(cap)}</span>` : '<span class="ksb-cap is-blank" aria-hidden="true"></span>'}
        </button>
      </li>`;
    };
    const print = (i) => {
      const { p } = list[i];
      const cap = capLine(p);
      return `<li class="ksb-print-li" style="--tilt:${TILTS[(i + 3) % TILTS.length] * 0.8}deg">
        <button type="button" class="ksb-print" data-i="${i}" aria-haspopup="dialog">
          <span class="ksb-tape is-small" aria-hidden="true"></span>
          <span class="ksb-photo ks-photo">${img(p, '(max-width: 520px) 30vw, 130px')}</span>
          ${cap ? `<span class="sr-only">${esc(cap)}</span>` : ''}
        </button>
      </li>`;
    };
    /** A page's handwriting: the memory's name over its words (never the same words twice). */
    const pageWords = (m) => {
      const heading = labelOf(m);
      return { heading, body: heading === String(m.text || '').trim() ? '' : m.text };
    };
    const moreTitle = api.t('more');
    const autofocusFirst = 'tabindex="-1" data-autofocus';
    el.innerHTML = `
      ${intro ? `<p class="ks-lead ksb-intro">${esc(intro)}</p>` : ''}
      ${pages.map(({ m, idx }, k) => {
        const { heading, body } = pageWords(m);
        return `
        <section class="ksb-page" aria-labelledby="ksb-h${k}">
          <header class="ksb-page-head">
            <h3 class="ksb-name" id="ksb-h${k}" ${k === 0 ? autofocusFirst : ''}>${esc(heading)}</h3>
            ${m.when ? `<p class="ksb-when">${esc(m.when)}</p>` : ''}
          </header>
          ${body ? `<p class="ksb-text">${esc(body)}</p>` : ''}
          <ul class="ksb-pols" role="list">${idx.map(polaroid).join('')}</ul>
        </section>`;
      }).join('')}
      ${more.length ? `
        <section class="ksb-more" ${moreTitle ? 'aria-labelledby="ksb-more"' : 'aria-label="More photos"'}>
          ${moreTitle ? `<h3 class="ksb-more-title" id="ksb-more" ${pages.length ? '' : autofocusFirst}>${esc(moreTitle)}</h3>` : ''}
          <ul class="ksb-prints" role="list">${more.map(print).join('')}</ul>
        </section>` : ''}
      <dialog class="ksb-viewer" data-own-escape aria-label="Photo" aria-describedby="ksb-vcap" tabindex="-1">
        <div class="ksb-v-bar">
          <p class="ksb-v-count" aria-live="polite"></p>
          <button type="button" class="ksb-v-close" aria-label="Close the photo">✕</button>
        </div>
        <figure class="ksb-v-fig">
          <img class="ksb-v-img" alt="">
          <figcaption class="ksb-v-cap" id="ksb-vcap"><span class="ksb-v-line"></span><span class="ksb-v-from"></span></figcaption>
        </figure>
        <button type="button" class="ksb-v-nav ksb-v-prev" aria-label="Previous photo"><span aria-hidden="true">‹</span></button>
        <button type="button" class="ksb-v-nav ksb-v-next" aria-label="Next photo"><span aria-hidden="true">›</span></button>
      </dialog>`;
    // no heading to land on (no pages, no “More pages” words): the first photo
    if (!el.querySelector('[data-autofocus]')) el.querySelector('.ksb-pol, .ksb-print').setAttribute('data-autofocus', '');

    // the first photos settle onto the page; the rest are simply there (a fast scroll never finds them blank)
    const tweens = [];
    if (!reduced) {
      const first = [...el.querySelectorAll('.ksb-pol-li, .ksb-print-li')].slice(0, 8);
      tweens.push(gsap.from(first, { opacity: 0, y: 12, duration: 0.55, ease: 'power3.out', stagger: 0.05, delay: 0.15, clearProps: 'opacity,transform' }));
    }

    /* ---------------- the viewer ---------------- */
    const dlg = el.querySelector('.ksb-viewer');
    const vImg = dlg.querySelector('.ksb-v-img');
    const vCount = dlg.querySelector('.ksb-v-count');
    const vLine = dlg.querySelector('.ksb-v-line');
    const vFrom = dlg.querySelector('.ksb-v-from');
    const vCap = dlg.querySelector('.ksb-v-cap');
    const multi = list.length > 1;
    dlg.querySelectorAll('.ksb-v-nav').forEach((b) => { b.hidden = !multi; });
    const modal = typeof dlg.showModal === 'function';
    let cur = -1;
    let ending = false;
    let imgTween = null;

    const show = (i, dir = 0) => {
      cur = (i + list.length) % list.length;
      const { p, m } = list[cur];
      delete vImg.dataset.fallback; // a reused <img>: a photo that failed before is guarded again (main.js)
      vImg.src = p.url;
      vImg.alt = p.alt || '';
      dlg.setAttribute('aria-label', p.alt || 'Photo');
      vLine.textContent = capLine(p);
      const from = labelOf(m);
      vFrom.textContent = from ? `From “${from}”` : '';
      vLine.hidden = !vLine.textContent;
      vFrom.hidden = !vFrom.textContent;
      vCap.hidden = vLine.hidden && vFrom.hidden;
      vCount.textContent = multi ? `${cur + 1} of ${list.length}` : '';
      if (imgTween) imgTween.kill();
      imgTween = reduced || !dir
        ? gsap.fromTo(vImg, { opacity: 0.35 }, { opacity: 1, duration: 0.25 })
        : gsap.fromTo(vImg, { x: dir * 24, opacity: 0.35 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
    };
    const openAt = (i) => {
      if (signal.aborted) return;
      show(i);
      if (!dlg.open) {
        if (modal) dlg.showModal(); else { dlg.setAttribute('open', ''); dlg.classList.add('is-fallback'); }
        gsap.fromTo(dlg, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.18 : 0.35 });
      }
      dlg.focus({ preventScroll: true });
      api.audio.sfx('tap');
    };
    /** Focus back on the photo she was looking at (not necessarily the one she opened). */
    const afterClose = () => {
      if (ending || signal.aborted) return;
      const b = el.querySelector(`[data-i="${cur}"]`);
      if (b && document.activeElement !== b) {
        b.focus({ preventScroll: true });
        b.scrollIntoView({ block: 'nearest' });
      }
    };
    const closeViewer = () => {
      if (!dlg.open) return;
      gsap.killTweensOf(dlg);
      // close() hands focus back to whatever opened the dialog at once; it goes on to the photo she is on
      // right away too (the 'close' event comes a task later, and a busy frame can hold it back)
      if (modal) dlg.close(); else dlg.removeAttribute('open');
      afterClose();
    };
    // closed some other way (a phone's back gesture closes a modal dialog by itself)
    dlg.addEventListener('close', afterClose);

    el.addEventListener('click', (e) => {
      if (e.target.closest('.ksb-viewer')) return;
      const b = e.target.closest('.ksb-pol, .ksb-print');
      if (b) openAt(Number(b.dataset.i));
    });

    // swipe (touch) or drag (mouse) between photos; the click that ends a drag never closes the photo
    let sx = null;
    let sy = null;
    let dragged = false;
    dlg.addEventListener('pointerdown', (e) => { dragged = false; if (!e.target.closest('button')) { sx = e.clientX; sy = e.clientY; } });
    dlg.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      sx = sy = null;
      if (multi && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        dragged = true;
        setTimeout(() => { dragged = false; }, 0);
        show(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
        api.audio.sfx('pageTurn');
      }
    });
    dlg.addEventListener('pointercancel', () => { sx = sy = null; });
    dlg.addEventListener('click', (e) => {
      if (dragged) { dragged = false; return; }
      if (e.target.closest('.ksb-v-prev')) { show(cur - 1, -1); api.audio.sfx('pageTurn'); return; }
      if (e.target.closest('.ksb-v-next')) { show(cur + 1, 1); api.audio.sfx('pageTurn'); return; }
      if (e.target.closest('.ksb-v-close')) { closeViewer(); return; }
      if (e.target.closest('.ksb-v-img, .ksb-v-cap, .ksb-v-count')) return; // the photo itself keeps it open
      closeViewer(); // a tap beside it
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeViewer(); return; }
      if (e.key === 'ArrowRight' && multi) { e.preventDefault(); show(cur + 1, 1); return; }
      if (e.key === 'ArrowLeft' && multi) { e.preventDefault(); show(cur - 1, -1); return; }
      if (e.key === 'Tab') {
        // Tab stays inside the open photo (the box's own trap never sees it)
        e.stopPropagation();
        const f = [...dlg.querySelectorAll('button')].filter((b) => !b.hidden && b.getClientRects().length);
        if (!f.length) { e.preventDefault(); return; }
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
      }
    });

    const teardown = () => {
      if (ending) return;
      ending = true;
      tweens.forEach((t) => t && t.kill());
      if (imgTween) imgTween.kill();
      gsap.killTweensOf(dlg);
      if (dlg.open) { if (modal) dlg.close(); else dlg.removeAttribute('open'); }
    };
    signal.addEventListener('abort', teardown, { once: true });
    return teardown;
  },
};
