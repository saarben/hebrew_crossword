/** Sentences spoken by the letter-sounds game (owned by SoundsGame.tsx). */
import { ALPHABET } from './letters';
import { FIXED_LINES, letterLines } from './soundsEngine';

export function soundsPhrases(): string[] {
  const out = new Set<string>(FIXED_LINES);
  for (const l of ALPHABET) letterLines(l.id).forEach((t) => out.add(t));
  return [...out];
}
