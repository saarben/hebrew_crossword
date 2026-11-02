import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Home, Volume2, VolumeX, RotateCcw, Lock } from 'lucide-react';
import { LETTER_BY_ID, ALPHABET } from './letters';
import { STROKES, Pt } from './strokes';
import { Tracer, begin, createTracer, end, moveSegment, nextTarget, progressOf, move } from './tracer';
import {
  DRAW_ORDER, DrawMode, DrawProfile, dstat, modeFor, pickDrawLetter, radiusFor, recordDraw,
} from './drawEngine';
import { loadDrawProfile, saveDrawProfile } from './storage';
import { setSpeechEnabled, speak, stopSpeaking } from './speech';
import { setSfxEnabled, sfx } from './sfx';
import {
  DRAW_ASSIST, DRAW_DOTS, DRAW_FADED, DRAW_START_HERE, DRAW_STRAY, DRAW_YOUR_TURN,
  drawDoneLine, drawWatchLine, likeLine,
} from './phrases';
import { BigButton, Mascot, StarsChip, burst, burstAt } from './ui';
import { trackEvent } from '../analytics';

type Phase = 'demo' | 'trace' | 'done';

const SKINS = [
  { name: 'rainbow', stops: ['#ff4d6d', '#ffb703', '#52b788', '#4cc9f0', '#9d4edd'], spark: ['✨', '⭐', '🌈'] },
  { name: 'ocean', stops: ['#4cc9f0', '#4361ee', '#7209b7'], spark: ['🫧', '💧', '🐠'] },
  { name: 'candy', stops: ['#ff5d8f', '#ff99ac', '#ffb703'], spark: ['💖', '🍭', '🌸'] },
  { name: 'forest', stops: ['#52b788', '#95d5b2', '#ffd166'], spark: ['🍃', '🦋', '🌟'] },
];

const toPath = (pts: Pt[]) => (pts.length < 2 ? '' : 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L'));

export default function DrawGame({ onExit }: { onExit: () => void }) {
  const [profile, setProfile] = useState<DrawProfile>(() => loadDrawProfile());
  const profileRef = useRef(profile);
  const [screen, setScreen] = useState<'play' | 'gallery'>('play');
  const [letterId, setLetterId] = useState<string>(() => {
    const p = profileRef.current;
    return pickDrawLetter(p);
  });
  const [phase, setPhase] = useState<Phase>('demo');
  const [assist, setAssist] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [, setTick] = useState(0);
  const [result, setResult] = useState<{ stars: number; unlocked: string | null } | null>(null);
  const [demo, setDemo] = useState<{ stroke: number; pts: number } | null>(null);
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; e: string }[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [shake, setShake] = useState(0);

  const tracer = useRef<Tracer | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const last = useRef<Pt | null>(null);
  const pid = useRef<number | null>(null);
  const run = useRef(0);
  const lastSparkAt = useRef(0);
  const sparkId = useRef(0);
  const lastSayAt = useRef(0);
  const lastProgressAt = useRef(Date.now());

  const letter = LETTER_BY_ID[letterId];
  const strokes = STROKES[letterId].strokes;
  const baseMode: DrawMode = modeFor(profile, letterId);
  const struggle = dstat(profile, letterId).struggle;
  const mode: DrawMode = assist >= 2 ? 'trace' : baseMode;
  const skin = SKINS[(profile.rounds + DRAW_ORDER.indexOf(letterId)) % SKINS.length];

  const commit = useCallback((p: DrawProfile) => {
    profileRef.current = p;
    setProfile(p);
    saveDrawProfile(p);
  }, []);

  useEffect(() => {
    setSpeechEnabled(soundOn);
    setSfxEnabled(soundOn);
  }, [soundOn]);

  useEffect(() => () => {
    run.current++;
    stopSpeaking();
  }, []);

  const say = (text: string | string[], gapMs = 0) => {
    const now = Date.now();
    if (now - lastSayAt.current < gapMs) return;
    lastSayAt.current = now;
    void speak(text);
  };

  // (Re)start a letter: build the tracer, play the demo when the child needs it.
  useEffect(() => {
    if (screen !== 'play') return;
    const p = profileRef.current;
    const radius = radiusFor(modeFor(p, letterId), dstat(p, letterId).struggle, assist);
    tracer.current = createTracer(strokes, radius);
    last.current = null;
    lastProgressAt.current = Date.now();
    setResult(null);
    setTick((n) => n + 1);
    const showDemo = modeFor(p, letterId) === 'trace' || attempt > 0;
    const my = ++run.current;
    if (!showDemo) {
      setPhase('trace');
      setDemo(null);
      say(modeFor(p, letterId) === 'dots' ? DRAW_DOTS : DRAW_FADED);
      return;
    }
    setPhase('demo');
    void speak(drawWatchLine(letter));
    // animate a pen along every stroke
    let raf = 0;
    let started = 0;
    const paths = tracer.current.paths;
    const total = paths.reduce((n, s) => n + s.length, 0);
    const MS_PER_POINT = 38;
    const t0 = performance.now() + 1400; // let the sentence start first
    const loop = (now: number) => {
      if (my !== run.current) return;
      const elapsed = now - t0;
      if (elapsed < 0) {
        raf = requestAnimationFrame(loop);
        return;
      }
      started = Math.floor(elapsed / MS_PER_POINT);
      if (started >= total + 10) {
        setDemo(null);
        setPhase('trace');
        lastProgressAt.current = Date.now();
        void speak(DRAW_YOUR_TURN);
        return;
      }
      let left = started;
      let si = 0;
      while (si < paths.length - 1 && left >= paths[si].length + 6) {
        left -= paths[si].length + 6; // short pause between strokes
        si++;
      }
      setDemo({ stroke: si, pts: Math.min(left, paths[si].length) });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterId, attempt, screen]);

  // Gentle nudges when the child is idle.
  useEffect(() => {
    if (phase !== 'trace') return;
    const id = setInterval(() => {
      if (Date.now() - lastProgressAt.current > 12000) {
        lastProgressAt.current = Date.now();
        say(DRAW_START_HERE);
        setShake((n) => n + 1);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [phase, letterId]);

  const toCoords = (e: React.PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100];
  };

  const spawn = (p: Pt) => {
    const now = performance.now();
    if (now - lastSparkAt.current < 110) return;
    lastSparkAt.current = now;
    const id = ++sparkId.current;
    const e = skin.spark[id % skin.spark.length];
    setSparks((s) => [...s.slice(-8), { id, x: p[0], y: p[1], e }]);
    setTimeout(() => setSparks((s) => s.filter((x) => x.id !== id)), 700);
  };

  const finish = () => {
    const t = tracer.current!;
    run.current++;
    setPhase('done');
    const res = recordDraw(profileRef.current, letterId, t.strays, assist > 0);
    commit(res.profile);
    setResult({ stars: res.stars, unlocked: res.unlocked });
    sfx.fanfare();
    burst(0.5, 0.4, true);
    void speak([drawDoneLine(letter), likeLine(letter)]);
    trackEvent('first_steps_draw', { letter: letterId, stars: res.stars, strays: t.strays });
  };

  const handle = (event: ReturnType<typeof move>, e?: React.SyntheticEvent) => {
    if (event === 'progress' || event === 'strokeDone' || event === 'letterDone') lastProgressAt.current = Date.now();
    if (event === 'strokeDone') {
      sfx.pop();
      e && burstAt(e);
    }
    if (event === 'stray') {
      sfx.wrong();
      say(DRAW_STRAY, 4000);
      const t = tracer.current!;
      // Repeated wandering: make it easier, and bring the full guide back.
      if (t.strays >= 3 && assist < 1) {
        setAssist(1);
        t.radius = radiusFor(baseMode, struggle, 1);
        say(DRAW_ASSIST);
      } else if (t.strays >= 6 && assist < 2) {
        setAssist(2);
        t.radius = radiusFor('trace', struggle, 2);
      }
    }
    if (event === 'letterDone') finish();
  };

  const onDown = (e: React.PointerEvent) => {
    if (phase === 'demo') {
      // tapping during the demo skips it
      run.current++;
      setDemo(null);
      setPhase('trace');
      lastProgressAt.current = Date.now();
      return;
    }
    if (phase !== 'trace' || !tracer.current) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pid.current = e.pointerId;
    const p = toCoords(e);
    last.current = p;
    const ok = begin(tracer.current, p);
    if (!ok) {
      sfx.tap();
      setShake((n) => n + 1);
      say(DRAW_START_HERE, 5000);
    } else {
      spawn(p);
    }
    setTick((n) => n + 1);
  };

  const onMove = (e: React.PointerEvent) => {
    const t = tracer.current;
    if (phase !== 'trace' || !t || !t.active || pid.current !== e.pointerId) return;
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
    const pts: Pt[] = events.length
      ? events.map((ev) => {
          const r = svgRef.current!.getBoundingClientRect();
          return [((ev.clientX - r.left) / r.width) * 100, ((ev.clientY - r.top) / r.height) * 100] as Pt;
        })
      : [toCoords(e)];
    let best: ReturnType<typeof move> = 'none';
    const rank = { none: 0, progress: 1, stray: 2, strokeDone: 3, letterDone: 4 } as const;
    for (const p of pts) {
      const from = last.current ?? p;
      const ev = moveSegment(t, from, p);
      last.current = p;
      if (rank[ev] > rank[best]) best = ev;
      if (!t.active && ev !== 'none') break;
    }
    const cur = pts[pts.length - 1];
    spawn(cur);
    handle(best, e);
    setTick((n) => n + 1);
  };

  const onUp = () => {
    if (tracer.current) end(tracer.current);
    pid.current = null;
    last.current = null;
    setTick((n) => n + 1);
  };

  const next = () => {
    const id = pickDrawLetter(profileRef.current);
    setAssist(0);
    setAttempt(0);
    setLetterId(id);
  };

  const retry = () => {
    setAssist(0);
    setAttempt((n) => n + 1);
  };

  // ---------- render ----------
  const t = tracer.current;
  const gradId = 'ink-grad';
  const target = t && phase === 'trace' ? nextTarget(t) : null;
  const curStroke = t ? Math.min(t.stroke, strokes.length - 1) : 0;

  const dotsFor = (si: number): Pt[] => {
    if (!t) return [];
    const path = t.paths[si];
    const out: Pt[] = [];
    for (let i = 0; i < path.length; i += 7) out.push(path[i]);
    return out;
  };

  const topBar = (
    <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
      <button
        aria-label="חזרה"
        onClick={() => {
          sfx.tap();
          run.current++;
          stopSpeaking();
          onExit();
        }}
        className="w-16 h-16 rounded-full bg-white/85 shadow flex items-center justify-center text-slate-600 active:scale-90"
      >
        <Home className="w-8 h-8" />
      </button>
      <div className="flex items-center gap-3">
        <StarsChip stars={profile.stars} />
        <button
          aria-label="גלריה"
          onClick={() => {
            sfx.tap();
            run.current++;
            stopSpeaking();
            setScreen('gallery');
          }}
          className="h-16 px-4 rounded-full bg-white/85 shadow flex items-center justify-center text-3xl active:scale-90"
        >
          🖼️
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

  if (screen === 'gallery') {
    return (
      <div className="fs-root fixed inset-0 overflow-y-auto" dir="rtl">
        <div className="min-h-full flex flex-col">
          <div className="flex items-center justify-between p-3 sm:p-4">
            <button
              aria-label="חזרה"
              onClick={() => {
                sfx.tap();
                setScreen('play');
              }}
              className="w-16 h-16 rounded-full bg-white/85 shadow flex items-center justify-center text-slate-600 active:scale-90"
            >
              <RotateCcw className="w-8 h-8" />
            </button>
            <StarsChip stars={profile.stars} />
          </div>
          <div className="px-3 pb-8 max-w-3xl w-full mx-auto">
            <h2 className="text-4xl font-bold text-pink-600 text-center mb-4">הגלריה שלי</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 sm:gap-4">
              {ALPHABET.map((l) => {
                const got = profile.gallery.includes(l.id);
                const stars = dstat(profile, l.id).best;
                return (
                  <button
                    key={l.id}
                    disabled={!got}
                    onClick={() => void speak(likeLine(l))}
                    className={`aspect-square rounded-3xl shadow flex flex-col items-center justify-center active:scale-95 ${
                      got ? 'bg-white' : 'bg-white/40 text-slate-400'
                    }`}
                  >
                    {got ? (
                      <>
                        <span
                          className="text-5xl sm:text-6xl leading-none font-bold"
                          style={{ background: `linear-gradient(135deg, ${SKINS[0].stops.join(',')})`, WebkitBackgroundClip: 'text', color: 'transparent' }}
                        >
                          {l.char}
                        </span>
                        <span className="text-sm mt-1">{'⭐'.repeat(stars)}</span>
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

  const roadW = mode === 'trace' ? 16 : 13;
  const roadColor = mode === 'faded' ? '#e5e7eb' : '#dbe4f3';
  // the card shrinks on the result screen so stars + buttons stay on screen
  const size = phase === 'done' ? 'min(calc(100vw - 24px), calc(100vh - 400px), 420px)' : 'min(calc(100vw - 24px), calc(100vh - 250px), 560px)';
  const promptText =
    phase === 'demo' ? `תסתכלו איך מציירים את האות ${letter.name}` : mode === 'dots' ? 'עקבו אחרי הנקודות לפי הסדר' : mode === 'faded' ? 'נסו לצייר כמעט בלי עזרה' : 'עכשיו תורך! התחילו מהנקודה';

  return (
    <div className="fs-root fixed inset-0 overflow-y-auto" dir="rtl">
      <div className="min-h-full flex flex-col">
        {topBar}
        <div className="flex-1 flex flex-col items-center gap-3 px-3 pb-6">
          <div className="flex items-center gap-3 max-w-3xl w-full justify-center">
            <Mascot size={64} dance={phase === 'done'} />
            <button
              onClick={() =>
                phase === 'demo'
                  ? void speak(drawWatchLine(letter))
                  : phase === 'done'
                    ? void speak([drawDoneLine(letter), likeLine(letter)])
                    : void speak(mode === 'dots' ? DRAW_DOTS : mode === 'faded' ? DRAW_FADED : DRAW_YOUR_TURN)
              }
              className="flex items-center gap-3 bg-white rounded-[2rem] shadow-lg px-5 py-3 active:scale-95 text-right"
              aria-label="שמע שוב"
            >
              <Volume2 className="w-8 h-8 text-indigo-500 shrink-0" />
              <span className="text-2xl sm:text-3xl font-bold text-slate-700">{phase === 'done' ? `כל הכבוד! ציירת את האות ${letter.name}` : promptText}</span>
            </button>
          </div>

          <div className="relative" style={{ width: size, height: size }}>
            {/* reference card: how the printed letter looks */}
            <div className="absolute top-2 right-2 z-10 w-16 h-16 rounded-2xl bg-white/90 shadow flex items-center justify-center text-4xl font-bold text-indigo-600 pointer-events-none">
              {letter.char}
            </div>
            <motion.div
              key={`card-${letterId}-${attempt}`}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full h-full rounded-[2.5rem] bg-white shadow-2xl overflow-hidden"
            >
              <svg
                ref={svgRef}
                viewBox="0 0 100 100"
                className="w-full h-full select-none"
                style={{ touchAction: 'none' }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                data-testid="draw-svg"
              >
                <defs>
                  <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="20" y1="20" x2="80" y2="80">
                    {skin.stops.map((c, i) => (
                      <stop key={c} offset={`${(i / Math.max(1, skin.stops.length - 1)) * 100}%`} stopColor={c} />
                    ))}
                  </linearGradient>
                </defs>

                {/* guide road */}
                {strokes.map((s, i) => (
                  <path key={`r${i}`} d={toPath(t ? t.paths[i] : s)} fill="none" stroke={roadColor} strokeWidth={roadW}
                    strokeLinecap="round" strokeLinejoin="round" opacity={mode === 'faded' && phase !== 'done' ? 0.45 : 1} />
                ))}
                {mode === 'trace' && phase !== 'done' &&
                  strokes.map((s, i) => (
                    <path key={`c${i}`} d={toPath(s)} fill="none" stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="2 3" strokeLinecap="round" />
                  ))}

                {/* ink the child has drawn */}
                {t &&
                  strokes.map((_, i) => (
                    <path key={`i${i}`} d={toPath(t.paths[i].slice(0, Math.max(0, progressOf(t, i))))} fill="none"
                      stroke={`url(#${gradId})`} strokeWidth={roadW - 3} strokeLinecap="round" strokeLinejoin="round" />
                  ))}

                {/* numbered dots */}
                {mode === 'dots' && phase !== 'done' && t &&
                  strokes.map((_, si) =>
                    dotsFor(si).map((d, di) => {
                      const lit = progressOf(t, si) > di * 7;
                      return (
                        <g key={`d${si}-${di}`}>
                          <circle cx={d[0]} cy={d[1]} r={lit ? 2.6 : 3.4} fill={lit ? '#fff' : '#6366f1'} stroke={lit ? 'none' : '#fff'} strokeWidth={0.8} />
                          {di === 0 && !lit && (
                            <text x={d[0]} y={d[1] + 1.6} fontSize={4.6} textAnchor="middle" fill="#fff" fontWeight="bold">{si + 1}</text>
                          )}
                        </g>
                      );
                    }),
                  )}

                {/* demo pen */}
                {phase === 'demo' && demo && t && (
                  <>
                    {strokes.map((_, i) => {
                      const n = i < demo.stroke ? t.paths[i].length : i === demo.stroke ? demo.pts : 0;
                      return <path key={`dm${i}`} d={toPath(t.paths[i].slice(0, n))} fill="none" stroke="#fb923c" strokeWidth={roadW - 3} strokeLinecap="round" strokeLinejoin="round" />;
                    })}
                    {(() => {
                      const pt = t.paths[demo.stroke][Math.max(0, Math.min(demo.pts, t.paths[demo.stroke].length) - 1)];
                      return <text x={pt[0] - 2} y={pt[1] - 1} fontSize={14}>✏️</text>;
                    })()}
                  </>
                )}

                {/* where to start / continue */}
                {target && !t!.active && (
                  <g key={`tgt-${shake}`}>
                    <motion.circle cx={target[0]} cy={target[1]} r={5} fill="#22c55e" stroke="#fff" strokeWidth={1.5}
                      animate={{ r: [5, 8, 5] }} transition={{ repeat: Infinity, duration: 1 }} />
                    {t!.idx === 0 && (
                      <text x={target[0]} y={target[1] + 2} fontSize={6} textAnchor="middle" fill="#fff" fontWeight="bold">{curStroke + 1}</text>
                    )}
                  </g>
                )}

                {/* sparkles under the finger */}
                {sparks.map((s) => (
                  <motion.text key={s.id} x={s.x} y={s.y} fontSize={8} textAnchor="middle"
                    initial={{ opacity: 1, y: s.y }} animate={{ opacity: 0, y: s.y - 10 }} transition={{ duration: 0.7 }}>
                    {s.e}
                  </motion.text>
                ))}
              </svg>
            </motion.div>
          </div>

          {phase === 'trace' && (
            <button
              onClick={retry}
              className="flex items-center gap-2 bg-white/80 rounded-full px-5 py-2 text-lg text-slate-600 shadow active:scale-95"
            >
              <RotateCcw className="w-5 h-5" /> הראו לי שוב
            </button>
          )}

          {phase === 'done' && result && (
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 text-5xl">
                {Array.from({ length: 3 }, (_, i) => (
                  <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15 * i, type: 'spring' }}
                    style={{ opacity: i < result.stars ? 1 : 0.2, filter: i < result.stars ? 'none' : 'grayscale(1)' }}>
                    ⭐
                  </motion.span>
                ))}
                <span className="text-6xl">{letter.emoji}</span>
              </div>
              {result.unlocked && <p className="text-xl font-bold text-pink-600">אות חדשה נפתחה: {LETTER_BY_ID[result.unlocked].name}!</p>}
              <div className="flex gap-3">
                <BigButton onClick={next} className="text-3xl px-10 py-4">הבא ▶</BigButton>
                <BigButton color="bg-sky-500" onClick={() => setScreen('gallery')} className="text-2xl px-6 py-4">🖼️ גלריה</BigButton>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
