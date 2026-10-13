// A message I was too shy to say (the Keepsake Box): only the owner's own words, and only if she wants to read
// them. A folded note and an “Open it” button; opening it unfolds the paper and shows the message as written
// (line breaks kept), then the gentle line after it. Never a reply button, never a question, never any pressure.
// The room is only in the box once the owner has written the message (still calm here if it ever isn't).
export default {
  open(api, el) {
    const { esc, gsap, reduced } = api;
    const intro = api.t('intro');
    const after = api.t('after');
    const message = (api.items() || []).map((s) => api.fill(s)).find(Boolean) || '';
    const lead = intro ? `<p class="ks-lead">${esc(intro)}</p>` : '';
    if (!message) {
      el.innerHTML = `${lead}<p class="ks-empty" tabindex="-1" data-autofocus>Nothing here yet.</p>`;
      return undefined;
    }

    el.innerHTML = `
      ${lead}
      <div class="sh-stage">
        <div class="sh-folded">
          <div class="sh-fold" aria-hidden="true"><span class="sh-fold-flap"></span><span class="sh-seal"></span></div>
          <button type="button" class="ks-btn sh-open" data-autofocus>Open it</button>
        </div>
        <div class="sh-paper" tabindex="-1" hidden>
          <p class="sh-text">${esc(message)}</p>
        </div>
        ${after ? `<p class="sh-after" hidden>${esc(after)}</p>` : ''}
      </div>`;

    const folded = el.querySelector('.sh-folded');
    const fold = el.querySelector('.sh-fold');
    const btn = el.querySelector('.sh-open');
    const paper = el.querySelector('.sh-paper');
    const text = el.querySelector('.sh-text');
    const afterEl = el.querySelector('.sh-after');
    const tweens = [];
    let opened = false;

    function open() {
      if (opened) return;
      opened = true;
      paper.hidden = false;
      if (afterEl) afterEl.hidden = false;
      paper.focus({ preventScroll: true }); // before the button goes, so focus is never dropped
      folded.hidden = true;
      if (reduced) {
        tweens.push(gsap.fromTo(paper, { opacity: 0 }, { opacity: 1, duration: 0.25 }));
      } else {
        // it unfolds downwards from its crease, then the words come up through the paper
        tweens.push(gsap.fromTo(paper, { clipPath: 'inset(0% 0% 58% 0% round 12px)', y: 14 }, { clipPath: 'inset(0% 0% 0% 0% round 12px)', y: 0, duration: 1.1, ease: 'power2.inOut', clearProps: 'clipPath,transform' }));
        tweens.push(gsap.fromTo(text, { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.45, ease: 'power1.out' }));
        if (afterEl) tweens.push(gsap.fromTo(afterEl, { opacity: 0 }, { opacity: 1, duration: 0.9, delay: 1.3 }));
      }
      api.audio.sfx('pageTurn');
    }
    btn.addEventListener('click', open);
    fold.addEventListener('click', open); // the note itself opens too (the button is the way for keys and readers)

    const stop = () => {
      for (const t of tweens) t.progress(1).kill();
      tweens.length = 0;
    };
    api.signal.addEventListener('abort', stop, { once: true });
    return stop;
  },
};
