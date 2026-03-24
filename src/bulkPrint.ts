import { WORD_LIST, type WordInfo } from './words';
import { generateCrossword, type CrosswordData, type GridCell } from './crosswordGenerator';
import { generateIcon } from './services/imageService';

const WORDS_PER_PUZZLE = 15;

function getCachedIcon(label: string): string | null {
  try {
    return localStorage.getItem(`icon_cache_${label}`);
  } catch {
    return null;
  }
}

function attachClueIcons(data: CrosswordData): CrosswordData {
  const grid = data.grid.map((row) =>
    row.map((cell) => {
      if (!cell?.isClue || !cell.clueLabel) return cell;
      const cached = getCachedIcon(cell.clueLabel);
      const url = cached || generateIcon(cell.clueLabel, cell.clueLabel);
      return { ...cell, clueImageUrl: url };
    })
  );
  return { ...data, grid };
}

export function createRandomPuzzle(gridSize: number): CrosswordData {
  const shuffled = [...WORD_LIST].sort(() => 0.5 - Math.random());
  const selected: WordInfo[] = shuffled.slice(0, WORDS_PER_PUZZLE);
  const data = generateCrossword(selected, gridSize);
  return attachClueIcons(data);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellToHtml(cell: GridCell | null, showSolution: boolean): string {
  if (!cell) {
    return '<div class="cw-cell cw-empty"></div>';
  }
  if (cell.isClue) {
    const src = cell.clueImageUrl ? escapeHtml(cell.clueImageUrl) : '';
    const dir = cell.clueDirection === 'H' ? 'cw-clue-h' : 'cw-clue-v';
    const arrowSvg = cell.clueDirection === 'H'
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`;
    return `<div class="cw-cell cw-clue ${dir}">
      <div class="cw-clue-img-wrap">
        ${src ? `<img class="cw-clue-img" src="${src}" alt="" crossorigin="anonymous" />` : ''}
      </div>
      <div class="cw-arrow" aria-hidden="true">${arrowSvg}</div>
    </div>`;
  }
  const letter = showSolution && cell.char ? escapeHtml(cell.char) : '';
  return `<div class="cw-cell cw-letter"><span class="cw-letter-inner">${letter}</span></div>`;
}

function puzzleToSection(
  data: CrosswordData,
  index: number,
  total: number,
  showSolution: boolean,
  subtitle: string
): string {
  const { size, grid } = data;
  const cells = grid
    .map((row) =>
      row.map((c) => cellToHtml(c, showSolution)).join('')
    )
    .join('');
  const title = showSolution ? `פתרון — תשחץ ${index + 1} מתוך ${total}` : `תשחץ ${index + 1} מתוך ${total}`;
  return `<section class="print-page" dir="rtl">
    <header class="print-page-head">
      <h1 class="print-title">תשחצון</h1>
      <p class="print-sub">${escapeHtml(title)}</p>
      <p class="print-note">${escapeHtml(subtitle)}</p>
    </header>
    <div class="cw-wrap">
      <div class="cw-grid" style="--cw-size:${size}">${cells}</div>
    </div>
  </section>`;
}

export function buildBulkPrintDocument(
  puzzles: CrosswordData[],
  options: { includeSolutions: boolean; subtitle?: string }
): string {
  const subtitle =
    options.subtitle ??
    `נוצר ב־${new Date().toLocaleDateString('he-IL', { dateStyle: 'long' })}`;
  const n = puzzles.length;
  let body = '';
  for (let i = 0; i < n; i++) {
    body += puzzleToSection(puzzles[i], i, n, false, subtitle);
  }
  if (options.includeSolutions) {
    for (let i = 0; i < n; i++) {
      body += puzzleToSection(puzzles[i], i, n, true, subtitle);
    }
  }

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>תשחצון — הדפסה מרובה</title>
  <style>
    @page { margin: 12mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Rubik", "David", "Arial Hebrew", sans-serif;
      color: #111;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-page {
      page-break-after: always;
      min-height: 0;
      padding: 0 0 8mm;
    }
    .print-page:last-child { page-break-after: auto; }
    .print-page-head {
      text-align: center;
      margin-bottom: 8mm;
    }
    .print-title {
      margin: 0;
      font-size: 18pt;
      font-weight: 800;
    }
    .print-sub {
      margin: 4px 0 0;
      font-size: 12pt;
      font-weight: 600;
    }
    .print-note {
      margin: 6px 0 0;
      font-size: 9pt;
      color: #555;
    }
    .cw-wrap {
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .cw-grid {
      display: grid;
      grid-template-columns: repeat(var(--cw-size), var(--cw-cell));
      gap: 2px;
      width: fit-content;
    }
    :root {
      --cw-cell: 11mm;
    }
    @media print {
      :root { --cw-cell: 10mm; }
    }
    .cw-cell {
      width: var(--cw-cell);
      height: var(--cw-cell);
      position: relative;
    }
    .cw-empty { visibility: hidden; pointer-events: none; }
    .cw-letter {
      border: 1.5px solid #222;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cw-letter-inner {
      font-size: 14pt;
      font-weight: 700;
    }
    .cw-clue {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cw-clue-h { }
    .cw-clue-v { }
    .cw-clue-img-wrap {
      width: calc(var(--cw-cell) * 0.85);
      height: calc(var(--cw-cell) * 0.85);
      border: 1px solid #333;
      border-radius: 4px;
      overflow: hidden;
      background: #fafafa;
    }
    .cw-clue-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .cw-arrow {
      position: absolute;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border-radius: 9999px;
      border: 1px solid #333;
      padding: 2px;
      color: #333;
      line-height: 1;
    }
    .cw-clue-h .cw-arrow {
      left: -5px;
      top: 50%;
      transform: translateY(-50%);
    }
    .cw-clue-v .cw-arrow {
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
    }
    @media print {
      .no-print { display: none !important; }
    }
    .bulk-toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 12px 16px;
      background: #ecfdf5;
      border-bottom: 1px solid #a7f3d0;
      margin-bottom: 10mm;
    }
    .bulk-toolbar-hint {
      margin: 0;
      font-size: 10pt;
      color: #064e3b;
      max-width: 42em;
      text-align: center;
    }
    .bulk-print-btn {
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      padding: 10px 20px;
      border: none;
      border-radius: 999px;
      background: #059669;
      color: #fff;
    }
    .bulk-print-btn:hover { background: #047857; }
  </style>
</head>
<body>
  <div class="bulk-toolbar no-print" dir="rtl">
    <p class="bulk-toolbar-hint">כשהתמונות נטענו, לחצו להדפסה או השתמשו ב־Ctrl+P. בחלון ההדפסה אפשר לשמור כ־PDF.</p>
    <button type="button" class="bulk-print-btn" onclick="window.print()">הדפסה / PDF</button>
  </div>
${body}
</body>
</html>`;
}

/** Write print HTML into a tab opened via window.open (same origin / about:blank). */
export function writeBulkPrintWindow(win: Window, html: string): void {
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export const BULK_PRINT_MAX = 40;
export const BULK_PRINT_DEFAULT_COUNT = 5;
