/** Tiny synthesized sound effects (no audio assets needed). */
let ctx: AudioContext | null = null;
let on = true;

export function setSfxEnabled(v: boolean) {
  on = v;
}

function ac(): AudioContext | null {
  try {
    const C = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = ctx ?? new C();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  correct() {
    if (!on) return;
    tone(660, 0, 0.18, 'triangle');
    tone(880, 0.12, 0.22, 'triangle');
    tone(1320, 0.26, 0.3, 'triangle');
  },
  wrong() {
    if (!on) return;
    tone(260, 0, 0.18, 'sine', 0.14);
    tone(200, 0.14, 0.25, 'sine', 0.14);
  },
  pop() {
    if (!on) return;
    tone(500, 0, 0.08, 'square', 0.12);
    tone(900, 0.04, 0.1, 'triangle', 0.14);
  },
  tap() {
    if (!on) return;
    tone(520, 0, 0.06, 'sine', 0.08);
  },
  fanfare() {
    if (!on) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.3, 'triangle'));
    tone(1047, 0.6, 0.5, 'triangle');
  },
};
