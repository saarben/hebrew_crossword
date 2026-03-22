/**
 * Builds noto-curator.html — NEW word ideas (not in words.ts) with Noto previews + checkboxes.
 * Run: node scripts/generate-noto-curator.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const wordsTs = fs.readFileSync(path.join(root, 'src', 'words.ts'), 'utf8');
const re = /\{ word: '([^']*)', icon: (\w+), label: '([^']*)'/g;
const existingWords = new Set();
const existingLabels = new Set();
let m;
while ((m = re.exec(wordsTs)) !== null) {
  existingWords.add(m[1]);
  existingLabels.add(m[3]);
}

/**
 * Suggested additions: Hebrew clue, unique `label` (for future Noto/Fluent map), Lucide component name.
 * `cp`: Unicode codepoints for Noto filename emoji_u{hex}_….png
 */
const NEW_CANDIDATES = [
  // מאכל ושתייה
  { word: 'כריך', label: 'Sandwich', lucide: 'Sandwich', cp: [0x1f96a] },
  { word: 'קרואסון', label: 'Croissant', lucide: 'Croissant', cp: [0x1f950] },
  { word: 'ממתק', label: 'Candy', lucide: 'Candy', cp: [0x1f36c] },
  { word: 'פופקורן', label: 'Popcorn', lucide: 'Popcorn', cp: [0x1f37f] },
  { word: 'דונאט', label: 'Donut', lucide: 'Donut', cp: [0x1f369] },
  { word: 'סוכריה על מקל', label: 'Lollipop', lucide: 'Lollipop', cp: [0x1f36d] },
  { word: 'בירה', label: 'Beer', lucide: 'Beer', cp: [0x1f37a] },
  { word: 'סטייק', label: 'Steak', lucide: 'Beef', cp: [0x1f969] },
  { word: 'גביע גלידה', label: 'IceCreamBowl', lucide: 'IceCreamBowl', cp: [0x1f368] },
  { word: 'משקה מוגז', label: 'Soda', lucide: 'CupSoda', cp: [0x1f964] },
  { word: 'חיטה', label: 'Wheat', lucide: 'Wheat', cp: [0x1f33e] },
  { word: 'שעועית', label: 'Beans', lucide: 'Bean', cp: [0x1fad8] },
  // בית וריהוט
  { word: 'שולחן אוכל', label: 'PlaceSetting', lucide: 'Table', cp: [0x1f37d, 0xfe0f] },
  { word: 'אסלה', label: 'Toilet', lucide: 'Toilet', cp: [0x1f6bd] },
  // משחקים וטכנולוגיה
  { word: 'קונסולה', label: 'VideoGame', lucide: 'Gamepad2', cp: [0x1f3ae] },
  { word: 'ג׳ויסטיק', label: 'Joystick', lucide: 'Joystick', cp: [0x1f579, 0xfe0f] },
  { word: 'רובוט', label: 'Robot', lucide: 'Bot', cp: [0x1f916] },
  { word: 'מעגל חשמלי', label: 'Circuit', lucide: 'CircuitBoard', cp: [0x1f50c] },
  { word: 'מעבד', label: 'CpuChip', lucide: 'Cpu', cp: [0x1f4bb] },
  // מקומות
  { word: 'בית ספר', label: 'School', lucide: 'School', cp: [0x1f3eb] },
  { word: 'מורה', label: 'Teacher', lucide: 'GraduationCap', cp: [0x1f393] },
  { word: 'כנסייה', label: 'Church', lucide: 'Church', cp: [0x26ea, 0xfe0f] },
  { word: 'בית חולים', label: 'Hospital', lucide: 'Hospital', cp: [0x1f3e5] },
  { word: 'טירה', label: 'Castle', lucide: 'Castle', cp: [0x1f3f0] },
  { word: 'בנק', label: 'Bank', lucide: 'Banknote', cp: [0x1f3e6] },
  { word: 'חנות', label: 'Store', lucide: 'Building2', cp: [0x1f3ea] },
  { word: 'מפעל', label: 'Factory', lucide: 'Factory', cp: [0x1f3ed] },
  { word: 'מלון', label: 'Hotel', lucide: 'Hotel', cp: [0x1f3e8] },
  { word: 'בניין משרדים', label: 'Office', lucide: 'Building2', cp: [0x1f3d7, 0xfe0f] },
  { word: 'אתר מפורסם', label: 'Landmark', lucide: 'Landmark', cp: [0x1f5fd] },
  // תחבורה
  { word: 'מונית', label: 'Taxi', lucide: 'CarTaxiFront', cp: [0x1f695] },
  { word: 'אמבולנס', label: 'Ambulance', lucide: 'Ambulance', cp: [0x1f691] },
  { word: 'סירה', label: 'Sailboat', lucide: 'Sailboat', cp: [0x26f5] },
  { word: 'אוניה', label: 'Ship', lucide: 'Ship', cp: [0x1f6a2] },
  { word: 'טרקטור', label: 'Tractor', lucide: 'Tractor', cp: [0x1f69c] },
  { word: 'תחנת דלק', label: 'GasPump', lucide: 'Fuel', cp: [0x26fd] },
  // חיות וטבע
  { word: 'פנדה', label: 'Panda', lucide: 'Panda', cp: [0x1f43c] },
  { word: 'סנאי', label: 'Squirrel', lucide: 'Squirrel', cp: [0x1f43f] },
  { word: 'חולדה', label: 'Rat', lucide: 'Rat', cp: [0x1f400] },
  { word: 'שבלול', label: 'Snail', lucide: 'Snail', cp: [0x1f40c] },
  { word: 'שרימפס', label: 'Shrimp', lucide: 'Shrimp', cp: [0x1f990] },
  { word: 'תולעת', label: 'Worm', lucide: 'Worm', cp: [0x1fab1] },
  { word: 'דולפין', label: 'Dolphin', lucide: 'Fish', cp: [0x1f42c] },
  { word: 'תמנון', label: 'Octopus', lucide: 'Fish', cp: [0x1f419] },
  { word: 'כריש', label: 'Shark', lucide: 'Fish', cp: [0x1f988] },
  { word: 'לווייתן', label: 'Whale', lucide: 'Fish', cp: [0x1f433] },
  { word: 'אורן', label: 'Pine', lucide: 'TreePine', cp: [0x1f332] },
  { word: 'ורד', label: 'Rose', lucide: 'Rose', cp: [0x1f339] },
  { word: 'היביסקוס', label: 'Hibiscus', lucide: 'Flower2', cp: [0x1f33a] },
  // ספורט ועולם
  { word: 'כדורעף', label: 'Volleyball', lucide: 'Volleyball', cp: [0x1f3d0] },
  { word: 'גלובוס', label: 'Globe', lucide: 'Globe', cp: [0x1f30d] },
  { word: 'לווין', label: 'Satellite', lucide: 'Satellite', cp: [0x1f6f0, 0xfe0f] },
  // חפצים
  { word: 'אגוז', label: 'Nut', lucide: 'Nut', cp: [0x1f330] },
  { word: 'כובע מגן', label: 'HardHat', lucide: 'HardHat', cp: [0x1f3a9] },
  { word: 'מדליה', label: 'Medal', lucide: 'Medal', cp: [0x1f3c5] },
  { word: 'אבן חן', label: 'Gemstone', lucide: 'Gem', cp: [0x1f48e] },
  { word: 'טבעת', label: 'Ring', lucide: 'Circle', cp: [0x1f48d] },
  { word: 'ארנק', label: 'Wallet', lucide: 'Wallet', cp: [0x1f45b] },
  { word: 'כרטיס אשראי', label: 'CreditCard', lucide: 'CreditCard', cp: [0x1f4b3] },
  { word: 'מזוודה', label: 'Luggage', lucide: 'Luggage', cp: [0x1f9f3] },
  { word: 'תיק מסמכים', label: 'Briefcase', lucide: 'Briefcase', cp: [0x1f4bc] },
  { word: 'לוח שנה', label: 'Calendar', lucide: 'Calendar', cp: [0x1f4c6] },
  { word: 'שעון חול', label: 'Hourglass', lucide: 'Hourglass', cp: [0x231b, 0xfe0f] },
  { word: 'פנס', label: 'Flashlight', lucide: 'Flashlight', cp: [0x1f526] },
  { word: 'אמבטיה', label: 'Bathtub', lucide: 'Bath', cp: [0x1f6c1] },
  { word: 'תינוק', label: 'Baby', lucide: 'Baby', cp: [0x1f476] },
  { word: 'גולגולת', label: 'Skull', lucide: 'Skull', cp: [0x1f480] },
  { word: 'מוח', label: 'Brain', lucide: 'Brain', cp: [0x1f9e0] },
  { word: 'מזרק', label: 'Syringe', lucide: 'Syringe', cp: [0x1f489] },
  { word: 'DNA', label: 'Dna', lucide: 'Dna', cp: [0x1f9ec] },
  { word: 'קרדום', label: 'Pickaxe', lucide: 'Pickaxe', cp: [0x26cf, 0xfe0f] },
  { word: 'מטף כיבוי', label: 'FireExtinguisher', lucide: 'FireExtinguisher', cp: [0x1f9ef] },
  { word: 'איש שלג', label: 'Snowman', lucide: 'CloudSnow', cp: [0x26c4, 0xfe0f] },
  { word: 'סימניה', label: 'Bookmark', lucide: 'Bookmark', cp: [0x1f516] },
  { word: 'לוח גזירים', label: 'Clipboard', lucide: 'Clipboard', cp: [0x1f4cb] },
];

// Drop candidate if Hebrew word already in app, or label collides with existing labels
const candidates = NEW_CANDIDATES.filter((c) => {
  if (existingWords.has(c.word)) return false;
  if (existingLabels.has(c.label)) return false;
  return true;
});

function cpToEmoji(cp) {
  return String.fromCodePoint(...cp);
}

function cpToNotoSuffix(cp) {
  return cp.map((x) => x.toString(16).toLowerCase()).join('_');
}

const NOTO_BASE =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/';

const enriched = candidates.map((c) => {
  const suffix = cpToNotoSuffix(c.cp);
  const emoji = cpToEmoji(c.cp);
  const notoUrl = `${NOTO_BASE}emoji_u${suffix}.png`;
  return {
    word: c.word,
    label: c.label,
    lucide: c.lucide,
    emoji,
    notoUrl,
    suffix,
  };
});

const dupLabels = candidates.reduce((acc, c) => {
  acc[c.label] = (acc[c.label] || 0) + 1;
  return acc;
}, {});
const labelDups = Object.entries(dupLabels).filter(([, n]) => n > 1);
if (labelDups.length) {
  console.warn('Duplicate labels in NEW_CANDIDATES:', labelDups);
}

const dataJson = JSON.stringify(enriched, null, 2);

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Noto — מילים חדשות מוצעות</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Hebrew:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #f8fafc;
      --card: #fff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --accent: #2563eb;
      --ok: #16a34a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "IBM Plex Sans Hebrew", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 1.25rem 1rem 3rem;
    }
    h1 { font-size: 1.35rem; margin: 0 0 0.35rem; }
    .lead { color: var(--muted); font-size: 0.88rem; max-width: 44rem; line-height: 1.55; margin-bottom: 1rem; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 1rem;
      padding: 0.75rem 1rem;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .toolbar button {
      font: inherit;
      cursor: pointer;
      padding: 0.4rem 0.85rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #fff;
    }
    .toolbar button.primary {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    .toolbar button.success {
      background: var(--ok);
      color: #fff;
      border-color: var(--ok);
    }
    .count { font-size: 0.85rem; color: var(--muted); margin-inline-start: auto; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
      gap: 0.65rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 0.6rem;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.25rem 0.5rem;
      align-items: start;
    }
    .card input[type="checkbox"] {
      grid-row: 1 / span 3;
      width: 1.1rem;
      height: 1.1rem;
      margin-top: 0.2rem;
    }
    .img-cell {
      grid-column: 2;
      width: 3.75rem;
      height: 3.75rem;
      border-radius: 10px;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .img-cell img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .fallback-emoji {
      font-size: 2.25rem;
      line-height: 1;
    }
    .he { font-weight: 600; font-size: 1rem; grid-column: 2; }
    .meta { font-size: 0.7rem; color: var(--muted); grid-column: 2; direction: ltr; text-align: right; font-family: ui-monospace, monospace; }
    .toast {
      position: fixed;
      bottom: 1.25rem;
      left: 50%;
      transform: translateX(-50%);
      background: #1e293b;
      color: #fff;
      padding: 0.5rem 1rem;
      border-radius: 999px;
      font-size: 0.85rem;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    }
    .toast.show { opacity: 1; }
    footer { margin-top: 2rem; font-size: 0.75rem; color: var(--muted); max-width: 44rem; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>מילים חדשות מוצעות (לא באפליקציה עדיין)</h1>
  <p class="lead">
    רשימת <strong>הצעות בלבד</strong> — כל מילה כאן <em>לא</em> מופיעה ב־<code>words.ts</code> (או הוסרה כי ה־label כבר קיים).
    סמנו מה להוסיף, ואז <strong>העתק JSON</strong> או <strong>העתק שורות ל־words.ts</strong>.
    תמונות: Noto Emoji (Apache-2.0). אחרי הוספה לפרויקט צריך גם ייבוא אייקון ב־Lucide ומפתח ב־<code>iconMapping</code> אם עוברים ל־Noto בקוד.
  </p>
  <p class="lead" style="margin-top:-0.5rem"><strong>${enriched.length}</strong> הצעות אחרי סינון מול הרשימה הקיימת.</p>
  <div class="toolbar">
    <button type="button" id="btnAll">סמן הכול</button>
    <button type="button" id="btnNone">נקה הכול</button>
    <button type="button" id="btnInvert">הפוך</button>
    <button type="button" class="primary" id="btnCopy">העתק JSON (נבחרים)</button>
    <button type="button" class="success" id="btnCopyTs">העתק שורות ל־words.ts</button>
    <span class="count" id="count"></span>
  </div>
  <div class="grid" id="grid"></div>
  <div class="toast" id="toast">הועתק</div>
  <footer>
    עריכת ההצעות: <code>scripts/generate-noto-curator.mjs</code> → מערך <code>NEW_CANDIDATES</code>.
    PNG חסר: יוצג אימוג׳י גיבוי. עדכנו את <code>cp</code> ב־<code>NEW_CANDIDATES</code> לפי הצורך.
  </footer>
  <script>
    const ENRICHED = ${dataJson};
    const STORAGE_KEY = 'noto_new_curator_v2';

    const grid = document.getElementById('grid');
    const countEl = document.getElementById('count');
    const toast = document.getElementById('toast');

    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {}

    function showToast() {
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 1600);
    }

    function getChecks() {
      return [...grid.querySelectorAll('input[type="checkbox"]')];
    }

    function updateCount() {
      const boxes = getChecks();
      const n = boxes.filter((b) => b.checked).length;
      countEl.textContent = n + ' / ' + boxes.length + ' נבחרו';
    }

    function persist() {
      const state = {};
      getChecks().forEach((cb) => { state[cb.dataset.label] = cb.checked; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    ENRICHED.forEach((row, i) => {
      const card = document.createElement('label');
      card.className = 'card';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.label = row.label;
      cb.dataset.index = String(i);
      cb.checked = saved[row.label] !== undefined ? saved[row.label] : true;
      cb.addEventListener('change', () => { persist(); updateCount(); });

      const imgCell = document.createElement('div');
      imgCell.className = 'img-cell';
      const img = document.createElement('img');
      img.src = row.notoUrl;
      img.alt = row.label;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () {
        this.style.display = 'none';
        const fb = document.createElement('span');
        fb.className = 'fallback-emoji';
        fb.textContent = row.emoji;
        fb.title = 'PNG חסר';
        imgCell.appendChild(fb);
      };
      imgCell.appendChild(img);

      const he = document.createElement('div');
      he.className = 'he';
      he.textContent = row.word;

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = row.lucide + ' · ' + row.label + ' · u' + row.suffix;

      card.append(cb, imgCell, he, meta);
      grid.appendChild(card);
    });

    updateCount();

    document.getElementById('btnAll').onclick = () => {
      getChecks().forEach((b) => { b.checked = true; });
      persist(); updateCount();
    };
    document.getElementById('btnNone').onclick = () => {
      getChecks().forEach((b) => { b.checked = false; });
      persist(); updateCount();
    };
    document.getElementById('btnInvert').onclick = () => {
      getChecks().forEach((b) => { b.checked = !b.checked; });
      persist(); updateCount();
    };

    document.getElementById('btnCopy').onclick = async () => {
      const picked = ENRICHED.filter((row, i) => getChecks()[i].checked).map((row) => ({
        word: row.word,
        label: row.label,
        lucide: row.lucide,
      }));
      await navigator.clipboard.writeText(JSON.stringify(picked, null, 2));
      showToast();
    };

    document.getElementById('btnCopyTs').onclick = async () => {
      const lines = ENRICHED.filter((row, i) => getChecks()[i].checked).map(
        (row) =>
          '  { word: ' +
          JSON.stringify(row.word) +
          ', icon: ' +
          row.lucide +
          ', label: ' +
          JSON.stringify(row.label) +
          ", imageUrl: 'https://loremflickr.com/200/200/placeholder/all' },"
      );
      await navigator.clipboard.writeText(lines.join(String.fromCharCode(10)));
      showToast();
    };
  </script>
</body>
</html>
`;

const out = path.join(root, 'noto-curator.html');
fs.writeFileSync(out, html, 'utf8');
console.log('Wrote', out, '—', enriched.length, 'new candidates (after excluding words/labels already in words.ts)');
