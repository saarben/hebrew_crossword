import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Home, Volume2, VolumeX, Lock } from 'lucide-react';
import { LETTER_BY_ID } from './letters';
import { WORDS, WORD_BY_ID } from './wordData';
import {
  Tile, WordProfile, WordQuestion, WordRoundSummary, W_ROUND_LENGTH,
  finishRound, firstEmpty, fitsSlot, initialPlaced, makeQuestion, recordComplete, recordWrong,
} from './wordEngine';
import { loadWordProfile, saveWordProfile } from './wordStorage';
import { loadProfile } from './storage';
import { setSpeechEnabled, speak, stopSpeaking } from './speech';
import { setSfxEnabled, sfx } from './sfx';
import { W_BUILD, W_FIND_LETTER, W_FIND_PIC, W_INTRO, W_MISSING, W_PRAISE, W_RETRY, W_ROUND_DONE } from './wordPhrases';
import { BigButton, Mascot, StarsChip, burst, burstAt } from './ui';
import { trackEvent } from '../analytics';

const COLORS = ['#FF9AA2', '#FFD166', '#7EE0B0', '#7DC8FF', '#C3B1FF', '#FFB3DE'];
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Screen = 'play' | 'round' | 'dict';
type Phase = 'pick' | 'build' | 'done';

interface Drag {
  id: number;
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  moved: boolean;
}

/** Letters the child already knows from the letter game (at least a starter set). */
function knownLetters(): number {
  try {
    return loadProfile().unlocked;
  } catch {
    return 10;
  }
}

function promptParts(q: WordQuestion, phase: Phase): string[] {
  const w = WORD_BY_ID[q.wordId];
  if (q.mode === 'picture' && phase === 'pick') return [W_FIND_PIC, w.speak];
  if (q.mode === 'missing') return [W_MISSING, w.speak];
  return [W_BUILD, w.speak];
}

export default function WordGame({ onExit }: { onExit: () => void }) {
  const [profile, setProfile] = useState<WordProfile>(() => loadWordProfile());
  const profileRef = useRef(profile);
  const [screen, setScreen] = useState<Screen>('play');
  const [q, setQ] = useState<WordQuestion | null>(null);
  const [qKey, setQKey] = useState(0);
  const [placed, setPlaced] = useState<(string | null)[]>([]);
  const [used, setUsed] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('build');
  const [hint, setHint] = useState(false);
  const [wiggle, setWiggle] = useState<{ id: number; n: number } | null>(null);
  const [wrongPics, setWrongPics] = useState<string[]>([]);
  const [summary, setSummary] = useState<WordRoundSummary | null>(null);
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return loadProfile().soundOn;
    } catch {
      return true;
    }
  });
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mistakes = useRef(0);
  const run = useRef(0);
  const placedRef = useRef<(string | null)[]>([]);

  const commit = useCallback((p: WordProfile) => {
    profileRef.current = p;
    setProfile(p);
    saveWordProfile(p);
  }, []);

  useEffect(() => {
    setSpeechEnabled(soundOn);
    setSfxEnabled(soundOn);
  }, [soundOn]);

  useEffect(
    () => () => {
      run.current++;
      stopSpeaking();
    },
    [],
  );

  const goNext = useCallback(() => {
    const nq = makeQuestion(profileRef.current, knownLetters());
    const init = initialPlaced(nq);
    placedRef.current = init;
    mistakes.current = 0;
    setQ(nq);
    setPlaced(init);
    setUsed([]);
    setHint(false);
    setWrongPics([]);
    setPhase(nq.mode === 'picture' ? 'pick' : 'build');
    setQKey((k) => k + 1);
    setScreen('play');
  }, []);

  // start
  useEffect(() => {
    const first = profileRef.current.rounds === 0 && profileRef.current.collection.length === 0;
    goNext();
    if (first) void speak(W_INTRO);
  }, [goNext]);

  // read the question aloud; repeat it if the child is idle
  useEffect(() => {
    if (screen !== 'play' || !q || phase === 'done') return;
    const say = () => void speak(promptParts(q, phase));
    const first = setTimeout(say, profileRef.current.rounds === 0 && qKey === 1 ? 1600 : 450);
    const idle = setInterval(say, 15000);
    return () => {
      clearTimeout(first);
      clearInterval(idle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qKey, screen, phase]);

  useEffect(() => {
    if (screen === 'round' && summary) {
      sfx.fanfare();
      burst(0.5, 0.35, true);
      void speak(W_ROUND_DONE);
    }
  }, [screen, summary]);

  const advance = useCallback(() => {
    const p = profileRef.current;
    if (p.round.done >= W_ROUND_LENGTH) {
      const s = finishRound(p);
      commit(s.profile);
      setSummary(s);
      setScreen('round');
      trackEvent('first_steps_words_round', { first_try: s.firstTry, level: s.profile.level });
    } else {
      goNext();
    }
  }, [commit, goNext]);

  const complete = (e?: React.SyntheticEvent) => {
    if (!q) return;
    const word = WORD_BY_ID[q.wordId];
    setPhase('done');
    sfx.correct();
    e && burstAt(e);
    burst(0.5, 0.35, true);
    const res = recordComplete(profileRef.current, q, mistakes.current);
    commit(res.profile);
    const parts = [...word.letters.map((l) => LETTER_BY_ID[l].speak), word.speak, pick(W_PRAISE)];
    const my = ++run.current;
    void Promise.all([speak(parts), wait(1500)]).then(() => {
      if (my === run.current) advance();
    });
  };

  const wrongTap = (tile: Tile, slot: number) => {
    if (!q) return;
    sfx.wrong();
    setWiggle({ id: tile.id, n: Date.now() });
    setTimeout(() => setWiggle((w) => (w && w.id === tile.id ? null : w)), 650);
    mistakes.current += 1;
    const word = WORD_BY_ID[q.wordId];
    const r = recordWrong(profileRef.current, q.wordId, word.letters[slot]);
    commit(r.profile);
    if (r.focusTriggered) trackEvent('first_steps_words_focus', { word: q.wordId });
    if (mistakes.current >= 2) {
      // errorless help: fade the wrong tiles, glow the right one
      setHint(true);
      void speak([W_FIND_LETTER, LETTER_BY_ID[word.letters[slot]].speak]);
    } else {
      void speak(pick(W_RETRY));
    }
  };

  /** Try to put `tile` in `slot` (null = the next empty one). */
  const place = (tile: Tile, slot: number | null, e?: React.SyntheticEvent) => {
    if (!q || phase !== 'build') return;
    const cur = placedRef.current;
    const idx = slot ?? firstEmpty(cur);
    if (idx < 0 || cur[idx] !== null || used.includes(tile.id)) return;
    if (!fitsSlot(q, idx, tile.letter)) {
      wrongTap(tile, idx);
      return;
    }
    const next = [...cur];
    next[idx] = tile.letter;
    placedRef.current = next;
    setPlaced(next);
    setUsed((u) => [...u, tile.id]);
    if (next.every((x) => x !== null)) {
      complete(e);
    } else {
      sfx.pop();
      void speak(LETTER_BY_ID[tile.letter].speak);
      setHint(false);
    }
  };

  const pickPic = (id: string, e: React.SyntheticEvent) => {
    if (!q || phase !== 'pick' || wrongPics.includes(id)) return;
    const word = WORD_BY_ID[q.wordId];
    if (id === q.wordId) {
      sfx.correct();
      burstAt(e);
      setPhase('build');
      setHint(false);
      void speak([pick(W_PRAISE)]);
    } else {
      sfx.wrong();
      const next = [...wrongPics, id];
      setWrongPics(next);
      if (next.length >= 1 && q.pics.length - 1 - next.length <= 0) void speak([W_FIND_PIC, word.speak]);
      else void speak(pick(W_RETRY));
    }
  };

  // ---- dragging tiles ------------------------------------------------------
  const onTileDown = (tile: Tile, e: React.PointerEvent) => {
    if (phase !== 'build') return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const d: Drag = { id: tile.id, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, moved: false };
    dragRef.current = d;
    setDrag(d);
  };
  const onTileMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    const nd = { ...d, dx, dy, moved: d.moved || Math.hypot(dx, dy) > 8 };
    dragRef.current = nd;
    setDrag(nd);
  };
  const onTileUp = (tile: Tile, e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || d.id !== tile.id) return;
    if (!d.moved) {
      place(tile, null, e);
      return;
    }
    const hit = slotRefs.current.findIndex((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const m = 14;
      return e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m;
    });
    if (hit >= 0) place(tile, hit, e);
  };

  const colors = useMemo(() => [...COLORS].sort(() => Math.random() - 0.5), [qKey]);
  const word = q ? WORD_BY_ID[q.wordId] : null;
  const nextSlot = placed.length ? firstEmpty(placed) : -1;

  // ---- UI ------------------------------------------------------------------
  const topBar = (back: () => void, showProgress = true) => (
    <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
      <button
        aria-label="חזרה"
        onClick={() => {
          sfx.tap();
          back();
        }}
        className="w-16 h-16 rounded-full bg-white/85 shadow flex items-center justify-center text-slate-600 active:scale-90"
      >
        <Home className="w-8 h-8" />
      </button>
      {showProgress ? (
        <div className="flex gap-2" aria-label="התקדמות בסיבוב">
          {Array.from({ length: W_ROUND_LENGTH }, (_, i) => (
            <motion.div
              key={i}
              animate={i < profile.round.done ? { scale: [1, 1.5, 1] } : {}}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${i < profile.round.done ? 'bg-amber-300 shadow' : 'bg-white/60 grayscale opacity-60'}`}
            >
              ⭐
            </motion.div>
          ))}
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-3">
        <StarsChip stars={profile.stars} />
        <button
          aria-label="המילים שלי"
          onClick={() => {
            sfx.tap();
            run.current++;
            stopSpeaking();
            setScreen('dict');
          }}
          className="h-16 px-4 rounded-full bg-white/85 shadow flex items-center justify-center text-3xl active:scale-90"
        >
          📖
        </button>
        <button
          aria-label="צליל"
          onClick={() => setSoundOn((v) => !v)}
          className="w-16 h-16 rounded-full bg-white/85 shadow flex items-center justify-center text-slate-600 active:scale-90"
        >
          {soundOn ? <Volume2 className="w-8 h-8" /> : <VolumeX className="w-8 h-8" />}
        </button>
      </div>
    </div>
  );

  const exit = () => {
    run.current++;
    stopSpeaking();
    onExit();
  };

  if (screen === 'dict') {
    return (
      <div className="fs-root fixed inset-0 overflow-y-auto" dir="rtl">
        <div className="min-h-full flex flex-col">
          {topBar(() => {
            setScreen('play');
            goNext();
          }, false)}
          <div className="px-3 pb-8 max-w-4xl w-full mx-auto">
            <h2 className="text-4xl font-bold text-teal-600 text-center mb-1">המילים שלי</h2>
            <p className="text-xl text-center text-slate-600 mb-4">
              {profile.collection.length} מתוך {WORDS.length} מילים
            </p>
            <div className="flex justify-center mb-4">
              <BigButton
                onClick={() => {
                  setScreen('play');
                  goNext();
                }}
                className="text-3xl px-8 py-4"
              >
                ממשיכים לשחק ▶
              </BigButton>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4">
              {WORDS.map((w) => {
                const got = profile.collection.includes(w.id);
                return (
                  <button
                    key={w.id}
                    disabled={!got}
                    onClick={() => void speak(w.speak)}
                    className={`aspect-square rounded-3xl shadow flex flex-col items-center justify-center active:scale-95 ${got ? 'bg-white' : 'bg-white/40 text-slate-400'}`}
                  >
                    {got ? (
                      <>
                        <span style={{ fontSize: 'clamp(40px,9vmin,70px)', lineHeight: 1 }}>{w.emoji}</span>
                        <span className="text-2xl font-bold text-indigo-700 mt-1">{w.text}</span>
                      </>
                    ) : (
                      <Lock className="w-8 h-8" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'round' && summary) {
    return (
      <div className="fs-root fixed inset-0 overflow-y-auto" dir="rtl">
        <div className="min-h-full flex flex-col">
          {topBar(exit, false)}
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 pb-8 text-center">
            <Mascot size={110} dance />
            <h2 className="text-5xl font-bold text-indigo-700">כל הכבוד!</h2>
            <div className="flex gap-2 flex-wrap justify-center">
              {Array.from({ length: summary.starsEarned }, (_, i) => (
                <motion.span key={i} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.12 * i, type: 'spring' }} className="text-5xl">
                  ⭐
                </motion.span>
              ))}
            </div>
            <div className="flex gap-3 bg-white rounded-[2rem] shadow-xl px-6 py-4">
              {summary.words.map((id, i) => (
                <motion.span key={`${id}-${i}`} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 + i * 0.15 }} style={{ fontSize: 'clamp(40px,9vmin,72px)', lineHeight: 1 }}>
                  {WORD_BY_ID[id].emoji}
                </motion.span>
              ))}
            </div>
            <div className="flex gap-4 flex-wrap justify-center">
              <BigButton onClick={goNext} className="text-4xl px-10 py-5">
                עוד מילים ▶
              </BigButton>
              <BigButton color="bg-sky-500" onClick={() => setScreen('dict')} className="text-3xl px-8 py-5">
                📖 המילים שלי
              </BigButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!q || !word) return <div className="fs-root fixed inset-0" />;

  // smaller tiles when there are many, so two rows still fit a tablet screen
  const SIZE = q.tiles.length > 5 ? 'clamp(62px, 12.5vmin, 108px)' : 'clamp(72px, 15vmin, 128px)';
  const promptText =
    phase === 'pick' ? 'לחצו על התמונה הנכונה' : q.mode === 'missing' ? 'איזו אות חסרה?' : `בואו נבנה את המילה ${word.text}`;
  const target = nextSlot >= 0 ? word.letters[nextSlot] : null;

  return (
    <div className="fs-root fixed inset-0 overflow-y-auto" dir="rtl">
      <style>{`@keyframes fs-wiggle{0%,100%{rotate:0deg}20%{rotate:-12deg}40%{rotate:12deg}60%{rotate:-8deg}80%{rotate:8deg}}.fs-wiggle{animation:fs-wiggle .5s ease-in-out}`}</style>
      <div className="min-h-full flex flex-col">
        {topBar(exit)}
        <div className="flex-1 flex flex-col items-center gap-4 px-3 pb-6">
          <div className="flex items-center gap-3 max-w-3xl w-full justify-center">
            <Mascot size={64} dance={phase === 'done'} />
            <button
              onClick={() => void speak(phase === 'done' ? [word.speak] : promptParts(q, phase))}
              className="flex items-center gap-3 bg-white rounded-[2rem] shadow-lg px-5 py-3 active:scale-95 text-right"
              aria-label="שמע שוב"
            >
              <Volume2 className="w-8 h-8 text-indigo-500 shrink-0" />
              <span className="text-2xl sm:text-3xl font-bold text-slate-700">{promptText}</span>
            </button>
          </div>

          {/* the picture (or the picture choices) */}
          {phase === 'pick' ? (
            <div className="flex-1 flex items-center justify-center gap-6 flex-wrap">
              {q.pics.map((id, i) => {
                const wrong = wrongPics.includes(id);
                return (
                  <motion.button
                    key={`${qKey}-${id}`}
                    initial={{ scale: 0, y: 30 }}
                    animate={wrong ? { x: [0, -12, 12, -8, 8, 0], scale: 0.9, opacity: 0.4, y: 0 } : { scale: 1, y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 16, delay: i * 0.08 }}
                    onClick={(e) => pickPic(id, e)}
                    disabled={wrong}
                    aria-label={WORD_BY_ID[id].text}
                    className="bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center active:scale-95"
                    style={{ width: 'clamp(140px,30vmin,240px)', height: 'clamp(140px,30vmin,240px)', fontSize: 'clamp(80px,18vmin,150px)', lineHeight: 1 }}
                  >
                    {WORD_BY_ID[id].emoji}
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <>
              <motion.button
                key={`pic-${qKey}`}
                onClick={() => void speak([word.speak])}
                initial={{ scale: 0.4 }}
                animate={phase === 'done' ? { scale: [1, 1.25, 1], rotate: [0, -12, 12, -8, 8, 0] } : { scale: 1 }}
                transition={phase === 'done' ? { duration: 1.1 } : { type: 'spring' }}
                aria-label={word.text}
                className="bg-white rounded-full shadow-xl flex items-center justify-center"
                style={{ width: 'clamp(120px,24vmin,200px)', height: 'clamp(120px,24vmin,200px)', fontSize: 'clamp(70px,15vmin,125px)', lineHeight: 1 }}
              >
                {word.emoji}
              </motion.button>

              {/* slots: first letter on the RIGHT (dir=rtl) */}
              <div className="flex gap-3 sm:gap-4 justify-center" dir="rtl" data-testid="slots">
                {word.letters.map((l, i) => {
                  const filled = placed[i];
                  const isPre = q.prefill.includes(i);
                  const isNext = i === nextSlot && phase === 'build';
                  return (
                    <div
                      key={i}
                      ref={(el) => {
                        slotRefs.current[i] = el;
                      }}
                      data-slot={i}
                      className={`relative rounded-3xl flex items-center justify-center font-bold ${filled ? '' : 'border-4 border-dashed'} ${isNext ? 'border-indigo-400 bg-white/90' : 'border-slate-300 bg-white/60'}`}
                      style={{ width: SIZE, height: SIZE, fontSize: `calc(${SIZE} * 0.62)`, lineHeight: 1 }}
                    >
                      {filled ? (
                        <motion.span
                          key={`f-${i}-${filled}`}
                          initial={{ scale: isPre ? 1 : 0.2 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                          className={`w-full h-full rounded-3xl flex items-center justify-center ${isPre ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-200 text-slate-800'}`}
                        >
                          {LETTER_BY_ID[filled].char}
                        </motion.span>
                      ) : (
                        (q.ghosts || hint) && (
                          <span className="text-slate-800" style={{ opacity: hint ? 0.5 : 0.18 }}>
                            {LETTER_BY_ID[l].char}
                          </span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>

              {/* tiles */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 max-w-3xl mt-2" data-testid="tiles">
                {q.tiles.map((t, i) => {
                  const isUsed = used.includes(t.id);
                  const right = hint && t.letter === target;
                  const faded = hint && t.letter !== target;
                  const dragging = drag?.id === t.id;
                  const wig = wiggle?.id === t.id;
                  return (
                    <motion.div
                      key={`${qKey}-${t.id}`}
                      initial={{ scale: 0, y: 30 }}
                      animate={
                        isUsed
                          ? { scale: 0.2, opacity: 0 }
                          : right
                              ? { scale: [1, 1.12, 1], opacity: 1, y: 0 }
                              : { scale: 1, y: 0, opacity: faded ? 0.25 : 1 }
                      }
                      transition={{
                        default: { type: 'spring', stiffness: 260, damping: 16, delay: i * 0.06 },
                        ...(right ? { scale: { repeat: Infinity, duration: 0.9, ease: 'easeInOut' } } : {}),
                      }}
                      style={{ pointerEvents: isUsed || faded ? 'none' : 'auto' }}
                    >
                      <button
                        data-tile={t.letter}
                        aria-label={`האות ${LETTER_BY_ID[t.letter].name}`}
                        onPointerDown={(e) => onTileDown(t, e)}
                        onPointerMove={onTileMove}
                        onPointerUp={(e) => onTileUp(t, e)}
                        onPointerCancel={() => {
                          dragRef.current = null;
                          setDrag(null);
                        }}
                        className={`flex items-center justify-center font-bold text-slate-800 select-none ${wig ? 'fs-wiggle' : ''}`}
                        style={{
                          width: SIZE,
                          height: SIZE,
                          fontSize: `calc(${SIZE} * 0.62)`,
                          lineHeight: 1,
                          background: colors[t.id % colors.length],
                          borderRadius: '1.5rem',
                          boxShadow: right ? '0 0 0 8px rgba(255,255,255,.9), 0 0 26px 10px rgba(255,220,0,.8)' : '0 7px 0 rgba(0,0,0,0.15)',
                          touchAction: 'none',
                          transform: dragging ? `translate(${drag!.dx}px, ${drag!.dy}px) scale(1.12)` : undefined,
                          zIndex: dragging ? 50 : undefined,
                          position: 'relative',
                          transition: dragging ? 'none' : 'transform 0.2s',
                          cursor: 'grab',
                        }}
                      >
                        {LETTER_BY_ID[t.letter].char}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
