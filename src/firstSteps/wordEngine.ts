/**
 * Build-the-word engine (pure functions).
 *
 * Levels 0..5 control word length, how much is pre-filled, whether faint
 * "ghost" letters are shown, how many distractor tiles there are and whether
 * look-alike letters are used as distractors. Misses on the same letter put the
 * word in `focus`: it comes back soon with an easier setup (ghosts, 1 distractor).
 */
import { ALPHABET, areSimilar } from './letters';
import { WORDS, WORD_BY_ID, Word } from './wordData';

export type WMode = 'build' | 'missing' | 'picture';

export interface WStat {
  done: number;
  firstTry: number;
  miss: number;
}

export interface WordProfile {
  v: 1;
  level: number;
  stars: number;
  words: Record<string, WStat>;
  /** Words the child has built (the "my words" dictionary). */
  collection: string[];
  /** Recent misses per letter; decays on clean answers. */
  letterMiss: Record<string, number>;
  focus: { wordId: string; left: number } | null;
  last: string | null;
  lastMode: WMode | null;
  round: { done: number; firstTry: number; stars: number; words: string[] };
  rounds: number;
}

export interface Tile {
  id: number;
  letter: string;
}

export interface WordQuestion {
  mode: WMode;
  wordId: string;
  /** Slot indices (0 = first letter) that are already filled at the start. */
  prefill: number[];
  tiles: Tile[];
  ghosts: boolean;
  /** Word ids shown as pictures (picture mode only). */
  pics: string[];
  assisted: boolean;
}

export const W_ROUND_LENGTH = 5;
export const MAX_LEVEL = 5;
export const MIN_KNOWN = 10;
export const FOCUS_MISSES = 2;

interface LevelCfg {
  len: [number, number];
  prefill: number;
  ghosts: boolean;
  distract: number;
  modes: WMode[];
  similar: boolean;
}

const ALL: WMode[] = ['build', 'missing', 'picture'];
export const LEVELS: LevelCfg[] = [
  { len: [2, 2], prefill: 1, ghosts: true, distract: 1, modes: ['build'], similar: false },
  { len: [2, 3], prefill: 1, ghosts: true, distract: 2, modes: ['build', 'missing'], similar: false },
  { len: [3, 3], prefill: 0, ghosts: true, distract: 2, modes: ALL, similar: false },
  { len: [3, 3], prefill: 0, ghosts: false, distract: 3, modes: ALL, similar: false },
  { len: [3, 4], prefill: 0, ghosts: false, distract: 3, modes: ALL, similar: true },
  { len: [4, 4], prefill: 0, ghosts: false, distract: 4, modes: ALL, similar: true },
];

export function newWordProfile(): WordProfile {
  return {
    v: 1,
    level: 0,
    stars: 0,
    words: {},
    collection: [],
    letterMiss: {},
    focus: null,
    last: null,
    lastMode: null,
    round: { done: 0, firstTry: 0, stars: 0, words: [] },
    rounds: 0,
  };
}

export const wstat = (p: WordProfile, id: string): WStat => p.words[id] ?? { done: 0, firstTry: 0, miss: 0 };

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Words of the right length made only of letters the child knows (relaxing if there are too few). */
export function eligibleWords(known: number, len: [number, number]): Word[] {
  for (let k = known; k <= ALPHABET.length + 4; k += 4) {
    const ids = new Set(ALPHABET.slice(0, Math.min(k, ALPHABET.length)).map((l) => l.id));
    const list = WORDS.filter((x) => x.letters.length >= len[0] && x.letters.length <= len[1] && x.letters.every((l) => ids.has(l)));
    if (list.length >= 3 || k >= ALPHABET.length) {
      if (list.length) return list;
    }
  }
  // nothing fits that length at all: any word up to the max length
  return WORDS.filter((x) => x.letters.length <= len[1]);
}

function chooseWord(p: WordProfile, known: number, cfg: LevelCfg, rng: () => number): Word {
  const f = p.focus;
  // The word that needs help comes back soon, but at most twice per round and never back to back.
  if (f && f.left > 0 && p.last !== f.wordId && p.round.words.filter((x) => x === f.wordId).length < 2) return WORD_BY_ID[f.wordId];
  const pool = eligibleWords(known, cfg.len);
  const cand = pool.filter((x) => x.id !== p.last);
  const list = cand.length ? cand : pool;
  const weights = list.map((x) => {
    const s = wstat(p, x.id);
    return 1 + (s.done === 0 ? 3 : 0) + Math.min(s.miss, 4) * 1.5 + (s.firstTry < 1 ? 1 : 0);
  });
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

function distractors(word: Word, needed: string[], count: number, known: number, similar: boolean, rng: () => number): string[] {
  const inWord = new Set(word.letters);
  const all = ALPHABET.map((l) => l.id).filter((id) => !inWord.has(id));
  const knownPool = all.filter((id) => ALPHABET.findIndex((l) => l.id === id) < Math.max(known, 6));
  const pool = knownPool.length >= count + 2 ? knownPool : all;
  const look = similar ? shuffle(pool.filter((id) => needed.some((n) => areSimilar(id, n))), rng) : [];
  const rest = shuffle(pool.filter((id) => !look.includes(id)), rng);
  // distinct-looking first on easy levels is implicit: they are simply random unknown-to-the-word letters
  return [...look, ...rest].slice(0, count);
}

export function makeQuestion(p: WordProfile, known = MIN_KNOWN, rng: () => number = Math.random): WordQuestion {
  let cfg = LEVELS[Math.min(p.level, MAX_LEVEL)];
  const focused = !!p.focus && p.focus.left > 0;
  const word = chooseWord(p, Math.max(known, MIN_KNOWN), cfg, rng);
  const isFocusWord = focused && p.focus!.wordId === word.id;
  if (isFocusWord) {
    const easier = LEVELS[Math.max(0, p.level - 1)];
    cfg = { ...easier, ghosts: true, prefill: 1, distract: p.focus!.left >= 2 ? 1 : Math.min(2, easier.distract), similar: false };
  }
  const len = word.letters.length;

  // mode
  let modes = isFocusWord ? (p.focus!.left >= 2 ? (['build'] as WMode[]) : (['missing'] as WMode[])) : cfg.modes;
  const others = WORDS.filter((x) => x.id !== word.id && x.emoji !== word.emoji);
  if (others.length < 2) modes = modes.filter((m) => m !== 'picture');
  const fresh = modes.filter((m) => m !== p.lastMode);
  const mode = (fresh.length ? fresh : modes)[Math.floor(rng() * (fresh.length || modes.length))];

  // pre-filled slots
  let prefill: number[];
  if (mode === 'missing') {
    const hole = Math.floor(rng() * len);
    prefill = word.letters.map((_, i) => i).filter((i) => i !== hole);
  } else {
    prefill = Array.from({ length: Math.min(cfg.prefill, len - 1) }, (_, i) => i);
  }
  const needed = word.letters.filter((_, i) => !prefill.includes(i));
  const dCount = mode === 'missing' ? Math.max(1, Math.min(cfg.distract, 3)) : cfg.distract;
  const extra = distractors(word, needed, dCount, known, cfg.similar, rng);
  const tiles: Tile[] = shuffle([...needed, ...extra], rng).map((letter, id) => ({ id, letter }));

  // picture choices: prefer different first letters so the choice is about the word
  let pics: string[] = [];
  if (mode === 'picture') {
    const count = p.level >= 4 ? 3 : 2;
    const diffFirst = shuffle(others.filter((x) => x.letters[0] !== word.letters[0]), rng);
    const pickFrom = (diffFirst.length >= count - 1 ? diffFirst : shuffle(others, rng)).slice(0, count - 1);
    pics = shuffle([word.id, ...pickFrom.map((x) => x.id)], rng);
  }
  return { mode, wordId: word.id, prefill, tiles, ghosts: cfg.ghosts, pics, assisted: isFocusWord };
}

/** Is `letter` right for slot `slot` of the question's word? */
export const fitsSlot = (q: WordQuestion, slot: number, letter: string) => WORD_BY_ID[q.wordId].letters[slot] === letter;

export function initialPlaced(q: WordQuestion): (string | null)[] {
  const w = WORD_BY_ID[q.wordId];
  return w.letters.map((l, i) => (q.prefill.includes(i) ? l : null));
}

export function firstEmpty(placed: (string | null)[]): number {
  return placed.findIndex((x) => x === null);
}

export function recordWrong(p: WordProfile, wordId: string, letter: string): { profile: WordProfile; focusTriggered: boolean } {
  const s = wstat(p, wordId);
  const miss = (p.letterMiss[letter] ?? 0) + 1;
  let profile: WordProfile = {
    ...p,
    words: { ...p.words, [wordId]: { ...s, miss: s.miss + 1 } },
    letterMiss: { ...p.letterMiss, [letter]: miss },
  };
  let focusTriggered = false;
  if (miss >= FOCUS_MISSES && p.focus?.wordId !== wordId) {
    focusTriggered = true;
    profile = { ...profile, focus: { wordId, left: 2 }, level: Math.max(0, profile.level - 1) };
  }
  return { profile, focusTriggered };
}

export function recordComplete(p: WordProfile, q: WordQuestion, mistakes: number): { profile: WordProfile; starsEarned: number; isNewWord: boolean } {
  const firstTry = mistakes === 0;
  const word = WORD_BY_ID[q.wordId];
  const s = wstat(p, q.wordId);
  const starsEarned = firstTry ? 2 : 1;
  const letterMiss = { ...p.letterMiss };
  if (firstTry) for (const l of word.letters) if (letterMiss[l]) letterMiss[l] = Math.max(0, letterMiss[l] - 1);
  let focus = p.focus;
  if (focus && focus.wordId === q.wordId && firstTry) focus = focus.left <= 1 ? null : { ...focus, left: focus.left - 1 };
  const isNewWord = !p.collection.includes(q.wordId);
  const profile: WordProfile = {
    ...p,
    stars: p.stars + starsEarned,
    words: { ...p.words, [q.wordId]: { done: s.done + 1, firstTry: s.firstTry + (firstTry ? 1 : 0), miss: s.miss } },
    collection: isNewWord ? [...p.collection, q.wordId] : p.collection,
    letterMiss,
    focus,
    last: q.wordId,
    lastMode: q.mode,
    round: {
      done: p.round.done + 1,
      firstTry: p.round.firstTry + (firstTry ? 1 : 0),
      stars: p.round.stars + starsEarned,
      words: [...p.round.words, q.wordId],
    },
  };
  return { profile, starsEarned, isNewWord };
}

export interface WordRoundSummary {
  profile: WordProfile;
  starsEarned: number;
  firstTry: number;
  levelChange: -1 | 0 | 1;
  words: string[];
}

export function finishRound(p: WordProfile): WordRoundSummary {
  const { firstTry, stars, words } = p.round;
  let level = p.level;
  let levelChange: -1 | 0 | 1 = 0;
  if (firstTry >= W_ROUND_LENGTH - 1 && level < MAX_LEVEL && !p.focus) {
    level += 1;
    levelChange = 1;
  } else if (firstTry <= 2 && level > 0) {
    level -= 1;
    levelChange = -1;
  }
  const profile: WordProfile = { ...p, level, rounds: p.rounds + 1, round: { done: 0, firstTry: 0, stars: 0, words: [] } };
  return { profile, starsEarned: stars, firstTry, levelChange, words };
}
