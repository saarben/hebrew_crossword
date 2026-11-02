import { newProfile, Profile } from './engine';

const KEY = 'hc_first_steps_feed_v1';

export function loadFeedProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.v === 1 && typeof p.unlocked === 'number') return { ...newProfile(), ...p };
    }
  } catch {
    /* start fresh */
  }
  return newProfile();
}

export function saveFeedProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function clearFeedProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
