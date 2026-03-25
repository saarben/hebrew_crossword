/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Printer,
  RotateCcw,
  CheckCircle2,
  Trophy,
  Download,
  ArrowLeft,
  ArrowDown,
  RefreshCw,
  Info,
  ExternalLink,
  FileStack,
  Grid3X3,
  PenLine,
  LayoutGrid,
  Calculator
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { WORD_LIST } from './words';
import { GERMAN_WORD_LIST } from './wordsGerman';

import { generateCrossword, CrosswordData, GridCell } from './crosswordGenerator';
import { generateIcon } from './services/imageService';
import {
  BULK_PRINT_DEFAULT_COUNT,
  BULK_PRINT_MAX,
  buildBulkPrintDocument,
  createRandomPuzzle,
  writeBulkPrintWindow,
} from './bulkPrint';
import SudokuGame from './SudokuGame';
import MemoryGame from './MemoryGame';
import BingoGame from './BingoGame';
import MathBalanceGame from './MathBalanceGame';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { trackEvent } from './analytics';

type AppTab = 'crossword' | 'sudoku' | 'memory' | 'bingo' | 'balance';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('crossword');

  const switchTab = useCallback((tab: AppTab) => {
    setActiveTab(tab);
    trackEvent('select_game', { game_name: tab });
  }, []);
  const [crossword, setCrossword] = useState<CrosswordData | null>(null);
  const [userGrid, setUserGrid] = useState<string[][]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [gridSize, setGridSize] = useState(10);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isGeneratingIcons, setIsGeneratingIcons] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bulkCount, setBulkCount] = useState(BULK_PRINT_DEFAULT_COUNT);
  const [bulkIncludeSolutions, setBulkIncludeSolutions] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [isGermanState, setIsGermanState] = useState(false);

  useEffect(() => {
    const checkGerman = () => {
      const german = window.location.pathname.includes('/german') || window.location.hash.includes('/german');
      setIsGermanState(german);
      document.title = german ? "Lernspiele für 1. Klasse" : "משחקי למידה לכיתה א'";
      document.documentElement.lang = german ? "de" : "he";
      document.documentElement.dir = german ? "ltr" : "rtl";
    };

    checkGerman();
    window.addEventListener('hashchange', checkGerman);
    return () => window.removeEventListener('hashchange', checkGerman);
  }, []);

  const isGerman = isGermanState;

  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);

  const createNewPuzzle = useCallback(async () => {
    try {
      setBootError(null);
      // Select random words
      const activeWordList = isGerman ? GERMAN_WORD_LIST : WORD_LIST;
      const shuffled = [...activeWordList].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 15); // Try to place up to 15 words
      const data = generateCrossword(selected, gridSize);
      setCrossword(data);

      // Initialize user grid
      const emptyGrid = Array(data.size).fill('').map(() => Array(data.size).fill(''));
      setUserGrid(emptyGrid);
      setIsComplete(false);
      setShowSolution(false);

      // Initialize refs
      inputRefs.current = Array(data.size).fill(null).map(() => Array(data.size).fill(null));

      // Trigger icon generation
      setIsGeneratingIcons(true);
      const updatedGrid = data.grid.map(row => row.map(cell => cell ? { ...cell } : null));

      // Use local storage to cache icons
      const getCachedIcon = (label: string) => {
        try {
          return localStorage.getItem(`icon_cache_${label}`);
        } catch (e) {
          return null;
        }
      };

      for (let y = 0; y < data.size; y++) {
        for (let x = 0; x < data.size; x++) {
          const cell = updatedGrid[y][x];
          if (cell?.isClue && cell.clueLabel) {
            const cached = getCachedIcon(cell.clueLabel);
            cell.clueImageUrl = cached || generateIcon(cell.clueLabel, cell.clueLabel);
          }
        }
      }

      setCrossword({ ...data, grid: updatedGrid.map(r => r.map(c => c ? { ...c } : null)) });
      setIsGeneratingIcons(false);
    } catch (e) {
      console.error(e);
      setBootError(e instanceof Error ? e.message : String(e));
      setIsGeneratingIcons(false);
    }
  }, [gridSize, isGerman]);

  useEffect(() => {
    createNewPuzzle();
  }, [createNewPuzzle]);

  const handleInputChange = (y: number, x: number, value: string) => {
    if (isComplete) return;

    // Only allow one character (Hebrew) or uppercase for German
    let char = value.slice(-1);
    if (isGerman) {
      char = char.toUpperCase();
    }
    const newGrid = [...userGrid];
    newGrid[y][x] = char;
    setUserGrid(newGrid);

    // Auto-focus next cell
    if (char && crossword) {
      const cell = crossword.grid[y][x];
      if (cell?.clueDirection === 'H' && x + 1 < crossword.size && crossword.grid[y][x + 1]) {
        inputRefs.current[y][x + 1]?.focus();
      } else if (cell?.clueDirection === 'V' && y + 1 < crossword.size && crossword.grid[y + 1][x]) {
        inputRefs.current[y + 1][x]?.focus();
      }
    }

    checkCompletion(newGrid);
  };

  const checkCompletion = (currentGrid: string[][]) => {
    if (!crossword) return;

    let allCorrect = true;
    let anyEmpty = false;

    for (let y = 0; y < crossword.size; y++) {
      for (let x = 0; x < crossword.size; x++) {
        const cell = crossword.grid[y][x];
        if (cell) {
          if (!currentGrid[y][x]) anyEmpty = true;
          if (currentGrid[y][x] !== cell.char) allCorrect = false;
        }
      }
    }

    if (allCorrect && !anyEmpty) {
      setIsComplete(true);
      trackEvent('game_complete', { game_name: 'crossword' });
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, y: number, x: number) => {
    if (e.key === 'Backspace' && !userGrid[y][x]) {
      // Move focus back if current is empty
      const cell = crossword?.grid[y][x];
      // This is a bit complex because we don't know which word the user is currently typing
      // For simplicity, we just allow manual navigation or standard backspace
    }

    if (e.key === 'ArrowRight' && x > 0) inputRefs.current[y][x - 1]?.focus();
    if (e.key === 'ArrowLeft' && x < gridSize - 1) inputRefs.current[y][x + 1]?.focus();
    if (e.key === 'ArrowDown' && y < gridSize - 1) inputRefs.current[y + 1][x]?.focus();
    if (e.key === 'ArrowUp' && y > 0) inputRefs.current[y - 1][x]?.focus();
  };

  const handlePrint = () => {
    trackEvent('print_puzzle', { type: 'single' });
    try {
      window.focus();
      // Small delay to ensure focus and layout are ready
      setTimeout(() => {
        window.print();
      }, 250);
    } catch (error) {
      console.error('Print error:', error);
    }
  };

  const handleBulkPrint = () => {
    setBulkError(null);
    trackEvent('print_puzzle', { type: 'bulk', count: bulkCount });
    // Open immediately on user gesture — delayed open + noopener often yields null in Chromium.
    const w = window.open('about:blank', '_blank');
    if (!w) {
      setBulkError('הדפדפן חסם חלון חדש. אפשרו חלונות קופצים לאתר זה, או לחצו ״פתח בלשונית חדשה״ והריצו משם.');
      return;
    }
    const n = Math.min(
      BULK_PRINT_MAX,
      Math.max(1, Math.floor(Number(bulkCount)) || 1)
    );
    try {
      const puzzles: CrosswordData[] = [];
      for (let i = 0; i < n; i++) {
        puzzles.push(createRandomPuzzle(gridSize));
      }
      const html = buildBulkPrintDocument(puzzles, {
        includeSolutions: bulkIncludeSolutions,
      });
      writeBulkPrintWindow(w, html);
    } catch (e) {
      console.error(e);
      try {
        w.close();
      } catch {
        /* ignore */
      }
      setBulkError(e instanceof Error ? e.message : String(e));
    }
  };

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  if (bootError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#FDFCFB] text-red-800" dir={isGerman ? "ltr" : "rtl"}>
        <p className="text-center max-w-md">{isGerman ? `Fehler beim Laden: ${bootError}` : `שגיאה בטעינת התשחץ: ${bootError}`}</p>
      </div>
    );
  }

  if (!crossword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#FDFCFB] text-stone-600" dir={isGerman ? "ltr" : "rtl"}>
        <p>{isGerman ? "Laden…" : "טוען…"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#2D3436] font-sans selection:bg-emerald-100" dir={isGerman ? "ltr" : "rtl"}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-stone-200 z-50 print:hidden">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2 sm:h-20 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <RefreshCw className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold tracking-tight whitespace-nowrap truncate">{isGerman ? "Lernspiele für 1. Klasse" : "משחקי למידה לכיתה א'"}</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-stone-500 font-medium hidden sm:block">{isGerman ? "Lernen mit Spaß" : "לומדים בכיף"}</p>
                {isGeneratingIcons && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-100 animate-pulse">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">{isGerman ? "Erstelle KI-Bilder..." : "מייצר תמונות AI..."}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Tab switcher */}
            <div className="flex bg-stone-100 rounded-full p-0.5">
              <button
                onClick={() => switchTab('crossword')}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-semibold transition-all",
                  activeTab === 'crossword' ? "bg-white shadow-sm text-stone-800" : "text-stone-500 hover:text-stone-700"
                )}
              >
                <PenLine className="w-4 h-4" />
                <span className="inline">{isGerman ? "Rätsel" : "תשחץ"}</span>
              </button>
              <button
                onClick={() => switchTab('sudoku')}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-semibold transition-all",
                  activeTab === 'sudoku' ? "bg-white shadow-sm text-stone-800" : "text-stone-500 hover:text-stone-700"
                )}
              >
                <Grid3X3 className="w-4 h-4" />
                <span className="inline">{isGerman ? "Sudoku" : "סודוקו"}</span>
              </button>
              <button
                onClick={() => switchTab('memory')}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-semibold transition-all",
                  activeTab === 'memory' ? "bg-white shadow-sm text-stone-800" : "text-stone-500 hover:text-stone-700"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="inline">{isGerman ? "Memory" : "זיכרון"}</span>
              </button>
              <button
                onClick={() => switchTab('bingo')}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-semibold transition-all",
                  activeTab === 'bingo' ? "bg-white shadow-sm text-stone-800" : "text-stone-500 hover:text-stone-700"
                )}
              >
                <Grid3X3 className="w-4 h-4" />
                <span className="inline">{isGerman ? "Bingo" : "בינגו"}</span>
              </button>
              <button
                onClick={() => switchTab('balance')}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-semibold transition-all",
                  activeTab === 'balance' ? "bg-white shadow-sm text-stone-800" : "text-stone-500 hover:text-stone-700"
                )}
              >
                <Calculator className="w-4 h-4" />
                <span className="inline">{isGerman ? "Waage" : "מאזניים"}</span>
              </button>
            </div>
            {activeTab === 'crossword' && (
              <>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-full text-sm font-semibold transition-all active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{isGerman ? "In neuem Tab öffnen" : "פתח בלשונית חדשה"}</span>
                </a>
                <button
                  onClick={() => {
                    const emptyGrid = Array(crossword.size).fill('').map(() => Array(crossword.size).fill(''));
                    setUserGrid(emptyGrid);
                    setIsComplete(false);
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-full text-sm font-semibold transition-all active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">{isGerman ? "Zurücksetzen" : "איפוס"}</span>
                </button>
                <button
                  onClick={createNewPuzzle}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-full text-sm font-semibold transition-all active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">{isGerman ? "Neu" : "חדש"}</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-sm font-semibold shadow-lg shadow-emerald-100 transition-all active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">{isGerman ? "Drucken" : "הדפסה"}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 sm:pt-32 pb-20 px-3 sm:px-6 max-w-5xl mx-auto">
        {activeTab === 'sudoku' ? (
          <SudokuGame isGerman={isGerman} />
        ) : activeTab === 'memory' ? (
          <MemoryGame isGerman={isGerman} />
        ) : activeTab === 'bingo' ? (
          <BingoGame isGerman={isGerman} />
        ) : activeTab === 'balance' ? (
          <MathBalanceGame isGerman={isGerman} />
        ) : (
          <div className="flex flex-col lg:flex-row gap-12 items-start justify-center">

            {/* Crossword Grid */}
            <div className="relative p-3 sm:p-8 bg-white rounded-[2rem] shadow-2xl shadow-stone-200/50 border border-stone-100 print:shadow-none print:p-0 print:border-none w-full sm:w-auto">
              <div
                className="grid gap-0.5 sm:gap-1 w-full"
                style={{
                  gridTemplateColumns: `repeat(${crossword.size}, minmax(0, 1fr))`,
                }}
              >
                {crossword.grid.map((row, y) => (
                  row.map((cell, x) => (
                    <div
                      key={`${y}-${x}`}
                      className={cn(
                        "relative aspect-square sm:w-14 sm:h-14 flex items-center justify-center rounded-lg transition-all duration-300",
                        cell ? (cell.isClue ? "bg-white border-none shadow-sm" : "bg-stone-50 border-2 border-stone-200") : "bg-transparent",
                        cell?.isWordStart && "ring-2 ring-emerald-100"
                      )}
                    >
                      {cell ? (
                        <>
                          {/* Clue Cell Content */}
                          {cell.isClue && (
                            <div className="relative w-full h-full p-1">
                              <div className="w-full h-full bg-white rounded-lg shadow-md border border-emerald-100 overflow-hidden relative group">
                                {cell.clueImageUrl ? (
                                  <img
                                    src={cell.clueImageUrl}
                                    alt={cell.clueLabel}
                                    className="w-full h-full object-cover rounded-md group-hover:scale-110 transition-transform"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-stone-50 animate-pulse">
                                    <RefreshCw className="w-4 h-4 text-emerald-300 animate-spin" />
                                  </div>
                                )}
                              </div>
                              {/* Arrow outside the icon container for better visibility and print support */}
                              <div className={cn(
                                "absolute z-20 flex items-center justify-center bg-white rounded-full shadow-md border border-emerald-200 p-0.5 sm:p-1 print:border-stone-300 print:shadow-none",
                                cell.clueDirection === 'H' ? "-left-2 sm:-left-3 top-1/2 -translate-y-1/2" : "-bottom-2 sm:-bottom-3 left-1/2 -translate-x-1/2"
                              )}>
                                {cell.clueDirection === 'H' ? (
                                  <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 print:text-stone-800" />
                                ) : (
                                  <ArrowDown className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 print:text-stone-800" />
                                )}
                              </div>
                            </div>
                          )}

                          {/* Input (only for non-clue cells) */}
                          {!cell.isClue && (
                            <input
                              ref={el => inputRefs.current[y][x] = el}
                              type="text"
                              maxLength={1}
                              value={showSolution ? (cell.char || '') : userGrid[y][x]}
                              onChange={(e) => handleInputChange(y, x, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, y, x)}
                              className={cn(
                                "w-full h-full text-center text-base sm:text-2xl font-bold bg-transparent outline-none transition-colors",
                                isComplete ? "text-emerald-600" : "text-stone-800",
                                showSolution && "text-blue-600"
                              )}
                              disabled={isComplete || showSolution}
                            />
                          )}
                        </>
                      ) : null}
                    </div>
                  ))
                ))}
              </div>

              {/* Success Message */}
              <AnimatePresence>
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="absolute -bottom-12 left-0 right-0 flex justify-center print:hidden"
                  >
                    <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3">
                      <Trophy className="w-5 h-5" />
                      <span className="font-bold">{isGerman ? "Gut gemacht! Du hast es gelöst!" : "כל הכבוד! פתרת את התשחץ!"}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sidebar / Instructions */}
            <div className="flex-1 space-y-8 print:hidden">
              <section className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-emerald-500" />
                  {isGerman ? "Wie spielt man?" : "איך משחקים?"}
                </h2>
                <ul className="space-y-4 text-sm text-stone-600">
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-50 flex-shrink-0 flex items-center justify-center text-emerald-600 font-bold text-xs">1</div>
                    <p>{isGerman ? "Schau dir die Bilder über den Kästchen an." : "הסתכלו על הציורים שמעל המשבצות."}</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-50 flex-shrink-0 flex items-center justify-center text-emerald-600 font-bold text-xs">2</div>
                    <p>{isGerman ? "Schreibe die Buchstaben des Wortes in Pfeilrichtung." : "כתבו את האותיות של המילה לפי כיוון החץ."}</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-50 flex-shrink-0 flex items-center justify-center text-emerald-600 font-bold text-xs">3</div>
                    <p>{isGerman ? "Du kannst die Pfeiltasten benutzen, um zwischen den Kästchen zu wechseln." : "אפשר להשתמש בחיצים במקלדת כדי לעבור בין משבצות."}</p>
                  </li>
                </ul>
              </section>

              {/* Print Tip for Iframe */}
              {isIframe && (
                <section className="bg-amber-50 p-6 rounded-3xl border border-amber-100 shadow-sm">
                  <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-amber-700">
                    <Printer className="w-5 h-5" />
                    {isGerman ? "Drucktipp" : "טיפ להדפסה"}
                  </h2>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    {isGerman ? 
                      <>Wenn der Drucken-Button nicht funktioniert, klicke oben auf <strong>"In neuem Tab öffnen"</strong>.</> : 
                      <>אם כפתור ההדפסה לא נפתח, לחצו על הכפתור <strong>"פתח בלשונית חדשה"</strong> למעלה ואז נסו להדפיס שוב מהלשונית החדשה.</>
                    }
                  </p>
                </section>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowSolution(!showSolution)}
                  className="w-full py-4 rounded-2xl border-2 border-stone-200 font-bold text-stone-500 hover:bg-stone-50 transition-all active:scale-[0.98]"
                >
                  {showSolution 
                    ? (isGerman ? 'Lösung verbergen' : 'הסתר פתרון') 
                    : (isGerman ? 'Lösung anzeigen' : 'הצג פתרון')}
                </button>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 text-xs flex gap-3">
                  <Download className="w-5 h-5 flex-shrink-0" />
                  <p>{isGerman ? "Tipp: Klicke auf Drucken, um ein fertiges Arbeitsblatt zu erhalten!" : "טיפ: לחצו על כפתור ההדפסה כדי לקבל דף עבודה מוכן למדפסת!"}</p>
                </div>

                <section className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <FileStack className="w-5 h-5 text-emerald-500" />
                    {isGerman ? "Mehrere Zufallsrätsel drucken" : "הדפסת מספר תשחצים אקראיים"}
                  </h2>
                  <p className="text-sm text-stone-600 mb-4 leading-relaxed">
                    {isGerman ? "Erstellt mehrere Rätsel in einem neuen Fenster. Jedes auf einer eigenen Seite." : "יוצרים מספר תשחצים אקראיים בחלון חדש — כל תשחץ בדף נפרד. אפשר להדפיס או לשמור כ־PDF מתפריט המדפסת."}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-4">
                    <label className="flex flex-col gap-1.5 flex-1">
                      <span className="text-xs font-semibold text-stone-500">{isGerman ? "Wie viele Rätsel?" : "כמה תשחצים?"}</span>
                      <input
                        type="number"
                        min={1}
                        max={BULK_PRINT_MAX}
                        value={bulkCount}
                        onChange={(e) => setBulkCount(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </label>
                    <span className="text-xs text-stone-400 pb-2">{isGerman ? `Bis zu ${BULK_PRINT_MAX}` : `עד ${BULK_PRINT_MAX}`}</span>
                  </div>
                  <label className="flex items-center gap-3 mb-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkIncludeSolutions}
                      onChange={(e) => setBulkIncludeSolutions(e.target.checked)}
                      className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-stone-700">{isGerman ? "Lösungsblätter hinzufügen" : "להוסיף דפי פתרון (אחרי כל דפי התשחצים)"}</span>
                  </label>
                  {bulkError && (
                    <p className="text-sm text-red-600 mb-3" role="alert">
                      {bulkError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleBulkPrint}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-stone-800 hover:bg-stone-900 text-white font-bold text-sm transition-all active:scale-[0.98]"
                  >
                    <Printer className="w-4 h-4" />
                    {isGerman ? "Druckdatei erstellen" : "צור קובץ להדפסה"}
                  </button>
                </section>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-10 text-center text-stone-400 text-xs print:hidden">
        <p>© {new Date().getFullYear()} {isGerman ? "Lernspiele für 1. Klasse - Lernen mit Spaß" : "משחקי למידה לכיתה א' - לומדים בכיף"}</p>
      </footer>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact;
          }
          main {
            padding: 1cm !important;
            max-width: none !important;
            width: 100% !important;
          }
          header, footer, .print-hidden {
            display: none !important;
          }
          .shadow-2xl, .shadow-xl, .shadow-md, .shadow-sm {
            box-shadow: none !important;
          }
          .rounded-[2rem] {
            border-radius: 0 !important;
          }
          .bg-stone-50 {
            background: white !important;
            border: 1px solid #000 !important;
          }
          input {
            color: black !important;
            -webkit-text-fill-color: black !important;
          }
          .text-emerald-600 {
            color: black !important;
          }
          .p-8 {
            padding: 0 !important;
          }
          .border-stone-100 {
            border: none !important;
          }
          /* Ensure icons and images are visible */
          .text-emerald-600 {
            color: #059669 !important;
          }
          .w-12, .w-16 {
            width: 1.5cm !important;
            height: 1.5cm !important;
          }
          .absolute.-top-10 {
            top: -1.2cm !important;
          }
        }
      `}</style>
    </div>
  );
}
