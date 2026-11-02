/**
 * Letter-sounds game: pure logic (no React / storage). Imports only letters.ts.
 *
 * A letter's sound is spoken as a syllable with kamatz ("בָּ" = "ba") because a
 * speech engine can't say an isolated consonant. Hard sounds use a dagesh.
 *
 * Adaptive behaviour mirrors engine.ts: letters unlock gradually, `tier` sets
 * the number of choices / question types / sound-alike distractors, and a
 * letter missed repeatedly enters "focus" (re-taught, asked with 2 easy choices,
 * asked more often, global tier eased).
 */
import { ALPHABET, LETTER_BY_ID } from './letters';

/** id -> syllable shown/spoken for the letter's sound. */
export const SYLLABLE: Record<string, string> = {
  alef: 'אָ', bet: 'בָּ', gimel: 'גָּ', dalet: 'דָּ', he: 'הָ', vav: 'וָ', zayin: 'זָ', het: 'חָ',
  tet: 'טָ', yod: 'יָ', kaf: 'כָּ', lamed: 'לָ', mem: 'מָ', nun: 'נָ', samekh: 'סָ', ayin: 'עָ',
  pe: 'פָּ', tsadi: 'צָ', qof: 'קָ', resh: 'רָ', shin: 'שָׁ', tav: 'תָּ',
};

/** Teaching order: clearly different sounds first, confusable ones later. */
export const SOUND_ORDER = [
  'mem', 'bet', 'shin', 'lamed', 'dalet', 'nun', 'resh', 'samekh', 'gimel', 'kaf', 'pe',
  'tav', 'he', 'zayin', 'yod', 'vav', 'het', 'tet', 'tsadi', 'qof', 'alef', 'ayin',
];

/** Letters that sound alike to a young ear. */
const ALIKE: string[][] = [
  ['bet', 'pe'], ['kaf', 'qof'], ['tav', 'tet'], ['samekh', 'shin', 'tsadi'], ['het', 'kaf'],
  ['ayin', 'alef'], ['dalet', 'tav'], ['gimel', 'kaf'], ['zayin', 'samekh'], ['vav', 'bet'], ['mem', 'nun'],
];
export const soundAlike = (a: string, b: string) => ALIKE.some((g) => g.includes(a) && g.includes(b));

export type SType = 'hear' | 'word' | 'picture' | 'catch';

export interface SLetterStat { box: number; seen: number; firstTry: number; wrong: number; recentWrong: number }
export interface SFocus { id: string; left: number }

export interface SoundsProfile {
  v: 1;
  unlocked: number;
  tier: number;
  stars: number;
  /** Instruments already revealed in the band. */
  items: number;
  letters: Record<string, SLetterStat>;
  introduced: string[];
  focus: SFocus | null;
  round: { done: number; firstTry: number; stars: number };
  lastType: SType | null;
  lastTarget: string | null;
  rounds: number;
}

export interface SQuestion { type: SType; target: string; options: string[] }

export const ROUND_LENGTH = 5;
export const STARS_PER_ITEM = 8;
export const START_LETTERS = 3;
export const MASTERED_BOX = 2;
export const TIER_OPTIONS = [2, 3, 3, 4, 4, 5];
export const MAX_TIER = TIER_OPTIONS.length - 1;
export const FOCUS_THRESHOLD = 2;
export const INSTRUMENTS = ['🥁', '🎺', '🎸', '🎹', '🎻', '🎷', '🔔', '🎤', '🎧', '📯'];

// ---- sentences (single source of truth; soundsPhrases.ts lists them all) ----
export const PRAISE = ['כל הכבוד!', 'יופי!', 'מעולה!', 'אלוף!', 'נכון מאוד!', 'וואו!', 'מצוין!'];
export const RETRY = ['לא נורא, נסה שוב', 'כמעט! נסה עוד פעם', 'אופס, נסה שוב'];
export const Q_HEAR = 'איזו אות אומרת את הצליל הזה?';
export const Q_WORD = 'מה הצליל הראשון במילה';
export const Q_PICTURE = 'איזו תמונה מתחילה בצליל הזה?';
export const Q_CATCH = 'תפוס את הכוכב שאומר את הצליל הזה';
export const CLICK_IT = 'לחץ עליה';
export const ROUND_DONE = 'כל הכבוד! סיימת סיבוב!';
export const ROUND_ITEM = 'קיבלת כלי נגינה חדש!';
export const FIXED_LINES = [...PRAISE, ...RETRY, Q_HEAR, Q_WORD, Q_PICTURE, Q_CATCH, CLICK_IT, ROUND_DONE, ROUND_ITEM];

export const soundLine = (id: string) => `${SYLLABLE[id]}, ${SYLLABLE[id]}, ${SYLLABLE[id]}`;
export const likeLine = (id: string) => `${SYLLABLE[id]} כמו ${LETTER_BY_ID[id].wordSpeak}`;
export const wordLine = (id: string) => LETTER_BY_ID[id].wordSpeak;
export const hintLine = (id: string) => `זו האות ${LETTER_BY_ID[id].speak}. ${SYLLABLE[id]} כמו ${LETTER_BY_ID[id].wordSpeak}`;
export const newIntroLine = (id: string) => `זו האות ${LETTER_BY_ID[id].speak}, והיא אומרת`;
export const againIntroLine = (id: string) => `בוא נכיר שוב את הצליל של האות ${LETTER_BY_ID[id].speak}`;

/** All sentences that depend on a letter. */
export function letterLines(id: string): string[] {
  return [soundLine(id), likeLine(id), wordLine(id), hintLine(id), newIntroLine(id), againIntroLine(id)];
}

// ---- profile -----------------------------------------------------------
export function newSoundsProfile(): SoundsProfile {
  return {
    v: 1, unlocked: START_LETTERS, tier: 0, stars: 0, items: 0, letters: {}, introduced: [], focus: null,
    round: { done: 0, firstTry: 0, stars: 0 }, lastType: null, lastTarget: null, rounds: 0,
  };
}

export const sstat = (p: SoundsProfile, id: string): SLetterStat =>
  p.letters[id] ?? { box: 0, seen: 0, firstTry: 0, wrong: 0, recentWrong: 0 };
export const soundsPool = (p: SoundsProfile) => SOUND_ORDER.slice(0, p.unlocked);

export function tierCap(unlocked: number): number {
  if (unlocked < 5) return 1;
  if (unlocked < 8) return 2;
  if (unlocked < 12) return 3;
  if (unlocked < 17) return 4;
  return MAX_TIER;
}

function allowedTypes(tier: number): SType[] {
  if (tier === 0) return ['word', 'picture'];
  if (tier === 1) return ['word', 'picture', 'hear'];
  return ['word', 'picture', 'hear', 'catch'];
}

const pick = <T,>(a: T[], rng: () => number): T => a[Math.floor(rng() * a.length)];
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const nextIntro = (p: SoundsProfile) => soundsPool(p).find((id) => !p.introduced.includes(id)) ?? null;
export const markIntroduced = (p: SoundsProfile, id: string): SoundsProfile =>
  p.introduced.includes(id) ? p : { ...p, introduced: [...p.introduced, id] };

function chooseTarget(p: SoundsProfile, rng: () => number): string {
  const pool = soundsPool(p);
  const f = p.focus;
  // alternate: focus letter, something else, focus letter again
  if (f && f.left > 0 && p.lastTarget !== f.id) return f.id;
  const newest = pool[pool.length - 1];
  const cand = pool.filter((id) => id !== p.lastTarget);
  const list = cand.length ? cand : pool;
  const w = list.map((id) => {
    const s = sstat(p, id);
    return 1 + (4 - s.box) + s.recentWrong * 2 + (id === newest ? 2 : 0) + (s.seen === 0 ? 2 : 0);
  });
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) {
    r -= w[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

function chooseOptions(p: SoundsProfile, target: string, count: number, rng: () => number): string[] {
  const others = soundsPool(p).filter((id) => id !== target);
  const n = Math.min(count, others.length + 1) - 1;
  const alike = others.filter((id) => soundAlike(id, target));
  const distinct = others.filter((id) => !soundAlike(id, target));
  const easy = p.tier <= 1 || (p.focus?.id === target && p.focus.left > 1);
  let chosen: string[];
  if (easy) {
    chosen = shuffle(distinct, rng).slice(0, n);
    if (chosen.length < n) chosen = chosen.concat(shuffle(alike, rng).slice(0, n - chosen.length));
  } else if (p.tier >= 3) {
    const takeAlike = shuffle(alike, rng).slice(0, Math.max(1, Math.ceil(n / 2)));
    chosen = takeAlike.concat(shuffle(distinct, rng).slice(0, n - takeAlike.length));
    if (chosen.length < n) chosen = chosen.concat(shuffle(alike.filter((s) => !chosen.includes(s)), rng).slice(0, n - chosen.length));
  } else {
    chosen = shuffle(others, rng).slice(0, n);
  }
  return shuffle([target, ...chosen], rng);
}

export function makeQuestion(p: SoundsProfile, rng: () => number = Math.random): SQuestion {
  const target = chooseTarget(p, rng);
  const focused = p.focus?.id === target && p.focus.left > 0;
  let count = TIER_OPTIONS[Math.min(p.tier, MAX_TIER)];
  if (focused) count = p.focus!.left >= 2 ? 2 : 3;
  count = Math.min(count, soundsPool(p).length);
  const allowed = allowedTypes(focused ? Math.min(p.tier, 1) : p.tier);
  const choices = allowed.filter((t) => t !== p.lastType);
  const type = pick(choices.length ? choices : allowed, rng);
  return { type, target, options: chooseOptions(p, target, count, rng) };
}

/** Sentences to speak (played in order) and the text shown to parents. */
export function prompt(q: SQuestion): { speak: string[]; text: string } {
  const l = LETTER_BY_ID[q.target];
  switch (q.type) {
    case 'hear':
      return { speak: [Q_HEAR, soundLine(q.target)], text: `איזו אות אומרת ${SYLLABLE[q.target]}?` };
    case 'word':
      return { speak: [Q_WORD, wordLine(q.target)], text: `מה הצליל הראשון במילה ${l.word}?` };
    case 'picture':
      return { speak: [Q_PICTURE, soundLine(q.target)], text: `איזו תמונה מתחילה בצליל ${SYLLABLE[q.target]}?` };
    default:
      return { speak: [Q_CATCH, soundLine(q.target)], text: `תפסו את הכוכב שאומר ${SYLLABLE[q.target]}` };
  }
}

/** Sentences after a correct answer. */
export const reinforce = (id: string, praise: string): string[] => [praise, likeLine(id)];
export const hintSpeech = (id: string): string[] => [hintLine(id), CLICK_IT];
export const lessonSpeech = (id: string, again: boolean): string[] => [
  again ? againIntroLine(id) : newIntroLine(id), soundLine(id), likeLine(id),
];

// ---- answers -----------------------------------------------------------
export function recordWrong(p: SoundsProfile, target: string): { profile: SoundsProfile; focusTriggered: boolean } {
  const s = sstat(p, target);
  const next: SLetterStat = { ...s, wrong: s.wrong + 1, recentWrong: s.recentWrong + 1, box: Math.max(0, s.box - 1) };
  let profile: SoundsProfile = { ...p, letters: { ...p.letters, [target]: next } };
  let focusTriggered = false;
  if (next.recentWrong >= FOCUS_THRESHOLD && p.focus?.id !== target) {
    focusTriggered = true;
    profile = { ...profile, focus: { id: target, left: 3 }, tier: Math.max(0, profile.tier - 1) };
  }
  return { profile, focusTriggered };
}

export interface SAnswerResult { profile: SoundsProfile; starsEarned: number; newlyUnlocked: string | null }

export function recordCorrect(p: SoundsProfile, q: SQuestion, mistakes: number): SAnswerResult {
  const s = sstat(p, q.target);
  const first = mistakes === 0;
  const next: SLetterStat = {
    box: first ? Math.min(4, s.box + 1) : s.box,
    seen: s.seen + 1,
    firstTry: s.firstTry + (first ? 1 : 0),
    wrong: s.wrong,
    recentWrong: first ? Math.max(0, s.recentWrong - 1) : s.recentWrong,
  };
  const starsEarned = first ? 2 : 1;
  let focus = p.focus;
  if (focus && focus.id === q.target && first) focus = focus.left <= 1 ? null : { ...focus, left: focus.left - 1 };
  let profile: SoundsProfile = {
    ...p,
    letters: { ...p.letters, [q.target]: next },
    stars: p.stars + starsEarned,
    focus,
    lastType: q.type,
    lastTarget: q.target,
    round: { done: p.round.done + 1, firstTry: p.round.firstTry + (first ? 1 : 0), stars: p.round.stars + starsEarned },
  };
  let newlyUnlocked: string | null = null;
  if (!profile.focus && profile.unlocked < SOUND_ORDER.length) {
    const pool = soundsPool(profile);
    const newest = pool[pool.length - 1];
    const mastered = pool.filter((id) => sstat(profile, id).box >= MASTERED_BOX).length;
    if (sstat(profile, newest).box >= MASTERED_BOX && mastered >= pool.length - 1) {
      profile = { ...profile, unlocked: profile.unlocked + 1 };
      newlyUnlocked = SOUND_ORDER[profile.unlocked - 1];
    }
  }
  return { profile, starsEarned, newlyUnlocked };
}

export interface SRoundSummary { profile: SoundsProfile; starsEarned: number; firstTry: number; tierChange: -1 | 0 | 1; newItem: boolean }

export function finishRound(p: SoundsProfile): SRoundSummary {
  const { firstTry, stars } = p.round;
  let tier = p.tier;
  let tierChange: -1 | 0 | 1 = 0;
  if (firstTry >= ROUND_LENGTH - 1 && tier < tierCap(p.unlocked) && !p.focus) {
    tier++;
    tierChange = 1;
  } else if (firstTry <= 2 && tier > 0) {
    tier--;
    tierChange = -1;
  }
  const items = Math.min(INSTRUMENTS.length, Math.floor(p.stars / STARS_PER_ITEM));
  const profile: SoundsProfile = { ...p, tier, rounds: p.rounds + 1, round: { done: 0, firstTry: 0, stars: 0 }, items };
  return { profile, starsEarned: stars, firstTry, tierChange, newItem: items > p.items };
}

export const allSoundLetters = () => ALPHABET.map((l) => l.id);
