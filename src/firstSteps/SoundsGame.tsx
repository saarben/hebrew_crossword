import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Home, Volume2, VolumeX } from 'lucide-react';
import { LETTER_BY_ID } from './letters';
import {
  INSTRUMENTS, PRAISE, RETRY, ROUND_DONE, ROUND_ITEM, ROUND_LENGTH, STARS_PER_ITEM, SYLLABLE,
  SQuestion, SRoundSummary, SoundsProfile, finishRound, hintSpeech, lessonSpeech, makeQuestion,
  markIntroduced, nextIntro, prompt, recordCorrect, recordWrong, reinforce, soundLine, sstat, likeLine,
} from './soundsEngine';
import { loadSoundsProfile, saveSoundsProfile } from './soundsStorage';
import { setSpeechEnabled, speak, stopSpeaking } from './speech';
import { setSfxEnabled, sfx } from './sfx';
import { BigButton, Mascot, StarsChip, burst, burstAt } from './ui';
import { trackEvent } from '../analytics';

type Screen = 'play' | 'lesson' | 'roundEnd' | 'band';

const CARD_COLORS = ['#FF9AA2', '#FFD166', '#7EE0B0', '#7DC8FF', '#C3B1FF', '#FFB3DE'];
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function SoundsGame({ onExit }: { onExit: () => void }) {
  const [profile, setProfile] = useState<SoundsProfile>(() => loadSoundsProfile());
  const profileRef = useRef(profile);
  const [screen, setScreen] = useState<Screen>('lesson');
  const [lesson, setLesson] = useState<{ id: string; again: boolean } | null>(null);
  const [q, setQ] = useState<SQuestion | null>(null);
  const [qKey, setQKey] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const wrongRef = useRef<string[]>([]);
  const [hint, setHint] = useState(false);
  const [phase, setPhase] = useState<'asking' | 'right'>('asking');
  const [summary, setSummary] = useState<SRoundSummary | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const pendingLesson = useRef<string | null>(null);
  const run = useRef(0);
  const started = useRef(false);

  const commit = useCallback((p: SoundsProfile) => {
    profileRef.current = p;
    setProfile(p);
    saveSoundsProfile(p);
  }, []);

  useEffect(() => {
    setSpeechEnabled(soundOn);
    setSfxEnabled(soundOn);
  }, [soundOn]);

  useEffect(() => () => {
    run.current++;
    stopSpeaking();
  }, []);

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

  // first screen: begin with the next lesson/question as soon as the game opens
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    goNext();
  }, [goNext]);

  const advance = useCallback(() => {
    const p = profileRef.current;
    if (p.round.done >= ROUND_LENGTH) {
      const s = finishRound(p);
      commit(s.profile);
      setSummary(s);
      setScreen('roundEnd');
      trackEvent('first_steps_sounds_round', { first_try: s.firstTry, letters: s.profile.unlocked, tier: s.profile.tier });
    } else {
      goNext();
    }
  }, [commit, goNext]);

  const continueFromLesson = () => {
    if (lesson) commit(markIntroduced(profileRef.current, lesson.id));
    run.current++;
    goNext();
  };

  const leave = () => {
    run.current++;
    stopSpeaking();
    onExit();
  };

  // ask the question aloud, repeat it when the child is idle
  const colors = useMemo(() => [...CARD_COLORS].sort(() => Math.random() - 0.5), [qKey]);
  useEffect(() => {
    if (screen !== 'play' || !q || phase !== 'asking') return;
    const say = () => void speak(hint ? hintSpeech(q.target) : prompt(q).speak);
    const first = setTimeout(say, hint ? 250 : 450);
    // "catch" questions repeat the sound more often: that is the game
    const idle = setInterval(say, q.type === 'catch' ? 9000 : 15000);
    return () => {
      clearTimeout(first);
      clearInterval(idle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qKey, screen, phase, hint]);

  useEffect(() => {
    if (screen !== 'lesson' || !lesson) return;
    const t = setTimeout(() => void speak(lessonSpeech(lesson.id, lesson.again)), 400);
    return () => clearTimeout(t);
  }, [screen, lesson]);

  useEffect(() => {
    if (screen === 'roundEnd' && summary) {
      sfx.fanfare();
      burst(0.5, 0.35, true);
      void speak(summary.newItem ? [ROUND_DONE, ROUND_ITEM] : ROUND_DONE);
    }
  }, [screen, summary]);

  const onPick = (id: string, e: React.SyntheticEvent) => {
    if (!q || phase !== 'asking' || wrongRef.current.includes(id)) return;
    if (id === q.target) {
      setPhase('right');
      sfx.correct();
      burstAt(e);
      const res = recordCorrect(profileRef.current, q, wrongRef.current.length);
      commit(res.profile);
      const my = ++run.current;
      void Promise.all([speak(reinforce(q.target, pick(PRAISE))), wait(1500)]).then(() => {
        if (my === run.current) advance();
      });
      return;
    }
    sfx.wrong();
    const r = recordWrong(profileRef.current, q.target);
    commit(r.profile);
    if (r.focusTriggered) {
      pendingLesson.current = q.target;
      trackEvent('first_steps_sounds_focus', { letter: q.target });
    }
    const next = [...wrongRef.current, id];
    wrongRef.current = next;
    setWrongIds(next);
    const wrongLeft = q.options.filter((o) => o !== q.target && !next.includes(o)).length;
    if (next.length >= 2 || wrongLeft === 0) setHint(true);
    else void speak(pick(RETRY));
  };

  const replay = () => {
    if (!q) return;
    void speak(hint ? hintSpeech(q.target) : prompt(q).speak);
  };

  // ---------------------------------------------------------------- screens
  const soundButton = (
    <button
      aria-label="צליל"
      onClick={() => setSoundOn((v) => !v)}
      className="w-16 h-16 rounded-full bg-white/85 shadow flex items-center justify-center text-slate-600 active:scale-90"
    >
      {soundOn ? <Volume2 className="w-8 h-8" /> : <VolumeX className="w-8 h-8" />}
    </button>
  );

  const topBar = (showProgress: boolean) => (
    <div className="flex items-center justify-between gap-3 p-3 sm:p-5">
      <button
        aria-label="חזרה"
        onClick={() => {
          sfx.tap();
          leave();
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
        <button
          aria-label="התזמורת שלי"
          onClick={() => {
            sfx.tap();
            run.current++;
            stopSpeaking();
            setScreen('band');
          }}
          className="h-16 px-4 rounded-full bg-white/85 shadow flex items-center justify-center text-3xl active:scale-90"
        >
          🎺
        </button>
        {soundButton}
      </div>
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <div className="fs-root fixed inset-0 overflow-y-auto" dir="rtl">
      <div className="min-h-full flex flex-col">{children}</div>
    </div>
  );

  if (screen === 'band') {
    return shell(
      <>
        <div className="flex items-center justify-between p-3 sm:p-5">
          <button
            aria-label="חזרה"
            onClick={() => {
              sfx.tap();
              goNext();
            }}
            className="w-16 h-16 rounded-full bg-white/85 shadow flex items-center justify-center text-slate-600 active:scale-90"
          >
            <Home className="w-8 h-8" />
          </button>
          <StarsChip stars={profile.stars} />
        </div>
        <div className="px-3 pb-8 max-w-3xl w-full mx-auto text-center">
          <h2 className="text-4xl font-bold text-violet-600">התזמורת שלי</h2>
          <p className="text-xl text-slate-600 mb-4">כל {STARS_PER_ITEM} כוכבים = כלי נגינה חדש</p>
          <div className="flex justify-center mb-4"><Mascot size={90} dance={profile.items > 0} /></div>
          <div className="grid grid-cols-5 gap-3 sm:gap-4">
            {INSTRUMENTS.map((ins, i) => (
              <motion.button
                key={ins}
                disabled={i >= profile.items}
                whileTap={{ scale: 0.85, rotate: 12 }}
                onClick={() => sfx.pop()}
                className="aspect-square rounded-3xl bg-white/85 shadow flex items-center justify-center"
              >
                {i < profile.items ? (
                  <motion.span
                    style={{ fontSize: 'clamp(40px,9vmin,72px)', lineHeight: 1 }}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.4 + i * 0.12 }}
                  >
                    {ins}
                  </motion.span>
                ) : (
                  <span className="text-4xl text-slate-300 font-bold">?</span>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </>,
    );
  }

  if (screen === 'lesson' && lesson) {
    const l = LETTER_BY_ID[lesson.id];
    return shell(
      <>
        {topBar(false)}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 pb-8 text-center">
          <p className="text-3xl font-bold text-violet-700">{lesson.again ? 'בוא נכיר שוב את הצליל' : 'אות חדשה וצליל חדש!'}</p>
          <motion.button
            key={lesson.id}
            initial={{ scale: 0.3, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            onClick={() => void speak([soundLine(lesson.id), likeLine(lesson.id)])}
            className="bg-white rounded-[3rem] shadow-xl flex items-center justify-center text-violet-600 gap-3"
            style={{ width: 'min(60vmin,340px)', height: 'min(50vmin,280px)', fontSize: 'min(36vmin,200px)', lineHeight: 1 }}
          >
            {l.char}
          </motion.button>
          <p className="text-4xl font-bold text-slate-700 flex items-center gap-3 flex-wrap justify-center">
            <span className="text-violet-600">{SYLLABLE[lesson.id]}</span> כמו {l.word} <span className="text-6xl">{l.emoji}</span>
          </p>
          <BigButton onClick={continueFromLesson} className="text-4xl px-12 py-5" color="bg-violet-500">
            ממשיכים ▶
          </BigButton>
        </div>
      </>,
    );
  }

  if (screen === 'roundEnd' && summary) {
    const toNext = STARS_PER_ITEM - (summary.profile.stars % STARS_PER_ITEM);
    const item = INSTRUMENTS[Math.min(summary.profile.items, INSTRUMENTS.length) - 1];
    return shell(
      <>
        {topBar(false)}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 pb-8 text-center">
          <Mascot size={110} dance />
          <h2 className="text-5xl font-bold text-violet-700">כל הכבוד!</h2>
          <div className="flex gap-2 flex-wrap justify-center">
            {Array.from({ length: summary.starsEarned }, (_, i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15 * i, type: 'spring' }} className="text-5xl">⭐</motion.span>
            ))}
          </div>
          {summary.newItem && item && (
            <motion.div initial={{ scale: 0, rotate: 180 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.8, type: 'spring', stiffness: 120 }} className="bg-white rounded-[2.5rem] shadow-xl px-10 py-5">
              <p className="text-2xl font-bold text-pink-600">כלי נגינה חדש בתזמורת!</p>
              <p style={{ fontSize: 110, lineHeight: 1.1 }}>{item}</p>
            </motion.div>
          )}
          {!summary.newItem && profile.items < INSTRUMENTS.length && (
            <p className="text-2xl text-violet-900/70">עוד {toNext} כוכבים לכלי הנגינה הבא 🎺</p>
          )}
          <div className="flex gap-4 flex-wrap justify-center">
            <BigButton onClick={goNext} className="text-4xl px-10 py-5" color="bg-violet-500">עוד משחק ▶</BigButton>
            <BigButton color="bg-sky-500" onClick={leave} className="text-3xl px-8 py-5">הביתה</BigButton>
          </div>
        </div>
      </>,
    );
  }

  if (!q) return shell(topBar(false));

  const target = LETTER_BY_ID[q.target];
  const p = prompt(q);
  const small = q.options.length > 4;
  const size = small ? 'clamp(92px,18vmin,148px)' : 'clamp(130px,31vmin,230px)';
  const speakerBubble = (
    <motion.button
      key={`s${qKey}`}
      initial={{ scale: 0.4 }}
      animate={{ scale: 1 }}
      whileTap={{ scale: 0.9 }}
      onClick={replay}
      aria-label="שמע שוב"
      className="bg-white rounded-full shadow-xl flex items-center justify-center text-violet-500"
      style={{ width: 'clamp(110px,22vmin,170px)', height: 'clamp(110px,22vmin,170px)' }}
    >
      <motion.div animate={{ scale: [1, 1.18, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}>
        <Volume2 style={{ width: 'clamp(54px,11vmin,84px)', height: 'clamp(54px,11vmin,84px)' }} />
      </motion.div>
    </motion.button>
  );

  return shell(
    <>
      {topBar(true)}
      <div className="flex-1 flex flex-col items-center gap-4 px-3 pb-6">
        <div className="flex items-center gap-3 max-w-3xl w-full justify-center">
          <Mascot size={72} dance={phase === 'right'} />
          <button onClick={replay} aria-label="שמע שוב"
            className="flex items-center gap-3 bg-white rounded-[2rem] shadow-lg px-5 py-3 active:scale-95 text-right">
            <Volume2 className="w-9 h-9 text-violet-500 shrink-0" />
            <span className="text-2xl sm:text-3xl font-bold text-slate-700">{p.text}</span>
          </button>
        </div>

        {q.type === 'word' && (
          <motion.div key={`w${qKey}`} initial={{ scale: 0.4 }} animate={{ scale: 1 }}
            className="bg-white rounded-full shadow-xl flex items-center justify-center"
            style={{ width: 'clamp(120px,26vmin,200px)', height: 'clamp(120px,26vmin,200px)', fontSize: 'clamp(70px,16vmin,130px)' }}>
            {target.emoji}
          </motion.div>
        )}
        {q.type === 'picture' && (
          <motion.div key={`p${qKey}`} initial={{ scale: 0.4 }} animate={{ scale: 1 }}
            className="bg-white rounded-[2.5rem] shadow-xl flex flex-col items-center justify-center text-violet-600"
            style={{ width: 'clamp(120px,26vmin,200px)', height: 'clamp(120px,26vmin,200px)', fontSize: 'clamp(70px,16vmin,130px)', lineHeight: 1 }}>
            {target.char}
          </motion.div>
        )}
        {(q.type === 'hear' || q.type === 'catch') && speakerBubble}

        <div className="flex-1 w-full flex items-center justify-center">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-7 max-w-4xl">
            {q.options.map((id, i) => (
              <Choice
                key={`${qKey}-${id}`}
                letterId={id}
                kind={q.type === 'picture' ? 'picture' : q.type === 'catch' ? 'star' : 'card'}
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

function Choice(props: React.Attributes & {
  letterId: string;
  kind: 'card' | 'picture' | 'star';
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
  const star = kind === 'star';
  const content = kind === 'picture' ? l.emoji : l.char;
  const idle = star && !glow && !wrong && !popped && !hidden;
  return (
    <motion.button
      initial={{ scale: 0, y: 40 }}
      animate={
        hidden ? { scale: 0.3, opacity: 0, y: 0 }
        : popped ? { scale: star ? 1.6 : 1.12, opacity: star ? 0 : 1, y: star ? -30 : 0 }
        : wrong ? { x: [0, -14, 14, -10, 10, 0], scale: 0.9, opacity: 0.45, y: 0 }
        : glow ? { scale: [1, 1.12, 1], opacity: 1, y: 0 }
        : star ? { scale: 1, opacity: 1, y: [0, -14, 0], rotate: [-4, 4, -4] }
        : { scale: 1, opacity: 1, y: 0 }
      }
      transition={{
        default: { type: 'spring', stiffness: 260, damping: 16, delay: index * 0.07 },
        ...(glow ? { scale: { repeat: Infinity, duration: 0.9, ease: 'easeInOut' } } : {}),
        ...(idle ? {
          y: { repeat: Infinity, duration: 2 + index * 0.4, ease: 'easeInOut', delay: index * 0.2 },
          rotate: { repeat: Infinity, duration: 3 + index * 0.3, ease: 'easeInOut' },
        } : {}),
      }}
      onClick={props.onPick}
      disabled={disabled || wrong || hidden}
      aria-label={kind === 'picture' ? l.word : `האות ${l.name}`}
      className="relative flex items-center justify-center font-bold text-slate-800 select-none"
      style={{
        width: size,
        height: size,
        fontSize: kind === 'picture' ? `calc(${size} * 0.55)` : `calc(${size} * 0.62)`,
        lineHeight: 1,
        background: star ? 'transparent' : color,
        borderRadius: '2rem',
        boxShadow: glow ? '0 0 0 10px rgba(255,255,255,0.9), 0 0 30px 12px rgba(255,220,0,.8)' : star ? 'none' : '0 8px 0 rgba(0,0,0,0.15)',
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      {star && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-lg" aria-hidden>
          <polygon fill={color} stroke="#fff" strokeWidth="3" strokeLinejoin="round"
            points="50,4 62,36 96,38 69,59 79,93 50,74 21,93 31,59 4,38 38,36" />
        </svg>
      )}
      <span className="relative pb-1" style={star ? { fontSize: `calc(${size} * 0.46)` } : undefined}>{content}</span>
    </motion.button>
  );
}
