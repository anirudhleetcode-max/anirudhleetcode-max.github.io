// The appreciation wall (the Keepsake Box): every card the owner wrote (and left switched on), pinned to a wall
// as a note, in their order. A list, so it reads as one. Each note leans a little (upright under reduced motion)
// and they arrive one after another (they are simply there under reduced motion). Only the owner's words: the
// room is in the box once a card is written, and stays calm here if none is.
const TILTS = [-1.6, 1.2, -0.7, 1.7, -1.2, 0.8, -1.9, 0.5];

export default {
  open(api, el) {
    const { esc, gsap, reduced } = api;
    const intro = api.t('intro');
    const cards = (api.items() || [])
      .map((c) => api.fill(c && typeof c === 'object' ? c.text : ''))
      .filter(Boolean);
    const lead = intro ? `<p class="ks-lead" tabindex="-1" data-autofocus>${esc(intro)}</p>` : '';
    if (!cards.length) {
      el.innerHTML = `${lead}<p class="ks-empty"${intro ? '' : ' tabindex="-1" data-autofocus'}>Nothing here yet.</p>`;
      return undefined;
    }
    el.innerHTML = `
      ${lead}
      <ul class="ap-wall" role="list" aria-label="${cards.length === 1 ? 'One note' : `${cards.length} notes`}"${intro ? '' : ' tabindex="-1" data-autofocus'}>
        ${cards.map((text, i) => `
          <li class="ap-item">
            <div class="ap-note ap-tint-${i % 3}" style="--tilt:${TILTS[i % TILTS.length]}deg">
              <span class="ap-pin" aria-hidden="true"></span>
              <p class="ap-text">${esc(text)}</p>
            </div>
          </li>`).join('')}
      </ul>`;

    let tw = null;
    if (!reduced) {
      // the entrance moves the <li>; the lean is the note's own CSS `rotate` inside it, so it is never lost
      tw = gsap.fromTo(el.querySelectorAll('.ap-item'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08, delay: 0.15, clearProps: 'opacity,transform' });
    }
    const stop = () => { if (tw) tw.progress(1).kill(); tw = null; };
    api.signal.addEventListener('abort', stop, { once: true });
    return stop;
  },
};
