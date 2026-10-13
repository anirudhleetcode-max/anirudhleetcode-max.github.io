// The Deepu files (the Keepsake Box): a mock case file, typed on a sheet in a manila folder, built ONLY from what
// is already in the film:
//   • Subject: her name · Also known as: her other names (settings → her → nicknames, her name left out)
//   • Days on record: the film's own count (her days on the day it opens: 7,305 on her twentieth birthday)
//   • Known weaknesses: the favourite things whose scenes play in the film (Theme switches; the photoshoot's
//     actor only when the owner has added its fan art, and never by name)
//   • Evidence: how many real photos and memories the film holds · First memory on file: the first memory
//   • Case notes: the owner's own lines (hidden when there are none)
//   • the verdict (the owner's words, or the built-in one) as a rubber stamp
// Nothing here is a fact the content doesn't already state.
import { fanArtPhotos } from '../shared/model.js';

/** The favourite things that play in the film, in the order the film shows them (labels as the brief names them). */
export function knownWeaknesses(site) {
  const theme = (site && site.settings && site.settings.theme) || {};
  const on = (k) => theme[k] !== false;
  // a chapter switched off (admin → Chapters) plays none of its scenes
  const chapterOn = (id) => !(Array.isArray(site && site.chapters) && site.chapters.some((c) => c && c.id === id && c.enabled === false));
  const out = [];
  if (chapterOn('favourites')) {
    if (on('panipuri')) out.push('Pani puri');
    if (on('manchuria')) out.push('Manchuria');
  }
  if (chapterOn('little')) {
    if (on('keychains')) out.push('Cute keychains');
    if (on('sprite')) out.push('Sprite');
    if (on('twinklingWatermelon')) out.push('Twinkling Watermelon');
  }
  if (chapterOn('favourites') && on('nivin') && fanArtPhotos(site).length > 0) out.push('One very specific favourite actor');
  return out;
}

const plural = (n, one, many) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

export default {
  open(api, el) {
    const { esc, gsap, reduced, signal } = api;
    const site = api.site || {};
    const intro = api.t('intro');
    const verdict = api.t('verdict');
    const notes = api.list('notes');
    const her = String(api.herName || '').trim();
    const aka = [...new Set((api.nicknames || []).map((n) => String(n).trim()).filter((n) => n && n.toLowerCase() !== her.toLowerCase()))];
    const days = Number(api.daysAlive());
    const weak = knownWeaknesses(site);
    const photos = api.realPhotos();
    const mems = api.memories();
    const first = mems[0];
    // the first memory, named as everywhere in the box: its title, or its own words when short
    const firstName = !first ? '' : String(first.title || '').trim() || (wordCount(first.text) <= 24 ? String(first.text || '').trim() : String(first.name || '').replace(/[.,;:!?]…$/, '…'));
    const evidence = [photos.length ? plural(photos.length, 'photograph', 'photographs') : '', mems.length ? plural(mems.length, 'memory', 'memories') : ''].filter(Boolean).join(', ');
    // the subject's photo: the film's own first photo (the prologue), else its first real photo
    const exhibit = (api.photos('prologue') || [])[0] || photos[0] || null;

    const rows = [
      her && ['Subject', esc(her)],
      aka.length && ['Also known as', aka.map((n) => `“${esc(n)}”`).join(', ')],
      Number.isFinite(days) && days > 0 && ['Days on record', esc(days.toLocaleString('en-IN'))],
      weak.length && ['Known weaknesses', `<ul class="klr-list">${weak.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`],
      evidence && ['Evidence', esc(evidence)],
      firstName && ['First memory on file', `“${esc(firstName)}”`],
    ].filter(Boolean);

    el.innerHTML = `
      <div class="klr-folder">
        <span class="klr-tab" aria-hidden="true">Confidential</span>
        <article class="klr-sheet" tabindex="-1" data-autofocus ${intro ? 'aria-labelledby="klr-intro"' : 'aria-label="Case file"'}>
          ${intro ? `<header class="klr-top"><p class="klr-intro" id="klr-intro">${esc(intro)}</p></header>` : ''}
          <div class="klr-body${exhibit ? ' has-exhibit' : ''}">
            ${exhibit ? `
              <figure class="klr-exhibit">
                <span class="klr-clip" aria-hidden="true"></span>
                <span class="klr-photo ks-photo"><img loading="lazy" decoding="async" alt="${esc(exhibit.alt || '')}" src="${esc(exhibit.thumbUrl || exhibit.url)}"${exhibit.srcset ? ` srcset="${esc(exhibit.srcset)}" sizes="140px"` : ''} style="object-position:${esc(exhibit.objectPosition || '50% 40%')}"></span>
                <figcaption>Exhibit A</figcaption>
              </figure>` : ''}
            <dl class="klr-fields">
              ${rows.map(([k, v]) => `<div class="klr-row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}
            </dl>
          </div>
          ${notes.length ? `
            <section class="klr-notes" aria-labelledby="klr-notes-h">
              <h3 class="klr-notes-h" id="klr-notes-h">Case notes</h3>
              <ol class="klr-note-list">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>
            </section>` : ''}
          ${verdict ? `<div class="klr-stamp-wrap"><p class="klr-stamp"><span>${esc(verdict)}</span></p></div>` : ''}
        </article>
      </div>`;

    const tl = reduced ? null : gsap.timeline({ delay: 0.2 });
    if (tl) {
      // typed in line by line, then the stamp comes down
      tl.from(el.querySelectorAll('.klr-top, .klr-exhibit, .klr-row, .klr-notes'), { opacity: 0, y: 6, duration: 0.35, ease: 'power2.out', stagger: 0.12, clearProps: 'opacity,transform' });
      const stamp = el.querySelector('.klr-stamp');
      if (stamp) {
        tl.fromTo(stamp, { opacity: 0, scale: 1.7 }, { opacity: 1, scale: 1, duration: 0.32, ease: 'power4.in', clearProps: 'opacity,transform' }, '+=0.15');
        tl.call(() => api.audio.sfx('tap'));
      }
    }

    const teardown = () => { if (tl) tl.kill(); };
    signal.addEventListener('abort', teardown, { once: true });
    return teardown;
  },
};
