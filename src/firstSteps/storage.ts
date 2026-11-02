import { newProfile, Profile } from './engine';

const KEY = 'hc_first_steps_v1';

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newProfile();
    const p = JSON.parse(raw);
    if (p && p.v === 1 && typeof p.unlocked === 'number') {
      // Merge over defaults so profiles saved by older versions stay valid.
      return { ...newProfile(), ...p };
    }
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
  return newProfile();
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full / private mode: the game still works, just without memory */
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
