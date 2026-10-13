// The Keepsake Box and “The day we met”: what each part needs, its built-in words, and whether it can play.
// Shared by the film (core/keepsakes.js, scenes/met.js) and the admin (Keepsake Box section, Overview).
//
// The rule that matters most: nothing personal is ever made up. A room that needs the owner's own words
// (the appreciation wall, the shy note…) stays out of the box until those words are written. The rooms that
// play from the start use only generic, clearly editable words (a comfort note, wishes, a coupon) or content
// that is already in the film (her memories, her photos, her names) — never an invented event.
//
// Content lives in messages.json, one group per room (`text.comfort`, `text.wish`…); switches live in
// settings.json → settings.keepsakes ({ box: false } hides the whole box, { quiz: false } one room).
import { memoriesOf, photosFor, localDay, shows, realPhotoIds, metCards } from './model.js';

export { localDay, shows, realPhotoIds, metCards };

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');

/**
 * The rooms, in the order the box shows them. `needs`:
 *   always   — plays with its built-in words until the owner rewrites them
 *   written  — hidden until the owner writes at least one item (the `items` key below)
 *   memories — needs at least one written memory (How it began)
 *   photos   — needs at least one real photo
 *   quiz     — needs enough real content to ask two honest questions
 *   voice    — needs a voice note (Audio)
 */
export const KEEPSAKE_ROOMS = [
  { id: 'scrapbook', title: 'The scrapbook', line: 'Every photo, page by page', needs: 'photos', icon: 'book' },
  { id: 'stars', title: 'Memory stars', line: 'One star for every memory', needs: 'memories', icon: 'star' },
  { id: 'comfort', title: 'If you ever forget how special you are', line: 'Open this one on a hard day', needs: 'always', icon: 'heartless' },
  { id: 'wish', title: 'A lantern for your wish', line: 'Your wish stays with you', needs: 'always', icon: 'lantern' },
  { id: 'flower', title: 'A birthday flower', line: 'Open it petal by petal', needs: 'always', icon: 'flower' },
  { id: 'appreciation', title: 'The appreciation wall', line: 'Things worth saying out loud', needs: 'written', items: 'cards', icon: 'wall' },
  { id: 'remember', title: 'The little things I remember', line: 'Small, and never forgotten', needs: 'written', items: 'items', icon: 'note' },
  { id: 'reminders', title: 'Things that remind me of you', line: 'Out there in the world', needs: 'written', items: 'items', icon: 'pin' },
  { id: 'awards', title: 'The awards', line: 'This year’s winners', needs: 'written', items: 'items', icon: 'trophy' },
  { id: 'lore', title: 'The Deepu files', line: 'A very serious investigation', needs: 'always', icon: 'file' },
  { id: 'quiz', title: 'Do you remember?', line: 'A few questions, no wrong answers', needs: 'quiz', icon: 'question' },
  { id: 'months', title: 'Twelve little doors', line: 'One for every month of your twentieth year', needs: 'always', icon: 'door' },
  { id: 'letters', title: 'Letters from different moments', line: 'Some open later', needs: 'written', items: 'items', icon: 'envelope' },
  { id: 'voice', title: 'Hear it in my voice', line: 'A voice note', needs: 'voice', icon: 'wave' },
  { id: 'coupon', title: 'A coupon', line: 'Officially issued', needs: 'always', icon: 'ticket' },
  { id: 'shy', title: 'A message I was too shy to say', line: 'Only if you want to read it', needs: 'written', items: 'text', icon: 'feather' },
  { id: 'secret', title: 'Kuchu Puchu’s secret drawer', line: 'For the ones who look closely', needs: 'always', icon: 'key' },
];
export const KEEPSAKE_IDS = KEEPSAKE_ROOMS.map((r) => r.id);
export const roomInfo = (id) => KEEPSAKE_ROOMS.find((r) => r.id === id) || null;

/**
 * The built-in words. Every one of them is generic (no event, date, conversation or feeling is claimed) and
 * every one is the owner's to rewrite in admin → Keepsake Box. Lists of objects (cards, items) have no
 * built-in entries: those are only ever the owner's.
 */
export const KEEPSAKE_TEXT = {
  box: {
    kicker: 'After the film',
    title: 'The Keepsake Box',
    intro: 'Little things to open whenever you like. Take your time; they’ll be here.',
    back: 'Back to the box',
  },
  scrapbook: { title: 'The scrapbook', intro: 'Every photo in this film, page by page.', more: 'More pages' },
  stars: { title: 'Memory stars', intro: 'One star for every memory. Tap one.' },
  comfort: {
    title: 'If you ever forget how special you are',
    intro: 'Pick whatever you need right now.',
    reminderLabel: 'I need a reminder',
    reminder: 'You are not too much, and you are not behind. You are exactly the person this whole film was made for, and that hasn’t changed.',
    smileLabel: 'I need to smile',
    smile: 'Somewhere in this film there is a very small, very shy chameleon who still thinks you are the best thing that ever happened to the festival. He’s not wrong.',
    memoryLabel: 'Show me a happy memory',
    memoryEmpty: 'There isn’t a memory in this box yet. There will be.',
    breatheLabel: 'I just need a moment',
    breathe: 'Breathe in… and out. No rush. Stay as long as you like.',
    back: 'Something else',
  },
  wish: {
    title: 'A lantern for your wish',
    intro: 'Write a wish, then let it go.',
    placeholder: 'Your wish…',
    button: 'Let it go',
    after: 'It’s on its way.',
    privacy: 'Your wish stays on this screen. It isn’t saved or sent anywhere, not even to me.',
    again: 'Another wish',
  },
  flower: {
    title: 'A birthday flower',
    intro: 'Tap a petal.',
    petals: [
      'Happy birthday, {name}.',
      'Twenty looks good on you.',
      'May this year be kind to you.',
      'May it be loud with laughing.',
      'May it bring you everything you’re hoping for, and a few things you didn’t know to hope for.',
      'And may you always know how much you’re loved.',
    ],
    done: 'Every petal open. Happy birthday.',
  },
  appreciation: { title: 'The appreciation wall', intro: 'Things worth saying out loud.' },
  remember: { title: 'The little things I remember', intro: 'Small things. I remember them anyway.' },
  reminders: { title: 'Things that remind me of you', intro: 'Out there in the world, these make me think of you.' },
  awards: { title: 'The awards', intro: 'The results are in.' },
  lore: {
    title: 'The Deepu files',
    intro: 'Case file. Strictly confidential (except to you).',
    verdict: 'Verdict: still the best. Case closed.',
  },
  quiz: {
    title: 'Do you remember?',
    intro: 'A few questions from this film. Skip any you like; there’s no score.',
    right: 'Yes! You remember.',
    wrong: 'Close! Here’s the answer.',
    skip: 'Skip',
    next: 'Next',
    end: 'That’s all of them. Every answer was a memory.',
  },
  months: {
    title: 'Twelve little doors',
    intro: 'One door for every month of your twentieth year. Each one opens on its day.',
    locked: 'Opens on {date}',
    doors: [
      'A wish for this month: a fresh start that feels easy.',
      'A wish for this month: someone makes you laugh until it hurts.',
      'A wish for this month: a good surprise.',
      'A wish for this month: more sunshine than rain.',
      'A wish for this month: a day that goes exactly your way.',
      'A wish for this month: something you worked hard for pays off.',
      'A wish for this month: a long conversation with someone who gets you.',
      'A wish for this month: a little adventure.',
      'A wish for this month: rest, real rest.',
      'A wish for this month: a song you can’t stop playing.',
      'A wish for this month: being proud of yourself.',
      'A wish for this month: a happy ending to a good year.',
    ],
  },
  letters: { title: 'Letters from different moments', intro: 'Some letters are for later. Each one opens on its day.', locked: 'Opens on {date}' },
  voice: { title: 'Hear it in my voice', intro: 'Headphones help.' },
  coupon: {
    title: 'A coupon',
    head: 'OFFICIAL BIRTHDAY HUG COUPON',
    line: 'Redeemable for one completely optional birthday hug.',
    small: 'No expiry date. No pressure. Smiles accepted as payment.',
  },
  shy: { title: 'A message I was too shy to say', intro: 'Only if you want to read it.', after: 'You don’t have to say anything back.' },
  secret: {
    title: 'Kuchu Puchu’s secret drawer',
    intro: 'Locked. It opens for whoever knows her other name, or finds three secrets in the film.',
    prompt: 'Her other name',
    button: 'Open',
    wrong: 'Not quite. (Hint: it’s one of her names in the film.)',
    open: 'Unlocked. Here’s everything you’ve found so far.',
    message: '',
  },
  met: {
    kicker: 'Chapter Three',
    title: 'The Day We Met, From My Side',
    intro: '',
    end: '',
  },
};

/** The words for a group: the owner's where written, else the built-in ones (a list replaces as a whole). */
export function wordsFor(site, group) {
  const own = (site && site.text && isObj(site.text[group])) ? site.text[group] : {};
  const base = KEEPSAKE_TEXT[group] || {};
  const out = { ...base };
  for (const [k, v] of Object.entries(own)) {
    if (typeof v === 'string') { if (v.trim()) out[k] = v; } else if (Array.isArray(v)) { if (v.some((x) => (typeof x === 'string' ? x.trim() : x != null))) out[k] = v; } else if (v != null) out[k] = v;
  }
  return out;
}

const ownList = (site, group, key) => {
  const g = site && site.text && site.text[group];
  return isObj(g) && Array.isArray(g[key]) ? g[key] : [];
};

/** The items of an owner-written room that are really there (empty cards and switched-off cards never show). */
export function writtenItems(site, id) {
  if (id === 'appreciation') return ownList(site, 'appreciation', 'cards').filter((c) => isObj(c) && c.show !== false && shows(site, c.text));
  if (id === 'remember') return ownList(site, 'remember', 'items').filter((s) => shows(site, s));
  if (id === 'reminders') return ownList(site, 'reminders', 'items').filter((c) => isObj(c) && shows(site, c.thing));
  if (id === 'awards') return ownList(site, 'awards', 'items').filter((c) => isObj(c) && shows(site, c.title));
  if (id === 'letters') return ownList(site, 'letters', 'items').filter((c) => isObj(c) && shows(site, c.body));
  if (id === 'shy') { const g = site && site.text && site.text.shy; return isObj(g) && shows(site, g.text) ? [g.text] : []; }
  return [];
}

/** Memories with words (How it began), in film order. */
export function writtenMemories(site) {
  return memoriesOf(site).filter((m) => shows(site, m.text));
}

/**
 * Honest quiz questions, built only from what is already in the film:
 *   • a photo linked to a memory → “Which memory is this photo from?”
 *   • the order of two memories in the owner's story order → “Which comes first in the story?”
 *   • her other name (Names) → “Which of these is also you?” is NOT asked (it would only test the owner's
 *     own wording); the quiz sticks to memories and photos.
 * Each: { kind, prompt, photo?, options: [text], answer: index }. Deterministic for a given site.
 */
export function quizQuestions(site, { max = 6 } = {}) {
  const mems = writtenMemories(site);
  if (mems.length < 2) return [];
  const label = (m) => memoryTitle(m);
  const real = realPhotoIds(site);
  const qs = [];
  const linked = photosFor(site, 'story').filter((p) => real.has(p.id) && p.memory && mems.some((m) => m.id === p.memory));
  // one photo per memory, so every memory gets its turn
  const usedMem = new Set();
  for (const p of linked) {
    if (usedMem.has(p.memory)) continue;
    usedMem.add(p.memory);
    const right = mems.findIndex((m) => m.id === p.memory);
    const others = mems.map((m, i) => i).filter((i) => i !== right).slice(0, 2);
    const order = [right, ...others].sort((a, b) => a - b);
    qs.push({ kind: 'photo', prompt: 'Which memory is this photo from?', photo: p.id, options: order.map((i) => label(mems[i])), answer: order.indexOf(right) });
  }
  if (mems.length >= 2) {
    const a = mems[0];
    const b = mems[mems.length - 1];
    qs.push({ kind: 'order', prompt: 'Which comes first in the story?', options: [label(b), label(a)], answer: 1 });
  }
  return qs.slice(0, max);
}

/** A short name for a memory: its title, else its first words. */
export function memoryTitle(m) {
  const t = str(m && m.title).trim();
  if (t) return t;
  const words = str(m && m.text).trim().split(/\s+/).filter(Boolean);
  return words.length > 8 ? `${words.slice(0, 8).join(' ')}…` : words.join(' ');
}

/** Switches (settings.json → settings.keepsakes). */
export function keepsakeSwitches(site) {
  const k = site && site.settings && site.settings.keepsakes;
  return isObj(k) ? k : {};
}

/**
 * Whether a room plays, and if not, why: { plays, why, count }
 *   why: 'on' | 'off' (switched off) | 'box-off' | 'empty' (not written yet) | 'needs-memories' |
 *        'needs-photos' | 'needs-voice' | 'needs-content'
 */
export function roomState(site, id) {
  const sw = keepsakeSwitches(site);
  const room = roomInfo(id);
  if (!room) return { plays: false, why: 'unknown', count: 0 };
  if (sw.box === false) return { plays: false, why: 'box-off', count: 0 };
  if (sw[id] === false) return { plays: false, why: 'off', count: 0 };
  let count = 1;
  let why = 'on';
  if (room.needs === 'written') { count = writtenItems(site, id).length; if (!count) why = 'empty'; }
  else if (room.needs === 'memories') { count = writtenMemories(site).length; if (!count) why = 'needs-memories'; }
  else if (room.needs === 'photos') { count = realPhotoIds(site).size; if (!count) why = 'needs-photos'; }
  else if (room.needs === 'voice') { count = site && site.media && site.media.voice ? 1 : 0; if (!count) why = 'needs-voice'; }
  else if (room.needs === 'quiz') { count = quizQuestions(site).length; if (count < 2) why = 'needs-content'; }
  if (why === 'on' && sw[id] === false) why = 'off';
  return { plays: why === 'on', why, count };
}

/** The rooms that play, in order. */
export function playingRooms(site) {
  return KEEPSAKE_ROOMS.filter((r) => roomState(site, r.id).plays);
}

/** Whether the box itself is on (it always has at least the rooms with built-in words). */
export function boxOn(site) {
  return keepsakeSwitches(site).box !== false && playingRooms(site).length > 0;
}

/**
 * The twelve doors: door i opens on her birthday's day of the month, i months after her birthday
 * (the unlock date's year). Returns [{ opensAt: Date, label }].
 */
export function monthDoors(site) {
  const unlock = Date.parse(site && site.settings && site.settings.lock && site.settings.lock.unlockAt);
  const birth = localDay((site && site.her && site.her.birthDate) || '2007-01-03') || new Date(2007, 0, 3);
  const year = Number.isFinite(unlock) ? new Date(unlock).getFullYear() : new Date().getFullYear();
  const out = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(year, birth.getMonth() + i, 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(birth.getDate(), last));
    out.push({ opensAt: d, label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) });
  }
  return out;
}
