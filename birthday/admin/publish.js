/**
 * publish.js — validation, PUBLISH (one commit), EXPORT (.zip), RESET, and connecting GitHub.
 *
 * Publish = ONE commit with: data/settings.json, data/messages.json, data/photos.json
 * (split(), only files whose content changed), every new image/media blob, and the
 * deletion of files under photos/ or media/ that the content no longer uses and that exist
 * in the repo. A conflicting update (409/422) → re-read, 3-way merge, retry once.
 */
import { FILES, split, combine, usedFiles, validate, malformedErrors, PHOTO_CHAPTERS } from '../assets/js/shared/model.js';
import {
  state, changes, flushSave, resetDraft, readDraft, client, connectAndFetch, adoptBase, storeToken, clearToken, tokenPlace, liveUrl, rerender, refreshChrome, globalStrength, noteLastPublish,
} from './state.js';
import { clone, deepEqual, mergeSites, isManagedPath, plural, formatBytes, stamp } from './util.js';
import { jsonText } from './github.js';
import { zipBlob } from './zip.js';
import { h, icon, toast, openSheet, confirmDialog, progressSheet, switchField, single } from './ui.js';
import { SCHEMA as MESSAGE_GROUPS, KEEPSAKE_GROUPS, showGroup } from './sections/messages.js';

/* ---------------------------------------------------------------- validation */
/** model.validate + a few friendly extras. */
export function checks(site = state.site) {
  const v = validate(site);
  // the published files themselves may have a part of the wrong shape (edited by hand on GitHub)
  if (site === state.site && state.baseProblems && state.baseProblems.length) v.errors.push(...state.baseProblems);
  const warnings = [...v.warnings];
  const noAlt = (site.photos || []).filter((p) => p.src && p.enabled !== false && !p.alt && p.chapter !== 'fanart').length; // (the photoshoot doesn't use alt text)
  if (noAlt) warnings.push({ message: `${plural(noAlt, 'photo')} without alt text (a short description helps screen readers).`, gentle: true });
  const big = [...state.files.entries()].filter(([, b]) => b.size > 25 * 1024 * 1024);
  for (const [p, b] of big) warnings.push({ message: `${p.split('/').pop()} is ${formatBytes(b.size)} — it may load slowly on phones.` });
  return { errors: v.errors, warnings, ok: v.errors.length === 0 };
}

/** Show the photo library filtered to one chapter. */
function openLibrary(chapter) {
  state.ui.filter = chapter;
  if (location.hash === '#library') rerender({ keepScroll: false });
  else location.hash = '#library';
}

export function checksPanel(site = state.site) {
  const c = checks(site);
  const photo = (id) => (id ? (site.photos || []).find((p) => p.id === id) : null);
  // where to fix it: a photo chapter, a photo (its chapter), or a Messages group (e.g. How it began)
  const target = (it) => {
    if (it.chapter && PHOTO_CHAPTERS.some((x) => x.id === it.chapter)) return () => openLibrary(it.chapter);
    const p = photo(it.id);
    if (p) return () => openLibrary(p.chapter);
    if (it.group && KEEPSAKE_GROUPS.has(it.group)) return () => { location.hash = '#keepsakes'; };
    if (it.group && MESSAGE_GROUPS[it.group]) return () => showGroup(it.group);
    return null;
  };
  const item = (it, kind) => {
    const go = target(it);
    return h(`li.check-item.${kind}`, icon(kind === 'error' ? 'warn' : 'info'),
      h('span', it.message),
      go ? h('button.link-btn', { type: 'button', onclick: go }, 'Open') : null);
  };
  return h('div.checks', { 'data-testid': 'checks' },
    c.errors.length
      ? h('div.check-group.errors', h('p.check-head', icon('warn'), `${plural(c.errors.length, 'problem')} to fix before publishing`), h('ul', c.errors.map((e) => item(e, 'error'))))
      : h('p.check-ok', icon('check'), 'Nothing blocks publishing.'),
    c.warnings.length
      ? h('div.check-group.warnings', h('p.check-head', icon('info'), `${plural(c.warnings.length, 'gentle reminder')} (these never block publishing)`), h('ul', c.warnings.map((w) => item(w, 'warning'))))
      : null);
}

export function changeList(ch) {
  return h('ul.change-list', ch.items.slice(0, 40).map((it) => h('li', h('span.change-dot', { 'aria-hidden': 'true' }), it.text)),
    ch.items.length > 40 ? h('li.muted', `…and ${ch.items.length - 40} more`) : null);
}

/* ---------------------------------------------------------------- publish */
export const publishFlow = single(async () => {
  await flushSave();
  const ch = changes();
  if (!ch.count && !state.files.size) { toast('Nothing new to publish — everything is already live. ✨'); return; }
  const c = checks();
  if (!c.ok) {
    const s = openSheet({
      kicker: 'Before publishing', title: 'A couple of things need fixing', size: 'md',
      content: [h('p.sheet-text', 'These would break the film, so publishing waits until they’re fixed. Your draft is safe.'), checksPanel()],
      actions: [h('button.btn.gold', { type: 'button', autofocus: true, onclick: () => s.close() }, 'OK')],
    });
    return;
  }
  if (state.conn.status !== 'ok' || !state.conn.token) {
    if (!state.conn.token) { showConnectSheet({ then: publishFlow }); return; }
    try {
      adoptBase(await connectAndFetch());
      rerender();
    } catch { showConnectSheet({ then: publishFlow }); return; }
  }
  const fresh = changes();
  const msg = h('input.input', { type: 'text', value: fresh.message, maxlength: '120', 'aria-label': 'Note for the history' });
  const bytes = [...state.files.values()].reduce((n, b) => n + b.size, 0);
  const s = openSheet({
    kicker: 'Publish', title: `Publish ${plural(fresh.count, 'change')}?`, size: 'md',
    content: [
      changeList(fresh),
      state.files.size ? h('p.muted.small', `${plural(state.files.size, 'new file')} to upload (${formatBytes(bytes)}).`) : null,
      c.warnings.length ? h('details.howto', h('summary', `${plural(c.warnings.length, 'gentle reminder')}`), checksPanel()) : null,
      h('details.howto', h('summary', 'Note for the history (optional)'), h('label.field', msg)),
      h('p.sheet-text', 'Everything goes live in one go. The site updates about 1–2 minutes after publishing.'),
    ],
    actions: [
      h('button.btn.ghost', { type: 'button', onclick: () => s.close(null) }, 'Not yet'),
      h('button.btn.gold', { type: 'button', autofocus: true, 'data-testid': 'publish-now', onclick: () => s.close('go') }, icon('send'), 'Publish now'),
    ],
  });
  if ((await s.result) !== 'go') return;
  await doPublish(msg.value.trim() || fresh.message);
});

/**
 * After a publish: is it really live? The admin is served by the live site itself, so it reads the
 * site's own data files (no token needed) until they match what was just committed. Honest either way:
 * "Live", or (after LIVE_LIMIT) "not updated yet" with the place to look; and from anywhere else
 * (a local copy) it says it can't check rather than guessing. Keeps going if the sheet is closed.
 */
const LIVE_EVERY = 15000;
const LIVE_LIMIT = 12 * 60000;
let liveWatch = 0; // a newer publish retires the check of an older one (it can never report a false problem)
export async function watchLive(expect, el, { every = LIVE_EVERY, limit = LIVE_LIMIT } = {}) {
  const mine = ++liveWatch;
  const current = () => mine === liveWatch;
  const live = liveUrl();
  const base = state.liveBase || (live && location.href.startsWith(live) ? live : '');
  const say = (text, kind) => { el.textContent = text; el.dataset.state = kind; };
  if (!base) { say('This page can’t check the live site from here. Open it in a few minutes to see your changes.', 'unknown'); return 'unknown'; }
  say('Checking the live site…', 'waiting');
  const t0 = Date.now();
  // compared as the film reads them (normalized), so a file this publish didn't touch never looks "old"
  const matches = async () => {
    const got = {};
    for (const [k, file] of Object.entries(FILES)) {
      const res = await fetch(`${base}${file}?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return false;
      got[k] = await res.json();
    }
    const now = split(combine(got));
    return Object.keys(FILES).every((k) => deepEqual(now[k], expect[k]));
  };
  for (;;) {
    let okNow = false;
    try { okNow = await matches(); } catch { okNow = false; }
    if (!current()) { say('A newer publish is being checked instead.', 'superseded'); return 'superseded'; }
    if (okNow) {
      say('Live ✓ The site now shows your changes.', 'live');
      if (!el.isConnected) toast('Your changes are live on the site ✓', { type: 'success' });
      return 'live';
    }
    if (Date.now() - t0 >= limit) {
      const { owner, repo } = state.repo;
      say('The live site hasn’t updated yet. Its build may have stopped on a problem: check the Actions page of the repository.', 'late');
      if (owner && repo) el.append(' ', h('a', { href: `https://github.com/${owner}/${repo}/actions`, target: '_blank', rel: 'noopener' }, 'Open Actions'));
      if (!el.isConnected) toast('The live site hasn’t updated yet: check the repository’s Actions page.', { type: 'error' });
      return 'late';
    }
    say('Waiting for the live site to update…', 'waiting');
    await new Promise((r) => setTimeout(r, every));
  }
}

/** Build the commit plan against what is on GitHub right now. Exported for tests. */
export function planPublish({ base, site, files, remote, existing }) {
  // files on GitHub with a part of the wrong shape (edited by hand) are never published over: the merge
  // would quietly empty that part (every photo, say) instead of keeping what is there
  const broken = malformedErrors(remote.site && remote.site.malformed);
  if (broken.length) throw new Error(`The site’s files on GitHub need fixing first: ${broken.map((e) => e.message.split(',')[0]).join('; ')}. Nothing was published; your draft is safe.`);
  const remoteChanged = !deepEqual(remote.site, base);
  const merged = remoteChanged ? mergeSites(base, site, remote.site) : clone(site);
  const after = validate(merged);
  if (after.errors.length) throw new Error(`Combined with the latest changes on GitHub, this would break the film: ${after.errors[0].message} Nothing was published; your draft is safe.`);
  const refs = usedFiles(merged);
  const remoteRefs = usedFiles(remote.site);
  const upload = new Map();
  for (const [p, b] of files) if (refs.has(p)) upload.set(p, b);
  const missing = [...refs].filter((p) => !upload.has(p) && !existing.has(p) && !remoteRefs.has(p) && isManagedPath(p));
  if (missing.length) {
    throw new Error(`Some new files in your draft are missing on this device (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}). Please upload those photos again, then publish.`);
  }
  const candidates = new Set([...usedFiles(base), ...remoteRefs]);
  const deletes = [...candidates].filter((p) => !refs.has(p) && isManagedPath(p) && existing.has(p));
  const next = split(merged);
  const prev = remote.legacy ? null : split(remote.site);
  const json = {};
  for (const k of Object.keys(FILES)) {
    // only files whose CONTENT changed (formatting-only differences are left alone) — and any of
    // the three that is missing from the repo, because the film needs all three to load
    const missingInRepo = existing && !existing.has(FILES[k]);
    if (missingInRepo || !(prev && deepEqual(next[k], prev[k]))) json[FILES[k]] = next[k];
  }
  return { site: combine(next), json, files: upload, deletes };
}

async function doPublish(message) {
  await flushSave();
  const count = changes().count;
  const prog = progressSheet({ kicker: 'Publishing', title: 'Sending your changes to the site…' });
  const gh = client();
  const myBase = state.base;
  const mySite = state.site;
  const myFiles = new Map(state.files);
  try {
    const res = await gh.publish({
      message,
      onProgress: (f, label) => prog.set(f, label),
      prepare: (remote, existing) => planPublish({ base: myBase, site: mySite, files: myFiles, remote, existing }),
    });
    for (const p of res.uploaded) { const b = myFiles.get(p); if (b) state.sessionBlobs.set(p, b); }
    state.base = clone(res.site);
    state.site = clone(res.site);
    state.files = new Map();
    state.filesDirty = true;
    await resetDraft();
    prog.close();
    rerender();
    refreshChrome();
    const live = liveUrl();
    const liveStatus = h('p.live-status.small.center', { role: 'status', 'data-testid': 'live-status' });
    const done = openSheet({
      kicker: 'Done', title: 'Published! ✨', size: 'sm',
      content: [
        h('div.success-orb', { 'aria-hidden': 'true' }, icon('lantern')),
        h('p.sheet-text.center', 'Your changes are saved in the site’s repository. The live site rebuilds next (usually 1–3 minutes).'),
        liveStatus,
        res.retried ? h('p.muted.small.center', 'Someone else changed the site at the same moment — both sets of changes were kept.') : null,
        res.deleted.length ? h('p.muted.small.center', `${plural(res.deleted.length, 'old file')} tidied away.`) : null,
      ],
      actions: [
        live ? h('a.btn.ghost', { href: live, target: '_blank', rel: 'noopener' }, icon('external'), 'Open the live site') : null,
        h('button.btn.gold', { type: 'button', autofocus: true, onclick: () => done.close() }, 'Lovely'),
      ].filter(Boolean),
    });
    noteLastPublish({ at: Date.now(), count, live: 'waiting' });
    watchLive(split(res.site), liveStatus).then((r) => { if (r !== 'superseded') noteLastPublish({ live: r, checkedAt: Date.now() }); }).catch(() => {});
  } catch (err) {
    console.error('[admin] publish failed', err);
    prog.close();
    if (err.status === 401) { state.conn.status = 'error'; state.conn.message = err.message; refreshChrome(); }
    const s = openSheet({
      kicker: 'Not published', title: 'That didn’t work', size: 'sm',
      content: [h('p.sheet-text', err.message || String(err)), h('p.muted.small', 'Your draft is safe on this device — nothing was lost.')],
      actions: [
        err.status === 401 || err.status === 403 || err.status === 404
          ? h('button.btn.ghost', { type: 'button', onclick: () => { s.close(); showConnectSheet({}); } }, icon('key'), 'Check token')
          : null,
        h('button.btn.gold', { type: 'button', onclick: () => { s.close(); publishFlow(); } }, 'Try again'),
      ].filter(Boolean),
    });
  }
}

/* ---------------------------------------------------------------- export */
/** Full-size originals never go in with the site files: they are private (scripts/build.mjs keeps them off the site too). */
export const KEEP_PRIVATE = 'keep-private/';
const KEEP_PRIVATE_NOTE = `These are the full-size originals of the photos you added. They are private: never upload
this folder (or photos/originals/) to a web host.

To keep re-cropping from them in the admin, move the photos/originals folder in here into
photos/originals/ of your copy of the repository. The build (node scripts/build.mjs) leaves that
folder out of the site it makes in dist/, and dist/ is the folder to host.
`;

export const exportZip = single(async () => {
  await flushSave();
  const parts = split(state.site);
  const refs = usedFiles(state.site);
  const entries = Object.keys(FILES).map((k) => ({ name: FILES[k], data: jsonText(parts[k]) }));
  let originals = 0;
  for (const [p, b] of state.files) {
    if (!refs.has(p)) continue;
    const priv = /^photos\/originals\//.test(p);
    if (priv) originals++;
    entries.push({ name: priv ? `${KEEP_PRIVATE}${p}` : p, blob: b });
  }
  if (originals) entries.push({ name: `${KEEP_PRIVATE}README.txt`, data: KEEP_PRIVATE_NOTE });
  let blob;
  try {
    blob = await zipBlob(entries);
  } catch (err) {
    console.warn('[admin] export failed', err);
    toast(`Couldn’t make the .zip: ${err.message || err}. Nothing was downloaded.`, { type: 'error' });
    return null;
  }
  const name = `lantern-room-${stamp()}.zip`;
  const a = h('a', { href: URL.createObjectURL(blob), download: name, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  const newFiles = entries.length - 3 - (originals ? originals + 1 : 0);
  toast(`Downloaded ${name}: the three content files${newFiles ? ` + ${plural(newFiles, 'new file')}` : ''}${originals ? `, with the full-size originals apart in ${KEEP_PRIVATE} (private: never host them)` : ''}. To host the site yourself, unzip it into your copy of the repository${originals ? `, move ${KEEP_PRIVATE}photos/originals/* back into photos/originals/ (the build needs them and leaves them off the site)` : ''}, then host the dist/ folder that “node scripts/build.mjs” makes, not the unzipped files.`, { type: 'success', duration: 12000 });
  return { name, size: blob.size, entries: entries.map((e) => e.name) };
});

/* ---------------------------------------------------------------- reset */
export const resetFlow = single(async () => {
  const ch = changes();
  if (!ch.count && !state.files.size) { toast('There are no unpublished changes to reset.'); return; }
  const ok = await confirmDialog({
    kicker: 'Reset changes',
    title: 'Discard all unpublished changes?',
    message: `${plural(ch.count, 'change')} saved on this device will be deleted and everything goes back to what’s live now. This can’t be undone.`,
    confirm: 'Discard changes', danger: true,
  });
  if (!ok) return;
  const cleared = await resetDraft();
  rerender();
  refreshChrome();
  if (cleared) toast('Draft discarded — you’re back to the published version.');
  else toast('You’re back to the published version here, but the copy saved on this device couldn’t be deleted, so it may be offered again next time. Choose “Discard” then.', { type: 'error' });
});

/* ---------------------------------------------------------------- connect */
export function showConnectSheet({ firstRun = false, then = null } = {}) {
  // (password managers are asked not to save it: it is a key to the repository, not a password)
  const tokenInput = h('input.input.mono#gh-token', { type: 'password', placeholder: 'github_pat_…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', value: '', 'data-1p-ignore': 'true', 'data-lpignore': 'true', 'data-bwignore': 'true', 'data-form-type': 'other' });
  const showBtn = h('button.link-btn', { type: 'button', 'aria-controls': 'gh-token', onclick: () => { tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password'; showBtn.textContent = tokenInput.type === 'password' ? 'Show' : 'Hide'; } }, 'Show');
  const err = h('p.form-error', { role: 'alert', hidden: true });
  const repoName = `${state.repo.owner}/${state.repo.repo}`;
  const steps = h('details.howto', { open: firstRun },
    h('summary', 'How to get a token (2 minutes)'),
    h('ol.steps',
      h('li', 'On ', h('b', 'github.com'), ' (signed in as ', h('b', state.repo.owner), '), open ', h('b', 'Settings → Developer settings → Personal access tokens → Fine-grained tokens'), ' → ', h('b', 'Generate new token'), '. ',
        h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'Open it directly ↗')),
      h('li', 'Name it “Lantern Room”. Set the expiration to after her birthday (e.g. 120 days).'),
      h('li', 'Repository access → ', h('b', 'Only select repositories'), ' → choose ', h('b', state.repo.repo), '.'),
      h('li', 'Repository permissions → ', h('b', 'Contents'), ' → ', h('b', 'Read and write'), '. (Leave everything else as is.)'),
      h('li', 'Tap ', h('b', 'Generate token'), ', copy it (it starts with ', h('code', 'github_pat_'), ') and paste it below.')));
  const remember = switchField({
    label: 'Remember on this device', checked: tokenPlace() !== 'tab',
    hint: 'Off: the token is forgotten when you close this tab — best on a shared or borrowed device.',
  });
  remember.control.setAttribute('data-testid', 'remember-token');
  const connectBtn = h('button.btn.gold', { type: 'button', 'data-testid': 'connect' }, icon('key'), h('span', 'Connect'));
  const s = openSheet({
    key: 'connect',
    kicker: firstRun ? 'Welcome to the Lantern Room' : 'GitHub',
    title: firstRun ? 'Connect once, publish anytime' : 'Connect to GitHub',
    size: 'md',
    content: [
      h('p.sheet-text', 'To publish, this page needs a GitHub key (a “token”) that can update ', h('b', repoName), '. You only do this once on each device. You can look around and save drafts without it.'),
      steps,
      h('div.field', h('div.field-top', h('label.field-label', { for: 'gh-token' }, 'Paste your token'), showBtn), tokenInput),
      err,
      remember,
      h('p.muted.small', 'The token stays in this browser only — it is never put into the site, your drafts or an export, and it is only ever sent to GitHub. Publishing goes to ', h('b', `${repoName} · ${state.repo.branch}`), ' (change this in Settings → GitHub).'),
    ],
    actions: [
      h('button.btn.ghost', { type: 'button', onclick: () => s.close(null) }, firstRun ? 'Just look around' : 'Cancel'),
      connectBtn,
    ],
  });
  if (s.el.querySelector('#gh-token') !== tokenInput) return; // already open (double tap) — keep that one
  const go = async () => {
    if (connectBtn.disabled) return; // Enter pressed twice → one check, one “then”
    const t = tokenInput.value.trim();
    if (!t) { err.textContent = 'Paste the token first.'; err.hidden = false; tokenInput.focus(); return; }
    connectBtn.disabled = true;
    connectBtn.lastChild.textContent = 'Checking…';
    err.hidden = true;
    const prev = state.conn.token;
    state.conn.token = t;
    try {
      const remote = await connectAndFetch();
      storeToken(t, { remember: remember.control.checked });
      s.close('ok');
      adoptBase(remote);
      state.source = 'github';
      rerender();
      refreshChrome();
      if (state.conn.info && state.conn.info.canPush === false) {
        // it can read the site but not change it: say so now, not at the first failed publish
        toast('Connected, but this token can only read. To publish, create one with Repository permissions → Contents: Read and write (Settings → GitHub → Change token).', { type: 'error', duration: 12000 });
        return;
      }
      toast('Connected to GitHub. You can publish now. ✨', { type: 'success' });
      if (then) then();
    } catch (e) {
      state.conn.token = prev;
      if (!prev) state.conn.status = 'none';
      refreshChrome();
      err.textContent = e.message || String(e);
      err.hidden = false;
      connectBtn.disabled = false;
      connectBtn.lastChild.textContent = 'Connect';
    }
  };
  connectBtn.addEventListener('click', go);
  tokenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
}

export async function reconnect() {
  if (!state.conn.token) { showConnectSheet({}); return; }
  try {
    adoptBase(await connectAndFetch());
    state.source = 'github';
    toast('Connected. ✨', { type: 'success' });
  } catch (err) {
    toast(err.message || String(err), { type: 'error' });
  }
  rerender();
  refreshChrome();
}

export async function forgetToken() {
  clearToken();
  state.conn = { status: 'none', message: '', token: '', info: null };
  refreshChrome();
  rerender();
  // on a shared or borrowed device the unpublished draft (your words, new photos) would stay behind too
  const unpublished = changes().count > 0 || state.files.size > 0 || !!(await readDraft());
  if (unpublished) {
    const also = await confirmDialog({
      kicker: 'Token forgotten', title: 'Also remove your draft from this device?',
      message: 'Your unpublished changes (your words and any new photos) are still saved in this browser. On a shared or borrowed device, remove them too. On your own device, keep them: they stay until you publish.',
      confirm: 'Remove the draft', cancel: 'Keep it', danger: true,
    });
    if (also) {
      const cleared = await resetDraft();
      rerender();
      refreshChrome();
      toast(cleared ? 'Token and draft removed from this device.' : 'Token forgotten. The draft couldn’t be removed from this browser’s storage: clear the site data in the browser settings.', { type: cleared ? 'success' : 'error' });
      return;
    }
  }
  toast('Token forgotten on this device.');
}


export { globalStrength };
