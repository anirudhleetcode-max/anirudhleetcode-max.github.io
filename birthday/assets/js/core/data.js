// Loads the content (data/settings.json + messages.json + photos.json, or the
// admin's unpublished draft) and gives the chapters a small photo API.
import { placeholderURL } from './placeholders.js';
import { FILES, LEGACY_FILE, combine, upgrade, photosFor, parseRatio, daysAlive } from '../shared/model.js';

export { parseRatio };

async function loadDraftSafe() {
  try {
    const mod = await import('../shared/drafts.js');
    return await mod.loadDraft();
  } catch (err) {
    console.warn('[data] no draft available', err);
    return null;
  }
}

/** One request that gives up after `timeout` ms (a hung connection never leaves her on the boot screen). */
async function fetchOnce(path, timeout) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), timeout) : 0;
  try {
    const res = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store', signal: ac ? ac.signal : undefined });
    if (!res.ok) { const err = new Error(`${path} ${res.status}`); err.status = res.status; throw err; }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** A content file, tried a few times (a dropped or slow request on mobile data is retried quietly).
 *  A file that is simply not there (404) is not retried. */
async function fetchJSON(path, { tries = 3, timeout = 9000 } = {}) {
  let last = null;
  for (let k = 0; k < tries; k++) {
    try {
      return await fetchOnce(path, timeout);
    } catch (err) {
      last = err;
      if (err && err.status === 404) break;
      if (k < tries - 1) await new Promise((r) => setTimeout(r, 600 * (k + 1)));
    }
  }
  throw last;
}

export async function loadSite({ draft = false } = {}) {
  let site = null;
  let files = null;
  if (draft) {
    const d = await loadDraftSafe();
    if (d && d.site) {
      site = upgrade(d.site);
      files = d.files;
    }
  }
  if (!site) {
    try {
      const [settings, messages, photos] = await Promise.all([fetchJSON(FILES.settings), fetchJSON(FILES.messages), fetchJSON(FILES.photos)]);
      site = combine({ settings, messages, photos });
    } catch (err) {
      // an older deploy that still has the single-file format (only when the files are really missing)
      if (!(err && err.status === 404)) throw err;
      site = upgrade(await fetchJSON(LEGACY_FILE, { tries: 1 }));
    }
  }
  return createStore(site, files);
}

const DEFAULT_FOCAL = { x: 0.5, y: 0.4 };

export function createStore(site, files) {
  const blobUrls = new Map();
  const resolve = (path) => {
    if (!path) return null;
    if (/^(https?:|data:|blob:)/.test(path)) return path;
    const blob = files && files.get && files.get(path);
    if (blob) {
      if (!blobUrls.has(path)) blobUrls.set(path, URL.createObjectURL(blob));
      return blobUrls.get(path);
    }
    return path;
  };

  const herName = (site.her && site.her.name) || 'her';
  const chapterRank = ['prologue', 'tower', 'story', 'hair', 'names', 'dance', 'lanterns', 'letter', 'finale', 'album'];
  const indexOf = new Map(site.photos.map((p, i) => [p.id, i]));

  // owner text on a photo goes through the same filler as narration ({name}… filled; a caption that still
  // needs an unwritten memory, or holds a [PLACEHOLDER], is left out of her film)
  let fillText = (t) => t;
  const toPhoto = (p) => {
    const ratio = parseRatio(p.ratio);
    const url = resolve(p.src);
    const focal = p.focal && Number.isFinite(p.focal.x) ? p.focal : DEFAULT_FOCAL;
    const placeholder = !url;
    const purl = placeholder ? placeholderURL({ id: p.id, label: p.label || p.chapter, ratio, index: indexOf.get(p.id) || 0 }) : null;
    return {
      id: p.id,
      chapter: p.chapter,
      order: p.order,
      role: p.role,
      label: p.label || '',
      caption: String(fillText(String(p.caption || '')) || '').trim(),
      rawCaption: String(p.caption || ''), // as the owner typed it (tokens unfilled): what the tone guard reads
      date: String(fillText(String(p.date || '')) || '').trim(),
      alt: p.alt || String(fillText(String(p.caption || '')) || '').trim() || `A photo of ${herName}`,
      ratio,
      ratioStr: p.ratio,
      focal,
      objectPosition: `${(focal.x * 100).toFixed(1)}% ${(focal.y * 100).toFixed(1)}%`,
      featured: !!p.featured,
      heroHair: !!p.heroHair,
      animation: p.animation || null,
      effect: p.effect || null,
      duration: p.duration || null,
      isPlaceholder: placeholder,
      memory: p.memory || null,
      url: url || purl,
      thumbUrl: resolve(p.thumb) || url || purl,
      srcset: srcsetOf(p, url),
    };
  };
  /** "thumb 480w, display 960w" when the display size is known — small slots then load the thumbnail. */
  function srcsetOf(p, url) {
    const w = Number(p.w);
    const h = Number(p.h);
    const thumb = resolve(p.thumb);
    if (!url || !thumb || !(w > 0 && h > 0)) return '';
    const tw = Math.round(w * Math.min(1, 640 / Math.max(w, h)));
    return tw < w ? `${thumb} ${tw}w, ${url} ${Math.round(w)}w` : '';
  }

  const enabledChapter = new Map((site.chapters || []).map((c) => [c.id, c.enabled !== false]));
  const byId = new Map(site.photos.map((p) => [p.id, p]));

  const store = {
    site,
    text: site.text || {},
    media: site.media || {},
    /** All enabled photos of a chapter, in order. `limit` caps the count. */
    photos(chapter, { limit } = {}) {
      const list = photosFor(site, chapter).map(toPhoto);
      return limit ? list.slice(0, limit) : list;
    },
    /** Backwards-compatible alias. */
    chapter(name) { return this.photos(name); },
    photo(id) {
      const p = byId.get(id);
      return p ? toPhoto(p) : toPhoto({ id, ratio: '1:1', label: id, chapter: 'album' });
    },
    /** The photo playing a special part: 'hero' | 'reveal' | 'together'. */
    role(role) {
      // (fan art is imagined, never a real photo: it never plays a special part)
      const p = site.photos.find((x) => x.role === role && x.enabled !== false && x.chapter !== 'fanart');
      if (p) return toPhoto(p);
      if (role === 'together') return null; // never pretend a solo photo shows the two of them
      const fallback = { hero: 'prologue', reveal: 'finale', together: 'finale' }[role];
      const list = this.photos(fallback);
      return list[role === 'together' ? 1 : 0] || list[0] || this.photo(role);
    },
    featured() { return this.all().filter((p) => p.featured); },
    heroHair() { return this.all().find((p) => p.heroHair) || null; },
    extras() { return this.photos('album').filter((p) => !p.isPlaceholder); },
    /** Every enabled photo across the film (chapter order), placeholders included. */
    all() {
      return chapterRank.flatMap((ch) => this.photos(ch));
    },
    real() { return this.all().filter((p) => !p.isPlaceholder); },
    count() { return this.real().length; },
    chapterEnabled(id) { return enabledChapter.has(id) ? enabledChapter.get(id) : true; },
    mediaUrl(key) { return resolve(site.media && site.media[key]); },
    /** The projector's token filler (set once the tokens are known). */
    setFill(fn) { fillText = typeof fn === 'function' ? fn : (t) => t; },
    daysAlive(when) { return daysAlive(site, when); },
  };
  return store;
}

// Decode an image ahead of time so reveals never pop in half-loaded.
const decoded = new Map();
/**
 * The file a browser will pick from a photo's srcset for a slot `cssWidth` CSS px wide on this
 * screen (the smallest copy that is sharp enough), so preloading fetches that file, not the other one.
 */
export function pickSrc(p, cssWidth) {
  if (!p || !p.srcset || !(cssWidth > 0)) return p ? p.url : '';
  const need = cssWidth * Math.min(window.devicePixelRatio || 1, 3);
  const list = p.srcset.split(',').map((c) => { const [u, w] = c.trim().split(/\s+/); return { u, w: parseFloat(w) }; })
    .filter((c) => c.u && c.w > 0).sort((a, b) => a.w - b.w);
  return (list.find((c) => c.w >= need) || list[list.length - 1] || { u: p.url }).u;
}

export function preload(url) {
  if (!url) return Promise.resolve(null);
  if (decoded.has(url)) return decoded.get(url);
  const p = new Promise((res) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => res(img));
    img.onerror = () => res(null);
    img.src = url;
  });
  decoded.set(url, p);
  return p;
}
