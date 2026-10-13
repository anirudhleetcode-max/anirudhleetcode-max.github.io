// The awards (the Keepsake Box): the owner's own awards, each a small certificate with a rosette: the award as its
// heading and, when they wrote one, the line under it. A list. The rosette is drawn here (a pleated ring, two
// ribbon tails, her age from the film in the middle); no trophy clip-art. The room is in the box once an award is
// written, and stays calm here if none is.

/** The rosette's pleated edge: a ring of points between two radii. */
const pleats = (cx, cy, r1, r2, n) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
};
const EDGE = pleats(32, 30, 25, 21, 18);

const rosette = (mid) => `
  <svg class="aw-rosette" viewBox="0 0 64 84" aria-hidden="true" focusable="false">
    <path class="aw-tail" d="M21 42 L12 80 L21.5 74 L28 82 L33 48 Z"/>
    <path class="aw-tail aw-tail-2" d="M43 42 L52 80 L42.5 74 L36 82 L31 48 Z"/>
    <path class="aw-edge" d="${EDGE}"/>
    <circle class="aw-ring" cx="32" cy="30" r="17.5"/>
    <circle class="aw-face" cx="32" cy="30" r="14.5"/>
    ${mid
    ? `<text class="aw-num" x="32" y="35.5" text-anchor="middle">${mid}</text>`
    : '<path class="aw-star" d="M32 21.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z"/>'}
  </svg>`;

export default {
  open(api, el) {
    const { esc, gsap, reduced } = api;
    const intro = api.t('intro');
    const items = (api.items() || [])
      .map((c) => (c && typeof c === 'object' ? { title: api.fill(c.title), line: api.fill(c.line) } : null))
      .filter((c) => c && c.title);
    const lead = intro ? `<p class="ks-lead" tabindex="-1" data-autofocus>${esc(intro)}</p>` : '';
    if (!items.length) {
      el.innerHTML = `${lead}<p class="ks-empty"${intro ? '' : ' tabindex="-1" data-autofocus'}>Nothing here yet.</p>`;
      return undefined;
    }
    const name = String(api.herName || '').trim();
    const age = /^\d{1,3}$/.test(api.fill('{age}')) ? api.fill('{age}') : '';
    const medal = rosette(esc(age));
    el.innerHTML = `
      ${lead}
      <ul class="aw-list" role="list"${intro ? '' : ' tabindex="-1" data-autofocus'}>
        ${items.map((c) => `
          <li class="aw-cert">
            <div class="aw-frame">
              <div class="aw-medal">${medal}</div>
              <div class="aw-words">
                ${name ? `<p class="aw-kicker">Awarded to ${esc(name)}</p>` : ''}
                <h3 class="aw-title">${esc(c.title)}</h3>
                ${c.line ? `<p class="aw-line">${esc(c.line)}</p>` : ''}
              </div>
            </div>
          </li>`).join('')}
      </ul>`;

    let tw = null;
    if (!reduced) tw = gsap.fromTo(el.querySelectorAll('.aw-cert'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.09, delay: 0.15, clearProps: 'opacity,transform' });
    api.audio.sfx('chime');
    const stop = () => { if (tw) tw.progress(1).kill(); tw = null; };
    api.signal.addEventListener('abort', stop, { once: true });
    return stop;
  },
};
