// The chapters: a small list of the film, opened from the book button (top left). It shows where she is,
// lets her go back to any chapter she has already seen, and keeps the ones still ahead a surprise (their
// names stay hidden until she gets there). After the film, it also opens every photo. A dialog: Escape,
// the ✕ or a tap outside closes it, Tab stays inside, focus returns to where it was.
import { esc } from './art.js';

/**
 * @param {{ items: {i:number,id:string,name:string,num:number|null,nav:boolean,seen:boolean,now:boolean}[], finished: boolean,
 *   reducedMotion: boolean, gsap: object, onPick: (i:number)=>void, onAlbum: ()=>void, onBox?: (()=>void)|null, onClose: ()=>void }} o
 * @returns {{ close: (opts?: {fromHistory?: boolean}) => void, el: HTMLElement }}
 */
export function openChapterList({ items, finished, reducedMotion, gsap, onPick, onAlbum, onBox = null, onClose }) {
  const opener = document.activeElement;
  const list = items.filter((c) => c.nav);
  const wrap = document.createElement('div');
  wrap.className = 'chl';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-labelledby', 'chl-title');
  const rows = list.map((c) => {
    // the film's own chapter number ("Chapter One" → 1); a star for the parts around the chapters
    const num = `<span class="chl-n${c.num ? '' : ' is-part'}" aria-hidden="true">${c.num || '✦'}</span>`;
    if (c.now) return `<li class="chl-row is-now"><span class="chl-item" aria-current="step">${num}<span class="chl-name">${esc(c.name)}</span><span class="chl-tag">now</span></span></li>`;
    if (c.seen) return `<li class="chl-row"><button type="button" class="chl-item chl-go" data-i="${c.i}" data-id="${esc(c.id)}">${num}<span class="chl-name">${esc(c.name)}</span></button></li>`;
    return `<li class="chl-row is-ahead"><span class="chl-item">${num}<span class="chl-name" aria-hidden="true">· · ·</span><span class="sr-only">${c.num ? `Chapter ${c.num}: still ahead` : 'Still ahead'}</span></span></li>`;
  }).join('');
  wrap.innerHTML = `
    <div class="chl-panel">
      <div class="chl-head">
        <div>
          <p class="chl-kicker">The story so far</p>
          <h2 class="chl-title" id="chl-title">Chapters</h2>
        </div>
        <button type="button" class="chl-close" aria-label="Close">✕</button>
      </div>
      <ol class="chl-list">${rows}</ol>
      <p class="chl-note">${finished ? 'Every chapter you have seen is one tap away.' : 'The chapters still ahead keep their names until you get there.'}</p>
      ${finished ? `<div class="chl-foot"><button type="button" class="btn-ghost chl-album">Every photo</button>${onBox ? '<button type="button" class="btn-ghost chl-box">The keepsake box</button>' : ''}</div>` : ''}
    </div>`;
  document.getElementById('ui').appendChild(wrap);
  const panel = wrap.querySelector('.chl-panel');
  if (reducedMotion) gsap.fromTo(wrap, { opacity: 0 }, { opacity: 1, duration: 0.25 });
  else {
    gsap.fromTo(wrap, { opacity: 0 }, { opacity: 1, duration: 0.45 });
    gsap.fromTo(panel, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' });
  }

  let closed = false;
  const close = ({ fromHistory = false, silent = false } = {}) => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey, true);
    gsap.to(wrap, { opacity: 0, duration: reducedMotion ? 0.15 : 0.35, onComplete: () => wrap.remove() });
    if (!silent && opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
    if (!fromHistory && !silent) onClose && onClose();
  };
  wrap.addEventListener('click', (e) => {
    const go = e.target.closest('.chl-go');
    if (go) { close({ silent: true }); onPick(Number(go.dataset.i)); return; }
    if (e.target.closest('.chl-close')) { close(); return; }
    // straight on to the album: the list steps aside quietly and the album takes its place (and its Back)
    if (e.target.closest('.chl-album')) { close({ silent: true }); onAlbum && onAlbum(); return; }
    if (e.target.closest('.chl-box')) { close({ silent: true }); onBox && onBox(); return; }
    if (!e.target.closest('.chl-panel')) close(); // a tap outside the panel
  });
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') { // keep focus inside
      const f = [...wrap.querySelectorAll('button')].filter((x) => !x.disabled && x.getClientRects().length);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
      return;
    }
    // the film's Continue shortcut and the scenes' own keys never fire behind the list
    if (['Enter', ' ', 'ArrowRight', 'ArrowLeft'].includes(e.key)) e.stopPropagation();
  }
  window.addEventListener('keydown', onKey, true);
  const first = wrap.querySelector('.chl-go') || wrap.querySelector('.chl-close');
  setTimeout(() => first && first.focus({ preventScroll: true }), 30);
  return { close, el: wrap };
}
