import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALPHABET } from '../src/firstSteps/letters';
import { allPhrases } from '../src/firstSteps/phrases';
import { newProfile, makeQuestion, recordCorrect, recordWrong, finishRound, ROUND_LENGTH, FOCUS_THRESHOLD } from '../src/firstSteps/engine';
import { HATS, feedPhrases, feedPrompt, hatFor, hintLine, inZone, itemKind, layoutFor } from '../src/firstSteps/feedEngine';

test('every letter and question type has a Hebrew monster prompt that is in the phrase list', () => {
  const all = new Set(allPhrases());
  for (const l of ALPHABET) {
    for (const type of ['find', 'balloons', 'word', 'picture'] as const) {
      const p = feedPrompt({ type, target: l.id, options: [] });
      assert.match(p.speak, /המפלצת|תפוס/);
      assert.ok(all.has(p.speak), `missing audio phrase: ${p.speak}`);
      assert.ok(p.text.length > 8);
    }
    assert.ok(all.has(hintLine(l)));
  }
  assert.ok(feedPhrases().length > 100);
});

test('balloon questions rain down; picture questions use pictures', () => {
  assert.equal(layoutFor('balloons'), 'rain');
  assert.equal(layoutFor('find'), 'tray');
  assert.equal(itemKind('picture'), 'picture');
  assert.equal(itemKind('word'), 'letter');
});

test('drop zone: on the monster counts, far away does not (generous padding)', () => {
  const r = { left: 300, right: 600, top: 400, bottom: 700 };
  assert.ok(inZone({ x: 450, y: 550 }, r));
  assert.ok(inZone({ x: 290, y: 395 }, r)); // just outside, within padding
  assert.ok(!inZone({ x: 100, y: 100 }, r));
});

test('hats: first hat after the first sticker, then they cycle', () => {
  assert.equal(hatFor(0), null);
  assert.equal(hatFor(1), HATS[0]);
  assert.equal(hatFor(HATS.length + 1), HATS[0]);
});

test('a feeding session with the shared engine: rewards, focus on repeated mistakes', () => {
  let p = newProfile();
  let seed = 3;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < ROUND_LENGTH; i++) p = recordCorrect(p, makeQuestion(p, rng), 0).profile;
  const s = finishRound(p);
  assert.equal(s.firstTry, ROUND_LENGTH);
  assert.ok(s.newSticker, 'a perfect round earns a hat');
  let q = s.profile;
  let triggered = false;
  for (let i = 0; i < FOCUS_THRESHOLD; i++) {
    const r = recordWrong(q, 'alef');
    q = r.profile;
    triggered ||= r.focusTriggered;
  }
  assert.ok(triggered && q.focus?.id === 'alef');
});
