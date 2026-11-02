/**
 * Every sentence the game can say. Both the game and the audio generator
 * script (scripts/generate-first-steps-audio.py) use this list, so the
 * pre-recorded files always match exactly what the game asks for.
 */
import { ALPHABET, LetterInfo } from './letters';
import { QType, prompt } from './engine';
import { soundsPhrases } from './soundsPhrases';
import { wordPhrases } from './wordPhrases';
import { feedPhrases } from './feedEngine';

export const PRAISE = ['כל הכבוד!', 'יופי!', 'מעולה!', 'אלוף!', 'נכון מאוד!', 'וואו!', 'מצוין!'];
export const RETRY = ['לא נורא, נסה שוב', 'כמעט! נסה עוד פעם', 'אופס, נסה שוב'];
export const ROUND_DONE_STICKER = 'כל הכבוד! קיבלת מדבקה חדשה!';
export const ROUND_DONE = 'כל הכבוד! סיימת סיבוב!';

export const nameLine = (l: LetterInfo) => `זו האות ${l.speak}`;
export const likeLine = (l: LetterInfo) => `${l.speak} כמו ${l.wordSpeak}`;
export const againLine = (l: LetterInfo) => `בוא נכיר שוב את האות ${l.speak}`;
export const hintLine = (l: LetterInfo) => `זו האות ${l.speak}. לחץ עליה`;

// ---- drawing game ----
export const drawWatchLine = (l: LetterInfo) => `תסתכל איך מציירים את האות ${l.speak}`;
export const DRAW_YOUR_TURN = 'עכשיו תורך! התחל מהנקודה';
export const DRAW_DOTS = 'עקוב אחרי הנקודות לפי הסדר';
export const DRAW_FADED = 'עכשיו נסה לצייר כמעט בלי עזרה';
export const DRAW_STRAY = 'חזור לקו, אתה יכול!';
export const DRAW_START_HERE = 'התחל מהנקודה המהבהבת';
export const DRAW_ASSIST = 'אני עוזר לך קצת';
export const drawDoneLine = (l: LetterInfo) => `כל הכבוד! ציירת את האות ${l.speak}`;
const DRAW_FIXED = [DRAW_YOUR_TURN, DRAW_DOTS, DRAW_FADED, DRAW_STRAY, DRAW_START_HERE, DRAW_ASSIST];

const TYPES: QType[] = ['find', 'balloons', 'word', 'picture'];

export function allPhrases(): string[] {
  const out = new Set<string>([...PRAISE, ...RETRY, ROUND_DONE, ROUND_DONE_STICKER, ...DRAW_FIXED, ...soundsPhrases(), ...wordPhrases(), ...feedPhrases()]);
  for (const l of ALPHABET) {
    [nameLine(l), likeLine(l), againLine(l), hintLine(l), drawWatchLine(l), drawDoneLine(l)].forEach((t) => out.add(t));
    for (const type of TYPES) out.add(prompt({ type, target: l.id, options: [] }).speak);
  }
  return [...out];
}
