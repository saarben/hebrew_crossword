/**
 * Adaptive learning engine for the letter game. Pure functions only (no React,
 * no storage), so the behaviour can be simulated and tested in isolation.
 *
 * Ideas:
 *  - Letters are introduced gradually (starts with 3, one more each time the
 *    newest letter has been recognised correctly twice in a row).
 *  - Every letter has a Leitner-style `box` (0..4). First-try correct answers
 *    raise it, mistakes drop it. Weak letters are asked more often.
 *  - `tier` controls how hard a question is: how many choices, which question
 *    types, and whether look-alike letters are used as distractors. It moves
 *    up after a good round and down after a rough one.
 *  - If the same letter is missed repeatedly, `focus` kicks in: re-teach the
 *    letter, then ask it with only two very different choices, and ease off
 *    the global tier.
 */
import { ALPHABET, LETTER_BY_ID, areSimilar } from './letters';

export type QType = 'find' | 'balloons' | 'word' | 'picture';

export interface LetterStat {
  /** 0 = new / shaky … 4 = solid. */
  box: number;
  seen: number;
  firstTry: number;
  wrong: number;
  /** Mistakes recently; decays on correct answers. Drives the "focus" mode. */
  recentWrong: number;
}

export interface Focus {
  id: string;
  /** Correct answers still needed before we consider the letter rescued. */
  left: number;
}

export interface Profile {
  v: 1;
  unlocked: number;
  tier: number;
  stars: number;
  /** Stickers already revealed to the child. */
  stickers: number;
  letters: Record<string, LetterStat>;
  introduced: string[];
  focus: Focus | null;
  round: { done: number; firstTry: number; stars: number };
  lastType: QType | null;
  lastTarget: string | null;
  soundOn: boolean;
  rounds: number;
}

export interface Question {
  type: QType;
  target: string;
  /** Letter ids; for the "picture" type they are rendered as pictures. */
  options: string[];
}

export const ROUND_LENGTH = 5;
export const STARS_PER_STICKER = 10;
export const START_LETTERS = 3;
export const MASTERED_BOX = 2;
/** Number of answer choices per tier. */
export const TIER_OPTIONS = [2, 3, 3, 4, 4, 5];
export const MAX_TIER = TIER_OPTIONS.length - 1;
/** Mistakes on the same letter before the focus mode is triggered. */
export const FOCUS_THRESHOLD = 2;

export function newProfile(): Profile {
  return {
    v: 1,
    unlocked: START_LETTERS,
    tier: 0,
    stars: 0,
    stickers: 0,
    letters: {},
    introduced: [],
    focus: null,
    round: { done: 0, firstTry: 0, stars: 0 },
    lastType: null,
    lastTarget: null,
    soundOn: true,
    rounds: 0,
  };
}

export function stat(p: Profile, id: string): LetterStat {
  return p.letters[id] ?? { box: 0, seen: 0, firstTry: 0, wrong: 0, recentWrong: 0 };
}

export function poolIds(p: Profile): string[] {
  return ALPHABET.slice(0, p.unlocked).map((l) => l.id);
}

/** Highest tier allowed for the number of letters currently unlocked. */
export function tierCap(unlocked: number): number {
  if (unlocked < 5) return 1;
  if (unlocked < 8) return 2;
  if (unlocked < 12) return 3;
  if (unlocked < 17) return 4;
  return MAX_TIER;
}

function allowedTypes(tier: number): QType[] {
  if (tier === 0) return ['find', 'balloons'];
  if (tier === 1) return ['find', 'balloons', 'word'];
  return ['find', 'balloons', 'word', 'picture'];
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A letter that still needs to be taught (first time seen). */
export function nextIntro(p: Profile): string | null {
  return poolIds(p).find((id) => !p.introduced.includes(id)) ?? null;
}

export function markIntroduced(p: Profile, id: string): Profile {
  return p.introduced.includes(id) ? p : { ...p, introduced: [...p.introduced, id] };
}

function chooseTarget(p: Profile, rng: () => number): string {
  const pool = poolIds(p);
  const focus = p.focus;
  // Alternate: a focus question, then something else, then focus again.
  if (focus && focus.left > 0 && p.lastTarget !== focus.id) return focus.id;
  const newest = pool[pool.length - 1];
  const candidates = pool.filter((id) => id !== p.lastTarget);
  const list = candidates.length ? candidates : pool;
  const weights = list.map((id) => {
    const s = stat(p, id);
    return 1 + (4 - s.box) + s.recentWrong * 2 + (id === newest ? 2 : 0) + (s.seen === 0 ? 2 : 0);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

function chooseOptions(p: Profile, target: string, count: number, rng: () => number): string[] {
  const pool = poolIds(p).filter((id) => id !== target);
  const n = Math.min(count, pool.length + 1) - 1;
  const similar = pool.filter((id) => areSimilar(id, target));
  const distinct = pool.filter((id) => !areSimilar(id, target));
  let chosen: string[];
  const easy = p.tier <= 1 || (p.focus?.id === target && p.focus.left > 1);
  if (easy) {
    // Very different letters only (fall back to anything if the pool is tiny).
    chosen = shuffle(distinct, rng).slice(0, n);
    if (chosen.length < n) chosen = chosen.concat(shuffle(similar, rng).slice(0, n - chosen.length));
  } else if (p.tier >= 3) {
    // Look-alikes first: this is where beginners really learn the shapes.
    const takeSimilar = shuffle(similar, rng).slice(0, Math.max(1, Math.ceil(n / 2)));
    chosen = takeSimilar.concat(shuffle(distinct, rng).slice(0, n - takeSimilar.length));
    if (chosen.length < n) chosen = chosen.concat(shuffle(similar.filter((s) => !chosen.includes(s)), rng).slice(0, n - chosen.length));
  } else {
    chosen = shuffle(pool, rng).slice(0, n);
  }
  return shuffle([target, ...chosen], rng);
}

export function makeQuestion(p: Profile, rng: () => number = Math.random): Question {
  const target = chooseTarget(p, rng);
  const focused = p.focus?.id === target && p.focus.left > 0;
  let count = TIER_OPTIONS[Math.min(p.tier, MAX_TIER)];
  if (focused) count = p.focus!.left >= 2 ? 2 : 3;
  count = Math.min(count, poolIds(p).length);

  const allowed = allowedTypes(focused ? Math.min(p.tier, 1) : p.tier);
  const choices = allowed.filter((t) => t !== p.lastType);
  const type = pick(choices.length ? choices : allowed, rng);
  return { type, target, options: chooseOptions(p, target, count, rng) };
}

export interface AnswerResult {
  profile: Profile;
  /** The letter just became a "problem letter": show a mini lesson. */
  focusTriggered: boolean;
  starsEarned: number;
  newlyUnlocked: string | null;
}

/**
 * Record a mistake. Returns the updated profile and whether this mistake pushed
 * the letter over the "needs help" threshold.
 */
export function recordWrong(p: Profile, target: string): { profile: Profile; focusTriggered: boolean } {
  const s = stat(p, target);
  const next: LetterStat = { ...s, wrong: s.wrong + 1, recentWrong: s.recentWrong + 1, box: Math.max(0, s.box - 1) };
  let profile: Profile = { ...p, letters: { ...p.letters, [target]: next } };
  let focusTriggered = false;
  if (next.recentWrong >= FOCUS_THRESHOLD && p.focus?.id !== target) {
    focusTriggered = true;
    profile = { ...profile, focus: { id: target, left: 3 }, tier: Math.max(0, profile.tier - 1) };
  }
  return { profile, focusTriggered };
}

/**
 * Record that the child finally found the right answer.
 * `mistakes` = wrong taps on this question before getting it right.
 */
export function recordCorrect(p: Profile, q: Question, mistakes: number): AnswerResult {
  const s = stat(p, q.target);
  const firstTry = mistakes === 0;
  const next: LetterStat = {
    box: firstTry ? Math.min(4, s.box + 1) : s.box,
    seen: s.seen + 1,
    firstTry: s.firstTry + (firstTry ? 1 : 0),
    wrong: s.wrong,
    recentWrong: firstTry ? Math.max(0, s.recentWrong - 1) : s.recentWrong,
  };
  const starsEarned = firstTry ? 2 : 1;
  let focus = p.focus;
  if (focus && focus.id === q.target && firstTry) {
    focus = focus.left <= 1 ? null : { ...focus, left: focus.left - 1 };
  }
  let profile: Profile = {
    ...p,
    letters: { ...p.letters, [q.target]: next },
    stars: p.stars + starsEarned,
    focus,
    lastType: q.type,
    lastTarget: q.target,
    round: {
      done: p.round.done + 1,
      firstTry: p.round.firstTry + (firstTry ? 1 : 0),
      stars: p.round.stars + starsEarned,
    },
  };

  // Unlock the next letter once the newest one (and nearly all others) are solid.
  let newlyUnlocked: string | null = null;
  if (!profile.focus && profile.unlocked < ALPHABET.length) {
    const pool = poolIds(profile);
    const newest = pool[pool.length - 1];
    const mastered = pool.filter((id) => stat(profile, id).box >= MASTERED_BOX).length;
    if (stat(profile, newest).box >= MASTERED_BOX && mastered >= pool.length - 1) {
      profile = { ...profile, unlocked: profile.unlocked + 1 };
      newlyUnlocked = ALPHABET[profile.unlocked - 1].id;
    }
  }
  return { profile, focusTriggered: false, starsEarned, newlyUnlocked };
}

export interface RoundSummary {
  profile: Profile;
  starsEarned: number;
  firstTry: number;
  tierChange: -1 | 0 | 1;
  newSticker: boolean;
}

/** Called when a round of ROUND_LENGTH questions is finished. */
export function finishRound(p: Profile): RoundSummary {
  const { firstTry, stars } = p.round;
  let tier = p.tier;
  let tierChange: -1 | 0 | 1 = 0;
  if (firstTry >= ROUND_LENGTH - 1 && tier < tierCap(p.unlocked) && !p.focus) {
    tier += 1;
    tierChange = 1;
  } else if (firstTry <= 2 && tier > 0) {
    tier -= 1;
    tierChange = -1;
  }
  const earnedStickers = Math.floor(p.stars / STARS_PER_STICKER);
  const profile: Profile = {
    ...p,
    tier,
    rounds: p.rounds + 1,
    round: { done: 0, firstTry: 0, stars: 0 },
    stickers: earnedStickers,
  };
  return { profile, starsEarned: stars, firstTry, tierChange, newSticker: earnedStickers > p.stickers };
}

export function prompt(q: Question): { speak: string; text: string } {
  const l = LETTER_BY_ID[q.target];
  switch (q.type) {
    case 'balloons':
      return { speak: `פוצץ את הבלון עם האות ${l.speak}`, text: `פוצצו את הבלון עם האות ${l.name}` };
    case 'word':
      return { speak: `עם איזו אות מתחילה המילה ${l.wordSpeak}?`, text: `עם איזו אות מתחילה המילה ${l.word}?` };
    case 'picture':
      return { speak: `לחץ על התמונה שמתחילה באות ${l.speak}`, text: `לחצו על התמונה שמתחילה באות ${l.name}` };
    default:
      return { speak: `לחץ על האות ${l.speak}`, text: `לחצו על האות ${l.name}` };
  }
}
