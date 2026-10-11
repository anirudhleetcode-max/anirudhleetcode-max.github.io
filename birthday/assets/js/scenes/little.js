// Chapter: "The Little Things" — three of the little things she loves, as one continuous 3D
// journey on the golden thread:
//   1. keychains — a keyring of cute charms swinging in warm light (her cute side)
//   2. sprite    — a cold, fizzy green bottle and a sky of bubbles (her playful side)
//   3. night     — a warm night street of music and memories, inspired by the feeling of
//                  Twinkling Watermelon (youth, friendship, music, time) — her nostalgic side —
//                  where the golden thread joins up the owner's real memories.
// Each movement can be switched off in the admin (Theme). Words: messages.json → "little".
// Engine: ./little/shell.js (one renderer, one loop, everything warmed up while the card plays);
// movement contract at the top of ./little/kit.js.
import { createChapter, enabledMovements as enabledOf } from './little/shell.js';

export const MOVEMENTS = [
  { id: 'keychains', toggle: 'keychains', label: 'Keychains: a keyring of cute charms swinging on the golden thread', load: () => import('./little/keychains.js') },
  { id: 'sprite', toggle: 'sprite', label: 'A cold, fizzy green bottle in a sky of bubbles', load: () => import('./little/fizz.js') },
  { id: 'night', toggle: 'twinklingWatermelon', label: 'A warm night street of music and memories, joined by the golden thread', load: () => import('./little/night.js') },
];

/** Which movements play (admin → Theme switches; all on unless switched off). */
export function enabledMovements(settings) {
  return enabledOf(settings, MOVEMENTS);
}

export const DEFAULT_TEXT = {
  kicker: 'Chapter Eight',
  title: 'The Little Things',
  keychainLines: ['It’s always the little things…', 'The things that quietly become part of you.'],
  spriteLines: ['Of course I remembered this one.'],
  spriteTag: 'sprite',
  nightLines: ['Maybe that’s what makes memories special.', 'They start as ordinary days.', 'And turn into the moments we never want to forget.'],
  cassette: 'twinkling watermelon',
  continue: 'Keep going',
};

export default createChapter({
  id: 'little',
  title: 'The Little Things',
  text: DEFAULT_TEXT,
  optional: ['spriteTag', 'cassette'],
  movements: MOVEMENTS,
  // the golden thread carries on into the next chapter
  next: { x: 0.5, y: 0.3, kind: 'dust' },
});
