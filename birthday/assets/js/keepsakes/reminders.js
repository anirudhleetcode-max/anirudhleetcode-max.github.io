// Things that remind me of you (the Keepsake Box): the owner's things, each a card with the thing as its heading
// and, when they wrote one, why under it. A list. The room is in the box once one is written, and stays calm here
// if none is.
const PIN = '<path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>';

export default {
  open(api, el) {
    const { esc, gsap, reduced } = api;
    const intro = api.t('intro');
    const items = (api.items() || [])
      .map((c) => (c && typeof c === 'object' ? { thing: api.fill(c.thing), why: api.fill(c.why) } : null))
      .filter((c) => c && c.thing);
    const lead = intro ? `<p class="ks-lead" tabindex="-1" data-autofocus>${esc(intro)}</p>` : '';
    if (!items.length) {
      el.innerHTML = `${lead}<p class="ks-empty"${intro ? '' : ' tabindex="-1" data-autofocus'}>Nothing here yet.</p>`;
      return undefined;
    }
    el.innerHTML = `
      ${lead}
      <ul class="rd-list" role="list"${intro ? '' : ' tabindex="-1" data-autofocus'}>
        ${items.map((c) => `
          <li class="ks-card rd-card">
            <span class="rd-ic" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${PIN}</svg></span>
            <div class="rd-words">
              <h3 class="rd-thing">${esc(c.thing)}</h3>
              ${c.why ? `<p class="rd-why">${esc(c.why)}</p>` : ''}
            </div>
          </li>`).join('')}
      </ul>`;

    let tw = null;
    if (!reduced) tw = gsap.fromTo(el.querySelectorAll('.rd-card'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.07, delay: 0.15, clearProps: 'opacity,transform' });
    const stop = () => { if (tw) tw.progress(1).kill(); tw = null; };
    api.signal.addEventListener('abort', stop, { once: true });
    return stop;
  },
};
