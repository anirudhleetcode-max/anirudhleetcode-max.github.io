/**
 * KEEPSAKE BOX — the little rooms she can open after the film (credits → “The keepsake box”). One card per
 * room: whether it plays (and if not, why), an on/off switch, and its words. A room that needs your own
 * words (the appreciation wall, the shy note…) stays out of her box until you write it; the rooms with
 * built-in words play from the start, and every one of those words is yours to rewrite.
 * Switches: settings.json → settings.keepsakes. Words: messages.json, one group per room.
 */
import { KEEPSAKE_ROOMS, roomState } from '../../assets/js/shared/keepsakes.js';
import { state, change } from '../state.js';
import { plural } from '../util.js';
import { h, icon, switchField } from '../ui.js';
import { openPreview } from '../photos.js';
import { sectionHead, panel, note } from './common.js';
import { groupEl, showGroup } from './messages.js';

/** What a room's state means, in words (also used by Overview). */
export function roomStatusText(st) {
  if (st.plays) return 'In her box';
  return {
    off: 'Switched off',
    'box-off': 'The whole box is switched off',
    empty: 'Hidden until you write it',
    'needs-memories': 'Waiting for a memory with words (How it began)',
    'needs-photos': 'Waiting for a photo',
    'needs-voice': 'Waiting for a voice note (Audio)',
    'needs-content': 'Needs more to ask about: two or more memories with words, and photos linked to them',
  }[st.why] || 'Not in her box';
}

const setSwitch = (key, on) => change((s) => {
  const k = s.settings.keepsakes && typeof s.settings.keepsakes === 'object' && !Array.isArray(s.settings.keepsakes) ? s.settings.keepsakes : (s.settings.keepsakes = {});
  if (on) delete k[key]; else k[key] = false;
  if (!Object.keys(k).length) delete s.settings.keepsakes;
}, { render: false });

export function renderKeepsakes() {
  const site = state.site;
  const sw = (site.settings && site.settings.keepsakes) || {};
  const boxOnNow = sw.box !== false;
  const badges = new Map();
  const paintBadges = () => {
    for (const r of KEEPSAKE_ROOMS) {
      const b = badges.get(r.id);
      if (!b) continue;
      const st = roomState(state.site, r.id);
      b.textContent = roomStatusText(st);
      b.className = `badge ks-state ${st.plays ? 'is-on' : st.why === 'off' || st.why === 'box-off' ? 'is-off' : 'is-wait'}`;
    }
    const n = KEEPSAKE_ROOMS.filter((r) => roomState(state.site, r.id).plays).length;
    count.textContent = boxOnNow ? `${plural(n, 'room')} in her box right now` : 'The box is switched off';
  };
  const count = h('p.ks-admin-count', { role: 'status' });

  const master = switchField({
    label: 'Show the Keepsake Box', checked: boxOnNow,
    hint: 'The box opens from the end of the film (the credits), and from the invitation and the chapters list once she has seen the film. Off: no box anywhere.',
    onchange: (v) => { setSwitch('box', v); renderAgain(); },
  });
  const rooms = KEEPSAKE_ROOMS.map((r) => {
    const badge = h('span.badge.ks-state');
    badges.set(r.id, badge);
    const on = sw[r.id] !== false;
    const toggle = switchField({
      label: 'In the box', checked: on, disabled: !boxOnNow, ariaLabel: `${r.title}: in the box`,
      onchange: (v) => { setSwitch(r.id, v); paintBadges(); },
    });
    toggle.classList.add('ks-room-switch');
    const words = groupEl(r.id);
    return h('li.ks-admin-room', { dataset: { room: r.id } },
      h('div.ks-admin-top',
        h('div.ks-admin-titles', h('h3.ks-admin-title', r.title), h('p.muted.small', r.line), badge),
        toggle),
      words,
      h('div.ks-admin-actions',
        r.needs === 'memories' || r.needs === 'quiz' ? h('button.btn.sm.quiet', { type: 'button', onclick: () => showGroup('story') }, icon('quote'), 'Your memories') : null,
        h('button.btn.sm.ghost', { type: 'button', dataset: { preview: r.id }, onclick: () => openPreview('credits', { box: r.id }), 'aria-label': `Preview ${r.title}` }, icon('eye'), 'Preview this room')));
  });
  const root = h('div.keepsakes',
    sectionHead('Keepsake Box', 'Little rooms after the film', 'Things she can open whenever she likes. Nothing in them is made up: a room that needs your words waits until you write them. Changes save to your draft as you type; publish to put them on the site.',
      h('div.head-actions', h('button.btn.sm.ghost', { type: 'button', onclick: () => openPreview('credits', { box: '' }) }, icon('eye'), 'Preview the box'))),
    panel('The box', { icon: 'sparkle', hint: 'Its own words, and the switch for the whole box.' }, master, count, groupEl('box')),
    note('Like everything you publish, these words are in the site’s public files. Her wish in the lantern room is the exception: it never leaves her screen.'),
    h('ol.ks-admin-list', rooms));
  // the badges follow the words as they are typed (a room appears once its first card is written)
  let t = 0;
  root.addEventListener('input', () => { clearTimeout(t); t = setTimeout(paintBadges, 250); });
  root.addEventListener('change', () => { clearTimeout(t); t = setTimeout(paintBadges, 50); });
  root.addEventListener('click', (e) => { if (e.target.closest('.obj-list, .row-tools, .pick-photos, .add-btn')) { clearTimeout(t); t = setTimeout(paintBadges, 300); } });
  paintBadges();
  function renderAgain() {
    const fresh = renderKeepsakes();
    root.replaceWith(fresh);
  }
  return root;
}
