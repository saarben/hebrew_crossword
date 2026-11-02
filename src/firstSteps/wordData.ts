/**
 * Words for the build-the-word game. Only base letters (no final forms
 * ך ם ן ף ץ), 2–4 letters, concrete and easy to picture.
 */
import { ALPHABET } from './letters';

export interface Word {
  id: string;
  /** Plain Hebrew spelling (shown to parents / in the dictionary). */
  text: string;
  /** Letter ids in spelling order (index 0 = first letter = right-most slot). */
  letters: string[];
  /** Spelling with niqqud for text-to-speech. */
  speak: string;
  emoji: string;
}

const CHAR_TO_ID: Record<string, string> = Object.fromEntries(ALPHABET.map((l) => [l.char, l.id]));

function w(text: string, speak: string, emoji: string): Word {
  const letters = [...text].map((c) => {
    const id = CHAR_TO_ID[c];
    if (!id) throw new Error(`wordData: "${c}" in "${text}" is not one of the 22 base letters`);
    return id;
  });
  return { id: text, text, letters, speak, emoji };
}

export const WORDS: Word[] = [
  // 2 letters
  w('דג', 'דָּג', '🐟'),
  w('לב', 'לֵב', '❤️'),
  w('יד', 'יָד', '✋'),
  w('תה', 'תֵּה', '🍵'),
  w('פה', 'פֶּה', '👄'),
  w('סל', 'סַל', '🧺'),
  w('נר', 'נֵר', '🕯️'),
  // 3 letters
  w('אבא', 'אַבָּא', '👨'),
  w('אמא', 'אִמָּא', '👩'),
  w('בית', 'בַּיִת', '🏠'),
  w('גזר', 'גֶּזֶר', '🥕'),
  w('כלב', 'כֶּלֶב', '🐶'),
  w('סוס', 'סוּס', '🐴'),
  w('פיל', 'פִּיל', '🐘'),
  w('ספר', 'סֵפֶר', '📖'),
  w('פרח', 'פֶּרַח', '🌸'),
  w('תות', 'תּוּת', '🍓'),
  w('שמש', 'שֶׁמֶשׁ', '☀️'),
  w('ורד', 'וֶרֶד', '🌹'),
  w('דבש', 'דְּבַשׁ', '🍯'),
  w('כוס', 'כּוֹס', '🥛'),
  w('ענב', 'עֵנָב', '🍇'),
  w('גמל', 'גָּמָל', '🐪'),
  w('דלי', 'דְּלִי', '🪣'),
  w('כסא', 'כִּסֵּא', '🪑'),
  w('דוב', 'דּוֹב', '🐻'),
  w('ירח', 'יָרֵחַ', '🌙'),
  w('דגל', 'דֶּגֶל', '🚩'),
  w('גשר', 'גֶּשֶׁר', '🌉'),
  w('צבע', 'צֶבַע', '🎨'),
  // 4 letters
  w('חתול', 'חָתוּל', '🐱'),
  w('עכבר', 'עַכְבָּר', '🐭'),
  w('רכבת', 'רַכֶּבֶת', '🚆'),
  w('ארנב', 'אַרְנָב', '🐰'),
  w('מטוס', 'מָטוֹס', '✈️'),
  w('כובע', 'כּוֹבַע', '🎩'),
  w('תפוח', 'תַּפּוּחַ', '🍎'),
  w('פרפר', 'פַּרְפַּר', '🦋'),
  w('כוכב', 'כּוֹכָב', '⭐'),
];

export const WORD_BY_ID: Record<string, Word> = Object.fromEntries(WORDS.map((x) => [x.id, x]));
