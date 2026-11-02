import { WordProfile, newWordProfile } from './wordEngine';

const KEY = 'hc_first_steps_words_v1';

export function loadWordProfile(): WordProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.v === 1 && typeof p.level === 'number') return { ...newWordProfile(), ...p };
    }
  } catch {
    /* start fresh */
  }
  return newWordProfile();
}

export function saveWordProfile(p: WordProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function clearWordProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
