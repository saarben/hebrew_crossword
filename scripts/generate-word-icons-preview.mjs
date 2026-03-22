import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const wordsTs = fs.readFileSync(path.join(root, 'src', 'words.ts'), 'utf8');
const re = /\{ word: '([^']*)', icon: (\w+), label: '([^']*)'/g;
const entries = [];
let m;
while ((m = re.exec(wordsTs)) !== null) {
  entries.push({ word: m[1], lucide: m[2], label: m[3] });
}

const iconTs = fs.readFileSync(path.join(root, 'src', 'constants', 'iconMapping.ts'), 'utf8');
const mapBody = iconTs.match(/export const FLUENT_EMOJI_MAPPING[^=]*=\s*(\{[\s\S]*?\n\});/)?.[1];
if (!mapBody) throw new Error('Could not parse FLUENT_EMOJI_MAPPING');

const mapping = new Function(`return ${mapBody}`)();

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>תשחצון — תצוגת אייקונים</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=IBM+Plex+Sans+Hebrew:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #fdfcfb;
      --card: #fff;
      --border: #e7e5e4;
      --text: #2d3436;
      --muted: #78716c;
      --accent: #059669;
      --warn-bg: #fff7ed;
      --warn-border: #fdba74;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem 1.25rem 3rem;
      font-family: "IBM Plex Sans Hebrew", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    h1 {
      font-family: "Frank Ruhl Libre", serif;
      font-size: 1.75rem;
      margin: 0 0 0.35rem;
    }
    .sub {
      color: var(--muted);
      font-size: 0.9rem;
      max-width: 42rem;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .stats {
      font-size: 0.85rem;
      color: var(--muted);
      margin-bottom: 1.25rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
      gap: 0.85rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 0.65rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.4rem;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
    }
    .card.missing {
      background: var(--warn-bg);
      border-color: var(--warn-border);
    }
    .img-wrap {
      width: 4.5rem;
      height: 4.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.65rem;
      background: #f5f5f4;
      overflow: hidden;
    }
    .img-wrap img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .he {
      font-weight: 600;
      font-size: 1.05rem;
      line-height: 1.3;
    }
    .label {
      font-size: 0.72rem;
      color: var(--muted);
      font-family: ui-monospace, monospace;
      direction: ltr;
    }
    .lucide {
      font-size: 0.65rem;
      color: #a8a29e;
      direction: ltr;
    }
    .badge {
      font-size: 0.65rem;
      padding: 0.15rem 0.4rem;
      border-radius: 999px;
      background: #ecfdf5;
      color: var(--accent);
      font-weight: 600;
    }
    .card.missing .badge {
      background: #ffedd5;
      color: #c2410c;
    }
  </style>
</head>
<body>
  <h1>תצוגת אייקונים לרשימת המילים</h1>
  <p class="sub">
    אותם קבצי PNG של Microsoft Fluent 3D כמו באפליקציה (<code>getFluentEmojiUrl</code>).
    שם רכיב Lucide מוצג ליד — לעזרה בהשוואה ל־<code>words.ts</code>.
  </p>
  <p class="stats" id="stats"></p>
  <div class="grid" id="grid"></div>
  <script>
    const FLUENT_EMOJI_MAPPING = ${JSON.stringify(mapping, null, 2)};
    const ENTRIES = ${JSON.stringify(entries, null, 2)};

    function getFluentEmojiUrl(label) {
      const emojiName = FLUENT_EMOJI_MAPPING[label];
      if (!emojiName) return null;
      const folderName = encodeURIComponent(emojiName);
      const fileName = emojiName.toLowerCase().replace(/ /g, '_');
      return 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets/' + folderName + '/3D/' + fileName + '_3d.png';
    }

    const grid = document.getElementById('grid');
    const stats = document.getElementById('stats');
    let missing = 0;

    ENTRIES.forEach((e) => {
      const url = getFluentEmojiUrl(e.label);
      if (!url) missing++;

      const card = document.createElement('article');
      card.className = 'card' + (url ? '' : ' missing');

      const wrap = document.createElement('div');
      wrap.className = 'img-wrap';
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = e.label;
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        wrap.appendChild(img);
      } else {
        wrap.textContent = '?';
        wrap.style.fontSize = '1.5rem';
        wrap.style.color = '#c2410c';
      }

      const he = document.createElement('div');
      he.className = 'he';
      he.textContent = e.word;

      const lab = document.createElement('div');
      lab.className = 'label';
      lab.textContent = e.label;

      const luc = document.createElement('div');
      luc.className = 'lucide';
      luc.textContent = e.lucide;

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = url ? 'Fluent 3D' : 'אין מיפוי ב־iconMapping';

      card.append(wrap, he, lab, luc, badge);
      grid.appendChild(card);
    });

    stats.textContent =
      ENTRIES.length +
      ' מילים · ' +
      (ENTRIES.length - missing) +
      ' עם URL פלואנט · ' +
      missing +
      ' בלי מפתח ב־FLUENT_EMOJI_MAPPING';
  </script>
</body>
</html>
`;

const out = path.join(root, 'word-icons-preview.html');
fs.writeFileSync(out, html, 'utf8');
console.log('Wrote', out);
