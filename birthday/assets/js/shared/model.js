// The content model (v2), shared by the film and the admin portal.
//
// On disk the content lives in three files so words, photos and settings stay
// separate from the animation code:
//   data/settings.json  — who / when / switches / media / chapter visibility
//   data/messages.json  — every on-screen word, grouped by chapter
//   data/photos.json    — the photo library (unlimited) + per-chapter defaults
//
// In memory both the film and the admin work with ONE combined object:
//   { version, her, from, settings, media, chapters, text, photoChapters, photos }
// `combine()` / `split()` convert between the two.

export const MODEL_VERSION = 2;

/** The photoshoot scene prints at most this many fan-art images. */
export const FANART_MAX = 2;

/** Words that make a photo read as romantic (roses, hearts…): the friendship moments pass those photos over. */
export const ROMANCE = /\b(roses?|hearts?|valentine|couple|kiss(es|ing)?|date night)\b/i;
export const readsRomantic = (p) => !!p && ROMANCE.test(`${p.label || ''} ${p.alt || ''} ${p.caption || ''} ${p.rawCaption || ''}`);

/** Where photos can live in the film. Counts are flexible — chapters adapt. */
export const PHOTO_CHAPTERS = [
  { id: 'prologue', label: 'Prologue — the very first photo', short: 'Prologue', ratio: '4:5', min: 1, max: 1, recommended: 1, hint: 'Her prettiest solo portrait. This is the first photo she sees.' },
  { id: 'tower', label: 'Ch · The tower walls (painted memories)', short: 'Tower', ratio: '3:4', min: 1, max: 16, recommended: 6, hint: 'Candid, warm, everyday moments.' },
  { id: 'story', label: 'Ch · How it began (your memories)', short: 'Our story', ratio: null, min: 0, max: null, recommended: 8, hint: 'Photos for your memories. In the photo editor, choose which memory each photo belongs to.' },
  { id: 'hair', label: 'Ch · The golden thread (hanging polaroids)', short: 'Golden thread', ratio: '3:4', min: 1, max: 24, recommended: 8, hint: 'Memories in order — the thread connects them.' },
  { id: 'names', label: 'Ch · Her names (Deepu, Kuchu Puchu)', short: 'Names', ratio: '4:5', min: 1, max: 4, recommended: 2, hint: 'One photo per name, in the same order as the names in Settings.' },
  { id: 'dance', label: 'Ch · The festival (3D dance)', short: 'Festival', ratio: '3:4', min: 3, max: 16, recommended: 8, hint: 'Happy, festive, fun.' },
  { id: 'lanterns', label: 'Ch · Photo lanterns in the night sky', short: 'Lanterns', ratio: '1:1', min: 1, max: 16, recommended: 6, hint: 'Soft, glowy, emotional moments.' },
  { id: 'letter', label: 'Ch · Pinned to the letter', short: 'Letter', ratio: '1:1', min: 0, max: 3, recommended: 2, hint: 'Photos of you two, ideally.' },
  { id: 'finale', label: 'Finale · the final photograph (and, optionally, one of you two)', short: 'Finale', ratio: '4:5', min: 1, max: 2, recommended: 1, hint: 'Her single best photo. Optionally a second one of BOTH of you (mark it “together”).' },
  { id: 'fanart', label: 'Fan-art photoshoot — your finished fan-art image (imagined, not a real photo)', short: 'Fan art', ratio: null, min: 0, max: FANART_MAX, recommended: 1, hint: 'Optional. A finished, identity-checked fan-art image (Deepu and Nivin Pauly side by side, nothing romantic), any shape, at least 1600 px on its long side. The film prints it marked “imagined · fan art” and never calls it a real photo; it is never shown anywhere else. Until you add one, the photoshoot scene is skipped. What the image must be: README → “The fan-art photoshoot”.' },
  { id: 'album', label: 'Extra memories (album, finale montage, credits)', short: 'Extra memories', ratio: null, min: 0, max: null, recommended: 0, hint: 'Add as many as you like, any time.' },
];

/**
 * The owner's finished fan-art images for the photoshoot scene (Photos → Fan art), at most
 * FANART_MAX, in order. Imagined fan art only: these are never real photos, never take a special
 * part (hero, reveal, together), never count as photos of her and never appear in any other chapter.
 */
export function fanArtPhotos(site) {
  return photosFor(site, 'fanart').filter((p) => p.src).slice(0, FANART_MAX);
}

/**
 * True for a fan-art image: added through Photos → Fan art (the admin marks it `kind: 'fanart'`;
 * older ones carry the "fanart-" id they were given there). Wherever it sits, it is imagined,
 * never a real photo, so it may never move to another chapter, and a real photo never becomes one.
 */
export function isFanArt(p) {
  return !!p && (p.kind === 'fanart' || (!p.kind && /^fanart-/.test(String(p.id || ''))));
}

/**
 * Whether a film chapter has anything to play with these settings (the film skips it otherwise):
 * “The little things” needs one of its scenes on in Theme; “What makes you, you” needs pani puri or
 * Manchuria on, or the photoshoot on with a fan-art image; the video chapter needs a video.
 * (A chapter switched off under Chapters is another matter: site.chapters.)
 */
export function chapterPlays(site, id) {
  const theme = (site && site.settings && site.settings.theme) || {};
  const on = (k) => theme[k] !== false;
  if (id === 'little') return ['keychains', 'sprite', 'twinklingWatermelon'].some(on);
  if (id === 'favourites') return ['panipuri', 'manchuria'].some(on) || (on('nivin') && fanArtPhotos(site).length > 0);
  if (id === 'video') return !!(site && site.media && site.media.video);
  return true;
}

/** The film's chapters, in story order. `toggle:false` chapters are always on. */
export const FILM_CHAPTERS = [
  { id: 'gate', label: 'Countdown', toggle: false },
  { id: 'invite', label: 'Invitation', toggle: false },
  { id: 'prologue', label: 'Prologue' },
  { id: 'tower', label: 'Chapter · The tower' },
  { id: 'story', label: 'Chapter · How it began (your memories)' },
  { id: 'hair', label: 'Chapter · The golden thread' },
  { id: 'names', label: 'Chapter · Her names' },
  { id: 'dance', label: 'Chapter · The festival' },
  { id: 'lanterns', label: 'Chapter · The night of lanterns' },
  { id: 'letter', label: 'The letter' },
  { id: 'little', label: 'The little things · keychains, Sprite, Twinkling Watermelon' },
  { id: 'favourites', label: 'What makes you, you · pani puri, Manchuria, the fan-art photoshoot (with your image)' },
  { id: 'cake', label: 'Twenty candles' },
  { id: 'video', label: 'Video message (only if uploaded)' },
  { id: 'constellation', label: 'Finale · the constellation' },
  { id: 'birthday', label: 'Finale · 7,305 days & the last lantern' },
  { id: 'hug', label: 'The friendship trail' },
  { id: 'credits', label: 'Credits', toggle: false },
];

export const RATIO_PRESETS = ['3:4', '4:5', '1:1', '4:3', '3:2', '2:3', '16:9', '9:16'];
export const ROLES = ['hero', 'reveal', 'together'];
export const CROP_MODES = ['cover', 'contain'];

/* ------------------------------------------------------------------ ratios */
export function parseRatio(str) {
  if (typeof str === 'number') return str > 0 ? str : 1;
  const [w, h] = String(str || '1:1').split(':').map(Number);
  return w > 0 && h > 0 ? w / h : 1;
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

/** Human ratio for arbitrary pixel sizes: nearest common preset if close, else reduced w:h. */
export function describeRatio(w, h) {
  const r = w / h;
  let best = null;
  for (const p of [...RATIO_PRESETS, '5:4', '21:9', '9:19.5', '19.5:9']) {
    const d = Math.abs(parseRatio(p) - r) / r;
    if (!best || d < best.d) best = { p, d };
  }
  if (best && best.d < 0.02) return best.p;
  const W = Math.round(w);
  const H = Math.round(h);
  const g = gcd(W, H) || 1;
  const a = W / g;
  const b = H / g;
  return a < 50 && b < 50 ? `${a}:${b}` : `${r.toFixed(2)}:1`;
}

/** True when two ratios are the same shape (within `tol`, relative). */
export function ratioMatches(a, b, tol = 0.015) {
  const ra = parseRatio(a);
  const rb = parseRatio(b);
  return Math.abs(ra - rb) / rb <= tol;
}

/* ------------------------------------------------------------------ photos */
let seq = 0;
export function newId(prefix = 'p') {
  seq = (seq + 1) % 1000;
  return `${prefix}-${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function chapterInfo(id) {
  return PHOTO_CHAPTERS.find((c) => c.id === id) || PHOTO_CHAPTERS[PHOTO_CHAPTERS.length - 1];
}

/** A complete photo record with defaults filled in. */
export function newPhoto(partial = {}) {
  const ch = chapterInfo(partial.chapter || 'album');
  return {
    ...partial, // keep any extra fields someone added by hand
    id: partial.id || newId(ch.id === 'album' ? 'x' : ch.id),
    chapter: ch.id,
    order: Number.isFinite(partial.order) ? partial.order : 999,
    role: partial.role || null,
    label: partial.label || '',
    hint: partial.hint || '',
    ratio: partial.ratio || ch.ratio || '3:4',
    src: partial.src || null,
    thumb: partial.thumb || null,
    original: partial.original || null,
    crop: partial.crop || null, // {x,y,w,h} normalised (0..1) within `original`
    cropMode: CROP_MODES.includes(partial.cropMode) ? partial.cropMode : 'cover',
    focal: partial.focal && Number.isFinite(partial.focal.x) ? { x: clamp01(partial.focal.x), y: clamp01(partial.focal.y) } : { x: 0.5, y: 0.4 },
    caption: partial.caption || '',
    date: partial.date || '',
    alt: partial.alt || '',
    enabled: partial.enabled !== false,
    featured: !!partial.featured,
    heroHair: !!partial.heroHair,
    grade: {
      strength: partial.grade && Number.isFinite(partial.grade.strength) ? partial.grade.strength : null,
      warmth: (partial.grade && partial.grade.warmth) || 0,
      exposure: (partial.grade && partial.grade.exposure) || 0,
    },
    animation: partial.animation || null,
    effect: partial.effect || null,
    duration: Number.isFinite(partial.duration) ? partial.duration : null,
    addedAt: partial.addedAt || null,
    updatedAt: partial.updatedAt || null,
  };
}

function clamp01(v) { return Math.min(1, Math.max(0, Number(v) || 0)); }

/** Enabled photos of a chapter in display order. */
export function photosFor(site, chapter, { includeDisabled = false } = {}) {
  return (site.photos || [])
    .filter((p) => p.chapter === chapter && (includeDisabled || p.enabled !== false))
    .sort((a, b) => (a.order - b.order) || String(a.id).localeCompare(String(b.id)));
}

export function nextOrder(site, chapter) {
  const list = photosFor(site, chapter, { includeDisabled: true });
  return list.length ? Math.max(...list.map((p) => p.order || 0)) + 1 : 1;
}

/** Re-number a chapter's photos 1..n following `ids` (others keep relative order after). */
export function reorder(site, chapter, ids) {
  const list = photosFor(site, chapter, { includeDisabled: true });
  const rank = new Map(ids.map((id, i) => [id, i]));
  list.sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e6 + a.order) - (rank.has(b.id) ? rank.get(b.id) : 1e6 + b.order));
  list.forEach((p, i) => (p.order = i + 1));
  return site;
}

/** Every repo path the content refers to (photos + media). */
export function usedFiles(site) {
  const s = new Set();
  for (const p of site.photos || []) for (const k of ['src', 'thumb', 'original']) if (p[k]) s.add(p[k]);
  for (const k of ['music', 'video', 'voice']) if (site.media && site.media[k]) s.add(site.media[k]);
  return s;
}

/* ------------------------------------------------------------------ files */
export function combine({ settings = {}, messages = {}, photos = {} } = {}) {
  const { version: _v1, ...text } = messages || {};
  const { version: _v2, her, from, settings: st, media, chapters, ...settingsExtra } = settings || {};
  const { version: _v3, chapters: photoChapters, photos: list, ...photosExtra } = photos || {};
  return normalize({
    version: MODEL_VERSION,
    her,
    from,
    settings: st,
    media,
    chapters,
    text,
    photoChapters,
    photos: list,
    settingsExtra,
    photosExtra,
  });
}

export function split(site) {
  const s = normalize(clone(site));
  return {
    settings: { ...(s.settingsExtra || {}), version: MODEL_VERSION, her: s.her, from: s.from, settings: s.settings, media: s.media, chapters: s.chapters },
    messages: { version: MODEL_VERSION, ...s.text },
    photos: { ...(s.photosExtra || {}), version: MODEL_VERSION, chapters: s.photoChapters, photos: s.photos },
  };
}

export const FILES = { settings: 'data/settings.json', messages: 'data/messages.json', photos: 'data/photos.json' };
export const LEGACY_FILE = 'data/site.json';

export function clone(o) { return JSON.parse(JSON.stringify(o)); }

const DEFAULT_SETTINGS = {
  lock: { enabled: true, unlockAt: '2027-01-03T00:00:00+05:30' },
  grading: { strength: 0.85 },
  whatsapp: '',
  github: { owner: 'anirudhleetcode-max', repo: 'birthday', branch: 'main' },
  theme: { grain: 0.6, particles: 1, ribbon: true, keychains: true, sprite: true, twinklingWatermelon: true, panipuri: true, manchuria: true, nivin: true },
};

/** The words that are lists of lines (Messages): a single string typed by hand is read as a one-line list. */
export const LIST_FIELDS = {
  invite: ['lines'], prologue: ['lines'], tower: ['lines'], story: ['memories'], hair: ['lines'], names: ['documentary', 'items'],
  dance: ['lines'], lanterns: ['lines'], letter: ['body'], cake: ['lines'], little: ['keychainLines', 'spriteLines', 'nightLines'],
  favourites: ['panipuriLines', 'manchuriaLines', 'nivinIntro', 'nivinLines', 'nivinAfter', 'revealLines'], constellation: ['lines'],
  birthday: ['lanterns', 'loved'], hug: ['intro', 'lines'], credits: ['roles', 'postCredits'],
};
// (these hold groups, not lines: a stray string there is reported, never turned into one)
const OBJECT_LISTS = new Set(['story.memories', 'names.items', 'credits.roles']);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Fill defaults, repair ids/orders. Never removes owner data: a part with the wrong shape (typed by hand)
 *  is noted in `site.malformed` — read fresh on every normalize, and never written to any file (it is not
 *  enumerable) — so validate() blocks publishing, the admin refuses to publish over it, and the film plays
 *  on without that part rather than freezing. */
export function normalize(site) {
  const s = site || {};
  const bad = new Set();
  const part = (v, name) => { if (v != null && !isObj(v)) { bad.add(name); return {}; } return v || {}; };
  s.version = MODEL_VERSION;
  s.her = { name: 'Deepu', nicknames: ['Deepu', 'Kuchu Puchu'], birthDate: '2007-01-03', ...part(s.her, 'her') };
  if (typeof s.her.nicknames === 'string') s.her.nicknames = [s.her.nicknames];
  if (!Array.isArray(s.her.nicknames)) { if (s.her.nicknames != null) bad.add('her.nicknames'); s.her.nicknames = []; }
  s.from = { name: 'Your best friend', signoff: 'Your best friend, always', ...part(s.from, 'from') };
  const st = part(s.settings, 'settings');
  s.settings = {
    ...DEFAULT_SETTINGS,
    ...st,
    lock: { ...DEFAULT_SETTINGS.lock, ...(st.lock || {}) },
    grading: { ...DEFAULT_SETTINGS.grading, ...(st.grading || {}) },
    github: { ...DEFAULT_SETTINGS.github, ...(st.github || {}) },
    theme: { ...DEFAULT_SETTINGS.theme, ...(st.theme || {}) },
  };
  s.media = { music: null, musicTitle: '', video: null, videoCaption: 'A little something I recorded for you', voice: null, ...part(s.media, 'media') };
  if (s.chapters != null && (!Array.isArray(s.chapters) || s.chapters.some((c) => !isObj(c)))) bad.add('chapters');
  const enabled = new Map((Array.isArray(s.chapters) ? s.chapters : []).filter(isObj).map((c) => [c.id, c.enabled !== false]));
  s.chapters = FILM_CHAPTERS.map((c) => ({ id: c.id, enabled: c.toggle === false ? true : enabled.has(c.id) ? enabled.get(c.id) : true }));
  s.text = part(s.text, 'messages');
  for (const [group, fields] of Object.entries(LIST_FIELDS)) {
    const g = s.text[group];
    if (!isObj(g)) continue;
    for (const f of fields) if (typeof g[f] === 'string' && !OBJECT_LISTS.has(`${group}.${f}`)) g[f] = [g[f]];
  }
  s.photoChapters = part(s.photoChapters, 'photos.chapters');
  s.settingsExtra = s.settingsExtra || {};
  s.photosExtra = s.photosExtra || {};
  if (s.photos != null && !Array.isArray(s.photos)) { bad.add('photos'); s.photos = []; }
  if ((s.photos || []).some((p) => !isObj(p))) bad.add('photos');
  const seen = new Set();
  s.photos = (s.photos || []).filter(isObj).map((p) => {
    const q = newPhoto(p);
    while (seen.has(q.id)) q.id = newId(q.chapter);
    seen.add(q.id);
    return q;
  });
  // stable 1..n order per chapter
  for (const ch of PHOTO_CHAPTERS) photosFor(s, ch.id, { includeDisabled: true }).forEach((p, i) => (p.order = i + 1));
  Object.defineProperty(s, 'malformed', { value: [...bad], enumerable: false, configurable: true, writable: true });
  return s;
}

/* ------------------------------------------------------------------ v1 → v2 */
export function migrateV1(old) {
  const roles = { hero: 'hero', finale: 'reveal', us: 'together' };
  const counters = {};
  const photos = (old.slots || []).map((slot) => {
    const chapter = slot.chapter === 'finale' || slot.id === 'us' ? 'finale' : slot.chapter;
    counters[chapter] = (counters[chapter] || 0) + 1;
    return newPhoto({ ...slot, chapter, order: counters[chapter], role: roles[slot.id] || null });
  });
  (old.extras || []).forEach((x, i) => photos.push(newPhoto({ ...x, chapter: 'album', order: i + 1, label: x.caption || `Extra memory ${i + 1}` })));
  return normalize({
    version: MODEL_VERSION,
    her: old.her,
    from: old.from,
    settings: old.settings,
    media: old.media,
    chapters: null,
    text: old.text || {},
    photoChapters: {},
    photos,
  });
}

/** Accept anything we've ever saved (v1 site.json, v2 combined) and return v2 combined. */
export function upgrade(site) {
  if (!site) return normalize({});
  if (Array.isArray(site.slots) && !Array.isArray(site.photos)) return migrateV1(site);
  return normalize(site);
}

/* ------------------------------------------------------------------ checks */
const PART = { her: 'settings.json → her', from: 'settings.json → from', settings: 'settings.json → settings', media: 'settings.json → media', chapters: 'settings.json → chapters (a list of chapters, each switched on or off)', messages: 'messages.json', 'her.nicknames': 'settings.json → her → nicknames (a list of names)', photos: 'photos.json → photos (a list of photos)', 'photos.chapters': 'photos.json → chapters' };
/** Blocking errors for the parts normalize() found with the wrong shape (`site.malformed`). */
export function malformedErrors(list) {
  return (Array.isArray(list) ? list : []).map((m) => ({ message: `${PART[m] || m} has the wrong shape, so the film can't use it. Fix it in the file, or restore the last good version from the repository history.` }));
}

/**
 * Problems the owner should know about before publishing.
 * errors block publishing; warnings are friendly reminders.
 */
export function validate(site) {
  const errors = [];
  const warnings = [];
  // the wrong kind of content (typed by hand into the JSON files): the film would skip or misread it
  errors.push(...malformedErrors(site.malformed));
  if (site.her && Array.isArray(site.her.nicknames) && site.her.nicknames.some((n) => typeof n !== 'string')) errors.push({ message: 'Her nicknames must all be text (settings.json → her → nicknames).' });
  for (const [group, value] of Object.entries(site.text || {})) {
    if (group === 'version') continue;
    if (!isObj(value)) { errors.push({ group, message: `Messages → ${group} has the wrong shape (it should be a group of fields), so the film can't use it.` }); continue; }
    for (const f of LIST_FIELDS[group] || []) {
      const v = value[f];
      if (v != null && !Array.isArray(v)) errors.push({ group, message: `Messages → ${group} → ${f} should be a list${OBJECT_LISTS.has(`${group}.${f}`) ? '' : ' (one line per item)'}, so the film can't use it.` });
      else if (Array.isArray(v) && v.some((x) => (OBJECT_LISTS.has(`${group}.${f}`) ? x == null || typeof x !== 'object' : typeof x !== 'string'))) errors.push({ group, message: `Messages → ${group} → ${f} has an item of the wrong kind (${OBJECT_LISTS.has(`${group}.${f}`) ? 'each one should be a group of fields' : 'each line should be text'}).` });
    }
  }
  const ids = new Set();
  const CHAPTER_IDS = new Set(PHOTO_CHAPTERS.map((c) => c.id));
  const roles = {};
  for (const p of site.photos || []) {
    if (!p.id || typeof p.id !== 'string') errors.push({ message: `A photo${p.label ? ` ("${p.label}")` : ''} has no id.` });
    else if (ids.has(p.id)) errors.push({ id: p.id, message: `Two photos share the id "${p.id}".` });
    ids.add(p.id);
    if (!CHAPTER_IDS.has(p.chapter)) errors.push({ id: p.id, message: `"${p.label || p.id}" is in an unknown chapter ("${p.chapter}"), so it would never be shown.` });
    const f = p.focal;
    if (f != null && !(Number.isFinite(f.x) && Number.isFinite(f.y) && f.x >= 0 && f.x <= 1 && f.y >= 0 && f.y <= 1)) warnings.push({ id: p.id, message: `"${p.label || p.id}" has an invalid focal point; the film will centre it instead. Set it again in the photo editor.` });
    if (p.role && p.enabled !== false && p.chapter !== 'fanart') (roles[p.role] = roles[p.role] || []).push(p);
    if (!/^\d+(\.\d+)?:\d+(\.\d+)?$/.test(String(p.ratio))) errors.push({ id: p.id, message: `"${p.label || p.id}" has an invalid shape (${p.ratio}).` });
    for (const k of ['src', 'thumb', 'original']) if (p[k] && !safePath(p[k])) errors.push({ id: p.id, message: `"${p.label || p.id}" has an unsafe file path (${k}).` });
    if (p.src && !/^(blob:|data:image\/)/.test(p.src) && !/\.(jpe?g|png|webp|avif|gif)$/i.test(p.src)) errors.push({ id: p.id, message: `"${p.label || p.id}" is not a web image (JPEG, PNG, WebP or AVIF).` });
    const c = p.crop;
    if (c && !(['x', 'y', 'w', 'h'].every((k) => Number.isFinite(c[k])) && c.x >= -0.001 && c.y >= -0.001 && c.w > 0 && c.h > 0 && c.x + c.w <= 1.001 && c.y + c.h <= 1.001)) errors.push({ id: p.id, message: `"${p.label || p.id}" has an invalid crop. Open it and crop it again.` });
    // fan art is imagined: it never plays as a real photo, and a real photo is never stamped as fan art
    if (isFanArt(p) && p.chapter !== 'fanart') errors.push({ id: p.id, message: `"${p.label || p.id}" is fan art (imagined, not a real photo), but it is in ${chapterInfo(p.chapter).short}, where the film would show it as a real photo. Move it back to Fan art, or delete it.` });
    else if (!isFanArt(p) && p.chapter === 'fanart' && p.src) errors.push({ id: p.id, message: `"${p.label || p.id}" is a real photo, but it is in Fan art, where the film would stamp it “imagined · fan art”. Move it back to its own chapter, or delete it (fan art is added through Add photo → Fan art).` });
  }
  for (const ch of PHOTO_CHAPTERS) {
    const live = photosFor(site, ch.id).filter((p) => p.src);
    const missing = photosFor(site, ch.id).filter((p) => !p.src);
    if (missing.length) warnings.push({ chapter: ch.id, message: `${ch.short}: ${missing.length} photo spot${missing.length > 1 ? 's are' : ' is'} still empty (a placeholder will show).` });
    else if (ch.min && live.length < ch.min) warnings.push({ chapter: ch.id, message: `${ch.short}: needs at least ${ch.min} photo${ch.min > 1 ? 's' : ''}.` });
    if (ch.max && photosFor(site, ch.id).length > ch.max) warnings.push({ chapter: ch.id, message: `${ch.short}: only the first ${ch.max} will be used.` });
  }
  // fan art is imagined, never a real photo: it plays no other part in the film
  for (const p of photosFor(site, 'fanart', { includeDisabled: true })) {
    if (p.role || p.featured || p.heroHair) warnings.push({ id: p.id, message: `"${p.label || p.id}" is fan art: it only appears, marked as fan art, in the photoshoot scene, so its special part / Featured / hair marks are ignored (open it in the photo editor and save to clear them).` });
    if (p.src && isFanArt(p) && p.kind !== 'fanart') warnings.push({ id: p.id, message: `"${p.label || p.id}" was added by an older version of the admin, which may have cropped or colour-graded it. Open it, press “Use the whole image” and save: the film then shows it exactly as it was made.` });
  }
  const theme = (site.settings && site.settings.theme) || {};
  if (theme.nivin !== false && !fanArtPhotos(site).length) warnings.push({ chapter: 'fanart', message: 'Fan art: the photoshoot scene is switched on but has no fan-art image yet, so the film skips it (add one in Photos → Fan art, or switch the scene off in Theme).' });
  for (const [role, list] of Object.entries(roles)) if (list.length > 1) warnings.push({ role, message: `${list.length} photos are marked as "${role}"; only the first is used.` });
  for (const role of ['hero', 'reveal']) { // 'together' is optional: not everyone has a photo of the two of them
    if (!(site.photos || []).some((p) => p.role === role && p.enabled !== false && p.chapter !== 'fanart')) warnings.push({ role, message: `No photo is marked as "${role}".` });
  }
  for (const p of site.photos || []) {
    if (p.duration != null && p.duration !== '' && !(Number(p.duration) > 0 && Number(p.duration) <= 60)) warnings.push({ id: p.id, message: `"${p.label || p.id}" has an invalid duration (${p.duration}); it will use the chapter's own timing.` });
  }
  // memories (How it began)
  const mems = memoriesOf(site);
  const memIds = new Set();
  for (const [i, m] of mems.entries()) {
    const name = m.when || `Memory ${i + 1}`;
    if (['when', 'text'].some((k) => m[k] != null && typeof m[k] !== 'string')) errors.push({ group: 'story', message: `${typeof m.when === 'string' && m.when ? m.when : `Memory ${i + 1}`} is malformed (its date and words must be text).` });
    if (!m.id || typeof m.id !== 'string') errors.push({ group: 'story', message: `${name} has no id (re-add it in Messages → How it began).` });
    else if (memIds.has(m.id)) errors.push({ group: 'story', message: `Two memories share the id "${m.id}".` });
    memIds.add(m.id);
    if (!String(m.text || '').trim() && !(site.photos || []).some((p) => p.memory === m.id && p.src)) warnings.push({ group: 'story', message: `${name} has no words and no photos yet, so it is skipped.` });
  }
  for (const p of site.photos || []) {
    if (p.memory && !memIds.has(p.memory)) warnings.push({ id: p.id, message: `"${p.label || p.id}" belongs to a memory that no longer exists; it will be shown with the last memory.` });
  }
  const big = site.text && site.text.birthday && site.text.birthday.big;
  if (typeof big === 'string' && !big.trim()) errors.push({ group: 'birthday', message: 'The birthday headline (Messages → Finale · 7,305 days → Big headline) is empty.' });
  for (const k of ['music', 'video', 'voice']) if (site.media && site.media[k] && !safePath(site.media[k])) errors.push({ message: `The ${k} file path is not a safe repo path.` });
  const at = Date.parse(site.settings && site.settings.lock && site.settings.lock.unlockAt);
  if (site.settings && site.settings.lock && site.settings.lock.enabled && !Number.isFinite(at)) errors.push({ message: 'The unlock date/time is not a valid date.' });
  if (!site.her || !site.her.name) errors.push({ message: 'Her name is empty.' });
  const bd = site.her && site.her.birthDate;
  if (bd != null && !(/^\d{4}-\d{2}-\d{2}$/.test(String(bd)) && Number.isFinite(Date.parse(`${bd}T00:00:00Z`)))) errors.push({ message: `Her birth date (${bd}) is not a valid date (YYYY-MM-DD).` });
  const gaps = personalGaps(site);
  const required = gaps.empty.filter((f) => !f.optional);
  if (required.length) warnings.push({ group: 'personal', message: `Your memories: ${required.map((f) => f.label).join(', ')} ${required.length > 1 ? 'are' : 'is'} still empty. The letter lines that use ${required.length > 1 ? 'them' : 'it'} are left out until you write ${required.length > 1 ? 'them' : 'it'} (Messages → Your memories).` });
  for (const g of gaps.leftovers) warnings.push({ group: g.group, message: `Messages → ${g.group}: “${g.placeholder}” is still a placeholder. That line is hidden from her until you replace it.` });
  return { errors, warnings, ok: errors.length === 0 };
}

/**
 * The owner's own memories (messages.json → "personal"). The letter is built around them.
 * Nothing here is ever invented: until a box is written, every line that uses it is left out
 * of her film (Preview shows the [LABEL] instead, so the owner can see where it goes).
 */
export const PERSONAL_FIELDS = [
  { key: 'memory1', label: '[MEMORY 1]' },
  { key: 'memory2', label: '[MEMORY 2]' },
  { key: 'tease', label: '[THING I ALWAYS TEASE HER ABOUT]' },
  { key: 'neverForget', label: '[ONE MOMENT I WILL NEVER FORGET]' },
  { key: 'admire', label: '[WHAT I ADMIRE ABOUT HER]' },
  { key: 'wantHerToKnow', label: '[ONE THING I WANT HER TO KNOW]' },
  { key: 'insideJoke', label: '[INSIDE JOKE]', optional: true },
];
const PERSONAL_LABEL = Object.fromEntries(PERSONAL_FIELDS.map((f) => [f.key, f.label]));
/** A placeholder typed by hand and never replaced, e.g. "[MEMORY 3]" or "[HER FAVOURITE SONG]". */
export const PLACEHOLDER_RE = /\[[A-Z0-9][A-Z0-9 '’&,.?!/-]{2,}\]/;

/** Trimmed values of the personal memories ('' = not written yet). */
export function personalValues(site) {
  const p = (site && site.text && site.text.personal) || {};
  return Object.fromEntries(PERSONAL_FIELDS.map((f) => [f.key, typeof p[f.key] === 'string' ? p[f.key].trim() : '']));
}

/**
 * Replace {tokens} in owner-written text. A line that needs a memory nobody has written yet,
 * or still holds a hand-typed [PLACEHOLDER], comes back '' so the film leaves it out; in
 * preview it comes back with the [LABEL] showing instead.
 */
export function fillText(str, tokens = {}, personal = {}, { preview = false } = {}) {
  let missing = false;
  const out = String(str ?? '').replace(/\{(\w+)\}/g, (m, k) => {
    if (k in PERSONAL_LABEL) {
      if (personal[k]) return personal[k];
      missing = true;
      return PERSONAL_LABEL[k];
    }
    return k in tokens ? tokens[k] : m;
  });
  if (!preview && (missing || PLACEHOLDER_RE.test(out))) return '';
  return out;
}

/** Every string inside messages, with where it lives (for placeholder checks). */
function textStrings(text, path = [], out = []) {
  if (typeof text === 'string') out.push({ path, value: text });
  else if (Array.isArray(text)) text.forEach((v, i) => textStrings(v, [...path, i], out));
  else if (text && typeof text === 'object') for (const k of Object.keys(text)) textStrings(text[k], [...path, k], out);
  return out;
}

/** Memories the film uses but nobody has written yet, and hand-typed placeholders left in the text. */
export function personalGaps(site) {
  const vals = personalValues(site);
  const strings = textStrings((site && site.text) || {}).filter((s) => s.path[0] !== 'personal');
  const used = new Set();
  for (const s of strings) for (const m of s.value.matchAll(/\{(\w+)\}/g)) if (m[1] in PERSONAL_LABEL) used.add(m[1]);
  const empty = PERSONAL_FIELDS.filter((f) => used.has(f.key) && !vals[f.key]);
  const leftovers = [];
  for (const s of [...strings, ...textStrings((site && site.text && site.text.personal) || {}, ['personal'])]) {
    const m = PLACEHOLDER_RE.exec(s.value);
    if (m) leftovers.push({ group: s.path[0], placeholder: m[0] });
  }
  return { empty, leftovers };
}

/** How a memory is staged in “How it began”. Anything else plays as a 'moment'. */
export const MEMORY_KINDS = [
  { id: 'moment', label: 'A moment (photo + words on the thread)' },
  { id: 'beginning', label: 'The beginning (the first knot in the thread)' },
  { id: 'daily', label: 'Every day (lights along the thread)' },
  { id: 'journey', label: 'A journey (the view from a bus or train window)' },
  { id: 'sharing', label: 'Sharing the day (little notes and lights)' },
];

/** The owner's memories, in film order: [{ id, kind, when, text }] (messages.json → story.memories). */
export function memoriesOf(site) {
  const list = site && site.text && site.text.story && site.text.story.memories;
  return Array.isArray(list) ? list.filter((m) => m && typeof m === 'object') : [];
}

/** A short id for a new memory (stable once saved). */
export function newMemoryId(existing = []) {
  const taken = new Set(existing.map((m) => m && m.id));
  let id;
  do { id = `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`; } while (taken.has(id));
  return id;
}

/** A plain relative repo path (no quotes, no '..', no scheme) — or an https/blob/data URL. */
export function safePath(p) {
  const s = String(p);
  if (/^(blob:|data:image\/|https:\/\/)/.test(s)) return !/["'<>\s]/.test(s);
  return /^[A-Za-z0-9._\-/]+$/.test(s) && !s.includes('..') && !s.startsWith('/');
}

/** Days from her birth to `when` (defaults to the unlock moment). */
export function daysAlive(site, when) {
  const birth = Date.parse(`${(site.her && site.her.birthDate) || '2007-01-03'}T00:00:00+05:30`);
  const end = when != null ? when : Date.parse(site.settings && site.settings.lock && site.settings.lock.unlockAt);
  return Math.round((end - birth) / 86400000);
}
