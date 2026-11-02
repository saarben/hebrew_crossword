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
  player?.pause();
}

// ---- pre-generated audio (public/audio/first-steps) ----------------------
// Sentences are mapped to mp3 files by a manifest written by
// scripts/generate-first-steps-audio.py. Anything missing falls back to the
// browser's own speech synthesis.
let manifest: Record<string, string> | null = null;
let manifestLoad: Promise<void> | null = null;
const AUDIO_DIR = `${import.meta.env.BASE_URL}audio/first-steps/`;
// One reusable element: once a tap has unlocked it, iOS lets us keep using it.
let player: HTMLAudioElement | null = null;

export function loadAudioManifest(): Promise<void> {
  manifestLoad ??= fetch(`${AUDIO_DIR}manifest.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      manifest = m && typeof m === 'object' ? m : null;
    })
    .catch(() => {
      manifest = null;
    });
  return manifestLoad;
}

export function hasRecordedAudio(): boolean {
  return !!manifest && Object.keys(manifest).length > 0;
}

function playFile(file: string, my: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      player ??= new Audio();
      const a = player;
      a.onended = () => resolve(true);
      a.onerror = () => resolve(false);
      a.src = AUDIO_DIR + file;
      const started = a.play();
      if (started) started.catch(() => resolve(false));
      // safety net if neither event ever fires
      setTimeout(() => resolve(my === token), 15000);
    } catch {
      resolve(false);
    }
  });
}

function synthOne(text: string, opts: { rate?: number; pitch?: number }): Promise<void> {
  const s = synth();
  if (!s) return new Promise((r) => setTimeout(r, Math.min(2500, 600 + text.length * 70)));
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
    s.speak(u);
  });
}

/**
 * Say one sentence or several in a row. Resolves when finished; a newer call
 * cancels the older one. Recorded audio is preferred, browser TTS is the fallback.
 */
export async function speak(
  text: string | string[],
  opts: { rate?: number; pitch?: number } = {},
): Promise<void> {
  const parts = Array.isArray(text) ? text : [text];
  const my = ++token;
  synth()?.cancel();
  player?.pause();
  if (!enabled) {
    await new Promise((r) => setTimeout(r, Math.min(2500, 600 + parts.join(' ').length * 70)));
    return;
  }
  await loadAudioManifest();
  for (const part of parts) {
    if (my !== token) return;
    const file = manifest?.[part];
    if (file && (await playFile(file, my))) continue;
    if (my !== token) return;
    await new Promise((r) => setTimeout(r, 30)); // some engines glitch right after cancel()
    if (my !== token) return;
    await synthOne(part, opts);
  }
}
