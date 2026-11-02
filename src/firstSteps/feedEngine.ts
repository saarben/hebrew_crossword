/**
 * Pure helpers for "Feed the Monster". The adaptive learning itself (levels,
 * choices, mistakes -> focus mode, stars, rewards) is the shared engine.ts; this
 * file only adds what is specific to the monster: prompts, layout, drop zone, hats.
 */
import { ALPHABET, LETTER_BY_ID, LetterInfo } from './letters';
import type { QType, Question } from './engine';

export const HATS = ['🎩', '👑', '🎀', '🎓', '🧢', '🤠', '👒', '🪖', '🎪', '⛑️'];
export const MONSTER_COLORS = ['#7c6cf0', '#3dbb9b', '#f0718a', '#f2a03d', '#4aa3e8'];

export type Layout = 'tray' | 'rain';
export type ItemKind = 'letter' | 'picture';

/** "balloons" in the shared engine becomes letters raining down for the monster. */
export const layoutFor = (t: QType): Layout => (t === 'balloons' ? 'rain' : 'tray');
export const itemKind = (t: QType): ItemKind => (t === 'picture' ? 'picture' : 'letter');

export function feedPrompt(q: Question): { speak: string; text: string } {
  const l = LETTER_BY_ID[q.target];
  switch (q.type) {
    case 'balloons':
      return { speak: `תפוס את האות ${l.speak} והאכל את המפלצת`, text: `תפסו את האות ${l.name} והאכילו את המפלצת` };
    case 'word':
      return { speak: `המפלצת רוצה אות! איזו אות מתחילה את המילה ${l.wordSpeak}?`, text: `איזו אות מתחילה את המילה ${l.word}?` };
    case 'picture':
      return { speak: `המפלצת רוצה משהו שמתחיל באות ${l.speak}`, text: `המפלצת רוצה משהו שמתחיל באות ${l.name}` };
    default:
      return { speak: `המפלצת רעבה! תאכיל אותה באות ${l.speak}`, text: `המפלצת רעבה! האכילו אותה באות ${l.name}` };
  }
}

export const hintLine = (l: LetterInfo) => `המפלצת רוצה את האות ${l.speak}. תאכיל אותה`;
export const nameLine = (l: LetterInfo) => `זו האות ${l.speak}`;
export const likeLine = (l: LetterInfo) => `${l.speak} כמו ${l.wordSpeak}`;
export const againLine = (l: LetterInfo) => `בוא נכיר שוב את האות ${l.speak}`;

export const YUCK = ['יאק! לא את זה, נסה שוב', 'בלה! זה לא מה שאני רוצה'];
export const THANKS = ['ניאם ניאם! תודה!', 'איזה טעים!', 'מממ, יופי!', 'עוד, עוד!'];
export const FULL = 'הבטן שלי מלאה! תודה רבה!';
export const FULL_HAT = 'וואו! קיבלתי כובע חדש!';

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Is a dropped point on (or near) the monster? Generous, for little fingers. */
export function inZone(pt: { x: number; y: number }, r: Rect, pad = 28): boolean {
  return pt.x >= r.left - pad && pt.x <= r.right + pad && pt.y >= r.top - pad && pt.y <= r.bottom + pad;
}

export const hatFor = (stickers: number): string | null => (stickers > 0 ? HATS[(stickers - 1) % HATS.length] : null);
export const colorFor = (rounds: number) => MONSTER_COLORS[rounds % MONSTER_COLORS.length];

/** Every sentence this game can speak (CI generates one clip per sentence). */
export function feedPhrases(): string[] {
  const out = new Set<string>([...YUCK, ...THANKS, FULL, FULL_HAT]);
  for (const l of ALPHABET) {
    for (const type of ['find', 'balloons', 'word', 'picture'] as const) out.add(feedPrompt({ type, target: l.id, options: [] }).speak);
    [hintLine(l), nameLine(l), likeLine(l), againLine(l)].forEach((t) => out.add(t));
  }
  return [...out];
}
