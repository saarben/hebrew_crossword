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
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { WORD_LIST } from './words';
import { generateCrossword, CrosswordData, GridCell } from './crosswordGenerator';
import { generateIcon } from './services/imageService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [crossword, setCrossword] = useState<CrosswordData | null>(null);
  const [userGrid, setUserGrid] = useState<string[][]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [gridSize, setGridSize] = useState(10);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isGeneratingIcons, setIsGeneratingIcons] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);

  const createNewPuzzle = useCallback(async () => {
    try {
      setBootError(null);
      // Select random words
      const shuffled = [...WORD_LIST].sort(() => 0.5 - Math.random());
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
  }, [gridSize]);

  useEffect(() => {
    createNewPuzzle();
  }, [createNewPuzzle]);

  const handleInputChange = (y: number, x: number, value: string) => {
    if (isComplete) return;

    // Only allow one character (Hebrew)
    const char = value.slice(-1);
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
    console.log('Print button clicked');
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

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  if (bootError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#FDFCFB] text-red-800" dir="rtl">
        <p className="text-center max-w-md">שגיאה בטעינת התשבץ: {bootError}</p>
      </div>
    );
  }

  if (!crossword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#FDFCFB] text-stone-600" dir="rtl">
        <p>טוען…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#2D3436] font-sans selection:bg-emerald-100" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-stone-200 z-50 print:hidden">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">תשבצון</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-stone-500 font-medium">תשחצים לכיתה א׳</p>
                {isGeneratingIcons && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-100 animate-pulse">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">מייצר תמונות AI...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-full text-sm font-semibold transition-all active:scale-95"
            >
              <ExternalLink className="w-4 h-4" />
              <span>פתח בלשונית חדשה</span>
            </a>
            <button 
              onClick={() => {
                const emptyGrid = Array(crossword.size).fill('').map(() => Array(crossword.size).fill(''));
                setUserGrid(emptyGrid);
                setIsComplete(false);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-full text-sm font-semibold transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>איפוס</span>
            </button>
            <button 
              onClick={createNewPuzzle}
              className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-full text-sm font-semibold transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>חדש</span>
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-sm font-semibold shadow-lg shadow-emerald-100 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>הדפסה</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-20 px-6 max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-12 items-start justify-center">
          
          {/* Crossword Grid */}
          <div className="relative p-8 bg-white rounded-[2rem] shadow-2xl shadow-stone-200/50 border border-stone-100 print:shadow-none print:p-0 print:border-none">
            <div 
              className="grid gap-1" 
              style={{ 
                gridTemplateColumns: `repeat(${crossword.size}, minmax(0, 1fr))`,
                width: 'fit-content'
              }}
            >
              {crossword.grid.map((row, y) => (
                row.map((cell, x) => (
                  <div 
                    key={`${y}-${x}`}
                    className={cn(
                      "relative w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center rounded-lg transition-all duration-300",
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
                              <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-[2px] py-0.5 flex justify-center">
                                {cell.clueDirection === 'H' ? (
                                  <ArrowLeft className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-emerald-600" />
                                )}
                              </div>
                            </div>
                            {/* Arrow outside the icon container for better visibility and print support */}
                            <div className={cn(
                              "absolute z-20 flex items-center justify-center bg-white rounded-full shadow-md border border-emerald-200 p-1 print:border-stone-300 print:shadow-none",
                              cell.clueDirection === 'H' ? "-left-3 top-1/2 -translate-y-1/2" : "-bottom-3 left-1/2 -translate-x-1/2"
                            )}>
                              {cell.clueDirection === 'H' ? (
                                <ArrowLeft className="w-4 h-4 text-emerald-600 print:text-stone-800" />
                              ) : (
                                <ArrowDown className="w-4 h-4 text-emerald-600 print:text-stone-800" />
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
                              "w-full h-full text-center text-xl sm:text-2xl font-bold bg-transparent outline-none transition-colors",
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
                    <span className="font-bold">כל הכבוד! פתרת את התשחץ!</span>
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
                איך משחקים?
              </h2>
              <ul className="space-y-4 text-sm text-stone-600">
                <li className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 flex-shrink-0 flex items-center justify-center text-emerald-600 font-bold text-xs">1</div>
                  <p>הסתכלו על הציורים שמעל המשבצות.</p>
                </li>
                <li className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 flex-shrink-0 flex items-center justify-center text-emerald-600 font-bold text-xs">2</div>
                  <p>כתבו את האותיות של המילה לפי כיוון החץ.</p>
                </li>
                <li className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 flex-shrink-0 flex items-center justify-center text-emerald-600 font-bold text-xs">3</div>
                  <p>אפשר להשתמש בחיצים במקלדת כדי לעבור בין משבצות.</p>
                </li>
              </ul>
            </section>

            {/* Print Tip for Iframe */}
            {isIframe && (
              <section className="bg-amber-50 p-6 rounded-3xl border border-amber-100 shadow-sm">
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-amber-700">
                  <Printer className="w-5 h-5" />
                  טיפ להדפסה
                </h2>
                <p className="text-sm text-amber-800 leading-relaxed">
                  אם כפתור ההדפסה לא נפתח, לחצו על הכפתור <strong>"פתח בלשונית חדשה"</strong> למעלה ואז נסו להדפיס שוב מהלשונית החדשה.
                </p>
              </section>
            )}

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setShowSolution(!showSolution)}
                className="w-full py-4 rounded-2xl border-2 border-stone-200 font-bold text-stone-500 hover:bg-stone-50 transition-all active:scale-[0.98]"
              >
                {showSolution ? 'הסתר פתרון' : 'הצג פתרון'}
              </button>
              
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 text-xs flex gap-3">
                <Download className="w-5 h-5 flex-shrink-0" />
                <p>טיפ: לחצו על כפתור ההדפסה כדי לקבל דף עבודה מוכן למדפסת!</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-10 text-center text-stone-400 text-xs print:hidden">
        <p>© {new Date().getFullYear()} תשבצון - לומדים עברית בכיף</p>
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
