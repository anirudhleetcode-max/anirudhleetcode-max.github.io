// The film's motion language, in one place: durations, eases, staggers and the per-mood presets
// the chapters choreograph with. CSS gets the same tokens as custom properties (main.css :root,
// --motion-* / --ease-*), so CSS and GSAP motion share one rhythm.
//
//   DUR      seconds — fast UI feedback → long, emotional holds
//   EASE     GSAP ease names; 'cine' (long, soft deceleration) and 'settle' (arrives, overshoots
//            ~1.5 %, settles — the weight of a card landing) are registered by registerEases()
//   STAGGER  seconds between siblings (letters, words, cards, lanterns)
//   MOOD     one preset per emotional register: how long, how eased, how far things travel
//
// Motion with a reason only: primary (the thread, the reveal) > secondary (cards settling) >
// ambient (dust). Reduced motion keeps every reveal and state change but shortens and stills it
// (rm()). See docs/ARCHITECTURE.md "Motion language".

export const DUR = {
  instant: 0.15,
  fast: 0.35,
  medium: 0.7,
  slow: 1.2,
  cinematic: 2.2,
  emotional: 3.4,
};

export const EASE = {
  out: 'power3.out',
  in: 'power2.in',
  inOut: 'power2.inOut',
  cine: 'cine',
  settle: 'settle',
  breath: 'sine.inOut',
  drift: 'drift',
};

export const STAGGER = {
  letters: 0.045,
  words: 0.075,
  cards: 0.12,
  lanterns: 0.35,
};

export const MOOD = {
  anticipation: { dur: 2.4, ease: 'sine.inOut', travel: 0.4 }, // slow, quiet, minimal
  discovery: { dur: 1.2, ease: 'cine', travel: 1 }, //           curious, a little quicker
  memory: { dur: 1.6, ease: 'power2.out', travel: 0.7 }, //      soft, organic
  magic: { dur: 1.8, ease: 'cine', travel: 1 }, //               flowing, luminous
  celebration: { dur: 0.9, ease: 'power3.out', travel: 1.2 }, // energetic, controlled
  ending: { dur: 3.2, ease: 'sine.inOut', travel: 0.3 }, //      slow, restrained, breathing
};

let registered = false;
/** Registers the film's custom eases with GSAP's CustomEase (once). */
export function registerEases(CustomEase) {
  if (registered || !CustomEase) return;
  registered = true;
  CustomEase.create('cine', 'M0,0 C0.16,0.84 0.3,1 1,1');
  CustomEase.create('settle', 'M0,0 C0.2,0.86 0.34,1.03 0.52,1.015 0.7,1.002 0.84,0.999 1,1');
}

/** A duration under reduced motion: still there, but short. */
export function rm(seconds, device, cap = 0.6) {
  return device && device.reducedMotion ? Math.min(seconds, cap) : seconds;
}
