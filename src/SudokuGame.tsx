import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Trophy, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateSudoku, SudokuPuzzle } from './sudokuGenerator';
import { generateIcon } from './services/imageService';
import { WORD_LIST } from './words';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pick 4 random icons from the word list */
function pickIcons(): { label: string; url: string }[] {
  const shuffled = [...WORD_LIST].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, 4);
  return picked.map(w => ({
    label: w.label,
    url: generateIcon(w.label, w.label),
  }));
}

export default function SudokuGame() {
  const [icons, setIcons] = useState<{ label: string; url: string }[]>([]);
  const [puzzle, setPuzzle] = useState<SudokuPuzzle | null>(null);
  const [grid, setGrid] = useState<number[][]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [dragIcon, setDragIcon] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // For touch drag
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragIconRef = useRef<number | null>(null);

  const newGame = useCallback(() => {
    const newIcons = pickIcons();
    const newPuzzle = generateSudoku('easy');
    setIcons(newIcons);
    setPuzzle(newPuzzle);
    setGrid(newPuzzle.puzzle.map(row => [...row]));
    setIsComplete(false);
    setIsWrong(false);
    setSelectedCell(null);
    setDragIcon(null);
  }, []);

  useEffect(() => {
    newGame();
  }, [newGame]);

  const checkSolution = useCallback((currentGrid: number[][]) => {
    if (!puzzle) return;

    // Check if all cells are filled
    const allFilled = currentGrid.every(row => row.every(cell => cell !== -1));
    if (!allFilled) {
      setIsComplete(false);
      setIsWrong(false);
      return;
    }

    // Check if correct
    const correct = currentGrid.every((row, r) =>
      row.every((cell, c) => cell === puzzle.solution[r][c])
    );

    if (correct) {
      setIsComplete(true);
      setIsWrong(false);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    } else {
      setIsWrong(true);
      setIsComplete(false);
    }
  }, [puzzle]);

  const placeIcon = useCallback((row: number, col: number, iconIdx: number) => {
    if (!puzzle || isComplete) return;
    if (puzzle.puzzle[row][col] !== -1) return; // Can't overwrite givens

    const newGrid = grid.map(r => [...r]);
    newGrid[row][col] = iconIdx;
    setGrid(newGrid);
    setSelectedCell(null);
    setDragIcon(null);
    checkSolution(newGrid);
  }, [puzzle, grid, isComplete, checkSolution]);

  const clearCell = useCallback((row: number, col: number) => {
    if (!puzzle || isComplete) return;
    if (puzzle.puzzle[row][col] !== -1) return; // Can't clear givens

    const newGrid = grid.map(r => [...r]);
    newGrid[row][col] = -1;
    setGrid(newGrid);
    setIsWrong(false);
    setIsComplete(false);
  }, [puzzle, grid, isComplete]);

  // Handle tap-to-place flow: tap cell, then tap icon (or vice versa)
  const handleCellTap = useCallback((row: number, col: number) => {
    if (!puzzle || isComplete) return;
    if (puzzle.puzzle[row][col] !== -1) return; // Given cell

    // If cell already has a value, clear it
    if (grid[row][col] !== -1) {
      clearCell(row, col);
      return;
    }

    // If we have a selected icon from tray, place it
    if (dragIcon !== null) {
      placeIcon(row, col, dragIcon);
      return;
    }

    // Select this cell for later icon selection
    setSelectedCell(prev =>
      prev && prev[0] === row && prev[1] === col ? null : [row, col]
    );
  }, [puzzle, grid, isComplete, dragIcon, placeIcon, clearCell]);

  const handleTrayTap = useCallback((iconIdx: number) => {
    if (isComplete) return;

    // If a cell is selected, place the icon there
    if (selectedCell) {
      placeIcon(selectedCell[0], selectedCell[1], iconIdx);
      return;
    }

    // Toggle icon selection
    setDragIcon(prev => prev === iconIdx ? null : iconIdx);
  }, [isComplete, selectedCell, placeIcon]);

  // Touch drag handlers
  const handleTouchStart = useCallback((e: React.TouchEvent, iconIdx: number) => {
    if (isComplete) return;
    e.preventDefault();
    const touch = e.touches[0];
    dragIconRef.current = iconIdx;
    setDragIcon(iconIdx);
    setDragPos({ x: touch.clientX, y: touch.clientY });
  }, [isComplete]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragIconRef.current === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    setDragPos({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (dragIconRef.current === null || !gridRef.current) {
      setDragPos(null);
      dragIconRef.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    // Find which grid cell is under the touch point
    const gridEl = gridRef.current;
    const cells = gridEl.querySelectorAll('[data-cell]');
    let placed = false;

    cells.forEach(cell => {
      const rect = cell.getBoundingClientRect();
      if (
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        const row = parseInt(cell.getAttribute('data-row') || '0');
        const col = parseInt(cell.getAttribute('data-col') || '0');
        if (puzzle && puzzle.puzzle[row][col] === -1) {
          placeIcon(row, col, dragIconRef.current!);
          placed = true;
        }
      }
    });

    if (!placed) {
      setDragIcon(null);
    }
    setDragPos(null);
    dragIconRef.current = null;
  }, [puzzle, placeIcon]);

  // HTML5 drag handlers for desktop
  const handleDragStart = useCallback((e: React.DragEvent, iconIdx: number) => {
    e.dataTransfer.setData('text/plain', String(iconIdx));
    setDragIcon(iconIdx);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    const iconIdx = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(iconIdx)) {
      placeIcon(row, col, iconIdx);
    }
  }, [placeIcon]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Count how many of each icon are still needed
  const getIconCounts = useCallback(() => {
    if (!puzzle) return [0, 0, 0, 0];
    const placed = [0, 0, 0, 0];
    grid.forEach(row => row.forEach(cell => {
      if (cell >= 0) placed[cell]++;
    }));
    // Each icon appears exactly 4 times in a 4x4 sudoku
    return placed.map(p => 4 - p);
  }, [puzzle, grid]);

  if (!puzzle || icons.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 text-stone-600" dir="rtl">
        <p>טוען…</p>
      </div>
    );
  }

  const iconCounts = getIconCounts();

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto px-3" dir="rtl">
      {/* Header buttons */}
      <div className="flex items-center gap-3 w-full justify-center">
        <button
          onClick={newGame}
          className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-full text-sm font-semibold transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>משחק חדש</span>
        </button>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95",
            showHelp ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 hover:bg-stone-200"
          )}
        >
          <HelpCircle className="w-4 h-4" />
          <span>עזרה</span>
        </button>
      </div>

      {/* Help section */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden w-full"
          >
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-stone-600 space-y-2">
              <p className="font-bold text-emerald-700">איך משחקים סודוקו?</p>
              <ul className="space-y-1.5 list-disc list-inside">
                <li>כל שורה צריכה להכיל את כל 4 הציורים, בלי חזרות</li>
                <li>כל עמודה צריכה להכיל את כל 4 הציורים, בלי חזרות</li>
                <li>כל ריבוע צבעוני (2×2) צריך להכיל את כל 4 הציורים</li>
                <li>גררו ציור מהמגש למשבצת ריקה, או לחצו על משבצת ואז על ציור</li>
                <li>לחצו על ציור שכבר במשבצת כדי להסיר אותו</li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div
        ref={gridRef}
        className="relative bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-100 p-2 sm:p-3"
      >
        <div className="grid grid-cols-4 gap-0">
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const isGiven = puzzle.puzzle[r][c] !== -1;
              const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
              // 2x2 box coloring
              const boxIdx = Math.floor(r / 2) * 2 + Math.floor(c / 2);
              const boxColors = [
                'bg-amber-50', 'bg-sky-50',
                'bg-emerald-50', 'bg-purple-50',
              ];

              return (
                <div
                  key={`${r}-${c}`}
                  data-cell
                  data-row={r}
                  data-col={c}
                  onClick={() => handleCellTap(r, c)}
                  onDrop={(e) => handleDrop(e, r, c)}
                  onDragOver={handleDragOver}
                  className={cn(
                    "relative aspect-square w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] flex items-center justify-center transition-all duration-200 cursor-pointer",
                    boxColors[boxIdx],
                    // Borders for grid lines
                    c < 3 && "border-r border-stone-200",
                    r < 3 && "border-b border-stone-200",
                    // Thicker lines for 2x2 box boundaries
                    c === 1 && "border-r-[3px] border-r-stone-400",
                    r === 1 && "border-b-[3px] border-b-stone-400",
                    // Selection highlight
                    isSelected && "ring-4 ring-emerald-400 ring-inset z-10",
                    // Given cells have a subtle indicator
                    isGiven && "opacity-100",
                    !isGiven && cell === -1 && "hover:bg-emerald-100/50",
                  )}
                >
                  {cell >= 0 && icons[cell] && (
                    <motion.img
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      src={icons[cell].url}
                      alt={icons[cell].label}
                      referrerPolicy="no-referrer"
                      className={cn(
                        "w-12 h-12 sm:w-14 sm:h-14 object-contain pointer-events-none select-none",
                        isGiven && "drop-shadow-md",
                      )}
                      draggable={false}
                    />
                  )}
                  {isGiven && cell >= 0 && (
                    <div className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-stone-300" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Status messages */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-3 bg-emerald-500 text-white px-6 py-3 rounded-full shadow-xl"
          >
            <Trophy className="w-5 h-5" />
            <span className="font-bold text-lg">כל הכבוד! פתרת את הסודוקו!</span>
          </motion.div>
        )}
        {isWrong && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: [0, -5, 5, -5, 5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-3 bg-orange-100 text-orange-700 px-6 py-3 rounded-full border border-orange-200"
          >
            <span className="font-bold">עוד קצת... נסו להחליף ציורים!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Icon tray */}
      <div className="w-full bg-white rounded-2xl shadow-lg shadow-stone-200/50 border border-stone-100 p-4">
        <p className="text-xs text-stone-400 font-semibold mb-3 text-center">גררו ציור למשבצת ריקה</p>
        <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
          {icons.map((icon, idx) => {
            const remaining = iconCounts[idx];
            const isSelectedIcon = dragIcon === idx;
            return (
              <div key={idx} className="flex flex-col items-center gap-1.5">
                <div
                  draggable={remaining > 0 && !isComplete}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onTouchStart={(e) => handleTouchStart(e, idx)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onClick={() => handleTrayTap(idx)}
                  className={cn(
                    "w-16 h-16 sm:w-18 sm:h-18 rounded-xl flex items-center justify-center transition-all duration-200 touch-none",
                    remaining > 0 && !isComplete
                      ? "bg-stone-50 border-2 border-stone-200 hover:border-emerald-300 hover:shadow-md cursor-grab active:cursor-grabbing active:scale-105"
                      : "bg-stone-100 border-2 border-stone-100 opacity-30 cursor-not-allowed",
                    isSelectedIcon && remaining > 0 && "border-emerald-400 bg-emerald-50 shadow-md ring-2 ring-emerald-200",
                  )}
                >
                  <img
                    src={icon.url}
                    alt={icon.label}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 sm:w-12 sm:h-12 object-contain pointer-events-none select-none"
                    draggable={false}
                  />
                </div>
                <div className={cn(
                  "flex gap-0.5",
                  remaining === 0 && "opacity-30"
                )}>
                  {Array.from({ length: remaining }).map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-emerald-400" />
                  ))}
                  {Array.from({ length: 4 - remaining }).map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-stone-200" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating drag indicator for touch */}
      {dragPos && dragIconRef.current !== null && icons[dragIconRef.current] && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: dragPos.x - 30,
            top: dragPos.y - 30,
          }}
        >
          <img
            src={icons[dragIconRef.current].url}
            alt=""
            referrerPolicy="no-referrer"
            className="w-[60px] h-[60px] object-contain opacity-80 drop-shadow-xl"
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
