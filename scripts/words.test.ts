/** Run with: npx tsx --test scripts/words.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALPHABET, LETTER_BY_ID } from '../src/firstSteps/letters';
import { WORDS, WORD_BY_ID } from '../src/firstSteps/wordData';
import {
  FOCUS_MISSES, LEVELS, MAX_LEVEL, W_ROUND_LENGTH, eligibleWords, finishRound, firstEmpty, fitsSlot,
  initialPlaced, makeQuestion, newWordProfile, recordComplete, recordWrong,
} from '../src/firstSteps/wordEngine';
import { W_FIXED, W_PRAISE, W_RETRY, W_BUILD, W_MISSING, W_FIND_PIC, W_FIND_LETTER, wordPhrases } from '../src/firstSteps/wordPhrases';

let seed = 7;
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const NIQQUD = /[֑-ׇ]/g;

test('every word uses only the 22 base letters and is spelled from its letter ids', () => {
  const finals = /[ךםןףץ]/;
  for (const w of WORDS) {
    assert.ok(w.text.length >= 2 && w.text.length <= 4, w.text);
    assert.ok(!finals.test(w.text), `${w.text} has a final letter`);
    assert.equal(w.letters.map((id) => LETTER_BY_ID[id].char).join(''), w.text);
    assert.equal(w.speak.replace(NIQQUD, ''), w.text, `speak form of ${w.text} does not match its spelling`);
  }
  assert.equal(new Set(WORDS.map((w) => w.id)).size, WORDS.length);
  assert.equal(new Set(WORDS.map((w) => w.emoji)).size, WORDS.length, 'emoji must be unique so pictures are unambiguous');
});

test('there are enough words of each length', () => {
  for (const n of [2, 3, 4]) assert.ok(WORDS.filter((w) => w.letters.length === n).length >= 5, `length ${n}`);
});

test('questions are always solvable: tiles contain every needed letter, prefill is valid', () => {
  for (let level = 0; level <= MAX_LEVEL; level++) {
    for (const known of [10, 14, 22]) {
      let p = { ...newWordProfile(), level };
      for (let i = 0; i < 80; i++) {
        const q = makeQuestion(p, known, rng);
        const w = WORD_BY_ID[q.wordId];
        const needed = w.letters.filter((_, k) => !q.prefill.includes(k));
        assert.ok(needed.length >= 1, 'at least one tile must be placed');
        const pool = q.tiles.map((t) => t.letter);
        for (const l of needed) assert.ok(pool.includes(l), `${w.text}: missing tile ${l}`);
        assert.equal(new Set(q.tiles.map((t) => t.id)).size, q.tiles.length);
        // distractors never appear in the word (no ambiguity)
        assert.equal(pool.length - needed.length, pool.filter((l) => !w.letters.includes(l)).length);
        if (q.mode === 'missing') assert.equal(needed.length, 1);
        if (q.mode === 'picture') {
          assert.ok(q.pics.includes(q.wordId) && q.pics.length >= 2);
          assert.equal(new Set(q.pics.map((id) => WORD_BY_ID[id].emoji)).size, q.pics.length);
        }
        p = recordComplete(p, q, 0).profile;
      }
    }
  }
});

test('level 0 is easy: 2-letter words, first letter given, ghosts, one distractor', () => {
  for (let i = 0; i < 40; i++) {
    const q = makeQuestion(newWordProfile(), 10, rng);
    assert.equal(WORD_BY_ID[q.wordId].letters.length, 2);
    assert.equal(q.mode, 'build');
    assert.deepEqual(q.prefill, [0]);
    assert.ok(q.ghosts);
    assert.equal(q.tiles.length, 2);
  }
});

test('higher levels: longer words, no ghosts, more tiles, all modes appear without repeating back to back', () => {
  let p = { ...newWordProfile(), level: 3 };
  const modes = new Set<string>();
  let last = '';
  for (let i = 0; i < 80; i++) {
    const q = makeQuestion(p, 22, rng);
    assert.equal(q.ghosts, false);
    assert.notEqual(q.mode, last);
    last = q.mode;
    modes.add(q.mode);
    p = recordComplete(p, q, 0).profile;
  }
  assert.equal(modes.size, 3);
  assert.ok(LEVELS[5].distract > LEVELS[0].distract);
});

test('words prefer letters the child already knows', () => {
  const known = ALPHABET.slice(0, 10).map((l) => l.id);
  for (const w of eligibleWords(10, [2, 3])) assert.ok(w.letters.every((l) => known.includes(l)));
});

test('placing: tap goes to the first empty slot; only the right letter fits', () => {
  const q = makeQuestion({ ...newWordProfile(), level: 3 }, 22, rng);
  const placed = initialPlaced(q);
  const slot = firstEmpty(placed);
  const w = WORD_BY_ID[q.wordId];
  assert.equal(slot, q.prefill.length ? Math.max(...q.prefill) + 1 : 0);
  assert.ok(fitsSlot(q, slot, w.letters[slot]));
  const wrong = ALPHABET.find((l) => l.id !== w.letters[slot])!.id;
  assert.ok(!fitsSlot(q, slot, wrong));
});

test('repeated misses on a letter put the word in focus: easier setup, comes back soon', () => {
  let p = { ...newWordProfile(), level: 3 };
  let triggered = false;
  for (let i = 0; i < FOCUS_MISSES; i++) {
    const r = recordWrong(p, 'דג', 'dalet');
    p = r.profile;
    triggered ||= r.focusTriggered;
  }
  assert.ok(triggered);
  assert.equal(p.focus?.wordId, 'דג');
  assert.equal(p.level, 2);
  const q = makeQuestion({ ...p, last: 'כלב' }, 22, rng);
  assert.equal(q.wordId, 'דג');
  assert.equal(q.ghosts, true);
  assert.ok(q.tiles.length <= WORD_BY_ID['דג'].letters.length + 1);
  // not twice in a row
  assert.notEqual(makeQuestion({ ...p, last: 'דג' }, 22, rng).wordId, 'דג');
  // two clean answers clear it
  let r = p;
  for (let i = 0; i < 2; i++) r = recordComplete({ ...r, last: null }, { ...q, wordId: 'דג' }, 0).profile;
  assert.equal(r.focus, null);
});

test('stars, collection and rounds', () => {
  const q = makeQuestion(newWordProfile(), 10, rng);
  const a = recordComplete(newWordProfile(), q, 0);
  assert.equal(a.starsEarned, 2);
  assert.ok(a.isNewWord);
  assert.deepEqual(a.profile.collection, [q.wordId]);
  assert.equal(recordComplete(a.profile, q, 2).starsEarned, 1);
  assert.ok(!recordComplete(a.profile, q, 0).isNewWord);
  const good = { ...newWordProfile(), level: 1, round: { done: W_ROUND_LENGTH, firstTry: 5, stars: 10, words: ['דג'] } };
  assert.equal(finishRound(good).profile.level, 2);
  const bad = { ...good, level: 2, round: { ...good.round, firstTry: 1 } };
  assert.equal(finishRound(bad).profile.level, 1);
  assert.equal(finishRound({ ...good, level: 0, round: { ...good.round, firstTry: 0 } }).profile.level, 0);
});

test('wordPhrases covers every sentence the game can say', () => {
  const all = new Set(wordPhrases());
  // building blocks used by WordGame.tsx
  for (const s of [...W_FIXED, ...W_PRAISE, ...W_RETRY, W_BUILD, W_MISSING, W_FIND_PIC, W_FIND_LETTER]) assert.ok(all.has(s), s);
  for (const w of WORDS) assert.ok(all.has(w.speak), `word ${w.text}`);
  for (const l of ALPHABET) assert.ok(all.has(l.speak), `letter ${l.name}`);
  assert.equal(all.size, wordPhrases().length, 'no duplicates inside the word phrases');
  assert.ok(all.size < 120, 'keep the number of audio clips small');
});

test('a word in focus returns at most twice per round, never back to back', () => {
  let p = { ...newWordProfile(), level: 3 };
  for (let i = 0; i < FOCUS_MISSES; i++) p = recordWrong(p, 'דג', 'dalet').profile;
  assert.equal(p.focus?.wordId, 'דג');
  for (let trial = 0; trial < 30; trial++) {
    let cur = { ...p, last: null, focus: { wordId: 'דג', left: 2 }, round: { done: 0, firstTry: 0, stars: 0, words: [] as string[] } };
    const asked: string[] = [];
    for (let i = 0; i < W_ROUND_LENGTH; i++) {
      const q = makeQuestion(cur, 22, rng);
      asked.push(q.wordId);
      // answer with a mistake so the focus never clears
      cur = recordComplete(cur, q, 1).profile;
      cur = { ...cur, focus: { wordId: 'דג', left: 2 } };
    }
    assert.ok(asked.filter((x) => x === 'דג').length <= 2, asked.join(','));
    for (let i = 1; i < asked.length; i++) assert.notEqual(asked[i], asked[i - 1]);
  }
});
