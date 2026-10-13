// Do you remember? (the Keepsake Box): a few questions made only from the owner's memories and their photos
// (shared/keepsakes.js → quizQuestions), one at a time. Every question can be skipped; after an answer the right
// one is marked with ✓ (never colour alone) and a kind line says so; then Next. There is no score, no count of
// right answers and nothing graded, ever. At the end: the closing line and “Start again”.
// A question whose words or photo can't be shown (a memory still waiting for its words, a photo switched off)
// is left out; with fewer than two left, the room says so calmly.

export default {
  open(api, el) {
    const { esc, gsap, reduced, signal } = api;
    const fill = (s) => String(api.fill(String(s ?? '')) || '').trim();
    const intro = api.t('intro');
    // an option names a memory by its short name; a memory without a title whose words are short reads in full
    // (never “By bus.…”), the same words the scrapbook and the stars show
    const mems = api.memories();
    const fullWords = (label) => {
      const m = mems.find((x) => x.name && x.name === label);
      if (m && !String(m.title || '').trim() && m.text && m.text.trim().split(/\s+/).length <= 24) return m.text.trim();
      return label.replace(/[.,;:!?]…$/, '…');
    };
    // only questions that can be asked honestly, in full
    const qs = [];
    for (const q of api.quiz() || []) {
      if (!q || !Array.isArray(q.options)) continue;
      const options = q.options.map((o) => { const f = fill(o); return f ? fullWords(f) : ''; });
      const prompt = fill(q.prompt);
      if (!prompt || options.length < 2 || options.some((o) => !o) || new Set(options).size !== options.length) continue;
      if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < options.length)) continue;
      let photo = null;
      if (q.photo) { photo = api.photo(q.photo); if (!photo) continue; }
      qs.push({ kind: q.kind, prompt, options, answer: q.answer, photo });
    }
    if (qs.length < 2) {
      el.innerHTML = `${intro ? `<p class="ks-lead">${esc(intro)}</p>` : ''}<p class="ks-empty" tabindex="-1" data-autofocus>There aren’t enough memories here for questions yet.</p>`;
      return undefined;
    }

    const words = {
      right: api.t('right'),
      wrong: api.t('wrong'),
      skip: api.t('skip') || 'Skip',
      next: api.t('next') || 'Next',
      end: api.t('end'),
    };
    el.innerHTML = `
      ${intro ? `<p class="ks-lead kqz-intro">${esc(intro)}</p>` : ''}
      <div class="kqz-card ks-card">
        <div class="kqz-stage"></div>
        <p class="kqz-say" aria-live="polite"></p>
        <p class="kqz-recall" hidden></p>
        <div class="ks-row kqz-actions">
          <button type="button" class="ks-btn is-quiet kqz-skip">${esc(words.skip)}</button>
          <button type="button" class="ks-btn kqz-next" hidden>${esc(words.next)} <span aria-hidden="true">›</span></button>
          <button type="button" class="ks-btn kqz-again" hidden>Start again</button>
        </div>
      </div>`;
    const stage = el.querySelector('.kqz-stage');
    const say = el.querySelector('.kqz-say');
    const recall = el.querySelector('.kqz-recall');
    const skipBtn = el.querySelector('.kqz-skip');
    const nextBtn = el.querySelector('.kqz-next');
    const againBtn = el.querySelector('.kqz-again');
    let at = 0;
    let answered = false;
    let tween = null;

    /** Scroll the panel so `nodes` sit together between the box's sticky head and the panel's bottom edge
     *  (the box gives the panel a scroll-padding-top as tall as its head). When they can't all fit, `prefer`
     *  says which end stays in view: 'start' (the question) or 'end' (the button that has focus). */
    const span = (nodes) => {
      const panel = el.closest('.ks-panel');
      const rs = nodes.filter((n) => n && n.getClientRects().length).map((n) => n.getBoundingClientRect());
      if (!panel || !rs.length) return null;
      const pr = panel.getBoundingClientRect();
      const top = pr.top + panel.clientTop + (parseFloat(getComputedStyle(panel).scrollPaddingTop) || 0);
      const bottom = pr.top + panel.clientTop + panel.clientHeight - 8;
      const t = Math.min(...rs.map((r) => r.top));
      const b = Math.max(...rs.map((r) => r.bottom));
      return { panel, top, bottom, t, b, fits: b - t <= bottom - top };
    };
    const reveal = (nodes, prefer = 'start') => {
      const v = span(nodes);
      if (!v) return;
      let d = 0;
      if (!v.fits) d = prefer === 'end' ? v.b - v.bottom : v.t - v.top;
      else if (v.t < v.top) d = v.t - v.top;
      else if (v.b > v.bottom) d = v.b - v.bottom;
      if (d) v.panel.scrollTop += d;
    };
    const enter = (node) => {
      if (tween) tween.kill();
      tween = reduced ? null : gsap.fromTo(node, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' });
    };
    const render = (i, { focus = true } = {}) => {
      at = i;
      answered = false;
      const q = qs[i];
      const p = q.photo;
      stage.innerHTML = `
        <div class="kqz-q${p ? ' has-photo' : ''}">
          <p class="kqz-count">${esc(`Question ${i + 1} of ${qs.length}`)}</p>
          <h3 class="kqz-prompt" id="kqz-prompt" tabindex="-1"${i === 0 && !focus ? ' data-autofocus' : ''}>${esc(q.prompt)}</h3>
          <div class="kqz-body">
            ${p ? `<div class="kqz-photo ks-photo" style="aspect-ratio:${Math.min(1.5, Math.max(0.66, Number(p.ratio) || 1)).toFixed(4)}"><img loading="lazy" decoding="async" alt="${esc(p.alt || '')}" src="${esc(p.thumbUrl || p.url)}"${p.srcset ? ` srcset="${esc(p.srcset)}" sizes="(max-width: 640px) 70vw, 260px"` : ''} style="object-position:${esc(p.objectPosition || '50% 40%')}"></div>` : ''}
            <ul class="kqz-options" role="list" aria-labelledby="kqz-prompt">
              ${q.options.map((o, k) => `<li><button type="button" class="kqz-opt" data-k="${k}"><span class="kqz-mark" aria-hidden="true"></span><span class="kqz-opt-text">${esc(o)}</span><span class="kqz-sr sr-only"></span></button></li>`).join('')}
            </ul>
          </div>
        </div>`;
      say.textContent = '';
      recall.hidden = true;
      skipBtn.hidden = false;
      nextBtn.hidden = true;
      againBtn.hidden = true;
      enter(stage.firstElementChild);
      if (focus) stage.querySelector('.kqz-prompt').focus({ preventScroll: true });
    };
    const answer = (k) => {
      if (answered) return;
      answered = true;
      const q = qs[at];
      const right = k === q.answer;
      stage.querySelectorAll('.kqz-opt').forEach((b) => {
        const n = Number(b.dataset.k);
        b.setAttribute('aria-disabled', 'true');
        if (n === q.answer) {
          b.classList.add('is-right');
          b.querySelector('.kqz-mark').textContent = '✓';
          b.querySelector('.kqz-sr').textContent = right ? ' (your answer, the right one)' : ' (the right answer)';
        } else if (n === k) {
          b.classList.add('is-picked');
          b.querySelector('.kqz-sr').textContent = ' (your answer)';
        }
      });
      say.textContent = right ? words.right : words.wrong;
      if (!reduced) {
        const mark = stage.querySelector('.kqz-opt.is-right .kqz-mark');
        if (mark) gsap.fromTo(mark, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2.4)' });
      }
      api.audio.sfx(right ? 'chime' : 'tap');
      skipBtn.hidden = true;
      nextBtn.hidden = false;
      nextBtn.focus({ preventScroll: true });
      // the ✓ on the right answer and Next (it has focus) on screen together, clear of the box's head; on a short
      // landscape phone where the two can't both fit, the right answer is repeated with its ✓ just above Next
      const rightBtn = stage.querySelector('.kqz-opt.is-right');
      const both = span([rightBtn, say, nextBtn]);
      if (both && !both.fits) {
        recall.textContent = `✓ ${q.options[q.answer]}`;
        recall.hidden = false;
        reveal([say, recall, nextBtn], 'end');
      } else reveal([rightBtn, say, nextBtn], 'end');
    };
    const finish = () => {
      answered = true;
      stage.innerHTML = `<div class="kqz-done">${words.end ? `<p class="kqz-end" tabindex="-1">${esc(words.end)}</p>` : '<p class="sr-only kqz-end" tabindex="-1">The end of the questions.</p>'}</div>`;
      say.textContent = '';
      recall.hidden = true;
      skipBtn.hidden = true;
      nextBtn.hidden = true;
      againBtn.hidden = false;
      enter(stage.firstElementChild);
      stage.querySelector('.kqz-end').focus({ preventScroll: true });
      api.audio.sfx('sparkle');
    };
    const onward = () => {
      if (at + 1 < qs.length) { render(at + 1); api.audio.sfx('pageTurn'); } else finish();
      // the new question from its first line, clear of the box's sticky head
      reveal([stage.firstElementChild], 'start');
    };

    stage.addEventListener('click', (e) => {
      const b = e.target.closest('.kqz-opt');
      if (b && !answered) answer(Number(b.dataset.k));
    });
    skipBtn.addEventListener('click', onward);
    nextBtn.addEventListener('click', onward);
    againBtn.addEventListener('click', () => { render(0); api.audio.sfx('pageTurn'); });

    render(0, { focus: false });

    const teardown = () => { if (tween) tween.kill(); gsap.killTweensOf(el.querySelectorAll('.kqz-mark')); };
    signal.addEventListener('abort', teardown, { once: true });
    return teardown;
  },
};
