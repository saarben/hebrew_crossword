import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Home, Volume2, VolumeX, Lock } from 'lucide-react';
import { ALPHABET, LETTER_BY_ID } from './letters';
import {
  Profile,
  Question,
  RoundSummary,
  ROUND_LENGTH,
  STARS_PER_STICKER,
  finishRound,
  lettersLearned,
  makeQuestion,
  markIntroduced,
  newProfile,
  nextIntro,
  prompt,
  recordCorrect,
  recordWrong,
  stat,
} from './engine';
import { clearDrawProfile, clearProfile, loadProfile, saveProfile } from './storage';
import { clearSoundsProfile } from './soundsStorage';
import { clearWordProfile } from './wordStorage';
import { hasHebrewVoice, hasRecordedAudio, loadAudioManifest, onVoicesReady, setSpeechEnabled, speak, stopSpeaking } from './speech';
import { PRAISE, RETRY, ROUND_DONE, ROUND_DONE_STICKER, againLine, hintLine, likeLine, nameLine } from './phrases';
import { setSfxEnabled, sfx } from './sfx';
import { trackEvent } from '../analytics';
import { BigButton, Mascot, StarsChip, burst, burstAt } from './ui';
import DrawGame from './DrawGame';
import SoundsGame from './SoundsGame';
import WordGame from './WordGame';

type Screen = 'home' | 'lesson' | 'play' | 'roundEnd' | 'letters' | 'stickers' | 'draw' | 'sounds' | 'words';

const STICKERS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦉', '🦋', '🐢', '🐙', '🐬'];
const CARD_COLORS = ['#FF9AA2', '#FFD166', '#7EE0B0', '#7DC8FF', '#C3B1FF', '#FFB3DE'];

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function FirstStepsGame() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const profileRef = useRef(profile);
  const [screen, setScreen] = useState<Screen>('home');
  const [lesson, setLesson] = useState<{ id: string; again: boolean } | null>(null);
  const [q, setQ] = useState<Question | null>(null);
  const [qKey, setQKey] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const wrongRef = useRef<string[]>([]);
  const [hint, setHint] = useState(false);
  const [phase, setPhase] = useState<'asking' | 'right'>('asking');
  const [summary, setSummary] = useState<RoundSummary | null>(null);
  const [voiceOk, setVoiceOk] = useState(true);
  const pendingLesson = useRef<string | null>(null);
  const run = useRef(0);

  const commit = useCallback((p: Profile) => {
    profileRef.current = p;
    setProfile(p);
    saveProfile(p);
  }, []);

  useEffect(() => {
    setSpeechEnabled(profile.soundOn);
    setSfxEnabled(profile.soundOn);
  }, [profile.soundOn]);

  useEffect(() => {
    void loadAudioManifest().then(() => setVoiceOk(hasRecordedAudio() || hasHebrewVoice()));
    const off = onVoicesReady(() => setVoiceOk(hasRecordedAudio() || hasHebrewVoice()));
    return () => {
      off();
      run.current++;
      stopSpeaking();
    };
  }, []);

  // ---- flow -------------------------------------------------------------

  const goNext = useCallback(() => {
    const p = profileRef.current;
    const intro = nextIntro(p);
    if (intro) {
      setLesson({ id: intro, again: false });
      setScreen('lesson');
      return;
    }
    if (pendingLesson.current) {
      setLesson({ id: pendingLesson.current, again: true });
      pendingLesson.current = null;
      setScreen('lesson');
      return;
    }
    wrongRef.current = [];
    setQ(makeQuestion(p));
    setWrongIds([]);
    setHint(false);
    setPhase('asking');
    setQKey((k) => k + 1);
    setScreen('play');
  }, []);

  const advance = useCallback(() => {
    const p = profileRef.current;
    if (p.round.done >= ROUND_LENGTH) {
      const s = finishRound(p);
      commit(s.profile);
      setSummary(s);
      setScreen('roundEnd');
      trackEvent('first_steps_round', { first_try: s.firstTry, letters: s.profile.unlocked, tier: s.profile.tier });
    } else {
      goNext();
    }
  }, [commit, goNext]);

  const leaveTo = (s: Screen) => {
    run.current++;
    stopSpeaking();
    setScreen(s);
  };

  const continueFromLesson = () => {
    if (lesson) commit(markIntroduced(profileRef.current, lesson.id));
    run.current++;
    goNext();
  };

  // Ask the question aloud whenever a new one appears, and re-ask if the child
  // is idle for a while.
  const promptText = q ? prompt(q) : null;
  // Random but stable card colours for the current question.
  const colors = useMemo(() => [...CARD_COLORS].sort(() => Math.random() - 0.5), [qKey]);
  useEffect(() => {
    if (screen !== 'play' || !q || phase !== 'asking') return;
    const say = () => {
      const l = LETTER_BY_ID[q.target];
      void speak(hint ? hintLine(l) : prompt(q).speak);
    };
    const first = setTimeout(say, hint ? 250 : 450);
    const idle = setInterval(say, 15000);
    return () => {
      clearTimeout(first);
      clearInterval(idle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qKey, screen, phase, hint]);

  useEffect(() => {
    if (screen !== 'lesson' || !lesson) return;
    const l = LETTER_BY_ID[lesson.id];
    const t = setTimeout(
      () =>
        void speak([lesson.again ? againLine(l) : nameLine(l), likeLine(l)]),
      400,
    );
    return () => clearTimeout(t);
  }, [screen, lesson]);

  useEffect(() => {
    if (screen === 'roundEnd' && summary) {
      sfx.fanfare();
      burst(0.5, 0.35, true);
      void speak(summary.newSticker ? ROUND_DONE_STICKER : ROUND_DONE);
    }
  }, [screen, summary]);

  // ---- answering --------------------------------------------------------

  const onPick = (id: string, e: React.SyntheticEvent) => {
    if (!q || phase !== 'asking' || wrongRef.current.includes(id)) return;
    const l = LETTER_BY_ID[q.target];
    if (id === q.target) {
      setPhase('right');
      sfx.correct();
      burstAt(e);
      const res = recordCorrect(profileRef.current, q, wrongRef.current.length);
      commit(res.profile);
      const reinforce = q.type === 'word' || q.type === 'picture' ? likeLine(l) : nameLine(l);
      const my = ++run.current;
      void Promise.all([speak([pick(PRAISE), reinforce]), wait(1500)]).then(() => {
        if (my === run.current) advance();
      });
      return;
    }
    // Wrong tap: gentle, never punishing.
    sfx.wrong();
    const r = recordWrong(profileRef.current, q.target);
    commit(r.profile);
    if (r.focusTriggered) {
      pendingLesson.current = q.target;
      trackEvent('first_steps_focus', { letter: q.target });
    }
    const next = [...wrongRef.current, id];
    wrongRef.current = next;
    setWrongIds(next);
    const wrongLeft = q.options.filter((o) => o !== q.target && !next.includes(o)).length;
    if (next.length >= 2 || wrongLeft === 0) {
      setHint(true);
    } else {
      void speak(pick(RETRY));
    }
  };

  const repeatPrompt = () => {
    if (!q) return;
    const l = LETTER_BY_ID[q.target];
    void speak(hint ? hintLine(l) : prompt(q).speak);
  };

  const toggleSound = () => commit({ ...profileRef.current, soundOn: !profileRef.current.soundOn });

  const reset = () => {
    // "reset progress" wipes every First Steps game, not just this one
    clearProfile();
    clearDrawProfile();
    clearSoundsProfile();
    clearWordProfile();
    pendingLesson.current = null;
    commit(newProfile());
  };

  // ---- screens ----------------------------------------------------------

  const shell = (children: React.ReactNode) => (
    <div className="fs-root fixed inset-0 overflow-y-auto" dir="rtl">
      <div className="min-h-full flex flex-col">{children}</div>
    </div>
  );

  const topBar = (back: () => void, showProgress: boolean, withSpeaker: boolean) => (
    <div className="flex items-center justify-between gap-3 p-3 sm:p-5">
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
          {Array.from({ length: ROUND_LENGTH }, (_, i) => (
            <motion.div
              key={i}
              animate={i < profile.round.done ? { scale: [1, 1.5, 1] } : {}}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-2xl ${
                i < profile.round.done ? 'bg-amber-300 shadow' : 'bg-white/60 grayscale opacity-60'
              }`}
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
        {withSpeaker && (
          <button
            aria-label="צליל"
            onClick={toggleSound}
            className="w-16 h-16 rounded-full bg-white/85 shadow flex items-center justify-center text-slate-600 active:scale-90"
          >
            {profile.soundOn ? <Volume2 className="w-8 h-8" /> : <VolumeX className="w-8 h-8" />}
          </button>
        )}
      </div>
    </div>
  );

  if (screen === 'home') {
    const learned = lettersLearned(profile);
    const started = profile.stars > 0 || profile.introduced.length > 0;
    return shell(
      <>
        <div className="flex items-center justify-between p-3 sm:p-5">
          <a
            href="#/"
            aria-label="לדף הבית"
            className="w-16 h-16 rounded-full bg-white/85 shadow flex items-center justify-center text-slate-600 active:scale-90"
          >
            <Home className="w-8 h-8" />
          </a>
          <div className="flex items-center gap-3">
            <StarsChip stars={profile.stars} />
            <button
              aria-label="צליל"
              onClick={toggleSound}
              className="w-16 h-16 rounded-full bg-white/85 shadow flex items-center justify-center text-slate-600 active:scale-90"
            >
              {profile.soundOn ? <Volume2 className="w-8 h-8" /> : <VolumeX className="w-8 h-8" />}
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 pb-6 text-center">
          <Mascot size={140} />
          <h1 className="text-5xl sm:text-6xl font-bold text-indigo-700 drop-shadow-sm">צעדים ראשונים</h1>
          <p className="text-xl text-indigo-900/70">משחקים ולומדים את האותיות</p>
          <BigButton
            color="bg-emerald-500"
            className="text-5xl px-14 py-6 mt-2"
            onClick={() => {
              trackEvent('first_steps_play', { stars: profile.stars });
              goNext();
            }}
          >
            {started ? 'ממשיכים! ▶' : 'בואו נשחק! ▶'}
          </BigButton>
          <BigButton
            color="bg-orange-500"
            className="text-4xl px-10 py-5"
            onClick={() => {
              trackEvent('first_steps_draw_open', {});
              setScreen('draw');
            }}
          >
            ✏️ מציירים אותיות
          </BigButton>
          <div className="flex gap-4 flex-wrap justify-center">
            <BigButton color="bg-violet-500" className="text-3xl px-7 py-4" onClick={() => setScreen('sounds')}>
              🔊 צלילים
            </BigButton>
            <BigButton color="bg-teal-500" className="text-3xl px-7 py-4" onClick={() => setScreen('words')}>
              🧩 בונים מילה
            </BigButton>
          </div>
          <div className="flex gap-4 mt-2">
            <BigButton color="bg-sky-500" className="text-2xl px-6 py-4" onClick={() => setScreen('letters')}>
              🔤 האותיות שלי
            </BigButton>
            <BigButton color="bg-pink-500" className="text-2xl px-6 py-4" onClick={() => setScreen('stickers')}>
              🎁 המדבקות ({Math.floor(profile.stars / STARS_PER_STICKER)})
            </BigButton>
          </div>
          <div className="w-full max-w-md mt-2">
            <div className="h-5 rounded-full bg-white/70 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-l from-amber-300 to-emerald-400 transition-all"
                style={{ width: `${(learned / ALPHABET.length) * 100}%` }}
              />
            </div>
            <p className="text-indigo-900/70 mt-1 text-lg">
              {learned} מתוך {ALPHABET.length} אותיות
            </p>
          </div>
        </div>
        <ParentCorner voiceOk={voiceOk} onReset={reset} />
      </>,
    );
  }

  if (screen === 'sounds') return <SoundsGame onExit={() => setScreen('home')} />;
  if (screen === 'words') return <WordGame onExit={() => setScreen('home')} />;

  if (screen === 'draw') {
    return <DrawGame onExit={() => setScreen('home')} />;
  }

  if (screen === 'lesson' && lesson) {
    const l = LETTER_BY_ID[lesson.id];
    return shell(
      <>
        {topBar(() => leaveTo('home'), false, true)}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 pb-8 text-center">
          <p className="text-3xl font-bold text-indigo-700">{lesson.again ? 'בוא נכיר שוב את האות' : 'אות חדשה!'}</p>
          <motion.button
            key={lesson.id}
            initial={{ scale: 0.3, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            onClick={() => void speak(likeLine(l))}
            className="bg-white rounded-[3rem] shadow-xl flex items-center justify-center text-indigo-600"
            style={{ width: 'min(60vmin,340px)', height: 'min(60vmin,340px)', fontSize: 'min(42vmin,240px)', lineHeight: 1 }}
          >
            {l.char}
          </motion.button>
          <p className="text-4xl font-bold text-slate-700">
            {l.name} כמו {l.word} <span className="text-6xl align-middle">{l.emoji}</span>
          </p>
          <BigButton onClick={continueFromLesson} className="text-4xl px-12 py-5">
            ממשיכים ▶
          </BigButton>
        </div>
      </>,
    );
  }

  if (screen === 'play' && q && promptText) {
    const target = LETTER_BY_ID[q.target];
    const small = q.options.length > 4;
    const size = small ? 'clamp(104px,23vmin,180px)' : 'clamp(130px,31vmin,230px)';
    return shell(
      <>
        {topBar(() => leaveTo('home'), true, true)}
        <div className="flex-1 flex flex-col items-center justify-start gap-4 px-3 pb-6">
          <div className="flex items-center gap-3 max-w-3xl w-full justify-center">
            <Mascot size={72} dance={phase === 'right'} />
            <button
              onClick={repeatPrompt}
              className="flex items-center gap-3 bg-white rounded-[2rem] shadow-lg px-5 py-3 active:scale-95 text-right"
              aria-label="שמע שוב"
            >
              <Volume2 className="w-9 h-9 text-indigo-500 shrink-0" />
              <span className="text-2xl sm:text-3xl font-bold text-slate-700">{promptText.text}</span>
            </button>
          </div>

          {q.type === 'word' && (
            <motion.div
              key={`w${qKey}`}
              initial={{ scale: 0.4 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-full shadow-xl flex items-center justify-center"
              style={{ width: 'clamp(120px,26vmin,200px)', height: 'clamp(120px,26vmin,200px)', fontSize: 'clamp(70px,16vmin,130px)' }}
            >
              {target.emoji}
            </motion.div>
          )}
          {q.type === 'picture' && (
            <motion.div
              key={`p${qKey}`}
              initial={{ scale: 0.4 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center text-indigo-600"
              style={{ width: 'clamp(120px,26vmin,200px)', height: 'clamp(120px,26vmin,200px)', fontSize: 'clamp(80px,19vmin,150px)', lineHeight: 1 }}
            >
              {target.char}
            </motion.div>
          )}

          <div className="flex-1 w-full flex items-center justify-center">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-7 max-w-4xl">
              {q.options.map((id, i) => (
                <AnswerOption
                  key={`${qKey}-${id}`}
                  letterId={id}
                  kind={q.type === 'balloons' ? 'balloon' : q.type === 'picture' ? 'picture' : 'card'}
                  size={size}
                  color={colors[i % colors.length]}
                  wrong={wrongIds.includes(id)}
                  hidden={hint && id !== q.target}
                  glow={hint && id === q.target}
                  popped={phase === 'right' && id === q.target}
                  disabled={phase !== 'asking'}
                  index={i}
                  onPick={(e) => onPick(id, e)}
                />
              ))}
            </div>
          </div>
        </div>
      </>,
    );
  }

  if (screen === 'roundEnd' && summary) {
    const toNext = STARS_PER_STICKER - (summary.profile.stars % STARS_PER_STICKER);
    const stickerIdx = Math.floor(summary.profile.stars / STARS_PER_STICKER) - 1;
    return shell(
      <>
        {topBar(() => leaveTo('home'), false, true)}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 pb-8 text-center">
          <Mascot size={120} dance />
          <h2 className="text-5xl font-bold text-indigo-700">כל הכבוד!</h2>
          <div className="flex gap-2 flex-wrap justify-center">
            {Array.from({ length: summary.starsEarned }, (_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15 * i, type: 'spring' }}
                className="text-5xl"
              >
                ⭐
              </motion.span>
            ))}
          </div>
          {summary.newSticker && stickerIdx >= 0 && (
            <motion.div
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.8, type: 'spring', stiffness: 120 }}
              className="bg-white rounded-[2.5rem] shadow-xl px-10 py-5"
            >
              <p className="text-2xl font-bold text-pink-600">מדבקה חדשה!</p>
              <p style={{ fontSize: 110, lineHeight: 1.1 }}>{STICKERS[stickerIdx % STICKERS.length]}</p>
            </motion.div>
          )}
          {!summary.newSticker && <p className="text-2xl text-indigo-900/70">עוד {toNext} כוכבים למדבקה הבאה 🎁</p>}
          <div className="flex gap-4 mt-2 flex-wrap justify-center">
            <BigButton onClick={goNext} className="text-4xl px-10 py-5">
              עוד משחק ▶
            </BigButton>
            <BigButton color="bg-sky-500" onClick={() => leaveTo('home')} className="text-3xl px-8 py-5">
              הביתה
            </BigButton>
          </div>
        </div>
      </>,
    );
  }

  if (screen === 'letters') {
    return shell(
      <>
        {topBar(() => setScreen('home'), false, false)}
        <div className="px-3 pb-8 max-w-3xl w-full mx-auto">
          <h2 className="text-4xl font-bold text-indigo-700 text-center mb-4">האותיות שלי</h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 sm:gap-4">
            {ALPHABET.map((l, i) => {
              const open = i < profile.unlocked;
              const box = stat(profile, l.id).box;
              const filled = box >= 3 ? 3 : box >= 2 ? 2 : box >= 1 ? 1 : 0;
              return (
                <button
                  key={l.id}
                  disabled={!open}
                  onClick={() => {
                    sfx.tap();
                    void speak(likeLine(l));
                  }}
                  className={`aspect-square rounded-3xl shadow flex flex-col items-center justify-center active:scale-95 ${
                    open ? 'bg-white text-indigo-600' : 'bg-white/40 text-slate-400'
                  }`}
                >
                  {open ? (
                    <>
                      <span className="text-5xl sm:text-6xl leading-none">{l.char}</span>
                      <span className="text-sm mt-1 tracking-widest">{'⭐'.repeat(filled)}{'☆'.repeat(3 - filled)}</span>
                    </>
                  ) : (
                    <Lock className="w-8 h-8" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </>,
    );
  }

  // stickers
  const earned = Math.floor(profile.stars / STARS_PER_STICKER);
  return shell(
    <>
      {topBar(() => setScreen('home'), false, false)}
      <div className="px-3 pb-8 max-w-3xl w-full mx-auto">
        <h2 className="text-4xl font-bold text-pink-600 text-center">המדבקות שלי</h2>
        <p className="text-xl text-center text-slate-600 mb-4">כל {STARS_PER_STICKER} כוכבים = מדבקה חדשה</p>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 sm:gap-4">
          {STICKERS.map((s, i) => (
            <div key={s} className="aspect-square rounded-3xl bg-white/80 shadow flex items-center justify-center">
              {i < earned ? (
                <span style={{ fontSize: 'clamp(40px,9vmin,72px)', lineHeight: 1 }}>{s}</span>
              ) : (
                <span className="text-4xl text-slate-300 font-bold">?</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>,
  );
}

function AnswerOption(props: React.Attributes & {
  letterId: string;
  kind: 'card' | 'balloon' | 'picture';
  size: string;
  color: string;
  wrong: boolean;
  hidden: boolean;
  glow: boolean;
  popped: boolean;
  disabled: boolean;
  index: number;
  onPick: (e: React.SyntheticEvent) => void;
}) {
  const { letterId, kind, size, color, wrong, hidden, glow, popped, disabled, index } = props;
  const l = LETTER_BY_ID[letterId];
  const balloon = kind === 'balloon';
  const content = kind === 'picture' ? l.emoji : l.char;
  return (
    <motion.button
      initial={{ scale: 0, y: 40 }}
      animate={
        hidden
          ? { scale: 0.3, opacity: 0, y: 0 }
          : popped && balloon
            ? { scale: 1.5, opacity: 0, y: -40 }
            : wrong
              ? { x: [0, -14, 14, -10, 10, 0], scale: 0.9, opacity: 0.45, y: 0 }
              : glow
                ? { scale: [1, 1.12, 1], opacity: 1, y: 0 }
                : balloon
                  ? { scale: 1, opacity: 1, y: [0, -12, 0] }
                  : { scale: popped ? 1.12 : 1, opacity: 1, y: 0 }
      }
      transition={{
        default: { type: 'spring', stiffness: 260, damping: 16, delay: index * 0.07 },
        // Looping motion is scoped to a single property so it can't re-trigger the pop-in.
        ...(glow ? { scale: { repeat: Infinity, duration: 0.9, ease: 'easeInOut' } } : {}),
        ...(balloon && !glow && !wrong && !popped && !hidden
          ? { y: { repeat: Infinity, duration: 2.2 + index * 0.35, ease: 'easeInOut', delay: index * 0.2 } }
          : {}),
      }}
      onClick={props.onPick}
      disabled={disabled || wrong || hidden}
      aria-label={kind === 'picture' ? l.word : `האות ${l.name}`}
      className="relative flex items-center justify-center font-bold text-slate-800 select-none"
      style={{
        width: size,
        height: balloon ? `calc(${size} * 1.2)` : size,
        ['--s' as string]: size,
        fontSize: kind === 'picture' ? `calc(${size} * 0.55)` : `calc(${size} * 0.62)`,
        lineHeight: 1,
        background: color,
        borderRadius: balloon ? '50% 50% 50% 50% / 45% 45% 55% 55%' : '2rem',
        boxShadow: glow ? '0 0 0 10px rgba(255,255,255,0.9), 0 0 30px 12px rgba(255,220,0,.8)' : '0 8px 0 rgba(0,0,0,0.15)',
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      <span className="pb-1">{content}</span>
      {balloon && (
        <>
          <span
            aria-hidden
            className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderBottom: `14px solid ${color}` }}
          />
          <span aria-hidden className="absolute left-1/2 top-full w-0.5 h-10 bg-slate-400/70 -translate-x-1/2" />
        </>
      )}
    </motion.button>
  );
}

/**
 * Small grown-up area: voice warning and progress reset. Behind a tiny
 * arithmetic gate (a 4-year-old can't pass it) instead of a long press, which
 * touch browsers cancel or turn into a context menu.
 */
function ParentCorner({ voiceOk, onReset }: { voiceOk: boolean; onReset: () => void }) {
  const [step, setStep] = useState<'closed' | 'quiz' | 'confirm' | 'done'>('closed');
  const [quiz, setQuiz] = useState({ a: 7, b: 6, options: [11, 13, 15] });

  const open = () => {
    const a = 6 + Math.floor(Math.random() * 6);
    const b = 6 + Math.floor(Math.random() * 6);
    const wrong = new Set<number>();
    while (wrong.size < 2) {
      const w = a + b + [-2, -1, 1, 2, 3][Math.floor(Math.random() * 5)];
      if (w !== a + b) wrong.add(w);
    }
    setQuiz({ a, b, options: [a + b, ...wrong].sort(() => Math.random() - 0.5) });
    setStep('quiz');
  };

  return (
    <div className="px-4 pb-4 text-center text-sm text-slate-500 space-y-2">
      {!voiceOk && (
        <p className="max-w-xl mx-auto bg-amber-100 text-amber-800 rounded-2xl px-4 py-2">
          להורים: לא זוהה קול בעברית במכשיר, ייתכן שהמשחק לא ידבר. אפשר להתקין קול עברי בהגדרות המכשיר (שפה וקלט ← טקסט לדיבור).
        </p>
      )}
      {step === 'done' && <p className="text-emerald-700 font-bold text-base">ההתקדמות אופסה ✓</p>}
      <button onClick={open} className="underline px-4 py-2">
        להורים: איפוס ההתקדמות
      </button>

      {(step === 'quiz' || step === 'confirm') && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full text-slate-700 space-y-4">
            {step === 'quiz' ? (
              <>
                <p className="text-lg font-bold">שאלה להורים: כמה זה {quiz.a} + {quiz.b}?</p>
                <div className="flex gap-3 justify-center">
                  {quiz.options.map((o) => (
                    <button
                      key={o}
                      onClick={() => (o === quiz.a + quiz.b ? setStep('confirm') : setStep('closed'))}
                      className="w-20 h-16 rounded-2xl bg-slate-100 text-2xl font-bold active:scale-95"
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-lg font-bold">למחוק את כל ההתקדמות, הכוכבים והמדבקות?</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      onReset();
                      setStep('done');
                    }}
                    className="px-5 py-3 rounded-2xl bg-red-500 text-white font-bold text-lg active:scale-95"
                  >
                    כן, לאפס
                  </button>
                  <button onClick={() => setStep('closed')} className="px-5 py-3 rounded-2xl bg-slate-200 font-bold text-lg active:scale-95">
                    ביטול
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
