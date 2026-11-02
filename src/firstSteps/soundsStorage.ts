import { newSoundsProfile, SoundsProfile } from './soundsEngine';

const KEY = 'hc_first_steps_sounds_v1';

export function loadSoundsProfile(): SoundsProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.v === 1 && typeof p.unlocked === 'number') return { ...newSoundsProfile(), ...p };
    }
  } catch {
    /* start fresh */
  }
  return newSoundsProfile();
}

export function saveSoundsProfile(p: SoundsProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: the game still works */
  }
}
