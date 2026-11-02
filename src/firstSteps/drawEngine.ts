/**
 * Progression for the letter-drawing game (pure functions).
 *
 * Each letter has a skill `box` (0..3) that picks the help level:
 *   0 → "trace": demo + full guide     1 → "dots": follow numbered dots
 *   2+ → "faded": almost no guide, only the start dots
 * Struggling (many strays) widens the tolerance and brings the full guide back,
 * and that letter is asked again soon until it goes well.
 */
import { LETTER_BY_ID } from './letters';

export const DRAW_ORDER = [
  'vav', 'yod', 'resh', 'dalet', 'he', 'nun', 'bet', 'kaf', 'gimel', 'lamed', 'het',
  'tav', 'zayin', 'tet', 'samekh', 'mem', 'pe', 'ayin', 'tsadi', 'qof', 'shin', 'alef',
];
export const DRAW_START = 3;

export type DrawMode = 'trace' | 'dots' | 'faded';

export interface DrawLetterStat {
  box: number;
  done: number;
  best: number;
  struggle: boolean;
}

export interface DrawProfile {
  v: 1;
  unlocked: number;
  letters: Record<string, DrawLetterStat>;
  stars: number;
  /** Letters drawn successfully at least once (the gallery). */
  gallery: string[];
  last: string | null;
  rounds: number;
}

export function newDrawProfile(): DrawProfile {
  return { v: 1, unlocked: DRAW_START, letters: {}, stars: 0, gallery: [], last: null, rounds: 0 };
}

export function dstat(p: DrawProfile, id: string): DrawLetterStat {
  return p.letters[id] ?? { box: 0, done: 0, best: 0, struggle: false };
}

export const drawPool = (p: DrawProfile) => DRAW_ORDER.slice(0, p.unlocked);

export function pickDrawLetter(p: DrawProfile, rng: () => number = Math.random): string {
  const pool = drawPool(p);
  const fresh = pool.find((id) => dstat(p, id).done === 0 && id !== p.last);
  if (fresh) return fresh; // every new letter gets drawn first
  const list = pool.filter((id) => id !== p.last);
  const cand = list.length ? list : pool;
  const w = cand.map((id) => {
    const s = dstat(p, id);
    return 1 + (3 - s.box) + (s.struggle ? 4 : 0);
  });
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cand.length; i++) {
    r -= w[i];
    if (r <= 0) return cand[i];
  }
  return cand[cand.length - 1];
}

export function modeFor(p: DrawProfile, id: string): DrawMode {
  const s = dstat(p, id);
  if (s.struggle || s.box === 0) return 'trace';
  return s.box === 1 ? 'dots' : 'faded';
}

/** Tolerance radius (in the 100x100 letter box) — generous for small fingers. */
export function radiusFor(mode: DrawMode, struggle: boolean, assist = 0): number {
  const base = mode === 'trace' ? 10 : mode === 'dots' ? 9 : 8.5;
  return base + (struggle ? 2 : 0) + assist * 2;
}

export function starsFor(strays: number, assisted: boolean): 1 | 2 | 3 {
  if (assisted) return strays <= 4 ? 2 : 1;
  return strays <= 1 ? 3 : strays <= 4 ? 2 : 1;
}

export interface DrawResult {
  profile: DrawProfile;
  stars: 1 | 2 | 3;
  unlocked: string | null;
}

export function recordDraw(p: DrawProfile, id: string, strays: number, assisted: boolean): DrawResult {
  const s = dstat(p, id);
  const stars = starsFor(strays, assisted);
  const next: DrawLetterStat = {
    done: s.done + 1,
    best: Math.max(s.best, stars),
    box: stars >= 2 && !assisted ? Math.min(3, s.box + 1) : s.box,
    struggle: stars === 1 || assisted ? true : stars === 3 ? false : s.struggle,
  };
  let profile: DrawProfile = {
    ...p,
    letters: { ...p.letters, [id]: next },
    stars: p.stars + stars,
    gallery: p.gallery.includes(id) ? p.gallery : [...p.gallery, id],
    last: id,
    rounds: p.rounds + 1,
  };
  let unlocked: string | null = null;
  if (profile.unlocked < DRAW_ORDER.length && drawPool(profile).every((x) => dstat(profile, x).box >= 1)) {
    profile = { ...profile, unlocked: profile.unlocked + 1 };
    unlocked = DRAW_ORDER[profile.unlocked - 1];
  }
  return { profile, stars, unlocked };
}

export const drawLetter = (id: string) => LETTER_BY_ID[id];
