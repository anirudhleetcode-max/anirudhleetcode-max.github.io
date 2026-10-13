// A coupon (the Keepsake Box): the owner's own wording (admin → Keepsake Box → A coupon). Completely optional by
// design: it is something to smile at, never something she owes. Nothing to press, nothing to redeem.
export default {
  open(api, el) {
    const { esc, gsap, reduced } = api;
    const title = api.t('head');
    const line = api.t('line');
    const small = api.t('small');
    el.innerHTML = `
      <div class="cp-ticket" tabindex="-1" data-autofocus>
        <div class="cp-main">
          <p class="cp-title">${esc(title)}</p>
          ${line ? `<p class="cp-line">${esc(line)}</p>` : ''}
          ${small ? `<p class="cp-small">${esc(small)}</p>` : ''}
        </div>
        <div class="cp-stub" aria-hidden="true"><span>Nº 20</span></div>
      </div>`;
    if (!reduced) {
      const t = el.querySelector('.cp-ticket');
      gsap.fromTo(t, { rotate: -4, scale: 0.94, opacity: 0 }, { rotate: -1.2, scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(1.6)' });
    }
    api.audio.sfx('sparkle');
  },
};
