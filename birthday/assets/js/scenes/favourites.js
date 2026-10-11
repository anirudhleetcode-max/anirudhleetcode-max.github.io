// Chapter: "What Makes You, You" — after "The Little Things", the golden thread finds a glowing
// little doorway into the rest of her favourite things, as one continuous 3D journey:
//   1. panipuri  — a street-food stall at dusk, a plate of pani puri, and a stylized 3D Deepu
//                  enjoying one (playful, bright)
//   2. manchuria — a wok, a sizzle, a glossy bowl of Manchurian, and the same stylized Deepu
//                  (warm, cosy, savoury)
//   3. nivin     — "Okay… imagine this.": one impossible photoshoot — an empty studio, a flash, and
//                  the owner's own finished fan-art image develops as a print marked "imagined · fan
//                  art". It plays only once that image exists (admin → Photos → Fan art): no face is
//                  ever generated or stylized here, so it can only show the identity-checked image.
//   4. reveal    — the camera pulls back: everything that makes her, her, on the golden thread
// These are playful fantasies of things she loves — never presented as real events or memories.
// Each movement can be switched off in the admin (Theme). Words: messages.json → "favourites".
// Engine: ./little/shell.js (movement contract in ./little/kit.js; the character in ./little/figure.js).
import { createChapter } from './little/shell.js';
import { fanArtOf, devFanArt } from './little/kit.js';

export const MOVEMENTS = [
  { id: 'panipuri', toggle: 'panipuri', label: 'Pani puri: a playful 3D street-food scene', load: () => import('./little/panipuri.js') },
  { id: 'manchuria', toggle: 'manchuria', label: 'Manchuria: a warm 3D comfort-food scene', load: () => import('./little/manchuria.js') },
  { id: 'nivin', toggle: 'nivin', available: (ctx) => fanArtOf(ctx).length > 0 || devFanArt(), label: 'One impossible photoshoot: imagined fan art of Deepu and Nivin Pauly, printed as a fan-art photograph (a birthday fantasy, not a real photo)', load: () => import('./little/nivin.js') },
  { id: 'reveal', label: 'All the little things that make her, her, joined by the golden thread', load: () => import('./little/reveal.js') },
];

export const DEFAULT_TEXT = {
  kicker: 'Chapter Nine',
  title: 'What Makes You, You',
  panipuriLines: ['Some things don’t need an explanation.'],
  manchuriaLines: [],
  nivinIntro: ['Okay… imagine this.'],
  nivinLines: ['One impossible photoshoot.'],
  nivinAfter: ['Okay, this one had to exist.'],
  photoCaption: 'a little birthday fantasy',
  revealLines: ['It’s the little things that make a person who they are.', 'And I remember every one of them.'],
  continue: 'Keep going',
};

export default createChapter({
  id: 'favourites',
  title: 'What Makes You, You',
  text: DEFAULT_TEXT,
  optional: ['photoCaption'],
  movements: MOVEMENTS,
  // everything she loves, gathered on the thread, leads on to the twenty candles
  next: { x: 0.5, y: 0.35, kind: 'dust' },
});
