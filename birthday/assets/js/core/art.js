// Hand-built SVG artwork shared by the chapters (all original drawings).

let uid = 0;
const nid = (p) => `${p}${++uid}`;

/** The kingdom's sun: 8 long rays, 8 flame rays, a ringed disc. */
export function sunEmblem({ className = '', glow = true, stroke = '#ffe3a3', fill = '#f4c463', inner = '#c98f2b' } = {}) {
  const g = nid('sg');
  const f = nid('sf');
  const rays = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * 360) / 16;
    if (i % 2 === 0) {
      rays.push(`<path transform="rotate(${a})" d="M46 -7.5 L97 0 L46 7.5 Z"/>`);
    } else {
      rays.push(
        `<path transform="rotate(${a})" d="M46 -5 C56 -11 61 4 69 1 C75 -1 79 -3 86 0 C79 4 74 7 67 7 C58 8 55 -2 46 5 Z"/>`
      );
    }
  }
  const inner8 = [];
  for (let i = 0; i < 8; i++) {
    inner8.push(`<path transform="rotate(${i * 45 + 22.5})" d="M14 -4 L30 0 L14 4 Z"/>`);
  }
  return `
<svg class="sun-emblem ${className}" viewBox="-100 -100 200 200" aria-hidden="true">
  <defs>
    <radialGradient id="${g}" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff6d6"/>
      <stop offset=".42" stop-color="#ffe3a3"/>
      <stop offset=".75" stop-color="${fill}"/>
      <stop offset="1" stop-color="#e0a443"/>
    </radialGradient>
    ${glow ? `<filter id="${f}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : ''}
  </defs>
  <g ${glow ? `filter="url(#${f})"` : ''} fill="url(#${g})" stroke="${stroke}" stroke-width=".8" stroke-linejoin="round">
    <g class="sun-rays">${rays.join('')}</g>
    <circle r="42" fill="none" stroke-width="3"/>
    <circle r="36"/>
    <circle r="31" fill="none" stroke="${inner}" stroke-width="1.4" stroke-dasharray="2 3"/>
    <g fill="${inner}" stroke="none" opacity=".75">${inner8.join('')}</g>
    <circle r="11" fill="#fff3cf" stroke="${inner}" stroke-width="1.2"/>
  </g>
</svg>`;
}

/** A paper sky-lantern. `lit` controls the glow. */
export function lanternSVG({ className = '', lit = false } = {}) {
  const body = nid('lb');
  const glow = nid('lg');
  const flame = nid('lf');
  return `
<svg class="lantern-svg ${lit ? 'is-lit' : ''} ${className}" viewBox="0 0 120 170" aria-hidden="true">
  <defs>
    <linearGradient id="${body}" x1="0" y1="1" x2="0" y2="0">
      <stop class="lb0" offset="0" stop-color="#ffd98a"/>
      <stop class="lb1" offset=".45" stop-color="#ffab4d"/>
      <stop class="lb2" offset="1" stop-color="#e2672b"/>
    </linearGradient>
    <radialGradient id="${glow}" cx="60" cy="118" r="70" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff2c4" stop-opacity=".95"/>
      <stop offset=".5" stop-color="#ffb347" stop-opacity=".35"/>
      <stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${flame}" cx="60" cy="128" r="10" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff"/>
      <stop offset=".5" stop-color="#ffe38a"/>
      <stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle class="l-halo" cx="60" cy="88" r="80" fill="url(#${glow})"/>
  <g class="l-dark">
    <path d="M20 24 Q60 12 100 24 L91 132 Q60 140 29 132 Z" fill="#2c1840" stroke="#7a5a98" stroke-width="1.2"/>
    <path d="M40 20 L44 136 M60 17 L60 139 M80 20 L76 136" stroke="#7a5a98" stroke-opacity=".35" stroke-width="1"/>
    <g transform="translate(60 74) scale(.27)" fill="none" stroke="#9c7cc0" stroke-opacity=".55" stroke-width="3">
      ${Array.from({ length: 16 }, (_, i) => `<path transform="rotate(${i * 22.5})" d="${i % 2 ? 'M44 -5 L74 0 L44 5Z' : 'M44 -8 L92 0 L44 8Z'}"/>`).join('')}
      <circle r="38"/>
    </g>
    <ellipse cx="60" cy="22" rx="40" ry="6" fill="#3a2352" stroke="#7a5a98" stroke-width="1.2"/>
    <ellipse cx="60" cy="134" rx="31" ry="5" fill="#3a2352" stroke="#7a5a98" stroke-width="1.2"/>
  </g>
  <g class="l-body">
    <path d="M20 24 Q60 12 100 24 L91 132 Q60 140 29 132 Z" fill="url(#${body})"/>
    <path d="M40 20 L44 136 M60 17 L60 139 M80 20 L76 136" stroke="#c4561f" stroke-opacity=".25" stroke-width="1"/>
    <g transform="translate(60 74) scale(.27)" fill="#d4622a" fill-opacity=".55">
      ${Array.from({ length: 16 }, (_, i) => `<path transform="rotate(${i * 22.5})" d="${i % 2 ? 'M44 -5 L74 0 L44 5Z' : 'M44 -8 L92 0 L44 8Z'}"/>`).join('')}
      <circle r="38"/>
    </g>
    <ellipse cx="60" cy="22" rx="40" ry="6" fill="#ffcf85" stroke="#d1702e" stroke-width="1.2"/>
    <ellipse cx="60" cy="134" rx="31" ry="5" fill="#ffefbf" stroke="#d1702e" stroke-width="1.2"/>
  </g>
  <ellipse class="l-flame" cx="60" cy="126" rx="7" ry="11" fill="url(#${flame})"/>
</svg>`;
}

/** The little magic flower that grows from a drop of sunlight. */
export function flowerSVG({ className = '' } = {}) {
  const pg = nid('pg');
  const cg = nid('cg');
  const blur = nid('fb');
  const petals = (n, len, rot, cls) =>
    Array.from({ length: n }, (_, i) => {
      const a = rot + (i * 360) / n;
      const w = len * 0.34;
      return `<g transform="rotate(${a})"><path class="${cls}" d="M0 0 C${w} ${-len * 0.25} ${w * 0.9} ${-len * 0.8} 0 ${-len} C${-w * 0.9} ${-len * 0.8} ${-w} ${-len * 0.25} 0 0 Z"/></g>`;
    }).join('');
  return `
<svg class="flower-svg ${className}" viewBox="-130 -150 260 330" aria-hidden="true">
  <defs>
    <linearGradient id="${pg}" x1="0" y1="0" x2="0" y2="-1" gradientUnits="objectBoundingBox">
      <stop offset="0" stop-color="#fff3c4"/>
      <stop offset=".55" stop-color="#f4c463"/>
      <stop offset="1" stop-color="#ffb347"/>
    </linearGradient>
    <radialGradient id="${cg}"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#ffe3a3"/><stop offset="1" stop-color="#f4c463"/></radialGradient>
    <filter id="${blur}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <g class="fl-stem" fill="none" stroke="#9fc47a" stroke-width="4" stroke-linecap="round">
    <path class="stem" d="M0 175 C -6 130, 10 90, 0 18"/>
    <path class="leaf" d="M-2 120 C -40 112, -58 84, -62 70 C -40 74, -12 92, -2 120 Z" fill="#7ea862" stroke-width="2"/>
    <path class="leaf" d="M2 92 C 34 84, 50 60, 54 48 C 34 52, 10 66, 2 92 Z" fill="#8bb56c" stroke-width="2"/>
  </g>
  <g class="fl-head">
    <g class="fl-aura" filter="url(#${blur})" opacity=".85">${petals(6, 96, 0, 'pa').replace(/class="pa"/g, 'fill="#ffd27a"')}</g>
    <g class="fl-outer" fill="url(#${pg})" stroke="#e8a33d" stroke-width="1.2">${petals(6, 92, 0, 'p1')}</g>
    <g class="fl-inner" fill="url(#${pg})" stroke="#e8a33d" stroke-width="1">${petals(6, 60, 30, 'p2')}</g>
    <circle class="fl-core" r="17" fill="url(#${cg})" stroke="#e8a33d" stroke-width="1.2"/>
    <g class="fl-dots" fill="#c98f2b">${Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return `<circle cx="${(Math.cos(a) * 9).toFixed(1)}" cy="${(Math.sin(a) * 9).toFixed(1)}" r="1.8"/>`;
    }).join('')}</g>
  </g>
</svg>`;
}

/** A decorative flourish used under chapter titles. */
export function flourishSVG({ className = '' } = {}) {
  return `
<svg class="cc-orn ${className}" viewBox="0 0 320 28" fill="none" stroke="#f4c463" stroke-width="1.2" stroke-linecap="round" aria-hidden="true">
  <path class="orn-l" d="M8 14 L118 14 C130 14 137 5 146 8 C153 10 151 19 144 18 C139 17 140 11 145 12"/>
  <path class="orn-r" d="M312 14 L202 14 C190 14 183 5 174 8 C167 10 169 19 176 18 C181 17 180 11 175 12"/>
  <path class="orn-c" d="M160 5 L165 14 L160 23 L155 14 Z" fill="#f4c463" fill-opacity=".35"/>
  <circle class="orn-d" cx="151" cy="14" r="1.6" fill="#f4c463"/><circle class="orn-d" cx="169" cy="14" r="1.6" fill="#f4c463"/>
</svg>`;
}

/** A tiny chameleon friend (colour set via CSS --skin / --belly). */
export function chameleonSVG({ className = '' } = {}) {
  return `
<svg class="chameleon ${className}" viewBox="0 0 220 150" aria-hidden="true">
  <g class="ch-tail" fill="none" stroke="var(--skin)" stroke-width="13" stroke-linecap="round">
    <path d="M70 98 C40 104 18 88 22 66 C26 46 54 44 58 62 C61 76 44 80 40 70"/>
  </g>
  <g class="ch-legs" fill="var(--skin-d)">
    <path d="M82 112 C78 124 72 130 66 132 C72 136 82 134 88 124 Z"/>
    <path d="M132 114 C134 126 140 132 148 134 C142 138 132 136 126 126 Z"/>
  </g>
  <path class="ch-body" fill="var(--skin)" d="M64 96 C64 70 92 56 122 58 C146 60 160 66 172 76 C186 88 186 108 168 116 C150 124 112 124 92 120 C74 116 64 110 64 96 Z"/>
  <path class="ch-belly" fill="var(--belly)" opacity=".85" d="M80 110 C100 120 140 122 166 112 C160 120 140 124 112 123 C96 122 84 118 80 110 Z"/>
  <path class="ch-crest" fill="var(--skin-d)" d="M92 62 l6 -7 l5 6 l6 -8 l5 7 l6 -8 l5 7 l6 -7 l5 7 l6 -6 l4 7 Z" opacity=".9"/>
  <g class="ch-spots" fill="var(--skin-d)" opacity=".5">
    <circle cx="104" cy="84" r="5"/><circle cx="124" cy="92" r="4"/><circle cx="142" cy="82" r="3.5"/><circle cx="96" cy="102" r="3"/>
  </g>
  <path class="ch-head" fill="var(--skin)" d="M158 70 C172 56 196 58 206 76 C214 90 206 108 186 110 C172 111 160 102 156 92 Z"/>
  <circle class="ch-blush" cx="196" cy="98" r="7" fill="#ff8fb8" opacity="0"/>
  <path class="ch-smile" d="M190 103 C196 106 202 104 206 99" fill="none" stroke="var(--skin-d)" stroke-width="2.4" stroke-linecap="round"/>
  <g class="ch-eye">
    <circle cx="178" cy="78" r="15" fill="var(--skin)" stroke="var(--skin-d)" stroke-width="2.5"/>
    <circle cx="178" cy="78" r="10" fill="none" stroke="var(--skin-d)" stroke-width="1.5" opacity=".6"/>
    <circle class="ch-pupil" cx="181" cy="79" r="5.2" fill="#1b1022"/>
    <circle cx="183" cy="76.5" r="1.7" fill="#fff"/>
  </g>
</svg>`;
}

/** Bunting of kingdom flags strung on a curved line. */
export function buntingSVG({ count = 9, width = 1000, sag = 60, className = '', flip = false } = {}) {
  const flags = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x = t * width;
    const y = 10 + Math.sin(t * Math.PI) * sag;
    const colors = ['#6b3fa0', '#f4c463', '#8a5cc7', '#f2a7c3'];
    const c = colors[i % colors.length];
    const sun = c === '#f4c463' ? '#6b3fa0' : '#f4c463';
    flags.push(`
      <g class="flag" style="--d:${(i % 5) * 0.37}s" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
        <g class="flag-in">
          <path d="M-26 0 L26 0 L26 46 L0 62 L-26 46 Z" fill="${c}"/>
          <path d="M-26 0 L26 0 L26 6 L-26 6 Z" fill="#000" opacity=".18"/>
          <g transform="translate(0 26) scale(.15)" fill="${sun}">
            ${Array.from({ length: 12 }, (_, k) => `<path transform="rotate(${k * 30})" d="M40 -9 L86 0 L40 9 Z"/>`).join('')}
            <circle r="34"/>
          </g>
        </g>
      </g>`);
  }
  const d = `M0 ${flip ? 10 : 10} Q ${width / 2} ${10 + sag * 2} ${width} 10`;
  return `
<svg class="bunting ${className}" viewBox="0 -4 ${width} ${sag + 90}" preserveAspectRatio="none" aria-hidden="true">
  <path d="${d}" fill="none" stroke="#e7d3a6" stroke-width="2" opacity=".75"/>
  ${flags.join('')}
</svg>`;
}

/** Tall tower silhouette on a rock, with one lit window. */
export function towerSVG({ className = '' } = {}) {
  return `
<svg class="tower-svg ${className}" viewBox="0 0 200 420" aria-hidden="true">
  <path d="M0 420 C20 360 50 352 60 340 L140 340 C152 352 182 362 200 420 Z" fill="#140a22"/>
  <path d="M70 344 L74 150 L126 150 L130 344 Z" fill="#1b0e2c"/>
  <path d="M58 156 L142 156 L148 140 L52 140 Z" fill="#1d1030"/>
  <path d="M50 140 L100 40 L150 140 Z" fill="#241238"/>
  <path d="M100 40 L100 22" stroke="#241238" stroke-width="3"/>
  <path d="M100 22 L118 28 L100 34 Z" fill="#6b3fa0"/>
  <path class="tw-win" d="M88 170 Q100 154 112 170 L112 196 L88 196 Z" fill="#ffcf7a"/>
  <path d="M74 220 C60 250 84 280 72 320" stroke="#2e5a3a" stroke-width="5" fill="none" opacity=".6"/>
  <path d="M126 230 C140 260 118 290 130 330" stroke="#2e5a3a" stroke-width="4" fill="none" opacity=".5"/>
</svg>`;
}

/** Utility: create an element from an HTML string. */
export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

/** Escape owner-provided text before putting it into markup. */
export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------------------------------------------------------- the friendship trail */

/**
 * A tiny line glyph for one of the owner's memories, by its kind (24×24, drawn in currentColor):
 * beginning → a knot in the thread, daily → beads of light, journey → a bus window,
 * sharing → two little notes (scribbles, never words), anything else → a spark.
 */
export function memoryGlyphSVG(kind = 'moment', { className = '' } = {}) {
  const shapes = {
    beginning: '<path d="M2.4 15.8 C6.4 15.8 8.6 14.6 10.4 11.8 C12.4 8.6 13.9 5.6 16.8 5.9 C19.9 6.2 20.1 10.3 17.4 11.9 C14.8 13.4 12.3 11.7 11.7 9.8"/><path d="M12.8 13.3 C14.8 15.4 17.6 15.9 21.6 15.8"/>',
    daily: '<path d="M1.8 12 H22.2" stroke-opacity=".55"/><circle cx="6.2" cy="12" r="2.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2.7" fill="currentColor" stroke="none"/><circle cx="17.8" cy="12" r="2.1" fill="currentColor" stroke="none"/>',
    journey: '<rect x="3.2" y="5.2" width="17.6" height="13.4" rx="3.2"/><path d="M3.6 14.8 C7.4 12.7 10.5 15.5 13.7 13.7 C16.1 12.4 18.4 12.9 20.4 13.9"/><circle cx="15.6" cy="9.5" r="1.7" fill="currentColor" stroke="none"/>',
    sharing: '<g transform="rotate(-10 8.6 13.6)"><rect x="3.4" y="8" width="10.4" height="11.4" rx="1.2" fill="currentColor" fill-opacity=".14"/><path d="M5.8 11.6 h5.4 M5.8 14 h4.4 M5.8 16.4 h2.8" stroke-width="1.2"/></g><g transform="rotate(9 15.6 10.4)"><rect x="10.4" y="4.6" width="10.4" height="11.4" rx="1.2" fill="currentColor" fill-opacity=".14"/><path d="M12.8 8.2 h5.4 M12.8 10.6 h4.6 M12.8 13 h3" stroke-width="1.2"/></g>',
    moment: '<path d="M12 2.6 C12.7 8.9 15.1 11.3 21.4 12 C15.1 12.7 12.7 15.1 12 21.4 C11.3 15.1 8.9 12.7 2.6 12 C8.9 11.3 11.3 8.9 12 2.6 Z" fill="currentColor" fill-opacity=".9" stroke-width="1"/>',
  };
  return `<svg class="mem-glyph ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[kind] || shapes.moment}</svg>`;
}

/**
 * A tiny keychain charm on a jump ring and a short chain (40×76; the ring's centre, 20 4.6, is
 * the pivot it swings from). kind: 'sun' (the film's gold sun, as enamel) or 'lantern'
 * (the film's sky lantern: plum paper, gold frame, a warm glow inside).
 */
export function charmSVG({ kind = 'sun', className = '' } = {}) {
  const gold = nid('cg');
  const halo = nid('ch');
  const paper = nid('cp');
  const chain = `
    <circle cx="20" cy="4.6" r="3.3" fill="none" stroke="#7a4e16" stroke-width="2.6"/>
    <circle cx="20" cy="4.6" r="3.3" fill="none" stroke="url(#${gold})" stroke-width="1.5"/>
    <g fill="none" stroke-width="1.25">
      <ellipse cx="20" cy="11.3" rx="1.8" ry="3" stroke="#ffe3a3"/>
      <ellipse cx="20" cy="17.1" rx=".75" ry="3" stroke="#e0a845"/>
      <ellipse cx="20" cy="22.9" rx="1.8" ry="3" stroke="#ffe3a3"/>
    </g>
    <circle cx="20" cy="28.6" r="2.3" fill="none" stroke="#f4c463" stroke-width="1.3"/>`;
  const defs = `
    <linearGradient id="${gold}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff3cf"/><stop offset=".45" stop-color="#f4c463"/><stop offset="1" stop-color="#b9822a"/>
    </linearGradient>
    <radialGradient id="${halo}">
      <stop offset="0" stop-color="#fff2c4" stop-opacity=".9"/><stop offset=".45" stop-color="#ffb347" stop-opacity=".35"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${paper}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3b1a57"/><stop offset=".55" stop-color="#7a3f8f"/><stop offset="1" stop-color="#e08a4a"/>
    </linearGradient>`;
  let body;
  if (kind === 'lantern') {
    body = `
    <g transform="translate(20 50)">
      <circle class="charm-glow" r="19" fill="url(#${halo})" opacity=".55"/>
      <path d="M-11 -15 Q0 -18.6 11 -15 L8 13 Q0 15.6 -8 13 Z" fill="url(#${paper})" stroke="#2a1238" stroke-width=".9" stroke-linejoin="round"/>
      <ellipse cx="0" cy="6" rx="5.6" ry="7" fill="url(#${halo})"/>
      <path d="M-4 -16.4 L-3 14.4 M4 -16.4 L3 14.4" stroke="#f4c463" stroke-width=".8" stroke-opacity=".85"/>
      <circle cy="-3.4" r="3" fill="none" stroke="#f4c463" stroke-width=".85"/>
      <circle cy="-3.4" r="1" fill="#f4c463"/>
      <ellipse cy="-15.4" rx="11.2" ry="2.3" fill="url(#${gold})" stroke="#7a4e16" stroke-width=".7"/>
      <ellipse cy="13.3" rx="8.1" ry="1.9" fill="#ffe3a3" stroke="#7a4e16" stroke-width=".7"/>
      <ellipse cy="8.4" rx="1.7" ry="2.8" fill="#fffaf0"/>
      <path d="M-8.4 -10 Q-9 0 -6.6 9" stroke="#fff4e0" stroke-width="1.1" stroke-linecap="round" stroke-opacity=".45" fill="none"/>
    </g>`;
  } else {
    const rays = Array.from({ length: 8 }, (_, i) => `<path transform="rotate(${i * 45})" d="M9.4 -3.3 L17.6 0 L9.4 3.3 Z"/>`).join('');
    body = `
    <g transform="translate(20 49) rotate(-90)">
      <g fill="url(#${gold})" stroke="#9a651c" stroke-width=".8" stroke-linejoin="round">${rays}<circle r="11"/></g>
    </g>
    <g transform="translate(20 49)">
      <circle r="7.6" fill="none" stroke="#c98f2b" stroke-width=".9" stroke-dasharray="1.4 1.6"/>
      <circle r="3.4" fill="#fff3cf" stroke="#c98f2b" stroke-width=".8"/>
      <path d="M-7.6 -4.6 A9 9 0 0 1 1.6 -9.4" stroke="#fffbe8" stroke-width="1.5" stroke-linecap="round" fill="none" stroke-opacity=".85"/>
    </g>`;
  }
  return `
<svg class="charm-svg charm-${kind === 'lantern' ? 'lantern' : 'sun'} ${className}" viewBox="0 0 40 76" aria-hidden="true">
  <defs>${defs}</defs>
  ${chain}
  ${body}
</svg>`;
}

/**
 * A hand-drawn keyring with three little charms — a tiny lantern, a mini soda bottle (plain
 * green glass, no label) and a watermelon slice — in ink and gold on paper (200×200, or 4:5
 * with `tall`, the drawing centred on a taller sheet).
 */
export function keyringSketchSVG({ className = '', tall = false } = {}) {
  const pad = tall ? 25 : 0; // extra paper above and below (viewBox 200×250)
  const ink = '#3a2147';
  const lines = nid('kl');
  const glass = nid('kg');
  const paper = nid('kp');
  const glow = nid('kw');
  const star = (x, y, r) => `M${x} ${y - r} C${x + r * 0.16} ${y - r * 0.2} ${x + r * 0.2} ${y - r * 0.16} ${x + r} ${y} C${x + r * 0.2} ${y + r * 0.16} ${x + r * 0.16} ${y + r * 0.2} ${x} ${y + r} C${x - r * 0.16} ${y + r * 0.2} ${x - r * 0.2} ${y + r * 0.16} ${x - r} ${y} C${x - r * 0.2} ${y - r * 0.16} ${x - r * 0.16} ${y - r * 0.2} ${x} ${y - r} Z`;
  const seeds = [[134, 106, -35], [144, 110, 0], [154, 106, 35], [139, 115, -20], [149, 115, 20]]
    .map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="1.3" ry="2.3" transform="rotate(${a} ${x} ${y})"/>`).join('');
  return `
<svg class="keyring-sketch ${className}" viewBox="0 ${-pad} 200 ${200 + 2 * pad}" aria-hidden="true">
  <defs>
    <linearGradient id="${glass}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#a9dcae"/><stop offset=".42" stop-color="#63b07c"/><stop offset="1" stop-color="#2e7650"/>
    </linearGradient>
    <linearGradient id="${paper}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a2470"/><stop offset=".6" stop-color="#7c3f8c"/><stop offset="1" stop-color="#df8a4c"/>
    </linearGradient>
    <radialGradient id="${glow}">
      <stop offset="0" stop-color="#ffe9b0" stop-opacity=".95"/><stop offset=".5" stop-color="#ffb347" stop-opacity=".4"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M13 ${15 - pad} C60 ${11 - pad} 140 ${13 - pad} 187 ${14 - pad} C189.5 60 188.5 140 186.5 ${186 + pad} C140 ${188.5 + pad} 60 ${189.5 + pad} 14 ${185.5 + pad} C11 140 12 60 13 ${15 - pad} Z" fill="none" stroke="${ink}" stroke-opacity=".28" stroke-width="1.3" stroke-linecap="round"/>
  <ellipse cx="58" cy="124" rx="30" ry="32" fill="url(#${glow})" opacity=".6"/>
  <g stroke-linecap="round" fill="none">
    <path d="M89 62 C80 72 66 80 58.5 91.5 M100 64 C100 74 100.5 84 100 96 M111 62 C120 72 136 79 143.5 89.5" stroke="${ink}" stroke-width="3.6" stroke-dasharray="3.4 2.2"/>
    <path d="M89 62 C80 72 66 80 58.5 91.5 M100 64 C100 74 100.5 84 100 96 M111 62 C120 72 136 79 143.5 89.5" stroke="#f4c463" stroke-width="1.9" stroke-dasharray="3.4 2.2"/>
    <circle cx="100" cy="44" r="19" stroke="${ink}" stroke-width="5.6"/>
    <circle cx="100" cy="44" r="19" stroke="#f4c463" stroke-width="3"/>
    <path d="M83.5 53.5 A16 16 0 1 1 112 55" stroke="${ink}" stroke-width="4.4"/>
    <path d="M83.5 53.5 A16 16 0 1 1 112 55" stroke="#e0a845" stroke-width="2.2"/>
    <path d="M86 33 A18 18 0 0 1 100 26.4" stroke="#fffbe8" stroke-width="1.3"/>
    <circle cx="58.5" cy="95" r="3.2" stroke="${ink}" stroke-width="3.4"/><circle cx="58.5" cy="95" r="3.2" stroke="#f4c463" stroke-width="1.6"/>
    <circle cx="100" cy="99.5" r="3.2" stroke="${ink}" stroke-width="3.4"/><circle cx="100" cy="99.5" r="3.2" stroke="#f4c463" stroke-width="1.6"/>
    <circle cx="144" cy="93" r="3.2" stroke="${ink}" stroke-width="3.4"/><circle cx="144" cy="93" r="3.2" stroke="#f4c463" stroke-width="1.6"/>
  </g>
  <g id="${lines}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M45 102 Q58.5 97.4 72 102 L68 142.5 Q58.5 146.4 49 142.5 Z" fill="url(#${paper})"/>
    <path d="M54 100.4 L55 144.6 M63 100.4 L62 144.6" stroke="#f4c463" stroke-width="1.1" fill="none"/>
    <circle cx="58.5" cy="117" r="4.2" fill="none" stroke="#f4c463" stroke-width="1.2"/>
    <circle cx="58.5" cy="117" r="1.4" fill="#f4c463" stroke="none"/>
    <ellipse cx="58.5" cy="136.6" rx="2.7" ry="4" fill="#fff3cf" stroke="none"/>
    <ellipse cx="58.5" cy="101.4" rx="13.6" ry="3" fill="#f4c463"/>
    <ellipse cx="58.5" cy="142.6" rx="9.7" ry="2.4" fill="#ffe3a3"/>
    <path d="M93.5 103.4 h13 v7 h-13 Z" fill="#d9dde6"/>
    <path d="M96.7 103.6 v6.6 M100 103.6 v6.6 M103.3 103.6 v6.6" stroke-width=".8" fill="none"/>
    <path d="M95 110.4 L95 117.6 C95 122.6 88.5 126 88.5 133.6 L88.5 167.6 Q88.5 173 94 173 L106 173 Q111.5 173 111.5 167.6 L111.5 133.6 C111.5 126 105 122.6 105 117.6 L105 110.4 Z" fill="url(#${glass})" fill-opacity=".92"/>
    <path d="M93.6 170 C92.6 162 92.6 156 93.6 149 M100 171 V149 M106.4 170 C107.4 162 107.4 156 106.4 149" stroke="#2a6a48" stroke-width=".9" fill="none"/>
    <path d="M92.4 132 L92.4 160" stroke="#fbfff8" stroke-opacity=".7" stroke-width="2.2" fill="none"/>
    <g fill="none" stroke="#effff1" stroke-width=".9"><circle cx="99" cy="141" r="1.6"/><circle cx="103.4" cy="151" r="1.2"/><circle cx="97.2" cy="157" r="1.4"/><circle cx="104.2" cy="134.4" r="1"/><circle cx="101.2" cy="163" r="1.1"/></g>
    <path d="M120 100 A24 24 0 0 0 168 100 Z" fill="#5f7f4b"/>
    <path d="M122.6 100.6 A21.4 21.4 0 0 0 165.4 100.6 Z" fill="#eef4cf" stroke="none"/>
    <path d="M125.2 100.6 A18.8 18.8 0 0 0 162.8 100.6 Z" fill="#f0596b" stroke="none"/>
    <path d="M119 100 H169" stroke="#c98f2b" stroke-width="2"/>
    <g fill="${ink}" stroke="none">${seeds}</g>
    <path d="M144 96.2 V100" fill="none"/>
  </g>
  <use href="#${lines}" transform="translate(.8 .6)" opacity=".22"/>
  <g fill="#f4c463" stroke="${ink}" stroke-width="1.1" stroke-linejoin="round">
    <path d="${star(38, 44, 7)}"/><path d="${star(165, 38, 5.5)}"/><path d="${star(176, 152, 4.5)}"/><path d="${star(26, 160, 4)}"/>${tall ? `<path d="${star(150, -2, 4)}"/><path d="${star(52, 200, 5)}"/>` : ''}
  </g>
  <g fill="none" stroke="${ink}" stroke-width="1.3" stroke-linecap="round" stroke-opacity=".7">
    <path d="M72 34 C67 31 65 26 66 20 M78 24 C75 20 75 15 77 11"/>
    <path d="M128 34 C133 31 135 26 134 20 M122 24 C125 20 125 15 123 11"/>
  </g>
</svg>`;
}
