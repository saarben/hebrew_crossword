/**
 * Every sentence the build-the-word game says. The game composes speech from a
 * few fixed lines + a word name + letter names (played one after the other), so
 * the number of audio clips stays small. Keep this list in sync with WordGame.tsx
 * (a test checks the lines used by the game are all here).
 */
import { ALPHABET } from './letters';
import { WORDS } from './wordData';

export const W_INTRO = 'בוא נבנה מילים!';
export const W_BUILD = 'בוא נבנה את המילה';
export const W_MISSING = 'איזו אות חסרה במילה';
export const W_FIND_PIC = 'לחץ על התמונה של';
export const W_FIND_LETTER = 'חפש את האות';
export const W_ROUND_DONE = 'כל הכבוד! סיימת סיבוב!';
export const W_PRAISE = ['כל הכבוד!', 'יופי!', 'מעולה!', 'אלוף!', 'נכון מאוד!', 'וואו!', 'מצוין!'];
export const W_RETRY = ['לא נורא, נסה שוב', 'כמעט! נסה עוד פעם', 'אופס, נסה שוב'];

export const W_FIXED = [W_INTRO, W_BUILD, W_MISSING, W_FIND_PIC, W_FIND_LETTER, W_ROUND_DONE, ...W_PRAISE, ...W_RETRY];

export function wordPhrases(): string[] {
  return [...W_FIXED, ...WORDS.map((x) => x.speak), ...ALPHABET.map((l) => l.speak)];
}
