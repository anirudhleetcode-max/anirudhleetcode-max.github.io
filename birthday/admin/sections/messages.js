/**
 * MESSAGES — a friendly, grouped editor for data/messages.json (docs §4).
 *
 * Every chapter group shows the words the film can use (missing keys simply use the
 * film's built-in wording until typed), then any other keys already in the file —
 * unknown keys are always kept. Editors: short text, long text, lists, pairs, objects,
 * and the owner's memories for “How it began” (story.memories: add, edit, delete, reorder,
 * each with its own photos).
 */
import { FILM_CHAPTERS, PERSONAL_FIELDS, MEMORY_KINDS, daysAlive, personalValues, memoriesOf, metCards } from '../../assets/js/shared/model.js';
import { KEEPSAKE_TEXT, KEEPSAKE_ROOMS } from '../../assets/js/shared/keepsakes.js';
import { state, change, rerender as rerenderSection, photoById } from '../state.js';
import {
  getAt, setAt, deleteAt, deepEqual, clone, plural, STORY, newMemory, memoryLabel, memoryPhotos, unlinkedStoryPhotos, removeMemory, restoreMemory,
} from '../util.js';
import { h, icon, autoGrow, toast, nextId, confirmDialog, openSheet, switchField } from '../ui.js';
import { addPhotos } from '../photos.js';
import { openEditor } from '../editor.js';
import { thumbEl } from './library.js';
import { sectionHead } from './common.js';

const S = (label, hint, placeholder) => ({ type: 'string', label, hint, placeholder });
const T = (label, hint, placeholder) => ({ type: 'text', label, hint, placeholder });
const MEMORY_HINTS = {
  memory1: ['One real memory of the two of you, in your own words: one to three sentences, the way you’d tell it to her. It becomes its own paragraph in the letter.', 'Remember when…'],
  memory2: ['Another one. A different kind if you can: if the first is funny, make this one soft (or the other way round).', 'And the time…'],
  tease: ['A few words that finish the sentence: “And yes, I’m still going to tease you about ___. Forever.”', 'e.g. a habit, a word she says, a famous mistake'],
  neverForget: ['Finishes: “If I had to pick one moment, though, it’s this one: ___”. Tell it simply: where you were, what happened, why it stuck.', 'In your own words…'],
  admire: ['Finishes: “The thing I admire most about you? ___”. Something she does, not just what she is.', 'In your own words…'],
  wantHerToKnow: ['Near the end of the letter: “And if you only remember one line from this whole film, make it this one: ___”', 'In your own words…'],
  insideJoke: ['Optional. Becomes the P.S. under your signature. Only she needs to get it.', 'P.S. …'],
};
const L = (label, hint, add = 'Add a line', long = false) => ({ type: 'list', label, hint, add, long });
/** A Keepsake Box / “day we met” line: its built-in words show greyed in the empty box (shared/keepsakes.js). */
const K = (group, key, label, hint = '', long = false) => (long ? T : S)(label, hint, String((KEEPSAKE_TEXT[group] || {})[key] || ''));
const B = (label, hint, dflt = true) => ({ type: 'bool', label, hint, default: dflt });
const PHOTOS = (label, hint) => ({ type: 'photos', label, hint });
const DATE = (label, hint) => ({ type: 'date', label, hint });
const builtIn = (group, key) => `Built in until you write your own: ${(KEEPSAKE_TEXT[group][key] || []).map((x) => `“${x}”`).join(' · ')}`;

export const SCHEMA = {
  personal: {
    title: 'Your memories (the letter)',
    desc: 'The letter is built around these, and nothing in it is made up for you. Until you fill a box, the line that uses it is simply left out of her film (Preview shows it as [MEMORY 1] etc. so you can see where it goes). Write the way you talk to her. You can also rewrite any paragraph of the letter itself under “The letter”. Like everything you publish, these words are public in the repository (the countdown only hides the film), so leave out anything she wouldn’t want strangers to read.',
    fields: Object.fromEntries(PERSONAL_FIELDS.map((f) => [f.key, (f.key === 'tease' ? S : T)(f.label, MEMORY_HINTS[f.key][0], MEMORY_HINTS[f.key][1])])),
  },
  story: {
    title: 'How it began (your memories)',
    desc: 'The chapter right after the tower: how it all began, told through your own memories, in the order she’ll see them. Each memory can have its own photos. Nothing here is made up for you: a memory with no words and no photos is simply skipped. Like everything you publish, these words are public in the repository.',
    fields: {
      kicker: S('Small title'),
      title: S('Title'),
      memories: { type: 'memories', label: 'Your memories', hint: 'In story order. Use the arrows to change the order.', add: 'Add a memory' },
      end: S('Closing line', 'After the last memory.'),
    },
  },
  met: {
    title: 'The day we met, from my side',
    desc: 'A chapter right after “How it began”, told from your side only: what you remember of that day, what you noticed, how it felt to you. It plays only once you write a card (a card with no words and no photo is skipped), and one card is enough. Nothing here is made up for you: don’t write what she thought or felt, only what you did. Like everything you publish, these words are public in the site’s files.',
    fields: {
      kicker: K('met', 'kicker', 'Small title'),
      title: K('met', 'title', 'Title'),
      intro: T('Opening line (optional)', 'Shown before the first card.'),
      cards: {
        type: 'objects', label: 'Cards', hint: 'One card per moment, in the order she’ll see them.', add: 'Add a card',
        item: {
          heading: S('Heading (optional)', '', 'e.g. Before · That day · Afterwards'),
          text: T('What I remember', '', 'In your own words…'),
          feeling: T('How it felt, from my side (optional)', 'Your feelings only.', 'In your own words…'),
          photos: PHOTOS('Photos (optional)', 'Choose from your photo library, or upload a new one.'),
        },
      },
      end: T('Closing line (optional)', 'After the last card.'),
    },
  },
  invite: { title: 'Invitation', desc: 'The very first screen.', fields: { greeting: S('Greeting', 'The first words she sees, e.g. “Hey {name}.”'), lines: L('Lines', 'Shown one after another.'), button: S('Button'), foot: S('Small print at the bottom') } },
  gate: { title: 'Countdown', desc: 'Before the unlock time.', fields: { kicker: S('Small title'), title: S('Title'), sub: S('Line under the title'), openKicker: S('When it unlocks — small title'), openTitle: S('When it unlocks — title'), openSub: S('When it unlocks — line'), button: S('Button') } },
  prologue: { title: 'Prologue', desc: 'Once upon a time…', fields: { kicker: S('Small title'), title: S('Title'), lines: L('Narration', 'One line at a time.'), titleSub: S('Line under the title'), date: S('Date line'), button: S('Button') } },
  tower: { title: 'Chapter · The tower', fields: { kicker: S('Small title'), title: S('Title'), lines: L('Narration'), windowLine: S('Line at the tower window'), hint: S('Hint') } },
  hair: { title: 'Chapter · The golden thread', fields: { kicker: S('Small title'), title: S('Title'), lines: L('Narration'), heroHairLine: T('Line for the hero-hair moment', 'Shown with the photo marked “Hero-hair”.'), endLine: S('Closing line') } },
  names: { title: 'Chapter · Her names', desc: 'The funny one.', fields: { kicker: S('Small title'), title: S('Title'), documentary: L('Documentary narrator', 'The fake-serious narrator, line by line.'), items: { type: 'objects', label: 'Her names', hint: 'One card per name, in order (matches the Names photos).', add: 'Add a name', item: { name: S('Name'), line: S('Line'), sub: S('Small line underneath') } }, namesNote: { type: 'note', text: 'If one of her names has a meaning you joke about (for example, if Deepu comes from a name meaning lamp or light), this is the place for it. Otherwise keep it playful and general.' }, aka: S('“Also known as” line'), finale: S('Closing line') } },
  dance: { title: 'Chapter · The festival', fields: { kicker: S('Small title'), title: S('Title'), lines: L('Narration'), hint: S('Hint') } },
  lanterns: { title: 'Chapter · The night of lanterns', fields: { kicker: S('Small title'), title: S('Title'), lines: L('Narration'), tapHint: S('Hint: tap to send a lantern'), photoHint: S('Hint: tap a photo lantern'), after: S('Line after the lanterns', 'Shown when the sky is full. If her name’s meaning matters to you two (e.g. lamp / light), you could write that joke here.'), secret: S('Secret message') } },
  letter: { title: 'The letter', desc: 'Your letter to her.', fields: { kicker: S('Small title'), title: S('Title'), salutation: S('Greeting (“Dear …” / “Hey …”)'), body: L('Paragraphs', 'Each box is one paragraph. Paragraphs with {memory1}, {tease} and so on use “Your memories” above and stay hidden until those are written.', 'Add a paragraph', true), signoff: S('Sign-off'), ps: S('P.S. (under your signature)', 'Uses {insideJoke} from “Your memories”; left out until that is written.'), tapSeal: S('Hint: tap the seal'), fasterHint: S('Hint: reading faster'), showAll: S('Button: show the whole letter', 'Writes the rest of the letter at once. Default: “Show it all”.'), voicePlay: S('Voice note: play', 'Only with a voice note (Audio). Default: “▶ Hear it in my voice”.'), voicePause: S('Voice note: pause'), voiceAgain: S('Voice note: play again') } },
  cake: { title: 'Twenty candles', fields: { kicker: S('Small title'), title: S('Title'), lines: L('Narration'), blowHint: S('Hint: blow out the candles'), tapFallback: S('Hint: or tap instead'), afterBlow: S('After the wish'), cutHint: S('Hint: cut the cake'), afterCut: S('After the cake is cut'), wish: S('The wish line') } },
  little: {
    title: 'The little things',
    desc: 'Right after the letter: three little things she loves, in 3D — a keyring of cute charms, a fizzy green bottle, and a night street of music and memories. Each one can be switched off in Theme.',
    fields: {
      kicker: S('Small title'),
      title: S('Title'),
      keychainLines: L('Keychains — lines'),
      spriteLines: L('Sprite — lines'),
      spriteTag: S('Sprite — the little handwritten tag (empty = none)'),
      nightLines: L('The night — lines'),
      cassette: S('The night — cassette label (empty = plain)'),
      continue: S('Button at the end'),
    },
  },
  favourites: {
    title: 'What makes you, you',
    desc: 'Right after “The little things”: her favourite things as playful 3D fantasies made with love — pani puri, Manchuria and a clearly fictional fan-art photoshoot (it plays only with your own finished fan-art image, Photos → Fan art, printed as “imagined · fan art”) — never real events or memories. Each scene can be switched off in Theme.',
    fields: {
      kicker: S('Small title'),
      title: S('Title'),
      panipuriLines: L('Pani puri — lines'),
      manchuriaLines: L('Manchuria — lines (empty = the scene speaks for itself)'),
      nivinIntro: L('Photoshoot — opening line'),
      nivinLines: L('Photoshoot — line'),
      nivinAfter: L('Photoshoot — after the flash'),
      photoCaption: S('Photoshoot — caption on the print (empty = none; the “imagined · fan art” stamp is always there)'),
      revealLines: L('The reveal — lines'),
      continue: S('Button at the end'),
    },
  },
  constellation: { title: 'Finale · the constellation', fields: { kicker: S('Small title'), title: S('Title'), lines: L('Narration') } },
  birthday: { title: 'Finale · 7,305 days', desc: 'The build-up to her title: 20 years → 7,305 days → countless memories → and somehow… → this is only the beginning → the lanterns → “20” → her final photograph and your handwritten note, in silence → her title.', fields: { years: S('Years line'), months: S('Months line', 'Leave empty to skip it (the month lights still appear).'), days: S('Days line', 'Appears after the lights, one for every day, have filled the golden thread.'), memories: S('Memories line'), somehow: S('“Somehow…” line'), beginning: S('Last line before the lanterns', 'Finishes “And somehow…”.'), lanterns: L('Lantern lines'), strands: S('Line while the thread draws “20”'), handwritten: T('Handwritten note under her final photograph', 'After “20”, in silence, just before her title. Empty = the photograph alone.'), big: S('Big headline'), name: S('Name line'), loved: L('Things she is loved for', '', 'Add one'), closing: T('Closing line') } },
  hug: {
    title: 'The friendship trail',
    desc: 'The finale: the golden thread reaches its last light, and the two of you stand side by side as best friends. Then the credits.',
    fields: {
      title: S('Title'),
      intro: L('Opening lines', 'Shown one after another as the trail begins.'),
      hint: S('Hint', 'A gentle nudge if she needs one.'),
      herCaption: S('Caption under her', 'e.g. “{name}”'),
      meCaption: S('Caption under you'),
      lines: L('Closing lines'),
      final: S('Last line'),
      replyLabel: S('Reply button', 'Only shown if your WhatsApp number is set (Settings → WhatsApp reply).'),
      replyMessage: T('WhatsApp reply message (only if a number is set)', 'The message WhatsApp opens with, ready for her to send to you.'),
    },
  },
  credits: { title: 'Credits', fields: { opening: S('Opening line'), roles: { type: 'pairs', label: 'Credits', hint: 'Role → name, like film credits.', labels: ['Role', 'Name'], add: 'Add a credit' }, end: S('Last line'), endSub: S('Line under the last line'), postCredits: L('Post-credits scene'), extrasTitle: S('Extra memories — title'), extrasSub: S('Extra memories — subtitle'), secrets: S('Secrets-found line') } },
  gallery: { title: 'Photo gallery', fields: { allTitle: S('Gallery title'), allKicker: S('Gallery small title') } },
  // ---- the Keepsake Box (edited in admin → Keepsake Box, not here) ----
  box: { title: 'The box itself', desc: 'The words on the box: shown when it opens.', fields: { kicker: K('box', 'kicker', 'Small title'), title: K('box', 'title', 'Title'), intro: K('box', 'intro', 'Line under the title', '', true), back: K('box', 'back', 'Button: back to the box') } },
  scrapbook: { title: 'The scrapbook', desc: 'Every real photo in the film, grouped by memory (photos linked to a memory first), with your captions and dates. Captions and dates: Photo library → a photo.', fields: { title: K('scrapbook', 'title', 'Title'), intro: K('scrapbook', 'intro', 'Line under the title'), more: K('scrapbook', 'more', 'Heading for the photos without a memory') } },
  stars: { title: 'Memory stars', desc: 'One star for each memory you wrote in How it began (Messages). Nothing else is added.', fields: { title: K('stars', 'title', 'Title'), intro: K('stars', 'intro', 'Line under the title') } },
  comfort: {
    title: 'If you ever forget how special you are', desc: 'Four choices for a hard day. “A happy memory” shows one of your real memories with its photo (How it began); with none, it says so gently. Rewrite any of the built-in words.',
    fields: {
      title: K('comfort', 'title', 'Title'), intro: K('comfort', 'intro', 'Line under the title'),
      reminderLabel: K('comfort', 'reminderLabel', 'Choice 1 — button'), reminder: K('comfort', 'reminder', 'Choice 1 — the reminder', '', true),
      smileLabel: K('comfort', 'smileLabel', 'Choice 2 — button'), smile: K('comfort', 'smile', 'Choice 2 — something to smile at', '', true),
      memoryLabel: K('comfort', 'memoryLabel', 'Choice 3 — button'), memoryEmpty: K('comfort', 'memoryEmpty', 'Choice 3 — when there is no memory yet', '', true),
      breatheLabel: K('comfort', 'breatheLabel', 'Choice 4 — button'), breathe: K('comfort', 'breathe', 'Choice 4 — a quiet moment', '', true),
      back: K('comfort', 'back', 'Button: choose something else'),
    },
  },
  wish: { title: 'A lantern for your wish', desc: 'She writes a wish and lets a lantern go. Her wish never leaves her screen: it isn’t saved, sent or shown to you.', fields: { title: K('wish', 'title', 'Title'), intro: K('wish', 'intro', 'Line under the title'), placeholder: K('wish', 'placeholder', 'The empty wish box says'), button: K('wish', 'button', 'Button: let it go'), after: K('wish', 'after', 'After the lantern goes'), privacy: K('wish', 'privacy', 'The privacy line (keep it true)', '', true), again: K('wish', 'again', 'Button: another wish') } },
  flower: { title: 'A birthday flower', desc: 'A flower that opens petal by petal, one line on each.', fields: { title: K('flower', 'title', 'Title'), intro: K('flower', 'intro', 'Line under the title'), petals: L('Petals (one line each)', builtIn('flower', 'petals'), 'Add a petal'), done: K('flower', 'done', 'When every petal is open') } },
  appreciation: { title: 'The appreciation wall', desc: 'Cards of things you appreciate about her. Hidden from the box until you write one; an empty card, or one switched off, is never shown.', fields: { title: K('appreciation', 'title', 'Title'), intro: K('appreciation', 'intro', 'Line under the title'), cards: { type: 'objects', label: 'Cards', hint: 'In order. Switch a card off to keep it without showing it.', add: 'Add a card', item: { text: T('What I appreciate', '', 'In your own words…'), show: B('Show this card') } } } },
  remember: { title: 'The little things I remember', desc: 'Small things you remember. Hidden from the box until you write one.', fields: { title: K('remember', 'title', 'Title'), intro: K('remember', 'intro', 'Line under the title'), items: L('The little things', 'One per line.', 'Add one', true) } },
  reminders: { title: 'Things that remind me of you', desc: 'Things out in the world that make you think of her. Hidden from the box until you write one.', fields: { title: K('reminders', 'title', 'Title'), intro: K('reminders', 'intro', 'Line under the title'), items: { type: 'objects', label: 'Things', add: 'Add a thing', item: { thing: S('The thing'), why: T('Why (optional)') } } } },
  awards: { title: 'The awards', desc: 'Playful awards in your words. Hidden from the box until you write one.', fields: { title: K('awards', 'title', 'Title'), intro: K('awards', 'intro', 'Line under the title'), items: { type: 'objects', label: 'Awards', add: 'Add an award', item: { title: S('The award', '', 'e.g. Best … of the year'), line: T('Why she won (optional)') } } } },
  lore: { title: 'The Deepu files', desc: 'A mock investigation built only from what is already in the film: her names, her favourite things that are switched on, your memories, the number of photos and days. Add your own case notes if you like.', fields: { title: K('lore', 'title', 'Title'), intro: K('lore', 'intro', 'Line under the title'), notes: L('Extra case notes (optional)', 'Your own lines, one per note.', 'Add a note'), verdict: K('lore', 'verdict', 'The verdict') } },
  quiz: { title: 'Do you remember?', desc: 'Questions made only from your memories and their photos (How it began). Every question can be skipped, every answer is shown, and there is no score.', fields: { title: K('quiz', 'title', 'Title'), intro: K('quiz', 'intro', 'Line under the title', '', true), right: K('quiz', 'right', 'After a right answer'), wrong: K('quiz', 'wrong', 'After another answer'), skip: K('quiz', 'skip', 'Button: skip'), next: K('quiz', 'next', 'Button: next'), end: K('quiz', 'end', 'At the end') } },
  months: { title: 'Twelve little doors', desc: 'One door for each month of her twentieth year; each opens on her birthday’s date that month, by the clock of the device she uses (no notifications are sent). Wishes, not predictions.', fields: { title: K('months', 'title', 'Title'), intro: K('months', 'intro', 'Line under the title', '', true), locked: K('months', 'locked', 'A closed door says ({date} = its day)'), doors: L('The twelve wishes', `${builtIn('months', 'doors').slice(0, 220)}… Write twelve (one per month, in order) to replace them all.`, 'Add a wish', true) } },
  letters: { title: 'Letters from different moments', desc: 'Letters for later. A letter with a date stays sealed until that day on her device; without a date it opens at once. Hidden from the box until you write one. Like everything you publish, a letter is in the site’s public files from the moment you publish it: the date only decides when the film shows it.', fields: { title: K('letters', 'title', 'Title'), intro: K('letters', 'intro', 'Line under the title'), locked: K('letters', 'locked', 'A sealed letter says ({date} = its day)'), items: { type: 'objects', label: 'Letters', add: 'Add a letter', item: { label: S('Title', '', 'e.g. For a hard exam week'), opensOn: DATE('Opens on (optional)', 'Leave empty to open at once.'), body: T('The letter', '', 'In your own words…') } } } },
  voice: { title: 'Hear it in my voice', desc: 'Your voice note again, any time (it appears only once you add one in Audio).', fields: { title: K('voice', 'title', 'Title'), intro: K('voice', 'intro', 'Line under the title') } },
  coupon: { title: 'A coupon', desc: 'A playful coupon. Your wording; it never asks anything of her.', fields: { title: K('coupon', 'title', 'Name in the box'), head: K('coupon', 'head', 'Coupon title'), line: K('coupon', 'line', 'Coupon line', '', true), small: K('coupon', 'small', 'Small print', '', true) } },
  shy: { title: 'A message I was too shy to say', desc: 'Something you never quite said. Hidden from the box until you write it. It never asks for a reply.', fields: { title: K('shy', 'title', 'Title'), intro: K('shy', 'intro', 'Line before it'), text: T('The message', '', 'In your own words…'), after: K('shy', 'after', 'Line after it (keep it pressure-free)') } },
  secret: { title: 'Kuchu Puchu’s secret drawer', desc: 'A locked drawer that opens with her other name or after three secrets found in the film. Inside: the secrets she has found (on her device), hints for the rest, and your secret message if you write one.', fields: { title: K('secret', 'title', 'Title'), intro: K('secret', 'intro', 'Line on the locked drawer', '', true), prompt: K('secret', 'prompt', 'The box for the name'), button: K('secret', 'button', 'Button: open'), wrong: K('secret', 'wrong', 'After a wrong name', '', true), open: K('secret', 'open', 'When it opens'), message: T('Your secret message (optional)', 'Shown inside the drawer.') } },
};
/** The Keepsake Box's words are edited in admin → Keepsake Box, not in Messages. */
export const KEEPSAKE_GROUPS = new Set(['box', ...KEEPSAKE_ROOMS.map((r) => r.id)]);

const ORDER = ['personal', 'story', 'met', 'invite', 'gate', 'prologue', 'tower', 'hair', 'names', 'dance', 'lanterns', 'letter', 'little', 'favourites', 'cake', 'constellation', 'birthday', 'hug', 'credits', 'gallery'];
const TOKENS = ['name', 'nick1', 'creator', 'photoCount', 'days', 'age'];
const open = new Set(['personal', 'story', 'invite']);
let reveal = null; // a group to scroll to after the next render (showGroup)

/** Open Messages at group `g`, opened and scrolled into view (the checks' “Open” links). */
export function showGroup(g) {
  open.add(g);
  reveal = g;
  if (location.hash !== '#messages') location.hash = '#messages';
  else rerenderSection({ keepScroll: true });
}

export function humanize(key) {
  if (typeof key === 'number') return `#${key + 1}`;
  const s = String(key).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const isPair = (v) => Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'string');
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function tokenValues() {
  const site = state.site;
  const nick = (site.her.nicknames || []).map((n) => String(n || '').trim()).filter(Boolean);
  const real = (site.photos || []).filter((p) => p.src && p.enabled !== false).length;
  const unlock = site.settings?.lock?.unlockAt;
  return {
    name: site.her.name || '',
    nick1: nick[1] || nick[0] || site.her.name || '',
    nick2: nick[2] || nick[1] || site.her.name || '',
    creator: site.from.name || '',
    photoCount: String(real || (site.photos || []).length),
    days: daysAlive(site).toLocaleString('en-IN'),
    age: String(new Date(unlock || Date.now()).getFullYear() - Number(String(site.her.birthDate || '2007').slice(0, 4))),
  };
}

export function renderMessages() {
  const text = state.site.text || (state.site.text = {});
  const vals = tokenValues();
  const tokens = h('section.panel.tokens',
    h('p.tokens-title', icon('sparkle'), 'Tokens you can use: ', h('code', '{name} {nick1} {creator} {photoCount} {days} {age}')),
    h('p.field-hint', 'Type them anywhere — the film swaps in the real value. Tap one to copy it.'),
    h('div.token-list', TOKENS.map((t) => h('button.token', {
      type: 'button', title: `Copy {${t}}`,
      onclick: async () => { try { await navigator.clipboard.writeText(`{${t}}`); toast(`Copied {${t}}`); } catch { toast(`{${t}} → ${vals[t]}`); } },
    }, h('code', `{${t}}`), h('span', vals[t] || '—')))));

  const groups = [...ORDER];
  for (const k of Object.keys(text)) if (!groups.includes(k) && !KEEPSAKE_GROUPS.has(k)) groups.push(k);
  const list = h('div.msg-groups', groups.map((g) => groupEl(g)));
  if (reveal) {
    const g = reveal;
    reveal = null;
    requestAnimationFrame(() => {
      const d = list.querySelector(`details.group[data-group="${CSS.escape(g)}"]`);
      if (!d) return;
      d.scrollIntoView({ block: 'start' });
      d.querySelector('summary').focus({ preventScroll: true });
    });
  }
  return h('div.messages',
    sectionHead('Messages', 'Every word she reads', 'Grouped by chapter, in story order. Empty boxes use the film’s own wording. Changes save to your draft as you type.',
      h('div.head-actions',
        h('button.btn.sm.ghost', { type: 'button', onclick: () => { for (const g of groups) open.add(g); for (const d of list.querySelectorAll('details.group')) d.open = true; } }, 'Open all'),
        h('button.btn.sm.quiet', { type: 'button', onclick: () => { open.clear(); for (const d of list.querySelectorAll('details.group')) d.open = false; } }, 'Close all'))),
    tokens, list);
}

function groupTitle(g) {
  if (SCHEMA[g]) return SCHEMA[g].title;
  const fc = FILM_CHAPTERS.find((c) => c.id === g);
  return fc ? fc.label : `${humanize(g)} (extra)`;
}

/** One group's editor (a <details>); the Keepsake Box section uses it for its rooms. */
export function groupEl(g) {
  const schema = SCHEMA[g];
  const body = h('div.group-body');
  const changedDot = h('span.changed-dot', { title: 'Changed (not published yet)' });
  const sub = h('span.group-sub', summaryOf(g));
  const d = h('details.group', { open: open.has(g), dataset: { group: g } },
    h('summary.group-head',
      h('span.group-titles', h('span.group-title', groupTitle(g), changedDot), sub),
      h('span.group-chev', icon('down'))),
    body);
  const sync = () => {
    d.classList.toggle('is-changed', !deepEqual(getAt(state.site, ['text', g]), getAt(state.base, ['text', g])));
    if (g === 'personal' || g === STORY || g === 'met') sub.textContent = summaryOf(g); // "3 of 7 written", "4 memories · 10 photos", live
  };
  d.addEventListener('toggle', () => {
    if (d.open) { open.add(g); if (!body.childElementCount) fill(); } else open.delete(g);
  });
  function fill() {
    const val = getAt(state.site, ['text', g]);
    if (schema && schema.desc) body.append(h('p.group-desc', schema.desc));
    const known = schema ? Object.keys(schema.fields) : [];
    for (const k of known) body.append(fieldFor(['text', g, k], schema.fields[k], k, sync));
    if (isObj(val)) {
      const extra = Object.keys(val).filter((k) => !known.includes(k));
      if (extra.length && schema) body.append(h('h4.sub-head', 'More words in this group'));
      for (const k of extra) body.append(genericField(['text', g, k], val[k], k, sync));
    } else if (val !== undefined && !schema) {
      body.append(genericField(['text', g], val, g, sync));
    }
  }
  if (d.open) fill();
  sync();
  return d;
}

function summaryOf(g) {
  if (g === 'personal') {
    const vals = personalValues(state.site);
    const done = PERSONAL_FIELDS.filter((f) => vals[f.key]).length;
    return `${done} of ${PERSONAL_FIELDS.length} written`;
  }
  if (g === 'met') {
    const cards = getAt(state.site, ['text', 'met', 'cards']);
    const n = Array.isArray(cards) ? cards.length : 0;
    const shown = metCards(state.site).length;
    if (!n) return 'Not written yet (the chapter is skipped)';
    return shown === n ? plural(n, 'card') : `${plural(n, 'card')} · ${shown ? `${shown} with words or a photo` : 'none written yet, so the chapter is skipped'}`;
  }
  if (g === STORY) {
    const n = memoriesOf(state.site).length;
    const photos = (state.site.photos || []).filter((p) => p.chapter === STORY).length;
    return n ? `${plural(n, 'memory', 'memories')} · ${plural(photos, 'photo')}` : 'No memories yet';
  }
  const v = getAt(state.site, ['text', g]);
  if (!isObj(v)) return SCHEMA[g]?.desc || '';
  const t = v.title || v.greeting || v.big || v.salutation || (Array.isArray(v.lines) && typeof v.lines[0] === 'string' ? v.lines[0] : '');
  return typeof t === 'string' && t ? t : SCHEMA[g]?.desc || '';
}

/* ---------------------------------------------------------------- field editors */
function markChanged(path, el) {
  el.classList.toggle('is-changed', !deepEqual(getAt(state.site, path), getAt(state.base, path)));
}

function commit(path, value, { prune = true } = {}) {
  change((site) => {
    const existed = getAt(state.base, path) !== undefined;
    if (prune && !existed && (value === '' || (Array.isArray(value) && !value.length))) {
      deleteAt(site, path);
      // a group that only held this new, now-empty value goes too (no empty {} left in the published file)
      for (let k = path.length - 1; k > 2; k--) {
        const parent = path.slice(0, k);
        const v = getAt(site, parent);
        if (getAt(state.base, parent) === undefined && v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) deleteAt(site, parent);
        else break;
      }
    } else setAt(site, path, value);
  }, { render: false });
}

function fieldFor(path, spec, key, onAny) {
  if (spec.type === 'note') return h('p.field-hint.note', spec.text);
  if (spec.type === 'string' || spec.type === 'text') return stringField(path, spec.label, { long: spec.type === 'text', hint: spec.hint, onAny, placeholder: spec.placeholder || undefined });
  if (spec.type === 'list') return listField(path, spec, onAny);
  if (spec.type === 'pairs') return pairsField(path, spec, onAny);
  if (spec.type === 'objects') return objectsField(path, spec, onAny);
  if (spec.type === 'memories') return memoriesField(path, spec, onAny);
  if (spec.type === 'photos') return photosField(path, spec, onAny);
  if (spec.type === 'bool') return boolField(path, spec, onAny);
  if (spec.type === 'date') return dateField(path, spec, onAny);
  return genericField(path, getAt(state.site, path), key, onAny);
}

/** On / off (a missing value is the default). */
function boolField(path, spec, onAny) {
  const v = getAt(state.site, path);
  return switchField({
    label: spec.label, hint: spec.hint || '', checked: v === undefined ? spec.default !== false : v !== false,
    onchange: (on) => { commit(path, on, { prune: false }); onAny(); },
  });
}

/** A calendar day (YYYY-MM-DD) or nothing. */
function dateField(path, spec, onAny) {
  const id = nextId('md');
  const v = getAt(state.site, path);
  const input = h('input.input', { id, type: 'date', value: typeof v === 'string' ? v : '', 'aria-describedby': spec.hint ? `${id}-hint` : null });
  input.addEventListener('change', () => { commit(path, input.value); onAny(); });
  input.addEventListener('input', () => { commit(path, input.value); onAny(); });
  return h('div.field', h('label.field-label', { for: id }, spec.label), input, spec.hint ? h('p.field-hint', { id: `${id}-hint` }, spec.hint) : null);
}

/** Real photos the owner can pick (not fan art, which is imagined). */
const pickable = () => (state.site.photos || []).filter((p) => p.src && p.enabled !== false && p.chapter !== 'fanart');

/** A few photos from the library, by id: shown as thumbnails; choose from the library or upload a new one. */
function photosField(path, spec, onAny) {
  const wrap = h('div.field.pick-photos');
  const ids = () => { const v = getAt(state.site, path); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; };
  const write = (list) => { commit(path, list); paint(); onAny(); };
  const paint = () => {
    const list = ids();
    const items = list.map((id, i) => {
      const p = photoById(id);
      const name = p ? (p.label || p.alt || 'Photo') : 'A photo that is no longer in the library';
      return h('li.pick-item',
        p ? h('button.mem-thumb', { type: 'button', title: name, 'aria-label': `Edit photo ${name}`, onclick: () => openEditor(id) }, h('span.mem-thumb-frame', { 'aria-hidden': 'true' }, thumbEl(p))) : h('span.pick-missing', '?'),
        h('button.icon-btn.sm.danger.pick-remove', { type: 'button', 'aria-label': `Remove photo ${i + 1} (${name}) from this card`, onclick: () => write(list.filter((_, k) => k !== i)) }, icon('close')));
    });
    wrap.replaceChildren(
      h('div.field-top', h('span.field-label', `${spec.label} · ${list.length}`)),
      items.length ? h('ul.pick-list', items) : h('p.field-hint', 'No photos chosen.'),
      h('div.pick-actions',
        h('button.btn.sm.ghost', { type: 'button', dataset: { act: 'pick-photos' }, onclick: async () => { const got = await pickPhotos(ids(), spec.label); if (got) write(got); } }, icon('images'), 'Choose from your photos'),
        h('button.btn.sm.quiet', { type: 'button', onclick: async () => {
          const before = new Set((state.site.photos || []).map((p) => p.id));
          await addPhotos({ chapter: 'album' });
          const fresh = (state.site.photos || []).filter((p) => !before.has(p.id) && p.src);
          // fan art is imagined, never a real photo: the film never shows it on a card, so it isn't put on one
          const added = fresh.filter((p) => p.chapter !== 'fanart' && p.enabled !== false).map((p) => p.id);
          if (added.length < fresh.length) toast('Fan art (and photos switched off) can’t go on a card: it stays in your library, not on this card.');
          if (added.length) write([...ids(), ...added]);
        } }, icon('plus'), 'Upload a new photo')),
      spec.hint ? h('p.field-hint', spec.hint) : null);
  };
  paint();
  return wrap;
}

/** The photo picker: every real photo, grouped by where it is in the film; tap to choose. */
async function pickPhotos(current, label) {
  const chosen = [...current];
  const all = pickable();
  const groups = new Map();
  for (const p of all) { if (!groups.has(p.chapter)) groups.set(p.chapter, []); groups.get(p.chapter).push(p); }
  const count = h('span');
  const sync = () => { count.textContent = chosen.length ? `Use ${plural(chosen.length, 'photo')}` : 'Use none'; };
  const content = all.length ? [...groups.entries()].map(([ch, list]) => h('section.pick-group',
    h('h3.pick-head', FILM_CHAPTERS.find((c) => c.id === ch)?.label || humanize(ch)),
    h('ul.pick-grid', list.sort((a, b) => a.order - b.order).map((p) => {
      const name = p.label || p.alt || 'Photo';
      const b = h('button.pick-tile', { type: 'button', 'aria-pressed': String(chosen.includes(p.id)), title: name, dataset: { id: p.id } },
        h('span.mem-thumb-frame', { 'aria-hidden': 'true' }, thumbEl(p)), h('span.sr-only', name), h('span.pick-check', { 'aria-hidden': 'true' }, icon('check')));
      b.addEventListener('click', () => {
        const i = chosen.indexOf(p.id);
        if (i >= 0) chosen.splice(i, 1); else chosen.push(p.id);
        b.setAttribute('aria-pressed', String(i < 0));
        sync();
      });
      return h('li', b);
    })))) : [h('p.sheet-text', 'There are no photos in your library yet. Upload one first.')];
  sync();
  const s = openSheet({
    kicker: label || 'Photos', title: 'Choose photos', size: 'lg', key: 'pick-photos',
    content: [h('p.muted.small', 'Tap to choose or unchoose. They appear in the order you chose them.'), ...content],
    actions: [
      h('button.btn.ghost', { type: 'button', onclick: () => s.close(null) }, 'Cancel'),
      h('button.btn.gold', { type: 'button', 'data-testid': 'pick-done', onclick: () => s.close('ok') }, icon('check'), count),
    ],
  });
  if (s.duplicate) return null;
  return (await s.result) === 'ok' ? chosen : null;
}

function stringField(path, label, { long = null, hint = '', onAny = () => {}, placeholder } = {}) {
  const value = getAt(state.site, path) ?? '';
  const isLong = long ?? (String(value).length > 70 || String(value).includes('\n'));
  const id = nextId('m');
  const ph = placeholder ?? (getAt(state.base, path) === undefined ? 'Uses the film’s own words' : '');
  const control = isLong
    ? autoGrow(h('textarea.input', { id, rows: '2', value: String(value), placeholder: ph }))
    : h('input.input', { id, type: 'text', value: String(value), placeholder: ph });
  const wrap = h('div.field');
  const reset = h('button.link-btn.reset', {
    type: 'button', title: 'Undo this change',
    onclick: () => {
      const was = getAt(state.base, path);
      control.value = was ?? '';
      commit(path, was ?? '');
      markChanged(path, wrap);
      onAny();
    },
  }, icon('undo'), 'Undo');
  wrap.append(h('div.field-top', h('label.field-label', { for: id }, label), h('span.changed-dot', { title: 'Changed (not published yet)' }), reset), control);
  if (hint) wrap.append(h('p.field-hint', hint)); // (native append would print a null as the text “null”)
  control.addEventListener('input', () => { commit(path, control.value); markChanged(path, wrap); onAny(); });
  markChanged(path, wrap);
  return wrap;
}

function rowTools(n, i, { move, remove, label }) {
  return h('div.row-tools',
    h('button.icon-btn.sm', { type: 'button', 'aria-label': `Move ${label} ${i + 1} up`, disabled: i === 0, onclick: () => move(i, -1) }, icon('up')),
    h('button.icon-btn.sm', { type: 'button', 'aria-label': `Move ${label} ${i + 1} down`, disabled: i === n - 1, onclick: () => move(i, 1) }, icon('down')),
    h('button.icon-btn.sm.danger', { type: 'button', 'aria-label': `Remove ${label} ${i + 1}`, onclick: () => remove(i) }, icon('trash')));
}

/**
 * Shared plumbing for list / pairs / objects editors. Every structural change rebuilds the
 * editor; `focus(fresh)` then puts the keyboard focus back on the matching control INSIDE the
 * rebuilt editor (never on a same-named field of another group).
 */
function arrayShell(path, label, hint, onAny, build) {
  const wrap = h('div.array-field');
  const rerender = (focus) => {
    const fresh = build();
    wrap.replaceWith(fresh);
    onAny();
    if (focus) requestAnimationFrame(() => { const el = focus(fresh); if (el) el.focus(); });
    return fresh;
  };
  const arr = () => getAt(state.site, path) || [];
  const write = (a) => commit(path, a);
  const rows = (fresh) => [...fresh.querySelectorAll(':scope > .str-list > li.str-row, :scope > .pair-list > .pair-row, :scope > .obj-list > .obj-card')];
  const move = (i, d) => {
    const a = clone(arr()); const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    write(a);
    rerender((fresh) => {
      const row = rows(fresh)[j];
      const btn = row && row.querySelectorAll('.row-tools .icon-btn')[d < 0 ? 0 : 1];
      return btn && !btn.disabled ? btn : row && row.querySelector('textarea, input');
    });
  };
  const remove = (i) => {
    const a = clone(arr());
    a.splice(i, 1);
    write(a);
    rerender((fresh) => { const r = rows(fresh); const row = r[Math.min(i, r.length - 1)]; return (row && row.querySelector('textarea, input')) || fresh.querySelector('.add-btn'); });
  };
  const changed = !deepEqual(getAt(state.site, path), getAt(state.base, path));
  wrap.append(h('div.field-top', h('span.field-label', label), changed ? h('span.changed-dot.on', { title: 'Changed' }) : null));
  if (hint) wrap.append(h('p.field-hint', hint));
  return { wrap, arr, write, move, remove, rerender };
}

function listField(path, spec, onAny) {
  const build = () => {
    const { wrap, arr, write, move, remove, rerender } = arrayShell(path, spec.label, spec.hint, onAny, build);
    const items = arr();
    const list = h('ol.str-list');
    items.forEach((v, i) => {
      const ta = autoGrow(h('textarea.input', { rows: spec.long ? '3' : '1', value: typeof v === 'string' ? v : JSON.stringify(v), 'aria-label': `${spec.label} ${i + 1}` }));
      ta.addEventListener('input', () => { const a = clone(arr()); a[i] = ta.value; write(a); onAny(); });
      list.append(h('li.str-row', h('span.row-num', { 'aria-hidden': 'true' }, String(i + 1)), ta, rowTools(items.length, i, { move, remove, label: 'line' })));
    });
    if (!items.length) list.append(h('li.str-empty', getAt(state.base, path) === undefined ? 'Empty — the film uses its own lines.' : 'No lines.'));
    wrap.append(list, h('button.btn.quiet.sm.add-btn', { type: 'button', onclick: () => { write([...arr(), '']); rerender((fresh) => { const r = fresh.querySelectorAll(':scope > .str-list textarea'); return r[r.length - 1]; }); } }, icon('plus'), spec.add || 'Add a line'));
    return wrap;
  };
  return build();
}

function pairsField(path, spec, onAny) {
  const [la, lb] = spec.labels || ['Left', 'Right'];
  const build = () => {
    const { wrap, arr, write, move, remove, rerender } = arrayShell(path, spec.label, spec.hint, onAny, build);
    const items = arr();
    const list = h('div.pair-list');
    items.forEach((pair, i) => {
      const a = h('input.input', { type: 'text', value: pair[0] ?? '', placeholder: la, 'aria-label': `${la} ${i + 1}` });
      const b = h('input.input', { type: 'text', value: pair[1] ?? '', placeholder: lb, 'aria-label': `${lb} ${i + 1}` });
      const up = () => { const x = clone(arr()); x[i] = [a.value, b.value]; write(x); onAny(); };
      a.addEventListener('input', up);
      b.addEventListener('input', up);
      list.append(h('div.pair-row', h('div.pair-inputs', a, b), rowTools(items.length, i, { move, remove, label: 'row' })));
    });
    wrap.append(list, h('button.btn.quiet.sm.add-btn', { type: 'button', onclick: () => { write([...arr(), ['', '']]); rerender((fresh) => { const r = fresh.querySelectorAll(':scope > .pair-list .pair-row'); return r.length ? r[r.length - 1].querySelector('input') : null; }); } }, icon('plus'), spec.add || 'Add a row'));
    return wrap;
  };
  return build();
}

function objectsField(path, spec, onAny) {
  const build = () => {
    const { wrap, arr, write, move, remove, rerender } = arrayShell(path, spec.label, spec.hint, onAny, build);
    const items = arr();
    const list = h('div.obj-list');
    items.forEach((obj, i) => {
      const card = h('div.obj-card', h('div.obj-head', h('span.obj-title', `${spec.label.replace(/s$/, '')} ${i + 1}`), rowTools(items.length, i, { move, remove, label: 'item' })));
      const keys = [...Object.keys(spec.item || {})];
      for (const k of Object.keys(obj || {})) if (!keys.includes(k)) keys.push(k);
      for (const k of keys) {
        const sub = spec.item && spec.item[k];
        if (!sub || sub.type === 'string' || sub.type === 'text') card.append(stringField([...path, i, k], sub ? sub.label : humanize(k), { long: sub ? sub.type === 'text' : null, onAny, placeholder: (sub && sub.placeholder) || '', hint: (sub && sub.hint) || '' }));
        else if (sub.type === 'photos') card.append(photosField([...path, i, k], sub, onAny));
        else if (sub.type === 'bool') card.append(boolField([...path, i, k], sub, onAny));
        else if (sub.type === 'date') card.append(dateField([...path, i, k], sub, onAny));
        else card.append(genericField([...path, i, k], obj[k], k, onAny));
      }
      list.append(card);
    });
    wrap.append(list, h('button.btn.quiet.sm.add-btn', {
      type: 'button',
      onclick: () => {
        const a = clone(arr());
        // a new item: the schema's fields with their defaults (an on/off starts on, photos start empty)
        const fresh = (sub) => (sub.type === 'bool' ? sub.default !== false : sub.type === 'photos' ? [] : '');
        const tmpl = spec.item ? Object.fromEntries(Object.entries(spec.item).map(([k, sub]) => [k, fresh(sub)])) : null;
        const blank = (v) => (typeof v === 'string' ? '' : Array.isArray(v) ? [] : isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x)])) : v);
        a.push(tmpl || blank(a[a.length - 1] || {}));
        write(a);
        rerender((fresh) => { const r = fresh.querySelectorAll(':scope > .obj-list > .obj-card'); return r.length ? r[r.length - 1].querySelector('input, textarea') : null; });
      },
    }, icon('plus'), spec.add || 'Add one more'));
    return wrap;
  };
  return build();
}

/**
 * The owner's memories (messages.json → story.memories): add, edit, delete and reorder them.
 * Each memory: when (optional), the words, a style, and its photos (“How it began” photos whose
 * `memory` is this memory's id). The id is never shown; a new memory starts empty.
 */
function memoriesField(path, spec, onAny) {
  const rowsOf = (fresh) => [...fresh.querySelectorAll(':scope > .obj-list > .obj-card')];
  const build = () => {
    const { wrap, arr, write, move, rerender } = arrayShell(path, spec.label, spec.hint, onAny, build);
    wrap.classList.add('mem-field');
    const items = arr();
    const removeAt = async (i) => {
      const m = arr()[i];
      if (m === undefined) return;
      const name = isObj(m) ? memoryLabel(m, i) : `Memory ${i + 1}`;
      const linked = isObj(m) && m.id ? memoryPhotos(state.site, m.id) : [];
      if (linked.length) {
        const ok = await confirmDialog({
          kicker: 'Delete memory', title: 'Delete this memory?', danger: true, confirm: 'Delete memory', cancel: 'Keep it',
          message: `“${name}” has ${plural(linked.length, 'photo')}. The photos stay in your library (Photo library → Our story); the film shows them with the last memory until you link them to another one.`,
        });
        if (!ok) return;
      }
      let undo = null;
      if (isObj(m) && m.id) change((site) => { undo = removeMemory(site, m.id); }, { render: false });
      else { const a = clone(arr()); a.splice(i, 1); write(a); }
      rerender((fresh) => { const r = rowsOf(fresh); const row = r[Math.min(i, r.length - 1)]; return (row && row.querySelector('input, textarea')) || fresh.querySelector('.add-btn'); });
      if (undo) {
        toast(`Deleted ${name}.${undo.unlinked.length ? ` Its ${plural(undo.unlinked.length, 'photo')} stay in Our story.` : ''}`, {
          action: { label: 'Undo', run: () => { change((site) => { restoreMemory(site, undo); }); toast('Memory restored.', { type: 'success' }); } },
        });
      }
    };
    const list = h('ol.obj-list.mem-list');
    items.forEach((m, i) => list.append(isObj(m)
      ? memoryCard(m, i, items.length, { arr, write, move, removeAt, onAny })
      : h('li.obj-card', h('div.obj-head', h('span.obj-title', `Memory ${i + 1}`), rowTools(items.length, i, { move, remove: removeAt, label: 'memory' })), h('p.field-hint', `${JSON.stringify(m)} (kept as is)`))));
    if (!items.length) list.append(h('li.str-empty', 'No memories yet.'));
    const add = h('button.btn.gold-soft.sm.add-btn', {
      type: 'button', 'data-testid': 'memory-add',
      onclick: () => {
        write([...clone(arr()), newMemory(memoriesOf(state.site))]);
        rerender((fresh) => { const r = rowsOf(fresh); return r.length ? r[r.length - 1].querySelector('input') : null; });
      },
    }, icon('plus'), spec.add || 'Add a memory');
    const loose = unlinkedStoryPhotos(state.site);
    wrap.append(list, add, h('p.field-hint.mem-later', 'For later months (October, November, December…): add a memory, write when it happened, then add its photos.'));
    if (loose.length) {
      wrap.append(h('div.mem-loose',
        h('p.field-hint', `${plural(loose.length, 'photo')} in Our story ${loose.length === 1 ? 'isn’t' : 'aren’t'} linked to a memory, so the film shows ${loose.length === 1 ? 'it' : 'them'} with the last memory. Open one to choose its memory.`),
        thumbList(loose)));
    }
    return wrap;
  };
  return build();
}

function memoryCard(m, i, n, { arr, write, move, removeAt, onAny }) {
  const base = memoriesOf(state.base).find((x) => x.id === m.id);
  const card = h('li.obj-card.mem-card', { dataset: { memory: m.id || '' } });
  const changed = () => card.classList.toggle('is-changed', !deepEqual(arr()[i], base));
  const set = (k, v) => {
    const a = clone(arr());
    if (!isObj(a[i])) return;
    a[i] = { ...a[i], [k]: v };
    write(a);
    changed();
    onAny();
  };
  const which = h('span.sr-only', ` (memory ${i + 1})`);
  const ids = { title: nextId('mn'), when: nextId('mw'), text: nextId('mt'), kind: nextId('mk') };
  const title = h('input.input', {
    id: ids.title, type: 'text', value: typeof m.title === 'string' ? m.title : '', maxlength: '80', placeholder: 'e.g. The college event', autocomplete: 'off',
    'aria-describedby': `${ids.title}-hint`, dataset: { fk: `mem-title-${m.id}`, field: 'title' },
  });
  title.addEventListener('input', () => set('title', title.value));
  const when = h('input.input', {
    id: ids.when, type: 'text', value: typeof m.when === 'string' ? m.when : '', maxlength: '60', placeholder: 'e.g. October 2026', autocomplete: 'off',
    'aria-describedby': `${ids.when}-hint`, dataset: { fk: `mem-when-${m.id}`, field: 'when' },
  });
  when.addEventListener('input', () => set('when', when.value));
  const text = autoGrow(h('textarea.input', { id: ids.text, rows: '3', value: typeof m.text === 'string' ? m.text : '', placeholder: 'In your own words…', dataset: { fk: `mem-text-${m.id}`, field: 'text' } }));
  text.addEventListener('input', () => set('text', text.value));
  const known = !m.kind || MEMORY_KINDS.some((k) => k.id === m.kind);
  const kinds = known ? MEMORY_KINDS : [...MEMORY_KINDS, { id: m.kind, label: `${m.kind} (plays as a moment)` }];
  const kind = h('select.input.select', { id: ids.kind, 'aria-describedby': `${ids.kind}-hint`, dataset: { fk: `mem-kind-${m.id}`, field: 'kind' } },
    kinds.map((k) => h('option', { value: k.id, selected: k.id === (m.kind || 'moment') }, k.label)));
  kind.addEventListener('change', () => set('kind', kind.value));
  const photos = m.id ? memoryPhotos(state.site, m.id) : [];
  card.append(
    h('div.obj-head', h('span.obj-title', `Memory ${i + 1}`, h('span.changed-dot', { title: 'Changed (not published yet)' })), rowTools(n, i, { move, remove: removeAt, label: 'memory' })),
    h('div.field', h('label.field-label', { for: ids.when }, 'When (optional)', which.cloneNode(true)), when, h('p.field-hint', { id: `${ids.when}-hint` }, 'A month, a season or a year. Leave it empty if you’d rather not say.')),
    h('div.field', h('label.field-label', { for: ids.title }, 'Title (optional)', which.cloneNode(true)), title, h('p.field-hint', { id: `${ids.title}-hint` }, 'A short name for it: shown in the Keepsake Box (the memory stars, the scrapbook, the quiz). Empty = its first words.')),
    h('div.field', h('label.field-label', { for: ids.text }, 'The memory', which.cloneNode(true)), text),
    h('div.field', h('label.field-label', { for: ids.kind }, 'Style', which.cloneNode(true)), kind, h('p.field-hint', { id: `${ids.kind}-hint` }, 'How the film stages it.')),
    h('div.field.mem-photos',
      h('span.field-label', `Photos (${photos.length})`),
      photos.length ? thumbList(photos) : h('p.field-hint', 'No photos yet.'),
      m.id ? h('button.btn.sm.ghost.mem-add-photos', {
        type: 'button', 'aria-label': `Add photos to this memory (memory ${i + 1})`, dataset: { act: 'mem-photos', fk: `mem-photos-${m.id}` },
        onclick: () => addPhotos({ chapter: STORY, memory: m.id }),
      }, icon('plus'), 'Add photos to this memory') : null));
  changed();
  return card;
}

/** Small thumbnails; each opens its photo in the editor. */
function thumbList(photos) {
  return h('ul.mem-thumbs', photos.map((p) => {
    const name = p.label || (p.caption ? `“${p.caption}”` : 'Untitled photo');
    return h('li', h('button.mem-thumb', {
      type: 'button', class: p.enabled === false ? 'is-off' : '', title: name,
      'aria-label': `Edit photo ${name}${p.enabled === false ? ' (hidden from the film)' : ''}`, dataset: { fk: `mem-photo-${p.id}`, id: p.id },
      onclick: () => openEditor(p.id),
    }, h('span.mem-thumb-frame', { 'aria-hidden': 'true' }, thumbEl(p))));
  }));
}

/** Any value of unknown shape: string / number / boolean / list / pairs / objects / nested object. */
function genericField(path, value, key, onAny) {
  if (typeof value === 'string' || value === null) return stringField(path, humanize(key), { onAny, placeholder: '' });
  if (typeof value === 'number') {
    const id = nextId('m');
    const input = h('input.input', { id, type: 'number', value: String(value) });
    input.addEventListener('input', () => { const n = Number(input.value); if (Number.isFinite(n)) { commit(path, n, { prune: false }); onAny(); } });
    return h('div.field', h('label.field-label', { for: id }, humanize(key)), input);
  }
  if (typeof value === 'boolean') {
    const id = nextId('m');
    const input = h('input', { id, type: 'checkbox', checked: value });
    input.addEventListener('change', () => { commit(path, input.checked, { prune: false }); onAny(); });
    return h('label.check', { for: id }, input, h('span', humanize(key)));
  }
  if (Array.isArray(value)) {
    if (value.length && value.every(isPair)) return pairsField(path, { label: humanize(key), labels: ['Left', 'Right'] }, onAny);
    if (value.length && value.every(isObj)) {
      const keys = [...new Set(value.flatMap((o) => Object.keys(o)))];
      return objectsField(path, { label: humanize(key), item: Object.fromEntries(keys.map((k) => [k, typeof value[0][k] === 'string' ? { type: 'string', label: humanize(k) } : { type: 'other' }])) }, onAny);
    }
    if (value.every((x) => typeof x === 'string')) return listField(path, { label: humanize(key) }, onAny);
    const box = h('div.array-field', h('span.field-label', humanize(key)));
    value.forEach((v, i) => box.append(genericField([...path, i], v, `${humanize(key)} ${i + 1}`, onAny)));
    return box;
  }
  if (isObj(value)) {
    const box = h('fieldset.nested', h('legend', humanize(key)));
    for (const k of Object.keys(value)) box.append(genericField([...path, k], value[k], k, onAny));
    return box;
  }
  return h('p.field-hint', `${humanize(key)}: (kept as is)`);
}
