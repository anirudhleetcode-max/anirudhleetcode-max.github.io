/**
 * OVERVIEW — the whole film at a glance: what is done and what is left, each tile one tap from the
 * place to change it. Every number is counted from the draft as it is now (nothing estimated), and
 * nothing here is ever published.
 */
import { FILM_CHAPTERS, PERSONAL_FIELDS, personalValues, personalGaps, memoriesOf, validate, photosFor } from '../../assets/js/shared/model.js';
import { state, changes, liveUrl } from '../state.js';
import { plural } from '../util.js';
import { h, icon } from '../ui.js';
import { publishFlow } from '../publish.js';
import { showGroup } from './messages.js';
import { sectionHead } from './common.js';

/** The numbers the tiles show (exported for tests). */
export function overviewCounts(site) {
  const photos = (site.photos || []).filter((p) => p.enabled !== false);
  const spots = photos.filter((p) => p.chapter !== 'fanart');
  const vals = personalValues(site);
  const toggles = (site.chapters || []).filter((c) => FILM_CHAPTERS.find((f) => f.id === c.id && f.toggle !== false));
  const mems = memoriesOf(site);
  const v = validate(site);
  const lock = (site.settings && site.settings.lock) || {};
  return {
    photos: spots.filter((p) => p.src).length,
    spots: spots.length,
    empty: spots.filter((p) => !p.src).length,
    album: photosFor(site, 'album').filter((p) => p.src).length,
    memories: mems.length,
    memoryPhotos: (site.photos || []).filter((p) => p.memory && p.src).length,
    letterWritten: PERSONAL_FIELDS.filter((f) => vals[f.key]).length,
    letterFields: PERSONAL_FIELDS.length,
    letterHidden: personalGaps(site).empty.filter((f) => !f.optional).length,
    letterOptional: personalGaps(site).empty.filter((f) => f.optional).length,
    letterPlaceholders: personalGaps(site).leftovers.length,
    chaptersOn: toggles.filter((c) => c.enabled !== false).length,
    chaptersOff: toggles.filter((c) => c.enabled === false).length,
    music: !!(site.media && site.media.music),
    voice: !!(site.media && site.media.voice),
    video: !!(site.media && site.media.video),
    errors: v.errors.length,
    warnings: v.warnings.length,
    locked: lock.enabled !== false,
    unlockAt: lock.unlockAt || '',
  };
}

/** What the letter tile says about lines that can't play yet (honest about the optional P.S. and leftover [PLACEHOLDERS]). */
function letterSub(c) {
  const parts = [];
  if (c.letterHidden) parts.push(`${c.letterHidden} still empty: the lines that use ${c.letterHidden > 1 ? 'them stay' : 'it stays'} hidden from her until you write ${c.letterHidden > 1 ? 'them' : 'it'}`);
  if (c.letterPlaceholders) parts.push(`${plural(c.letterPlaceholders, 'line')} still ${c.letterPlaceholders > 1 ? 'have' : 'has'} a [PLACEHOLDER] (hidden from her)`);
  if (c.letterOptional) parts.push('the optional line (the inside joke, in the P.S.) is left out until you write it');
  return parts.length ? parts.join(' · ') : 'every line of the letter can play';
}

export function renderOverview() {
  const c = overviewCounts(state.site);
  const ch = changes();
  const live = liveUrl();
  const go = (hash) => () => { location.hash = hash; };
  const tile = (key, ic, title, value, sub, onclick, kind = '') => h(`button.ov-tile${kind ? `.${kind}` : ''}`, { type: 'button', dataset: { tile: key }, onclick },
    h('span.ov-icon', icon(ic)),
    h('span.ov-text', h('span.ov-title', title), h('span.ov-value', value), sub ? h('span.ov-sub', sub) : null),
    icon('right', 'icon ov-go'));
  const when = (() => {
    const t = Date.parse(c.unlockAt);
    if (!Number.isFinite(t)) return 'no date set';
    const d = new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const days = Math.ceil((t - Date.now()) / 86400000);
    return `${d} IST${days > 0 ? ` · ${plural(days, 'day')} to go` : ''}`;
  })();
  return h('div.overview',
    sectionHead('Overview', 'The film at a glance', 'What’s done and what’s left. Tap a tile to go there. Counted from your draft as it is right now.'),
    h('div.ov-grid', { role: 'list' },
      [
        tile('photos', 'images', 'Photos', `${c.photos} of ${c.spots} spots filled`, c.empty ? `${plural(c.empty, 'empty spot')} (a soft placeholder shows)` : `every spot filled ✨${c.album ? ` · ${c.album} in the album` : ''}`, go('#library'), c.empty ? 'is-todo' : 'is-done'),
        tile('memories', 'quote', 'Your memories (How it began)', `${c.memories} ${c.memories === 1 ? 'memory' : 'memories'}`, `${plural(c.memoryPhotos, 'photo')} linked to them`, () => showGroup('story'), c.memories ? 'is-done' : 'is-todo'),
        tile('letter', 'quote', 'Your letter’s personal lines', `${c.letterWritten} of ${c.letterFields} written`, letterSub(c), () => showGroup('personal'), c.letterHidden || c.letterPlaceholders ? 'is-todo' : 'is-done'),
        tile('chapters', 'film', 'Chapters', `${c.chaptersOn} on${c.chaptersOff ? ` · ${c.chaptersOff} switched off` : ''}`, null, go('#chapters')),
        tile('sound', 'music', 'Music & voice note', [c.music ? 'your music' : 'the built-in score', c.voice ? 'a voice note' : 'no voice note'].join(' · '), c.voice ? null : 'optional: a voice note plays under the letter', go('#audio')),
        tile('video', 'video', 'Video message', c.video ? 'added' : 'none', c.video ? null : 'optional: its chapter only plays when there is one', go('#video')),
        tile('checks', c.errors ? 'warn' : 'check', 'Checks before publishing', c.errors ? plural(c.errors, 'problem') + ' to fix' : 'nothing blocking', c.warnings ? plural(c.warnings, 'gentle reminder') : null, go('#preview'), c.errors ? 'is-problem' : 'is-done'),
        tile('release', 'lock', 'Release', c.locked ? 'locked until her birthday' : 'open now (no countdown)', when, go('#settings')),
        tile('publish', 'send', 'Unpublished changes', ch.count ? plural(ch.count, 'change') : 'none · all published', ch.count ? 'only on this device until you publish' : (live ? live.replace(/^https:\/\//, '') : null), ch.count ? () => publishFlow() : (live ? () => window.open(live, '_blank', 'noopener') : go('#preview')), ch.count ? 'is-todo' : 'is-done'),
      ].map((t) => h('div.ov-item', { role: 'listitem' }, t))),
    h('p.muted.small', 'Photos: every photo spot in the film (fan art is counted apart, in its own chapter). Nothing on this page is published.'));
}
