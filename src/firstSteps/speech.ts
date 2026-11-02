/**
 * Hebrew text-to-speech using the browser's built-in speech synthesis.
 * (No network, no API keys. Quality depends on the voices installed on the
 * tablet: Android/Chrome ships "Google עברית", iOS ships "Carmit".)
 */
let cachedVoice: SpeechSynthesisVoice | null = null;
let enabled = true;
let token = 0;

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

function findHebrewVoice(): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices();
  const he = voices.filter((v) => /^(he|iw)([-_]|$)/i.test(v.lang));
  // Prefer a local/high quality voice when several are available.
  return he.find((v) => v.localService) ?? he[0] ?? null;
}

export function hasHebrewVoice(): boolean {
  cachedVoice = findHebrewVoice();
  return !!cachedVoice;
}

/** Calls `cb` once voices have loaded (they are often async), and on change. */
export function onVoicesReady(cb: () => void): () => void {
  const s = synth();
  if (!s) return () => {};
  const handler = () => {
    cachedVoice = findHebrewVoice();
    cb();
  };
  s.addEventListener?.('voiceschanged', handler);
  handler();
  return () => s.removeEventListener?.('voiceschanged', handler);
}

export function setSpeechEnabled(on: boolean) {
  enabled = on;
  if (!on) stopSpeaking();
}

export function stopSpeaking() {
  token++;
  synth()?.cancel();
}

/**
 * Speak `text`. Resolves when finished (or after a safety timeout, since some
 * engines never fire `onend`). Starting a new utterance cancels the old one.
 */
export function speak(text: string, opts: { rate?: number; pitch?: number } = {}): Promise<void> {
  const s = synth();
  const my = ++token;
  if (!s || !enabled) return new Promise((r) => setTimeout(r, Math.min(2500, 600 + text.length * 70)));
  s.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL';
    const v = cachedVoice ?? findHebrewVoice();
    if (v) u.voice = v;
    u.rate = opts.rate ?? 0.85; // slower for a small child
    u.pitch = opts.pitch ?? 1.15;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    setTimeout(finish, 1500 + text.length * 160 + 800);
    // Some engines glitch if speak() immediately follows cancel().
    setTimeout(() => {
      if (my === token) s.speak(u);
      else finish();
    }, 30);
  });
}
