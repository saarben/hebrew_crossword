/** Run with: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FOCUS_THRESHOLD, ROUND_LENGTH, finishRound, makeQuestion, markIntroduced, newProfile,
  nextIntro, poolIds, lettersLearned, prompt, recordCorrect, recordWrong, tierCap, MAX_TIER, TIER_OPTIONS,
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

// ---------------------------------------------------------------- drawing game
import { STROKES } from '../src/firstSteps/strokes';
import { begin, createTracer, end, move, moveSegment, resample } from '../src/firstSteps/tracer';
import {
  DRAW_ORDER, modeFor, newDrawProfile, pickDrawLetter, radiusFor, recordDraw, starsFor,
} from '../src/firstSteps/drawEngine';
import type { Pt } from '../src/firstSteps/strokes';

/** Simulate a finger following every stroke exactly. */
function traceAll(strokes: Pt[][], radius = 9, jitter = 0) {
  const t = createTracer(strokes, radius);
  let last = '';
  for (const s of strokes) {
    const pts = resample(s, 1.5).map(([x, y]) => [x + jitter, y - jitter] as Pt);
    assert.ok(begin(t, pts[0]), 'must be able to start at the start dot');
    for (let i = 1; i < pts.length; i++) last = moveSegment(t, pts[i - 1], pts[i]) === 'none' ? last : last;
    end(t);
  }
  return t;
}

test('all 22 letters have valid strokes inside the box', () => {
  assert.equal(Object.keys(STROKES).length, 22);
  for (const id of DRAW_ORDER) {
    const { strokes } = STROKES[id];
    assert.ok(strokes.length >= 1 && strokes.length <= 3, id);
    for (const s of strokes) {
      assert.ok(s.length >= 2, id);
      for (const [x, y] of s) assert.ok(x >= 5 && x <= 95 && y >= 5 && y <= 97, `${id} point out of box`);
    }
  }
  assert.equal(new Set(DRAW_ORDER).size, 22);
  assert.ok(DRAW_ORDER.every((id) => id in STROKES));
});

test('following every stroke exactly completes every letter, even with a wobbly finger', () => {
  for (const id of DRAW_ORDER) {
    assert.ok(traceAll(STROKES[id].strokes).done, `${id} perfect trace`);
    assert.ok(traceAll(STROKES[id].strokes, 9, 4).done, `${id} wobbly trace`);
  }
});

test('starting far from the start dot does not activate tracing', () => {
  const t = createTracer(STROKES.bet.strokes);
  assert.equal(begin(t, [90, 90]), false);
  assert.equal(move(t, [60, 24]), 'none');
  assert.equal(t.idx, 0);
});

test('scribbling over the letter out of order does not complete it', () => {
  const t = createTracer(STROKES.shin.strokes);
  // start on the start dot, then jump to the far end of the stroke and wiggle there
  assert.ok(begin(t, STROKES.shin.strokes[0][0]));
  for (let i = 0; i < 50; i++) move(t, [74, 22 + (i % 5)]);
  assert.equal(t.done, false);
  assert.equal(t.stroke, 0);
});

test('lifting the finger keeps progress; resuming must be near where you stopped', () => {
  const stroke = STROKES.resh.strokes[0];
  const t = createTracer([stroke]);
  const pts = resample(stroke, 1.5);
  begin(t, pts[0]);
  for (let i = 1; i < Math.floor(pts.length / 2); i++) moveSegment(t, pts[i - 1], pts[i]);
  const half = t.idx;
  assert.ok(half > 5);
  end(t);
  assert.equal(begin(t, pts[0]), false, 'restarting at the start dot is too far from the traced end');
  assert.equal(begin(t, pts[Math.floor(pts.length / 2)]), true);
  assert.equal(t.idx, half);
});

test('wandering far off the path counts a stray once per excursion', () => {
  const t = createTracer(STROKES.dalet.strokes);
  begin(t, STROKES.dalet.strokes[0][0]);
  assert.equal(move(t, [50, 70]), 'stray');
  assert.equal(move(t, [52, 72]), 'none');
  assert.equal(t.strays, 1);
});

test('draw progression: new letters first, unlock after success, struggle brings back the full guide', () => {
  let p = newDrawProfile();
  assert.equal(pickDrawLetter(p), 'vav');
  assert.equal(modeFor(p, 'vav'), 'trace');
  // a perfect first drawing raises the skill and moves on to the next new letter
  p = recordDraw(p, 'vav', 0, false).profile;
  assert.equal(modeFor(p, 'vav'), 'dots');
  assert.equal(pickDrawLetter(p), 'yod');
  // a messy attempt: no promotion, marked as struggling, guide + bigger tolerance
  const messy = recordDraw(p, 'yod', 9, false);
  assert.equal(messy.stars, 1);
  assert.equal(modeFor(messy.profile, 'yod'), 'trace');
  assert.ok(radiusFor('trace', true) > radiusFor('trace', false));
  // letters all drawn at least decently -> the next letter unlocks
  p = recordDraw(p, 'yod', 0, false).profile;
  const r = recordDraw(p, 'resh', 0, false);
  assert.equal(r.unlocked, 'dalet');
  assert.equal(r.profile.unlocked, 4);
  assert.deepEqual(r.profile.gallery, ['vav', 'yod', 'resh']);
});

test('a struggling letter is asked again far more often', () => {
  let p = { ...newDrawProfile(), unlocked: 6 };
  for (const id of DRAW_ORDER.slice(0, 6)) p = recordDraw(p, id, 0, false).profile;
  p = { ...p, unlocked: 6, last: 'resh', letters: { ...p.letters, dalet: { ...p.letters.dalet, struggle: true, box: 0 } } };
  let hits = 0;
  for (let i = 0; i < 400; i++) if (pickDrawLetter(p, rng) === 'dalet') hits++;
  assert.ok(hits > 400 * 0.3, `dalet picked ${hits}/400`);
  assert.equal(starsFor(0, false), 3);
  assert.equal(starsFor(0, true), 2);
});

test('letters learned counts mastered letters: 0 for a fresh or reset profile', () => {
  assert.equal(lettersLearned(newProfile()), 0);
  let p = newProfile();
  const q = { type: 'find' as const, target: 'alef', options: ['alef', 'bet'] };
  p = recordCorrect(recordCorrect(p, q, 0).profile, q, 0).profile; // two clean answers
  assert.equal(lettersLearned(p), 1);
  assert.equal(lettersLearned(newProfile()), 0);
});
