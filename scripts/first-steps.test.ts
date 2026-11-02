/** Run with: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FOCUS_THRESHOLD, ROUND_LENGTH, finishRound, makeQuestion, markIntroduced, newProfile,
  nextIntro, poolIds, prompt, recordCorrect, recordWrong, tierCap, MAX_TIER, TIER_OPTIONS,
} from '../src/firstSteps/engine';
import { ALPHABET } from '../src/firstSteps/letters';
import { allPhrases } from '../src/firstSteps/phrases';

let seed = 42;
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('starts with 3 letters and teaches them first', () => {
  const p = newProfile();
  assert.equal(poolIds(p).length, 3);
  assert.equal(nextIntro(p), 'alef');
  assert.equal(nextIntro(markIntroduced(markIntroduced(markIntroduced(p, 'alef'), 'bet'), 'gimel')), null);
});

test('every question contains its target, no duplicates, only unlocked letters', () => {
  for (let unlocked = 3; unlocked <= 22; unlocked++) {
    for (let tier = 0; tier <= MAX_TIER; tier++) {
      const p = { ...newProfile(), unlocked, tier };
      for (let i = 0; i < 60; i++) {
        const q = makeQuestion(p, rng);
        assert.ok(q.options.includes(q.target));
        assert.equal(new Set(q.options).size, q.options.length);
        assert.ok(q.options.every((o) => poolIds(p).includes(o)));
        assert.ok(q.options.length <= Math.max(2, TIER_OPTIONS[tier]));
        assert.ok(q.options.length >= 2);
      }
    }
  }
});

test('question types are varied and never repeat back to back', () => {
  let p = { ...newProfile(), unlocked: 8, tier: 3 };
  const seen = new Set<string>();
  let last = '';
  for (let i = 0; i < 100; i++) {
    const q = makeQuestion(p, rng);
    assert.notEqual(q.type, last);
    seen.add(q.type);
    last = q.type;
    p = recordCorrect(p, q, 0).profile;
  }
  assert.equal(seen.size, 4);
});

test('repeated mistakes on a letter trigger focus mode and ease the difficulty', () => {
  let p = { ...newProfile(), unlocked: 6, tier: 3 };
  let triggered = false;
  for (let i = 0; i < FOCUS_THRESHOLD; i++) {
    const r = recordWrong(p, 'dalet');
    p = r.profile;
    triggered ||= r.focusTriggered;
  }
  assert.ok(triggered);
  assert.equal(p.focus?.id, 'dalet');
  assert.equal(p.tier, 2);
  // the troubled letter comes back soon, with only 2 easy choices
  const q = makeQuestion({ ...p, lastTarget: 'alef' }, rng);
  assert.equal(q.target, 'dalet');
  assert.equal(q.options.length, 2);
  // and it is not asked twice in a row
  assert.notEqual(makeQuestion({ ...p, lastTarget: 'dalet' }, rng).target, 'dalet');
});

test('focus is released after enough clean answers', () => {
  let p = { ...newProfile(), unlocked: 6, tier: 2, focus: { id: 'dalet', left: 3 } };
  for (let i = 0; i < 3; i++) p = recordCorrect(p, { type: 'find', target: 'dalet', options: ['dalet', 'alef'] }, 0).profile;
  assert.equal(p.focus, null);
});

test('good rounds raise the tier (within the cap), bad rounds lower it', () => {
  const good = { ...newProfile(), unlocked: 6, tier: 1, round: { done: ROUND_LENGTH, firstTry: 5, stars: 10 } };
  assert.equal(finishRound(good).profile.tier, 2);
  const capped = { ...good, unlocked: 3, tier: tierCap(3) };
  assert.equal(finishRound(capped).profile.tier, tierCap(3));
  const bad = { ...good, tier: 2, round: { done: ROUND_LENGTH, firstTry: 1, stars: 5 } };
  assert.equal(finishRound(bad).profile.tier, 1);
});

test('a child who always answers correctly unlocks letters steadily, all the way', () => {
  let p = newProfile();
  for (let r = 0; r < 200 && p.unlocked < ALPHABET.length; r++) {
    for (let q = 0; q < ROUND_LENGTH; q++) {
      for (let id = nextIntro(p); id; id = nextIntro(p)) p = markIntroduced(p, id);
      p = recordCorrect(p, makeQuestion(p, rng), 0).profile;
    }
    p = finishRound(p).profile;
  }
  assert.equal(p.unlocked, ALPHABET.length);
  assert.ok(p.stars > 0 && p.stickers > 0);
});

test('stars: 2 for first try, 1 after mistakes; stickers every 10 stars', () => {
  const q = { type: 'find' as const, target: 'alef', options: ['alef', 'bet'] };
  assert.equal(recordCorrect(newProfile(), q, 0).starsEarned, 2);
  assert.equal(recordCorrect(newProfile(), q, 1).starsEarned, 1);
  const r = finishRound({ ...newProfile(), stars: 12, round: { done: 5, firstTry: 3, stars: 8 } });
  assert.ok(r.newSticker);
});

test('prompts are spoken in Hebrew and name the letter', () => {
  for (const l of ALPHABET)
    for (const type of ['find', 'balloons', 'word', 'picture'] as const) {
      const { speak, text } = prompt({ type, target: l.id, options: [] });
      assert.match(speak, /[א-ת]/);
      assert.ok(speak.length > 8 && text.length > 8);
    }
});

test('phrase list is complete and has no duplicates', () => {
  const p = allPhrases();
  assert.equal(new Set(p).size, p.length);
  assert.ok(p.length > 150);
});

// Strict only in CI after generation (REQUIRE_AUDIO=1); otherwise checked when present.
test('recorded audio covers every phrase the game can say', (t) => {
  const dir = path.resolve('public/audio/first-steps');
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    if (process.env.REQUIRE_AUDIO) assert.fail('no audio manifest generated');
    return t.skip('audio not generated yet (npm run audio)');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const phrase of allPhrases()) {
    const file = manifest[phrase];
    assert.ok(file, `no audio for: ${phrase}`);
    const stat = fs.statSync(path.join(dir, file));
    assert.ok(stat.size > 1500, `audio too small: ${phrase}`);
  }
});
