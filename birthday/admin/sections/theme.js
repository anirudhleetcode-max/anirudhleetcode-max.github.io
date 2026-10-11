/** THEME — film grain, particles, the golden ribbon, its glow, calmer motion, and the scenes of “The Little Things” and “What Makes You, You” (settings.theme). */
import { state, change } from '../state.js';
import { h, icon, sliderField, switchField } from '../ui.js';
import { openPreview } from '../photos.js';
import { sectionHead, panel } from './common.js';

export function renderTheme() {
  const t = state.site.settings.theme;
  const sample = h('div.theme-sample', { 'aria-hidden': 'true' },
    h('div.ts-sky'), h('div.ts-particles'), h('div.ts-ribbon'), h('div.ts-grain'),
    h('p.ts-title', 'Happy Birthday'));
  const paint = () => {
    sample.style.setProperty('--grain', String(0.18 * t.grain));
    sample.style.setProperty('--particles', String(Math.max(0, Math.min(1.5, t.particles))));
    sample.classList.toggle('no-ribbon', t.ribbon === false);
    sample.style.setProperty('--thread', String(t.threadGlow ?? 1));
  };
  paint();
  const grain = sliderField({
    label: 'Film grain', min: 0, max: 1, step: 0.05, value: t.grain, format: (v) => (v === 0 ? 'Off' : `${Math.round(v * 100)}%`), ends: ['Clean', 'Filmic'],
    hint: 'A very subtle moving texture over everything, like real film. 60% is the intended look.',
    oninput: (v) => { change((s) => { s.settings.theme.grain = Math.round(v * 100) / 100; }, { render: false }); paint(); },
  });
  const particles = sliderField({
    label: 'Golden dust', min: 0.3, max: 1.5, step: 0.05, value: t.particles, format: (v) => `${Math.round(v * 100)}%`, ends: ['Calm', 'Lavish'],
    hint: 'How much fine golden dust floats through the film. Older phones automatically use less.',
    oninput: (v) => { change((s) => { s.settings.theme.particles = Math.round(v * 100) / 100; }, { render: false }); paint(); },
  });
  const ribbon = switchField({
    label: 'Golden ribbon', checked: t.ribbon !== false,
    hint: 'The film’s signature thread of light (inspired by her long hair) that links chapters and memories. Switch off for a simpler look.',
    onchange: (v) => { change((s) => { s.settings.theme.ribbon = v; }, { render: false }); paint(); },
  });
  const threadGlow = sliderField({
    label: 'Golden thread glow', min: 0.5, max: 1.5, step: 0.05, value: t.threadGlow ?? 1, format: (v) => `${Math.round(v * 100)}%`, ends: ['Delicate', 'Radiant'],
    hint: 'How brightly the golden thread glows wherever it appears. 100% is the intended look.',
    oninput: (v) => { change((s) => { s.settings.theme.threadGlow = Math.round(v * 100) / 100; }, { render: false }); paint(); },
  });
  const calm = switchField({
    label: 'Calmer animation', checked: t.calm === true,
    hint: 'Less movement everywhere (gentler transitions, no camera drift), the same as a phone’s “reduce motion” setting. Off is the intended look.',
    onchange: (v) => { change((s) => { s.settings.theme.calm = v; }, { render: false }); },
  });
  // the three movements of “The Little Things”, then the three scenes of “What Makes You, You”
  // (each one can be skipped on its own; on unless switched off)
  const little = [
    ['keychains', 'Keychains scene', 'The cute keyring of little things in “The Little Things”.'],
    ['sprite', 'Sprite scene', 'The fizzy green bottle (with its little handwritten tag) in “The Little Things”.'],
    ['twinklingWatermelon', 'Twinkling Watermelon scene', 'The night street of music and memories that ends “The Little Things”.'],
    ['panipuri', 'Pani puri scene', 'A playful street-food stall at dusk in “What Makes You, You”.'],
    ['manchuria', 'Manchuria scene', 'A warm, sizzling wok and a bowl of Manchurian in “What Makes You, You”.'],
    ['nivin', 'Fan-art photoshoot scene', 'A clearly fictional fan-art fantasy: one impossible photoshoot with her favourite actor, printed as “imagined · fan art”. It plays only with your own finished fan-art image (Photos → Fan art); until then it is skipped.'],
  ].map(([key, label, hint]) => switchField({
    label, checked: t[key] !== false, hint,
    onchange: (v) => { change((s) => { s.settings.theme[key] = v; }, { render: false }); },
  }));
  return h('div.theme',
    sectionHead('Theme', 'The film’s finish', 'Small touches that apply to the whole film. Preview to feel the difference.'),
    h('div.theme-grid',
      panel('Look & feel', { icon: 'palette' }, grain, particles, ribbon, threadGlow, calm, ...little,
        h('button.btn.sm.ghost', { type: 'button', onclick: () => openPreview('lanterns') }, icon('eye'), 'Preview the lanterns')),
      h('figure.theme-figure', sample, h('figcaption', 'A rough impression — the real film is richer.'))));
}
