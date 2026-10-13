// The little things I remember (the Keepsake Box): the owner's own little things, one per line, written by hand
// on a strip of paper, as a list. The room is in the box once one is written, and stays calm here if none is.
export default {
  open(api, el) {
    const { esc, gsap, reduced } = api;
    const intro = api.t('intro');
    const items = (api.items() || []).map((s) => api.fill(typeof s === 'string' ? s : '')).filter(Boolean);
    const lead = intro ? `<p class="ks-lead" tabindex="-1" data-autofocus>${esc(intro)}</p>` : '';
    if (!items.length) {
      el.innerHTML = `${lead}<p class="ks-empty"${intro ? '' : ' tabindex="-1" data-autofocus'}>Nothing here yet.</p>`;
      return undefined;
    }
    el.innerHTML = `
      ${lead}
      <div class="rm-strip">
        <span class="rm-tape" aria-hidden="true"></span>
        <ul class="rm-list" role="list"${intro ? '' : ' tabindex="-1" data-autofocus'}>
          ${items.map((s) => `<li class="rm-item"><span class="rm-mark" aria-hidden="true"></span><span class="rm-text">${esc(s)}</span></li>`).join('')}
        </ul>
      </div>`;

    let tw = null;
    if (!reduced) tw = gsap.fromTo(el.querySelectorAll('.rm-item'), { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.55, ease: 'power2.out', stagger: 0.09, delay: 0.2, clearProps: 'opacity,transform' });
    const stop = () => { if (tw) tw.progress(1).kill(); tw = null; };
    api.signal.addEventListener('abort', stop, { once: true });
    return stop;
  },
};
