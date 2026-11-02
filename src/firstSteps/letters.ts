/**
 * Hebrew alphabet data for the "first steps" (צעדים ראשונים) area.
 *
 * `speak*` fields carry niqqud so that text-to-speech engines pronounce the
 * letter names and anchor words the way a child expects to hear them.
 */
export interface LetterInfo {
  id: string;
  char: string;
  /** Name shown to parents (no niqqud). */
  name: string;
  /** Name sent to the speech engine. */
  speak: string;
  /** Anchor word that starts with the letter, shown to parents. */
  word: string;
  wordSpeak: string;
  emoji: string;
}

export const ALPHABET: LetterInfo[] = [
  { id: 'alef', char: 'א', name: 'אלף', speak: 'אָלֶף', word: 'אריה', wordSpeak: 'אַרְיֵה', emoji: '🦁' },
  { id: 'bet', char: 'ב', name: 'בית', speak: 'בֵּית', word: 'בננה', wordSpeak: 'בָּנָנָה', emoji: '🍌' },
  { id: 'gimel', char: 'ג', name: 'גימל', speak: 'גִּימֶל', word: 'גזר', wordSpeak: 'גֶּזֶר', emoji: '🥕' },
  { id: 'dalet', char: 'ד', name: 'דלת', speak: 'דָּלֶת', word: 'דג', wordSpeak: 'דָּג', emoji: '🐟' },
  { id: 'he', char: 'ה', name: 'הא', speak: 'הֵא', word: 'הליקופטר', wordSpeak: 'הֵלִיקוֹפְּטֶר', emoji: '🚁' },
  { id: 'vav', char: 'ו', name: 'וו', speak: 'וָו', word: 'ורד', wordSpeak: 'וֶרֶד', emoji: '🌹' },
  { id: 'zayin', char: 'ז', name: 'זין', speak: 'זַיִן', word: 'זברה', wordSpeak: 'זֶבְּרָה', emoji: '🦓' },
  { id: 'het', char: 'ח', name: 'חית', speak: 'חֵית', word: 'חתול', wordSpeak: 'חָתוּל', emoji: '🐱' },
  { id: 'tet', char: 'ט', name: 'טית', speak: 'טֵית', word: 'טרקטור', wordSpeak: 'טְרַקְטוֹר', emoji: '🚜' },
  { id: 'yod', char: 'י', name: 'יוד', speak: 'יוֹד', word: 'יונה', wordSpeak: 'יוֹנָה', emoji: '🕊️' },
  { id: 'kaf', char: 'כ', name: 'כף', speak: 'כַּף', word: 'כלב', wordSpeak: 'כֶּלֶב', emoji: '🐶' },
  { id: 'lamed', char: 'ל', name: 'למד', speak: 'לָמֶד', word: 'לב', wordSpeak: 'לֵב', emoji: '❤️' },
  { id: 'mem', char: 'מ', name: 'מם', speak: 'מֵם', word: 'מטוס', wordSpeak: 'מָטוֹס', emoji: '✈️' },
  { id: 'nun', char: 'נ', name: 'נון', speak: 'נוּן', word: 'נחש', wordSpeak: 'נָחָשׁ', emoji: '🐍' },
  { id: 'samekh', char: 'ס', name: 'סמך', speak: 'סָמֶךְ', word: 'סוס', wordSpeak: 'סוּס', emoji: '🐴' },
  { id: 'ayin', char: 'ע', name: 'עין', speak: 'עַיִן', word: 'עוגה', wordSpeak: 'עוּגָה', emoji: '🎂' },
  { id: 'pe', char: 'פ', name: 'פא', speak: 'פֵּא', word: 'פיל', wordSpeak: 'פִּיל', emoji: '🐘' },
  { id: 'tsadi', char: 'צ', name: 'צדי', speak: 'צָדִי', word: 'צפרדע', wordSpeak: 'צְפַרְדֵּעַ', emoji: '🐸' },
  { id: 'qof', char: 'ק', name: 'קוף', speak: 'קוֹף', word: 'קוף', wordSpeak: 'קוֹף', emoji: '🐵' },
  { id: 'resh', char: 'ר', name: 'ריש', speak: 'רֵישׁ', word: 'רכבת', wordSpeak: 'רַכֶּבֶת', emoji: '🚆' },
  { id: 'shin', char: 'ש', name: 'שין', speak: 'שִׁין', word: 'שמש', wordSpeak: 'שֶׁמֶשׁ', emoji: '☀️' },
  { id: 'tav', char: 'ת', name: 'תו', speak: 'תָּו', word: 'תפוח', wordSpeak: 'תַּפּוּחַ', emoji: '🍎' },
];

export const LETTER_BY_ID: Record<string, LetterInfo> = Object.fromEntries(
  ALPHABET.map((l) => [l.id, l]),
);

/** Groups of letters that look alike — the classic mix-ups for beginners. */
const SIMILAR_GROUPS: string[][] = [
  ['bet', 'kaf'],
  ['dalet', 'resh'],
  ['he', 'het', 'tav'],
  ['vav', 'zayin', 'yod'],
  ['gimel', 'nun'],
  ['ayin', 'tsadi'],
  ['mem', 'samekh'],
  ['pe', 'bet'],
  ['tet', 'mem'],
];

export function areSimilar(a: string, b: string): boolean {
  return SIMILAR_GROUPS.some((g) => g.includes(a) && g.includes(b));
}
