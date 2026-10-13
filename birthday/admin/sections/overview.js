/**
 * OVERVIEW — the whole film at a glance: what is done and what is left, each tile one tap from the
 * place to change it. Every number is counted from the draft as it is now (nothing estimated), and
 * nothing here is ever published.
 */
import { FILM_CHAPTERS, PERSONAL_FIELDS, FILES, personalValues, personalGaps, memoriesOf, validate, photosFor, metCards, shows, split, combine } from '../../assets/js/shared/model.js';
import { KEEPSAKE_ROOMS, roomState } from '../../assets/js/shared/keepsakes.js';
import { state, changes, liveUrl, lastPublish } from '../state.js';
import { plural, deepEqual, timeAgo } from '../util.js';
import { h, icon } from '../ui.js';
import { publishFlow, checks } from '../publish.js';
import { showGroup } from './messages.js';
import { sectionHead, panel } from './common.js';
import { roomStatusText } from './keepsakes.js';

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

/**
 * Content readiness: what is really published, what is only a draft on this device, what is still empty,
 * what is not set up, and what is wrong — each line from the draft and the published copy as they are now
 * (exported for tests). Nothing is guessed: the live site is only called “up to date” after reading it.
 */
export function readiness(site, base) {
  const out = {};
  const memories = memoriesOf(site);
  out.emptyMemories = memories.filter((m) => !shows(site, m.text) && !(site.photos || []).some((p) => p.memory === m.id && p.src)).length;
  const cards = site.text && site.text.met && Array.isArray(site.text.met.cards) ? site.text.met.cards : [];
  out.metCards = metCards(site).length;
  out.metEmpty = cards.length - out.metCards;
  out.letterEmpty = personalGaps(site).empty.filter((f) => !f.optional).map((f) => f.label);
  out.placeholders = personalGaps(site).leftovers.length;
  out.rooms = KEEPSAKE_ROOMS.map((r) => ({ id: r.id, title: r.title, ...roomState(site, r.id) }));
  out.unset = out.rooms.filter((r) => !r.plays && r.why !== 'off' && r.why !== 'box-off');
  const live = (site.photos || []).filter((p) => p.enabled !== false && p.chapter !== 'fanart');
  out.emptySpots = live.filter((p) => !p.src).length;
  out.noAlt = live.filter((p) => p.src && !String(p.alt || '').trim()).length;
  out.noCaption = live.filter((p) => p.src && !String(p.caption || '').trim()).length;
  const c = checks(site);
  out.errors = c.errors;
  out.warnings = c.warnings;
  out.photoErrors = c.errors.filter((e) => e.id).length;
  out.publishedMemories = base ? memoriesOf(base).length : null;
  out.publishedPhotos = base ? (base.photos || []).filter((p) => p.src && p.chapter !== 'fanart').length : null;
  out.draftPhotos = live.filter((p) => p.src).length;
  return out;
}

/** The live site's three data files, compared with the published copy (as the film reads them). */
async function liveMatches(base) {
  const live = liveUrl();
  const root = state.liveBase || (live && location.href.startsWith(live) ? live : '');
  if (!root) return { state: 'unknown', text: 'This page can’t read the live site from here (open the admin on the live site to check).' };
  // without GitHub, “published” IS the live site's own copy (that is where the admin read it): comparing the two
  // would always agree, so say what is really known
  if (state.conn.status !== 'ok') return { state: 'unknown', text: 'Not connected to GitHub, so the admin read the live site’s own files: they are what she sees now. To check that a publish has reached the live site, connect GitHub (Settings) — or publish, and this page checks it for you.' };
  try {
    const got = {};
    for (const [k, file] of Object.entries(FILES)) {
      const res = await fetch(`${root}${file}?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return { state: 'error', text: `The live site didn’t answer for ${file} (HTTP ${res.status}).` };
      got[k] = await res.json();
    }
    const now = split(combine(got));
    const want = split(base);
    const same = Object.keys(FILES).every((k) => deepEqual(now[k], want[k]));
    return same
      ? { state: 'live', text: 'The live site shows exactly what is published ✓' }
      : { state: 'late', text: 'The live site still shows an older version. It usually catches up 1–3 minutes after a publish; if it doesn’t, its build may have stopped (check the repository’s Actions page).' };
  } catch {
    return { state: 'error', text: 'Couldn’t reach the live site just now (offline?). Try again in a moment.' };
  }
}

function readinessPanel() {
  const r = readiness(state.site, state.base);
  const ch = changes();
  const lp = lastPublish();
  const row = (kind, title, detail, actions = []) => h(`li.ready-row.is-${kind}`, icon(kind === 'ok' ? 'check' : kind === 'problem' ? 'warn' : 'info'),
    h('p.ready-title', title), detail ? h('div.ready-detail', detail) : null, actions.length ? h('div.ready-actions', actions) : null);
  const btn = (label, onclick, attrs = {}) => h('button.btn.sm.ghost', { type: 'button', onclick, ...attrs }, label);
  const liveOut = h('p.live-check', { role: 'status', 'data-testid': 'live-check' });
  const checkLive = async () => { liveOut.textContent = 'Reading the live site…'; liveOut.dataset.state = 'waiting'; const res = await liveMatches(state.base); liveOut.textContent = res.text; liveOut.dataset.state = res.state; };
  // on the live site itself the check is cheap (three small files): it runs at once
  const live = liveUrl();
  if (state.liveBase || (live && location.href.startsWith(live))) setTimeout(checkLive, 0);
  const lastText = !lp ? 'No publish recorded on this device yet.'
    : `${new Date(lp.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (${timeAgo(new Date(lp.at).toISOString())}) · ${plural(lp.count || 0, 'change')} · ${
      lp.live === 'live' ? 'confirmed on the live site ✓' : lp.live === 'late' ? 'the live site hadn’t updated when last checked' : lp.live === 'unknown' ? 'not checked (published from a page that can’t read the live site)' : 'not confirmed live yet'}`;
  const empties = [
    r.letterEmpty.length ? `Letter: ${r.letterEmpty.join(', ')} (their lines stay hidden)` : null,
    r.placeholders ? `${plural(r.placeholders, 'line')} still ${r.placeholders > 1 ? 'have' : 'has'} a [PLACEHOLDER] (hidden from her)` : null,
    r.emptyMemories ? `${plural(r.emptyMemories, 'memory', 'memories')} with no words and no photos (skipped)` : null,
    r.metEmpty > 0 ? `The day we met: ${plural(r.metEmpty, 'empty card')} (skipped)` : null,
  ].filter(Boolean);
  const unset = r.unset.map((x) => `${x.title}: ${roomStatusText(x).toLowerCase()}`);
  if (!r.metCards) unset.unshift('The day we met (chapter): not written yet, so the film skips it');
  if (!(state.site.media && state.site.media.voice)) unset.push('Voice note: none (optional)');
  if (!(state.site.media && state.site.media.video)) unset.push('Video message: none (optional)');
  const media = [
    r.emptySpots ? `${plural(r.emptySpots, 'empty photo spot')} (a soft placeholder shows)` : null,
    r.photoErrors ? `${plural(r.photoErrors, 'photo')} with a problem that blocks publishing` : null,
    r.noAlt ? `${plural(r.noAlt, 'photo')} without a description (alt text)` : null,
    r.noCaption ? `${plural(r.noCaption, 'photo')} without a caption (optional; captions show in the album and the scrapbook)` : null,
  ].filter(Boolean);
  const list = (items) => h('ul', items.map((x) => h('li', x)));
  return panel('Content readiness', { icon: 'check', className: 'ready', hint: 'Honest about where everything is: on this device only, published, or on the live site.' },
    h('ul.ready-list', { 'data-testid': 'readiness' },
      ch.count
        ? row('todo', `${plural(ch.count, 'unpublished change')} — only on this device`, 'She can’t see these until you publish. Your draft is saved here, so it survives closing the page.', [h('button.btn.sm.gold', { type: 'button', onclick: () => publishFlow() }, 'Publish…')])
        : row('ok', 'Your draft and the published site are the same', r.publishedMemories != null ? `Published: ${plural(r.publishedMemories, 'memory', 'memories')} · ${plural(r.publishedPhotos, 'photo')}.` : null),
      row(lp && lp.live === 'live' ? 'ok' : lp ? 'todo' : 'todo', 'Last publish', lastText),
      row('todo', 'The live site', liveOut, [btn('Check the live site now', checkLive, { 'data-testid': 'live-check-btn' })]),
      r.errors.length
        ? row('problem', `${plural(r.errors.length, 'problem')} blocking publishing`, list(r.errors.slice(0, 4).map((e) => e.message)), [btn('Open the checks', () => { location.hash = '#preview'; })])
        : row('ok', 'Nothing blocks publishing', r.warnings.length ? `${plural(r.warnings.length, 'gentle reminder')} (never blocking).` : null),
      empties.length ? row('todo', 'Still empty', list(empties), [btn('Your memories', () => showGroup('personal')), btn('How it began', () => showGroup('story'))]) : row('ok', 'Nothing left empty', null),
      unset.length ? row('todo', 'Optional, not set up yet', list(unset), [btn('Keepsake Box', () => { location.hash = '#keepsakes'; })]) : row('ok', 'Every optional part is set up', null),
      media.length ? row(r.photoErrors ? 'problem' : 'todo', 'Photos and media', list(media), [btn('Photo library', () => { location.hash = '#library'; })]) : row('ok', 'Photos and media look right', null)));
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
    readinessPanel(),
    h('p.muted.small', 'Photos: every photo spot in the film (fan art is counted apart, in its own chapter). Nothing on this page is published.'));
}
