/** Run with: npx tsx --test scripts/sounds.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALPHABET } from '../src/firstSteps/letters';
import {
  FIXED_LINES, FOCUS_THRESHOLD, INSTRUMENTS, MAX_TIER, ROUND_LENGTH, SOUND_ORDER, SYLLABLE, TIER_OPTIONS,
  finishRound, hintSpeech, lessonSpeech, makeQuestion, markIntroduced, newSoundsProfile, nextIntro,
  prompt, recordCorrect, recordWrong, reinforce, soundAlike, soundsPool, tierCap, type SType,
} from '../src/firstSteps/soundsEngine';
import { soundsPhrases } from '../src/firstSteps/soundsPhrases';

let seed = 99;
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const TYPES: SType[] = ['hear', 'word', 'picture', 'catch'];

test('every letter has a syllable and a place in the teaching order', () => {
  assert.equal(SOUND_ORDER.length, 22);
  assert.equal(new Set(SOUND_ORDER).size, 22);
  for (const l of ALPHABET) {
    assert.ok(SYLLABLE[l.id], l.id);
    assert.ok(SOUND_ORDER.includes(l.id), l.id);
    assert.ok(SYLLABLE[l.id].startsWith(l.char));
  }
  // hard sounds carry a dagesh (U+05BC)
  for (const id of ['bet', 'kaf', 'pe', 'tav', 'gimel', 'dalet']) assert.ok(SYLLABLE[id].includes('ּ'), id);
});

test('starts with 3 letters and teaches each new letter first', () => {
  const p = newSoundsProfile();
  assert.deepEqual(soundsPool(p), ['mem', 'bet', 'shin']);
  assert.equal(nextIntro(p), 'mem');
  let q = p;
  for (const id of soundsPool(p)) q = markIntroduced(q, id);
  assert.equal(nextIntro(q), null);
});

test('questions are valid for every tier and pool size', () => {
  for (let unlocked = 3; unlocked <= 22; unlocked++)
    for (let tier = 0; tier <= MAX_TIER; tier++) {
      const p = { ...newSoundsProfile(), unlocked, tier };
      for (let i = 0; i < 40; i++) {
        const q = makeQuestion(p, rng);
        assert.ok(q.options.includes(q.target));
        assert.equal(new Set(q.options).size, q.options.length);
        assert.ok(q.options.every((o) => soundsPool(p).includes(o)));
        assert.ok(q.options.length >= 2 && q.options.length <= Math.max(2, TIER_OPTIONS[tier]));
      }
    }
});

test('question types rotate (never the same twice) and are all used at higher tiers', () => {
  let p = { ...newSoundsProfile(), unlocked: 9, tier: 3 };
  const seen = new Set<string>();
  let last = '';
  for (let i = 0; i < 120; i++) {
    const q = makeQuestion(p, rng);
    assert.notEqual(q.type, last);
    seen.add(q.type);
    last = q.type;
    p = recordCorrect(p, q, 0).profile;
  }
  assert.equal(seen.size, 4);
});

test('tier 0 only uses the easy, picture-anchored types', () => {
  const p = newSoundsProfile();
  for (let i = 0; i < 60; i++) assert.ok(['word', 'picture'].includes(makeQuestion(p, rng).type));
});

test('hard tiers include sound-alike distractors', () => {
  const p = { ...newSoundsProfile(), unlocked: 22, tier: 4 };
  let withAlike = 0;
  for (let i = 0; i < 100; i++) {
    const q = makeQuestion({ ...p, lastTarget: null }, rng);
    if (q.options.some((o) => o !== q.target && soundAlike(o, q.target))) withAlike++;
  }
  assert.ok(withAlike > 40, `only ${withAlike}/100 had a sound-alike`);
});

test('repeated mistakes on a letter trigger focus: easy 2-choice question and lower tier', () => {
  let p = { ...newSoundsProfile(), unlocked: 8, tier: 3 };
  let triggered = false;
  for (let i = 0; i < FOCUS_THRESHOLD; i++) {
    const r = recordWrong(p, 'bet');
    p = r.profile;
    triggered ||= r.focusTriggered;
  }
  assert.ok(triggered);
  assert.equal(p.focus?.id, 'bet');
  assert.equal(p.tier, 2);
  const q = makeQuestion({ ...p, lastTarget: 'mem' }, rng);
  assert.equal(q.target, 'bet');
  assert.equal(q.options.length, 2);
  assert.notEqual(makeQuestion({ ...p, lastTarget: 'bet' }, rng).target, 'bet');
  // rescued after enough clean answers
  for (let i = 0; i < 3; i++) p = recordCorrect(p, { type: 'word', target: 'bet', options: ['bet', 'mem'] }, 0).profile;
  assert.equal(p.focus, null);
});

test('rounds move the tier up/down and stay within the cap', () => {
  const good = { ...newSoundsProfile(), unlocked: 6, tier: 1, round: { done: ROUND_LENGTH, firstTry: 5, stars: 10 } };
  assert.equal(finishRound(good).profile.tier, 2);
  assert.equal(finishRound({ ...good, unlocked: 3, tier: tierCap(3) }).profile.tier, tierCap(3));
  assert.equal(finishRound({ ...good, tier: 2, round: { done: 5, firstTry: 1, stars: 5 } }).profile.tier, 1);
});

test('a perfect child unlocks all 22 letters and earns every instrument', () => {
  let p = newSoundsProfile();
  for (let r = 0; r < 400 && (p.unlocked < 22 || p.items < INSTRUMENTS.length); r++) {
    for (let i = 0; i < ROUND_LENGTH; i++) {
      for (let id = nextIntro(p); id; id = nextIntro(p)) p = markIntroduced(p, id);
      p = recordCorrect(p, makeQuestion(p, rng), 0).profile;
    }
    p = finishRound(p).profile;
  }
  assert.equal(p.unlocked, 22);
  assert.equal(p.items, INSTRUMENTS.length);
});

test('stars: 2 first try, 1 after mistakes; an instrument every 8 stars', () => {
  const q = { type: 'word' as const, target: 'mem', options: ['mem', 'bet'] };
  assert.equal(recordCorrect(newSoundsProfile(), q, 0).starsEarned, 2);
  assert.equal(recordCorrect(newSoundsProfile(), q, 2).starsEarned, 1);
  const r = finishRound({ ...newSoundsProfile(), stars: 9, round: { done: 5, firstTry: 3, stars: 6 } });
  assert.ok(r.newItem);
  assert.equal(r.profile.items, 1);
});

test('soundsPhrases covers every sentence the game can speak', () => {
  const have = new Set(soundsPhrases());
  assert.equal(have.size, soundsPhrases().length, 'no duplicates');
  for (const f of FIXED_LINES) assert.ok(have.has(f), f);
  for (const l of ALPHABET) {
    for (const type of TYPES) for (const s of prompt({ type, target: l.id, options: [] }).speak) assert.ok(have.has(s), `${type}/${l.id}: ${s}`);
    for (const again of [true, false]) for (const s of lessonSpeech(l.id, again)) assert.ok(have.has(s), s);
    for (const s of hintSpeech(l.id)) assert.ok(have.has(s), s);
    for (const praise of ['כל הכבוד!', 'יופי!', 'מעולה!', 'אלוף!', 'נכון מאוד!', 'וואו!', 'מצוין!']) for (const s of reinforce(l.id, praise)) assert.ok(have.has(s), s);
  }
  assert.ok(have.size < 200, `${have.size} clips is more than needed`);
});
