import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Home, Volume2, VolumeX, Lock } from 'lucide-react';
import { LETTER_BY_ID } from './letters';
import {
  Profile, Question, RoundSummary, ROUND_LENGTH, STARS_PER_STICKER,
  finishRound, makeQuestion, recordCorrect, recordWrong,
} from './engine';
import {
  FULL, FULL_HAT, HATS, THANKS, YUCK, againLine, colorFor, feedPrompt, hatFor, hintLine,
  inZone, itemKind, layoutFor, likeLine, nameLine,
} from './feedEngine';
import { loadFeedProfile, saveFeedProfile } from './feedStorage';
import { setSpeechEnabled, speak, stopSpeaking } from './speech';
import { setSfxEnabled, sfx } from './sfx';
import { BigButton, StarsChip, burst } from './ui';
import { trackEvent } from '../analytics';

type Mood = 'hungry' | 'chomp' | 'yuck' | 'happy';
const CARD_COLORS = ['#FFD166', '#7DC8FF', '#FF9AA2', '#7EE0B0', '#C3B1FF', '#FFB3DE'];
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- monster ---
const Monster = React.forwardRef<HTMLDivElement, { mood: Mood; color: string; hat: string | null; look?: number; size: string }>(
  function Monster({ mood, color, hat, look = 0, size }, ref) {
    const open = mood === 'hungry' || mood === 'chomp';
    return (
      <motion.div
        ref={ref}
        aria-label="המפלצת"
        style={{ width: size, height: size }}
        animate={
          mood === 'chomp' ? { scaleX: [1, 1.12, 0.95, 1], scaleY: [1, 0.88, 1.06, 1] }
            : mood === 'yuck' ? { x: [0, -10, 10, -8, 8, 0] }
            : mood === 'happy' ? { y: [0, -18, 0], rotate: [-4, 4, -4] }
            : { y: [0, -5, 0] }
        }
        transition={mood === 'happy' ? { repeat: Infinity, duration: 0.8 } : mood === 'hungry' ? { repeat: Infinity, duration: 2.2 } : { duration: 0.6 }}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
          {/* feet, arms, ears */}
          <ellipse cx="66" cy="186" rx="24" ry="12" fill={color} />
          <ellipse cx="134" cy="186" rx="24" ry="12" fill={color} />
          <ellipse cx="22" cy="128" rx="14" ry="28" fill={color} transform="rotate(14 22 128)" />
          <ellipse cx="178" cy="128" rx="14" ry="28" fill={color} transform="rotate(-14 178 128)" />
          <path d="M44 62 L52 24 L78 50 Z" fill={color} />
          <path d="M156 62 L148 24 L122 50 Z" fill={color} />
          <ellipse cx="100" cy="118" rx="82" ry="72" fill={color} />
          <ellipse cx="100" cy="156" rx="48" ry="32" fill="#fff" opacity="0.28" />
          {/* eyes */}
          {mood === 'yuck' ? (
            <>
              <path d="M52 78 L88 88 M52 88 L88 78" stroke="#2b2250" strokeWidth="6" strokeLinecap="round" />
              <path d="M112 78 L148 88 M112 88 L148 78" stroke="#2b2250" strokeWidth="6" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="72" cy="80" r="21" fill="#fff" />
              <circle cx="128" cy="80" r="21" fill="#fff" />
              <circle cx={72 + look * 7} cy="84" r="10" fill="#2b2250" />
              <circle cx={128 + look * 7} cy="84" r="10" fill="#2b2250" />
              <circle cx={75 + look * 7} cy="80" r="3.5" fill="#fff" />
              <circle cx={131 + look * 7} cy="80" r="3.5" fill="#fff" />
            </>
          )}
          {/* mouth */}
          {open && (
            <motion.g
              style={{ transformOrigin: '100px 128px' }}
              animate={mood === 'chomp' ? { scaleY: [1, 0.12, 1, 0.12, 1] } : { scaleY: [1, 1.14, 1] }}
              transition={mood === 'chomp' ? { duration: 0.7 } : { repeat: Infinity, duration: 1.4 }}
            >
              <ellipse cx="100" cy="132" rx="44" ry="30" fill="#5b1a2b" />
              <ellipse cx="100" cy="150" rx="26" ry="11" fill="#ff7a90" />
              <path d="M66 116 l8 12 l8 -12 M84 114 l8 12 l8 -12 M102 114 l8 12 l8 -12 M120 116 l8 12 l8 -12" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
            </motion.g>
          )}
          {mood === 'yuck' && (
            <>
              <path d="M70 140 Q100 118 130 140" stroke="#5b1a2b" strokeWidth="7" fill="none" strokeLinecap="round" />
              <ellipse cx="100" cy="152" rx="12" ry="16" fill="#ff7a90" />
            </>
          )}
          {mood === 'happy' && (
            <>
              <path d="M66 130 Q100 168 134 130" stroke="#5b1a2b" strokeWidth="7" fill="none" strokeLinecap="round" />
              <circle cx="52" cy="112" r="9" fill="#ff7a90" opacity="0.6" />
              <circle cx="148" cy="112" r="9" fill="#ff7a90" opacity="0.6" />
            </>
          )}
          {hat && <text x="100" y="40" fontSize="62" textAnchor="middle">{hat}</text>}
        </svg>
      </motion.div>
    );
  },
);

// ------------------------------------------------------------------ items ---
type ItemProps = React.Attributes & {
  id: string;
  kind: 'letter' | 'picture';
  size: number;
  color: string;
  wrong: boolean;
  hidden: boolean;
  glow: boolean;
  onDrop: (id: string, point: { x: number; y: number } | null, el: HTMLElement | null) => void;
  onHold?: (id: string, held: boolean) => void;
  style?: React.CSSProperties;
  bob?: number;
};

function FeedItem({ id, kind, size, color, wrong, hidden, glow, onDrop, onHold, style, bob = 0 }: ItemProps) {
  const l = LETTER_BY_ID[id];
  const ref = useRef<HTMLButtonElement | null>(null);
  return (
    <div style={{ position: 'absolute', ...style, width: size, height: size, pointerEvents: hidden ? 'none' : 'auto' }}>
      <motion.button
        ref={ref}
        data-testid={`item-${id}`}
        aria-label={kind === 'picture' ? l.word : `האות ${l.name}`}
        drag={!wrong && !hidden}
        dragSnapToOrigin
        dragElastic={0.6}
        whileDrag={{ scale: 1.18, zIndex: 50 }}
        onDragStart={() => onHold?.(id, true)}
        onDragEnd={(_, info) => {
          onHold?.(id, false);
          onDrop(id, info.point, ref.current);
        }}
        onTap={() => onDrop(id, null, ref.current)}
        initial={{ scale: 0 }}
        animate={
          hidden ? { scale: 0.2, opacity: 0 }
            : wrong ? { scale: 0.9, opacity: 0.4, x: [0, -10, 10, -6, 6, 0] }
            : glow ? { scale: [1, 1.14, 1], opacity: 1 }
            : { scale: 1, opacity: 1, y: bob ? [0, -8, 0] : 0 }
        }
        transition={
          glow ? { scale: { repeat: Infinity, duration: 0.9 } }
            : bob && !wrong ? { y: { repeat: Infinity, duration: 2 + bob * 0.3, ease: 'easeInOut' }, default: { type: 'spring', stiffness: 260, damping: 16 } }
            : { type: 'spring', stiffness: 260, damping: 16 }
        }
        className="w-full h-full flex items-center justify-center font-bold text-slate-800 select-none"
        style={{
          touchAction: 'none',
          background: color,
          borderRadius: '1.6rem',
          fontSize: kind === 'picture' ? size * 0.58 : size * 0.64,
          lineHeight: 1,
          boxShadow: glow ? '0 0 0 8px rgba(255,255,255,.9), 0 0 28px 10px rgba(255,220,0,.8)' : '0 6px 0 rgba(0,0,0,.15)',
          cursor: 'grab',
        }}
      >
        {kind === 'picture' ? l.emoji : l.char}
      </motion.button>
    </div>
  );
}

/** Letters falling gently toward the monster; they wrap to the top, never lost. */
function RainField(props: {
  q: Question; kind: 'letter' | 'picture'; colors: string[]; wrongIds: string[]; hint: boolean;
  onDrop: ItemProps['onDrop']; paused: boolean;
}) {
  const { q, kind, colors, wrongIds, hint, onDrop, paused } = props;
  const box = useRef<HTMLDivElement | null>(null);
  const items = useRef<{ id: string; x: number; y: number; v: number }[]>([]);
  const held = useRef<Set<string>>(new Set());
  const [, setTick] = useState(0);
  const SIZE = 118;

  useEffect(() => {
    const n = q.options.length;
    // start inside the play area (staggered), so there is never a wait for letters to appear
    items.current = q.options.map((id, i) => ({ id, x: ((i + 0.5) / n) * 100, y: 8 + (i % 3) * 64, v: 38 + (i % 3) * 8 }));
  }, [q]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const h = box.current?.clientHeight ?? 400;
      if (!paused) {
        for (const it of items.current) {
          if (held.current.has(it.id)) continue;
          it.y += it.v * dt;
          if (it.y > h) it.y = -SIZE;
        }
      }
      setTick((n) => (n + 1) % 1e6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  return (
    <div ref={box} className="absolute inset-0">
      {items.current.map((it, i) => (
        <FeedItem
          key={`${it.id}`}
          id={it.id}
          kind={kind}
          size={SIZE}
          color={colors[i % colors.length]}
          wrong={wrongIds.includes(it.id)}
          hidden={paused || (hint && it.id !== q.target)}
          glow={!paused && hint && it.id === q.target}
          onDrop={onDrop}
          onHold={(id, h) => (h ? held.current.add(id) : held.current.delete(id))}
          style={{ left: `calc(${it.x}% - ${SIZE / 2}px)`, top: it.y }}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------- game ---
export default function FeedGame({ onExit }: { onExit: () => void }) {
  const [profile, setProfile] = useState<Profile>(() => loadFeedProfile());
  const profileRef = useRef(profile);
  const [screen, setScreen] = useState<'play' | 'roundEnd' | 'lesson' | 'wardrobe'>('play');
  const [q, setQ] = useState<Question | null>(null);
  const [qKey, setQKey] = useState(0);
  const [mood, setMood] = useState<Mood>('hungry');
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const wrongRef = useRef<string[]>([]);
  const [hint, setHint] = useState(false);
  const [phase, setPhase] = useState<'asking' | 'eating'>('asking');
  const [summary, setSummary] = useState<RoundSummary | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const pendingLesson = useRef<string | null>(null);
  const run = useRef(0);
  const monsterRef = useRef<HTMLDivElement | null>(null);

  const commit = useCallback((p: Profile) => {
    profileRef.current = p;
    setProfile(p);
    saveFeedProfile(p);
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
    if (pendingLesson.current) {
      setLessonId(pendingLesson.current);
      pendingLesson.current = null;
      setScreen('lesson');
      return;
    }
    wrongRef.current = [];
    setQ(makeQuestion(profileRef.current));
    setWrongIds([]);
    setHint(false);
    setPhase('asking');
    setMood('hungry');
    setQKey((k) => k + 1);
    setScreen('play');
  }, []);

  useEffect(() => {
    goNext();
  }, [goNext]);

  const colors = useMemo(() => [...CARD_COLORS].sort(() => Math.random() - 0.5), [qKey]);

  // read the question aloud, and again if he is idle
  useEffect(() => {
    if (screen !== 'play' || !q || phase !== 'asking') return;
    const l = LETTER_BY_ID[q.target];
    const say = () => void speak(hint ? hintLine(l) : feedPrompt(q).speak);
    const first = setTimeout(say, hint ? 250 : 500);
    const idle = setInterval(say, 16000);
    return () => {
      clearTimeout(first);
      clearInterval(idle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qKey, screen, phase, hint]);

  useEffect(() => {
    if (screen !== 'lesson' || !lessonId) return;
    const l = LETTER_BY_ID[lessonId];
    const t = setTimeout(() => void speak([againLine(l), likeLine(l)]), 400);
    return () => clearTimeout(t);
  }, [screen, lessonId]);

  useEffect(() => {
    if (screen !== 'roundEnd' || !summary) return;
    sfx.fanfare();
    burst(0.5, 0.4, true);
    void speak(summary.newSticker ? [FULL, FULL_HAT] : FULL);
  }, [screen, summary]);

  const advance = useCallback(() => {
    const p = profileRef.current;
    if (p.round.done >= ROUND_LENGTH) {
      const s = finishRound(p);
      commit(s.profile);
      setSummary(s);
      setMood('happy');
      setScreen('roundEnd');
      trackEvent('first_steps_feed_round', { first_try: s.firstTry, letters: s.profile.unlocked });
    } else {
      goNext();
    }
  }, [commit, goNext]);

  const onDrop = (id: string, point: { x: number; y: number } | null, el: HTMLElement | null) => {
    if (!q || phase !== 'asking' || wrongRef.current.includes(id)) return;
    // a drag only counts if it ends on the monster; a plain tap sends the item there
    if (point) {
      const r = monsterRef.current?.getBoundingClientRect();
      if (!r || !inZone({ x: point.x, y: point.y }, r)) return;
    }
    const l = LETTER_BY_ID[q.target];
    if (id === q.target) {
      setPhase('eating');
      setMood('chomp');
      sfx.correct();
      const r = monsterRef.current?.getBoundingClientRect();
      if (r) burst((r.left + r.width / 2) / window.innerWidth, (r.top + r.height / 2) / window.innerHeight);
      const res = recordCorrect(profileRef.current, q, wrongRef.current.length);
      commit(res.profile);
      const reinforce = q.type === 'word' || q.type === 'picture' ? likeLine(l) : nameLine(l);
      const my = ++run.current;
      void Promise.all([speak([pick(THANKS), reinforce]), wait(1700)]).then(() => {
        if (my === run.current) advance();
      });
      return;
    }
    sfx.wrong();
    setMood('yuck');
    const my = run.current;
    setTimeout(() => {
      if (my === run.current) setMood('hungry');
    }, 900);
    const r = recordWrong(profileRef.current, q.target);
    commit(r.profile);
    if (r.focusTriggered) {
      pendingLesson.current = q.target;
      trackEvent('first_steps_feed_focus', { letter: q.target });
    }
    const next = [...wrongRef.current, id];
    wrongRef.current = next;
    setWrongIds(next);
    const wrongLeft = q.options.filter((o) => o !== q.target && !next.includes(o)).length;
    if (next.length >= 2 || wrongLeft === 0) setHint(true);
    else void speak(pick(YUCK));
  };

  const exit = () => {
    run.current++;
    stopSpeaking();
    onExit();
  };

  const hat = hatFor(profile.stickers);
  const color = colorFor(profile.rounds);
  const earned = profile.stickers;

  const topBar = (back: () => void) => (
    <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
      <button aria-label="חזרה" onClick={() => { sfx.tap(); back(); }}
        className="w-16 h-16 rounded-full bg-white/85 shadow flex items-center justify-center text-slate-600 active:scale-90">
        <Home className="w-8 h-8" />
      </button>
      <div className="flex gap-2" aria-label="התקדמות בסיבוב">
        {Array.from({ length: ROUND_LENGTH }, (_, i) => (
          <motion.div key={i} animate={i < profile.round.done ? { scale: [1, 1.4, 1] } : {}}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${i < profile.round.done ? 'bg-amber-300 shadow' : 'bg-white/60 grayscale opacity-60'}`}>
            🍎
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <StarsChip stars={profile.stars} />
        <button aria-label="מלתחה" onClick={() => { sfx.tap(); run.current++; stopSpeaking(); setScreen('wardrobe'); }}
          className="h-16 px-4 rounded-full bg-white/85 shadow text-3xl active:scale-90">👒</button>
        <button aria-label="צליל" onClick={() => setSoundOn((v) => !v)}
          className="w-16 h-16 rounded-full bg-white/85 shadow flex items-center justify-center text-slate-600 active:scale-90">
          {soundOn ? <Volume2 className="w-8 h-8" /> : <VolumeX className="w-8 h-8" />}
        </button>
      </div>
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <div className="fs-root fixed inset-0 overflow-y-auto" dir="rtl">
      <div className="min-h-full flex flex-col">{children}</div>
    </div>
  );

  if (screen === 'wardrobe') {
    return shell(
      <>
        {topBar(() => { setScreen('play'); goNext(); })}
        <div className="px-3 pb-8 max-w-3xl w-full mx-auto text-center">
          <h2 className="text-4xl font-bold text-pink-600 mb-1">המלתחה של המפלצת</h2>
          <p className="text-xl text-slate-600 mb-4">כל {STARS_PER_STICKER} כוכבים = כובע חדש</p>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
            {HATS.map((h, i) => (
              <div key={h} className="aspect-square rounded-3xl bg-white/80 shadow flex items-center justify-center">
                {i < earned ? <span style={{ fontSize: 'clamp(40px,9vmin,70px)' }}>{h}</span> : <Lock className="w-8 h-8 text-slate-300" />}
              </div>
            ))}
          </div>
        </div>
      </>,
    );
  }

  if (screen === 'lesson' && lessonId) {
    const l = LETTER_BY_ID[lessonId];
    return shell(
      <>
        {topBar(exit)}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 pb-8 text-center">
          <p className="text-3xl font-bold text-indigo-700">בוא נכיר שוב את האות</p>
          <button onClick={() => void speak(likeLine(l))}
            className="bg-white rounded-[3rem] shadow-xl flex items-center justify-center text-indigo-600"
            style={{ width: 'min(50vmin,300px)', height: 'min(50vmin,300px)', fontSize: 'min(36vmin,200px)', lineHeight: 1 }}>
            {l.char}
          </button>
          <p className="text-4xl font-bold text-slate-700">{l.name} כמו {l.word} <span className="text-6xl align-middle">{l.emoji}</span></p>
          <BigButton onClick={() => goNext()} className="text-4xl px-12 py-5">ממשיכים ▶</BigButton>
        </div>
      </>,
    );
  }

  if (screen === 'roundEnd' && summary) {
    return shell(
      <>
        {topBar(exit)}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 pb-8 text-center">
          <Monster mood="happy" color={color} hat={hat} size="min(46vmin,320px)" />
          <h2 className="text-5xl font-bold text-indigo-700">הבטן מלאה!</h2>
          <div className="flex gap-2 flex-wrap justify-center">
            {Array.from({ length: summary.starsEarned }, (_, i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.12 * i, type: 'spring' }} className="text-4xl">⭐</motion.span>
            ))}
          </div>
          {summary.newSticker && <p className="text-2xl font-bold text-pink-600">קיבלנו כובע חדש! {hat}</p>}
          <div className="flex gap-3 flex-wrap justify-center">
            <BigButton onClick={goNext} className="text-4xl px-10 py-5">עוד אוכל ▶</BigButton>
            <BigButton color="bg-sky-500" onClick={exit} className="text-3xl px-8 py-5">הביתה</BigButton>
          </div>
        </div>
      </>,
    );
  }

  if (!q) return shell(<div />);
  const target = LETTER_BY_ID[q.target];
  const kind = itemKind(q.type);
  const layout = layoutFor(q.type);
  const prompt = feedPrompt(q);
  const sizePx = q.options.length > 4 ? 120 : 158;

  return shell(
    <>
      {topBar(exit)}
      <div className="flex-1 flex flex-col items-center gap-2 px-3 pb-3">
        <button
          data-target={q.target}
          data-layout={layout}
          onClick={() => void speak(hint ? hintLine(target) : prompt.speak)}
          className="flex items-center gap-3 bg-white rounded-[2rem] shadow-lg px-5 py-3 active:scale-95 max-w-3xl"
          aria-label="שמע שוב"
        >
          <Volume2 className="w-8 h-8 text-indigo-500 shrink-0" />
          <span className="text-2xl sm:text-3xl font-bold text-slate-700">{prompt.text}</span>
        </button>

        <div className="relative w-full flex-1 overflow-hidden" style={{ minHeight: 'calc(100vh - 210px)' }}>
          {/* what the monster is thinking of */}
          {(q.type === 'word' || q.type === 'picture') && (
            <motion.div key={`think${qKey}`} initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="absolute z-10 bg-white rounded-full shadow-xl flex items-center justify-center"
              style={{ top: 4, left: 'calc(50% + min(12vmin,90px))', width: 'clamp(84px,17vmin,130px)', height: 'clamp(84px,17vmin,130px)', fontSize: 'clamp(46px,10vmin,76px)', lineHeight: 1 }}>
              {q.type === 'word' ? target.emoji : <span className="text-indigo-600 font-bold">{target.char}</span>}
            </motion.div>
          )}

          {layout === 'rain' ? (
            <RainField q={q} kind={kind} colors={colors} wrongIds={wrongIds} hint={hint} onDrop={onDrop} paused={phase !== 'asking'} />
          ) : (
            <div className="absolute left-0 right-0 flex items-center justify-center gap-4 sm:gap-8 flex-wrap px-2" style={{ top: 28 }}>
              {q.options.map((id, i) => (
                <div key={`${qKey}-${id}`} style={{ position: 'relative', width: sizePx, height: sizePx }}>
                  <FeedItem id={id} kind={kind} size={sizePx} color={colors[i % colors.length]} wrong={wrongIds.includes(id)}
                    hidden={phase === 'eating' || (hint && id !== q.target)} glow={phase === 'asking' && hint && id === q.target} bob={i + 1} onDrop={onDrop} style={{ left: 0, top: 0 }} />
                </div>
              ))}
            </div>
          )}

          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex flex-col items-center">
            <Monster ref={monsterRef} mood={mood} color={color} hat={hat} look={0} size="min(42vmin,300px)" />
          </div>
        </div>
      </div>
    </>,
  );
}
