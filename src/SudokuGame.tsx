import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Trophy, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateSudoku, SudokuPuzzle } from './sudokuGenerator';
import { generateIcon } from './services/imageService';
import { WORD_LIST } from './words';
import { GERMAN_WORD_LIST } from './wordsGerman';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pick N random icons from the word list */
function pickIcons(count: number, isGerman: boolean): { label: string; url: string }[] {
  const activeWordList = isGerman ? GERMAN_WORD_LIST : WORD_LIST;
  const shuffled = [...activeWordList].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count);
  return picked.map(w => ({
    label: w.label,
    url: generateIcon(w.label, w.label),
  }));
}

export default function SudokuGame({ isGerman }: { isGerman: boolean }) {
  const [blockSize, setBlockSize] = useState(2);
  const [icons, setIcons] = useState<{ label: string; url: string }[]>([]);
  const [puzzle, setPuzzle] = useState<SudokuPuzzle | null>(null);
  const [grid, setGrid] = useState<number[][]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [dragIcon, setDragIcon] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const totalSize = blockSize * blockSize;

  // For touch drag
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragIconRef = useRef<number | null>(null);
  const dragSourceRef = useRef<{ r: number; c: number } | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const newGame = useCallback((size: number = blockSize) => {
    const total = size * size;
    const newIcons = pickIcons(total, isGerman);
    const newPuzzle = generateSudoku(size, 'easy');
    setIcons(newIcons);
    setPuzzle(newPuzzle);
    setGrid(newPuzzle.puzzle.map(row => [...row]));
    setIsComplete(false);
    setIsWrong(false);
    setSelectedCell(null);
    setDragIcon(null);
  }, [blockSize]);

  const changeSize = (newBlockSize: number) => {
    setBlockSize(newBlockSize);
    newGame(newBlockSize);
  };

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
    if (e.cancelable) e.preventDefault();
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    dragIconRef.current = iconIdx;
    dragSourceRef.current = null;
    setDragIcon(iconIdx);
    setDragPos({ x: touch.clientX, y: touch.clientY });
  }, [isComplete]);

  const handleGridTouchStart = useCallback((e: React.TouchEvent, r: number, c: number, iconIdx: number) => {
    if (isComplete) return;
    if (e.cancelable) e.preventDefault();
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    dragIconRef.current = iconIdx;
    dragSourceRef.current = { r, c };
    setDragIcon(iconIdx);
    setDragPos({ x: touch.clientX, y: touch.clientY });
  }, [isComplete]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragIconRef.current === null) return;
    if (e.cancelable) e.preventDefault();
    const touch = e.touches[0];
    setDragPos({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (dragIconRef.current === null || !gridRef.current) {
      setDragPos(null);
      dragIconRef.current = null;
      dragSourceRef.current = null;
      touchStartPosRef.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    
    // Check if it was a tap
    const isTap = touchStartPosRef.current && 
      Math.abs(touch.clientX - touchStartPosRef.current.x) < 10 &&
      Math.abs(touch.clientY - touchStartPosRef.current.y) < 10;

    if (isTap) {
      if (dragSourceRef.current) {
        // Tapped a grid cell
        const { r, c } = dragSourceRef.current;
        handleCellTap(r, c);
      } else {
        // Tapped a tray icon
        handleTrayTap(dragIconRef.current);
      }
      
      setDragPos(null);
      dragIconRef.current = null;
      dragSourceRef.current = null;
      touchStartPosRef.current = null;
      return;
    }

    // Find which grid cell is under the touch point
    const gridEl = gridRef.current;
    const cells = gridEl.querySelectorAll('[data-cell]');
    let placed = false;
    let targetCell: {row: number, col: number} | null = null;

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
        targetCell = { row, col };
      }
    });

    if (targetCell) {
      const { row, col } = targetCell;
      if (puzzle && puzzle.puzzle[row][col] === -1) {
        if (dragSourceRef.current) {
          const { r: srcR, c: srcC } = dragSourceRef.current;
          if (srcR !== row || srcC !== col) {
            setGrid(prev => {
              const newGrid = prev.map(r => [...r]);
              newGrid[srcR][srcC] = -1;
              newGrid[row][col] = dragIconRef.current!;
              setTimeout(() => checkSolution(newGrid), 0);
              return newGrid;
            });
            placed = true;
          }
        } else {
          placeIcon(row, col, dragIconRef.current!);
          placed = true;
        }
      }
    } else if (dragSourceRef.current && !isTap) {
      // Dropped outside grid: clear the cell
      clearCell(dragSourceRef.current.r, dragSourceRef.current.c);
    }

    if (!placed) {
      setDragIcon(null);
    }
    setDragPos(null);
    dragIconRef.current = null;
    dragSourceRef.current = null;
    touchStartPosRef.current = null;
  }, [puzzle, placeIcon, checkSolution, handleCellTap, handleTrayTap, clearCell]);

  // HTML5 drag handlers for desktop
  const handleDragStart = useCallback((e: React.DragEvent, iconIdx: number) => {
    e.dataTransfer.setData('text/plain', String(iconIdx));
    setDragIcon(iconIdx);
  }, []);

  const handleGridDragStart = useCallback((e: React.DragEvent, r: number, c: number, iconIdx: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'grid', r, c, iconIdx }));
    setDragIcon(iconIdx);
  }, []);

  const handleGridDragEnd = useCallback((e: React.DragEvent, r: number, c: number) => {
    if (e.dataTransfer.dropEffect === 'none') {
      clearCell(r, c);
    }
    setDragIcon(null);
  }, [clearCell]);

  const handleDrop = useCallback((e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;

    try {
      if (data.startsWith('{')) {
        const parsed = JSON.parse(data);
        if (parsed.source === 'grid') {
          if (parsed.r === row && parsed.c === col) return;

          setGrid(prev => {
            const newGrid = prev.map(r => [...r]);
            newGrid[parsed.r][parsed.c] = -1;
            newGrid[row][col] = parsed.iconIdx;
            setTimeout(() => checkSolution(newGrid), 0);
            return newGrid;
          });
          return;
        }
      }
    } catch {
      // Ignore JSON parse errors
    }

    const iconIdx = parseInt(data);
    if (!isNaN(iconIdx)) {
      placeIcon(row, col, iconIdx);
    }
  }, [placeIcon, checkSolution]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Count how many of each icon are still needed
  const getIconCounts = useCallback(() => {
    if (!puzzle) return [];
    const placed = new Array(totalSize).fill(0);
    grid.forEach(row => row.forEach(cell => {
      if (cell >= 0) placed[cell]++;
    }));
    // Each icon appears exactly totalSize times
    return placed.map(p => totalSize - p);
  }, [puzzle, grid, totalSize]);

  if (!puzzle || icons.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 text-stone-600" dir={isGerman ? "ltr" : "rtl"}>
        <p>{isGerman ? "Laden…" : "טוען…"}</p>
      </div>
    );
  }

  const iconCounts = getIconCounts();

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto px-3" dir={isGerman ? "ltr" : "rtl"}>
      {/* Header buttons */}
      <div className="flex flex-col items-center gap-4 w-full">
        <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-2xl">
          {[2, 3, 4].map((size) => (
            <button
              key={size}
              onClick={() => changeSize(size)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                blockSize === size
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-stone-500 hover:text-stone-700 hover:bg-stone-200/50"
              )}
            >
              {size}×{size}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full justify-center">
          <button
            onClick={() => newGame()}
            className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-full text-sm font-semibold transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{isGerman ? "Neues Spiel" : "משחק חדש"}</span>
          </button>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95",
              showHelp ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 hover:bg-stone-200"
            )}
          >
            <HelpCircle className="w-4 h-4" />
            <span>{isGerman ? "Hilfe" : "עזרה"}</span>
          </button>
        </div>
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
              <p className="font-bold text-emerald-700">{isGerman ? "Wie spielt man Sudoku?" : "איך משחקים סודוקו?"}</p>
              <ul className="space-y-1.5 list-disc list-inside">
                <li>{isGerman ? `Jede Reihe muss alle ${totalSize} Bilder ohne Wiederholung enthalten` : `כל שורה צריכה להכיל את כל ${totalSize} הציורים, בלי חזרות`}</li>
                <li>{isGerman ? `Jede Spalte muss alle ${totalSize} Bilder ohne Wiederholung enthalten` : `כל עמודה צריכה להכיל את כל ${totalSize} הציורים, בלי חזרות`}</li>
                <li>{isGerman ? `Jedes farbige Quadrat (${blockSize}×${blockSize}) muss alle Bilder enthalten` : `כל ריבוע צבעוני (${blockSize}×${blockSize}) צריך להכיל את כל הציורים`}</li>
                <li>{isGerman ? "Ziehe ein Bild in ein leeres Kästchen oder tippe auf ein Kästchen und dann auf ein Bild" : "גררו ציור מהמגש למשבצת ריקה, או לחצו על משבצת ואז על ציור"}</li>
                <li>{isGerman ? "Tippe auf ein gesetztes Bild, um es zu entfernen" : "לחצו על ציור שכבר במשבצת כדי להסיר אותו"}</li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div
        ref={gridRef}
        className="relative bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-100 p-1.5 sm:p-2 w-full aspect-square"
      >
        <div
          className="grid gap-0 w-full h-full"
          style={{
            gridTemplateColumns: `repeat(${totalSize}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${totalSize}, minmax(0, 1fr))`
          }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const isGiven = puzzle.puzzle[r][c] !== -1;
              const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;

              // Dynamic box coloring
              const boxR = Math.floor(r / blockSize);
              const boxC = Math.floor(c / blockSize);
              const boxIdx = (boxR * blockSize + boxC) % 8; // Cyclic through colors
              const boxColors = [
                'bg-amber-50', 'bg-sky-50', 'bg-emerald-50', 'bg-purple-50',
                'bg-rose-50', 'bg-indigo-50', 'bg-orange-50', 'bg-cyan-50'
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
                  draggable={!isGiven && cell >= 0}
                  onDragStart={(e) => {
                    if (!isGiven && cell >= 0) {
                      handleGridDragStart(e, r, c, cell);
                    }
                  }}
                  onDragEnd={(e) => {
                    if (!isGiven && cell >= 0) {
                      handleGridDragEnd(e, r, c);
                    }
                  }}
                  onTouchStart={(e) => {
                    if (!isGiven && cell >= 0) {
                      handleGridTouchStart(e, r, c, cell);
                    }
                  }}
                  onTouchMove={(e) => {
                    if (!isGiven && cell >= 0) {
                      handleTouchMove(e);
                    }
                  }}
                  onTouchEnd={(e) => {
                    if (!isGiven && cell >= 0) {
                      handleTouchEnd(e);
                    }
                  }}
                  className={cn(
                    "relative flex items-center justify-center transition-all duration-200 cursor-pointer overflow-hidden",
                    (!isGiven && cell >= 0) && "touch-none",
                    boxColors[boxIdx],
                    // Borders for grid lines
                    c < totalSize - 1 && "border-l border-stone-200/50",
                    r < totalSize - 1 && "border-b border-stone-200/50",
                    // Thicker lines for block boundaries
                    (c + 1) % blockSize === 0 && c < totalSize - 1 && "border-l-[2px] border-l-stone-300",
                    (r + 1) % blockSize === 0 && r < totalSize - 1 && "border-b-[2px] border-b-stone-300",
                    // Selection highlight
                    isSelected && "ring-2 ring-emerald-400 ring-inset z-10",
                    !isGiven && cell === -1 && "hover:bg-emerald-100/30",
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
                        "object-contain pointer-events-none select-none",
                        blockSize === 2 ? "w-[75%] h-[75%]" :
                          blockSize === 3 ? "w-[85%] h-[85%]" : "w-[90%] h-[90%]",
                        isGiven && "drop-shadow-sm brightness-90",
                      )}
                      draggable={false}
                    />
                  )}
                  {isGiven && cell >= 0 && (
                    <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-stone-300" />
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
            <span className="font-bold text-lg">{isGerman ? "Gut gemacht! Du hast das Sudoku gelöst!" : "כל הכבוד! פתרת את הסודוקו!"}</span>
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
            <span className="font-bold">{isGerman ? "Fast... versuche Bilder zu tauschen!" : "עוד קצת... נסו להחליף ציורים!"}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Icon tray */}
      <div className="w-full bg-white rounded-2xl shadow-lg shadow-stone-200/50 border border-stone-100 p-3 sm:p-4">
        <p className="text-xs text-stone-400 font-semibold mb-2 sm:mb-3 text-center">{isGerman ? "Ziehe ein Bild in ein leeres Kästchen" : "גררו ציור למשבצת ריקה"}</p>
        <div className="flex sm:justify-center gap-2 sm:gap-3 overflow-x-auto pb-2 px-1 snap-x" style={{ scrollbarWidth: 'thin' }}>
          {icons.map((icon, idx) => {
            const remaining = iconCounts[idx];
            const isSelectedIcon = dragIcon === idx;
            return (
              <div key={idx} className="flex flex-col items-center gap-1 shrink-0 snap-center">
                <div
                  draggable={remaining > 0 && !isComplete}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onTouchStart={(e) => handleTouchStart(e, idx)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onClick={() => handleTrayTap(idx)}
                  className={cn(
                    "rounded-xl flex items-center justify-center transition-all duration-200 touch-none",
                    blockSize === 2 ? "w-14 h-14" : blockSize === 3 ? "w-11 h-11" : "w-10 h-10",
                    remaining > 0 && !isComplete
                      ? "bg-stone-50 border border-stone-200 hover:border-emerald-300 hover:shadow-md cursor-grab active:cursor-grabbing active:scale-105"
                      : "bg-stone-100 border border-stone-100 opacity-30 cursor-not-allowed",
                    isSelectedIcon && remaining > 0 && "border-emerald-400 bg-emerald-50 shadow-md ring-2 ring-emerald-200",
                  )}
                >
                  <img
                    src={icon.url}
                    alt={icon.label}
                    referrerPolicy="no-referrer"
                    className="w-[80%] h-[80%] object-contain pointer-events-none select-none"
                    draggable={false}
                  />
                </div>
                <div className={cn(
                  "flex gap-0.5",
                  remaining === 0 && "opacity-30"
                )}>
                  {Array.from({ length: Math.min(remaining, 5) }).map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  ))}
                  {remaining > 5 && <span className="text-[10px] text-emerald-500 font-bold">+{remaining - 5}</span>}
                  {remaining === 0 && <div className="w-1.5 h-1.5 rounded-full bg-stone-200" />}
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
