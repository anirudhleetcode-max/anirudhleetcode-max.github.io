// The film's final photograph (the birthday chapter, after the 7,305 days and "20", in
// real silence, just before her title): one photograph alone in the dark, softly lit,
// a short handwritten line that writes itself, and then both gently clear.
// Plain DOM for the photo (the browser's own full-quality image). Her photo is never
// altered: only light and framing around it.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * createReveal(el, photo, { device, signal }) →
 *   { layout(W, H), show() → Promise, write(text) → Promise, clear() → Promise, dispose() }
 */
export function createReveal(el, photo, { device = {}, signal } = {}) {
  const gsap = window.gsap;
  const reduced = !!device.reducedMotion;
  const ratio = clamp(Number(photo && photo.ratio) || 0.8, 0.5, 2);

  const root = document.createElement('div');
  root.className = 'cn-reveal';
  root.innerHTML = `
    <div class="cn-reveal-light" aria-hidden="true"></div>
    <figure class="cn-print"><img alt="" decoding="async" draggable="false"></figure>
    <p class="cn-hand"></p>`;
  el.appendChild(root);
  const light = root.querySelector('.cn-reveal-light');
  const fig = root.querySelector('.cn-print');
  const img = fig.querySelector('img');
  const hand = root.querySelector('.cn-hand');
  img.alt = (photo && photo.alt) || '';
  img.style.objectPosition = (photo && photo.objectPosition) || '50% 40%';
  if (photo) img.src = photo.url || photo.thumbUrl || '';

  const tweens = [];
  const keep = (t) => { tweens.push(t); return t; };
  let raf = 0;
  let W = 0;
  let H = 0;
  let box = { x: 0, y: 0, w: 0, h: 0 };
  let fs = 32;
  let text = '';
  let handLines = [];
  let written = false;
  let disposed = false;

  const measure = document.createElement('canvas').getContext('2d');
  function wrapText(str, maxW) {
    measure.font = `400 ${fs}px Caveat, 'Bradley Hand', cursive`;
    const words = str.split(/\s+/).filter(Boolean);
    const width = (s) => measure.measureText(s).width;
    if (width(str) <= maxW || words.length < 2) return [str];
    // the most balanced split into two lines (three if it really must)
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const m = Math.max(width(a), width(b));
      if (!best || m < best.m) best = { m, lines: [a, b] };
    }
    if (best.m <= maxW) return best.lines;
    const out = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && width(next) > maxW) { out.push(cur); cur = w; } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  }

  function layout(w, h) {
    W = w;
    H = h;
    const portrait = H > W * 1.05;
    fs = Math.round(portrait ? clamp(W * 0.078, 26, 44) : clamp(H * 0.052, 28, 46));
    const maxTextW = Math.min(W * 0.86, portrait ? W * 0.86 : 640);
    const lines = text ? wrapText(text, maxTextW) : ['x'];
    const textH = lines.length * fs * 1.12;
    const top = Math.max(portrait ? H * 0.085 : H * 0.075, 54);
    const bottomUI = portrait ? Math.max(104, H * 0.13) : Math.max(96, H * 0.12);
    const gap = Math.max(16, fs * 0.6);
    const availH = H - top - bottomUI - textH - gap;
    const availW = W * (portrait ? 0.82 : 0.56);
    let ph = Math.min(availH, availW / ratio, H * (portrait ? 0.58 : 0.66));
    ph = Math.max(ph, Math.min(availH, 120));
    const pw = ph * ratio;
    const y = top + Math.max(0, (availH - ph) * 0.4);
    box = { x: (W - pw) / 2, y, w: pw, h: ph };
    Object.assign(fig.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${pw}px`, height: `${ph}px` });
    const border = Math.max(3, Math.round(Math.min(pw, ph) * 0.012));
    fig.style.setProperty('--b', `${border}px`);
    const lw = Math.max(pw, ph) * 1.9;
    Object.assign(light.style, { left: `${box.x + pw / 2 - lw / 2}px`, top: `${box.y + ph / 2 - lw / 2}px`, width: `${lw}px`, height: `${lw}px` });
    Object.assign(hand.style, { top: `${box.y + ph + gap}px`, fontSize: `${fs}px` });
    if (handLines.length && text) {
      buildHand();
      if (written) hand.querySelectorAll('.cn-hand-row').forEach((r) => r.style.setProperty('--p', '99999px'));
    }
  }

  /** Appear: alone, large, softly lit; a slow push-in. */
  async function show() {
    if (!img.complete || !img.naturalWidth) {
      await Promise.race([
        new Promise((r) => { img.onload = r; img.onerror = r; }),
        new Promise((r) => setTimeout(r, 4000)),
      ]);
    }
    try { await img.decode(); } catch { /* fine */ }
    if (disposed) return;
    root.classList.add('on');
    keep(gsap.fromTo(light, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: reduced ? 1.4 : 3.2, ease: 'sine.out' }));
    keep(gsap.fromTo(fig, { opacity: 0, scale: reduced ? 1 : 0.965, filter: 'blur(10px) brightness(0.6)' },
      { opacity: 1, scale: 1, filter: 'blur(0px) brightness(1)', duration: reduced ? 1.2 : 2.8, ease: 'power2.out', clearProps: 'filter' }));
    // the emotional climax: almost no movement — a barely perceptible push, so she can simply look
    if (!reduced) keep(gsap.to(fig, { scale: 1.03, duration: 26, delay: 2.8, ease: 'sine.out' }));
    await new Promise((r) => setTimeout(r, (reduced ? 1.2 : 2.6) * 1000));
  }

  function buildHand() {
    const portrait = H > W * 1.05;
    handLines = wrapText(text, Math.min(W * 0.86, portrait ? W * 0.86 : 640));
    hand.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'cn-sr';
    sr.textContent = text;
    hand.appendChild(sr);
    handLines.forEach((ln) => {
      const row = document.createElement('span');
      row.className = 'cn-hand-row';
      row.setAttribute('aria-hidden', 'true');
      row.innerHTML = '<span class="ink"></span><span class="wet"></span><i class="nib"></i>';
      row.querySelector('.ink').textContent = ln;
      row.querySelector('.wet').textContent = ln;
      hand.appendChild(row);
    });
  }

  /** The line writes itself, pen-speed: quick strokes, little pauses between words, a breath at the comma. */
  async function write(str) {
    text = String(str || '').trim();
    if (!text) return;
    // the canvas measures with the real script, so the pen follows the letters exactly
    try { await Promise.race([document.fonts.load(`400 ${fs}px Caveat`), new Promise((r) => setTimeout(r, 1500))]); } catch { /* fallback font */ }
    if (disposed) return;
    buildHand();
    measure.font = `400 ${fs}px Caveat, 'Bradley Hand', cursive`;
    const rows = [...hand.querySelectorAll('.cn-hand-row')];
    const PAD = Math.round(fs * 0.35); // matches the CSS padding (overhangs of the script)
    rows.forEach((r) => r.style.setProperty('--pad', `${PAD}px`));
    // keyframes: (time, row, px)
    const keys = [];
    let time = 0;
    const speed = reduced ? 0.45 : 1;
    handLines.forEach((ln, ri) => {
      keys.push({ t: time, r: ri, x: PAD - 2 });
      for (let i = 0; i < ln.length; i++) {
        const ch = ln[i];
        const x = PAD + measure.measureText(ln.slice(0, i + 1)).width;
        const cw = measure.measureText(ch).width;
        let d = clamp((cw / (fs * 0.44)) * 0.072, 0.03, 0.12);
        if (ch === ' ') d = 0.05;
        time += d * speed * (0.85 + Math.random() * 0.3);
        keys.push({ t: time, r: ri, x });
        if (ch === ' ') time += 0.07 * speed;
        if (/[,;:—–]/.test(ch)) time += 0.28 * speed;
        if (/[.!?…]/.test(ch)) time += 0.18 * speed;
      }
      keys.push({ t: time + 0.05, r: ri, x: PAD + measure.measureText(ln).width + PAD + 60 });
      time += 0.34 * speed;
    });
    const total = time;
    hand.classList.add('on');
    rows.forEach((r) => r.style.setProperty('--p', '0px'));
    await new Promise((resolve) => {
      const t0 = performance.now();
      let k = 0;
      const step = () => {
        const t = (performance.now() - t0) / 1000;
        while (k < keys.length - 1 && keys[k + 1].t <= t) k++;
        const a = keys[k];
        const b = keys[Math.min(k + 1, keys.length - 1)];
        rows.forEach((row, ri) => {
          let px;
          if (ri < a.r) px = 99999;
          else if (ri > a.r) px = 0;
          else if (b.r !== a.r || b.t <= a.t) px = a.x;
          else px = a.x + (b.x - a.x) * clamp((t - a.t) / (b.t - a.t), 0, 1);
          row.style.setProperty('--p', `${px.toFixed(1)}px`);
          row.classList.toggle('writing', ri === a.r && t < total);
        });
        if (t < total + 0.1) raf = requestAnimationFrame(step);
        else {
          rows.forEach((row) => { row.style.setProperty('--p', '99999px'); row.classList.remove('writing'); });
          written = true;
          resolve();
        }
      };
      raf = requestAnimationFrame(step);
      if (signal) signal.addEventListener('abort', () => { cancelAnimationFrame(raf); resolve(); }, { once: true });
    });
  }

  /** The photograph and its line gently clear: the words first, then the light and the print, into the dark. */
  function clear() {
    keep(gsap.to(hand, { opacity: 0, filter: 'blur(6px)', y: -6, duration: reduced ? 0.6 : 1.1, ease: 'power2.in' }));
    keep(gsap.to(light, { opacity: 0, duration: reduced ? 1 : 2.2, ease: 'sine.inOut' }));
    keep(gsap.to(fig, { opacity: 0, filter: 'blur(8px)', duration: reduced ? 1 : 1.8, delay: reduced ? 0 : 0.35, ease: 'sine.inOut' }));
    return new Promise((r) => setTimeout(r, (reduced ? 1 : 2.2) * 1000));
  }

  return {
    el: root,
    layout,
    show,
    write,
    clear,
    get box() { return box; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      tweens.forEach((t) => t && t.kill());
      gsap.killTweensOf([fig, light, hand]);
      img.removeAttribute('src');
      root.remove();
    },
  };
}
