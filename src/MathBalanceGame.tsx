import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Trophy, Calculator, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { trackEvent } from './analytics';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Level {
  left: number[];
  right: number[]; // First element is fixed, second is missing
  targetSum: number;
  missingWeight: number;
  options: number[];
}

function generateLevel(): Level {
  // Sum between 10 and 20 for first graders
  const targetSum = Math.floor(Math.random() * 11) + 10;
  
  // Left side: A + B
  const leftA = Math.floor(Math.random() * (targetSum - 2)) + 1;
  const leftB = targetSum - leftA;
  
  // Right side: C + D
  const rightC = Math.floor(Math.random() * (targetSum - 2)) + 1;
  const rightD = targetSum - rightC;
  
  // 4 choices including rightD
  const options = new Set<number>();
  options.add(rightD);
  while(options.size < 4) {
    let wrong = rightD + (Math.floor(Math.random() * 7) - 3);
    if (wrong > 0 && wrong !== rightD) {
      options.add(wrong);
    }
  }
  
  return {
    left: [leftA, leftB],
    right: [rightC, 0], // 0 means missing
    targetSum,
    missingWeight: rightD,
    options: Array.from(options).sort(() => Math.random() - 0.5)
  };
}

export default function MathBalanceGame({ isGerman }: { isGerman: boolean }) {
  const [level, setLevel] = useState<Level | null>(null);
  const [selectedWeight, setSelectedWeight] = useState<number | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [tilt, setTilt] = useState(0); // rotation angle
  
  const initGame = useCallback(() => {
    setLevel(generateLevel());
    setSelectedWeight(null);
    setIsComplete(false);
    setTilt(0);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    if (!level) return;
    
    // Calculate current sums
    const leftSum = level.left.reduce((a, b) => a + b, 0);
    const rightBaseSum = level.right[0];
    const currentRightSum = rightBaseSum + (selectedWeight || 0);
    
    // Tilt the scale
    if (selectedWeight === null) {
      // It is initially unbalanced because one weight is missing
      setTilt(-12);
    } else if (leftSum > currentRightSum) {
      setTilt(-8); // Left is heavier
    } else if (currentRightSum > leftSum) {
      setTilt(8);  // Right is heavier
    } else {
      setTilt(0);  // Balanced
      if (selectedWeight !== null && currentRightSum === leftSum && !isComplete) {
        setIsComplete(true);
        trackEvent('game_complete', { game_name: 'balance' });
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  }, [selectedWeight, level, isComplete]);

  // Handle selection
  const handleSelect = (weight: number) => {
    if (isComplete) return;
    setSelectedWeight(weight);
  };

  if (!level) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-12 w-full max-w-4xl mx-auto p-4" dir={isGerman ? "ltr" : "rtl"}>
      
      {/* Title */}
      <div className="text-center space-y-2 print:hidden">
        <h2 className="text-3xl font-bold text-stone-800 flex items-center justify-center gap-3">
          <Calculator className="w-8 h-8 text-indigo-500" />
          {isGerman ? "Zahlenwaage" : "מאזניי מספרים"}
        </h2>
        <p className="text-stone-500 font-medium">{isGerman ? "Füge das fehlende Gewicht hinzu, um die Waage auszugleichen!" : "הוסיפו את המשקולת החסרה כדי לאזן את המאזניים!"}</p>
      </div>

      {/* Scale Interface */}
      <div className="relative w-full max-w-2xl h-64 flex flex-col items-center justify-end">
        {/* The Balance Beam */}
        <motion.div 
          className="relative w-[300px] sm:w-[500px] h-4 bg-stone-300 rounded-full z-10 origin-center"
          animate={{ rotate: tilt }}
          transition={{ type: "spring", stiffness: 60, damping: 10 }}
        >
          {/* Left Pan */}
          <motion.div className="absolute left-0 sm:left-4 -top-0 flex flex-col items-center" animate={{ rotate: -tilt }} transition={{ type: "spring", stiffness: 60, damping: 10 }}>
            <div className="w-0.5 h-24 bg-stone-400"></div>
            <div className="w-32 h-4 bg-stone-400 rounded-b-xl flex items-end justify-center gap-2 px-2 pb-1 relative">
              {/* Weights on left pan */}
              <div className="absolute bottom-4 flex gap-1 sm:gap-2">
                {level.left.map((w, idx) => (
                  <div key={idx} className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-500 rounded-lg shadow-md border-b-4 border-indigo-700 flex items-center justify-center text-white font-bold text-lg sm:text-xl">
                    {w}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right Pan */}
          <motion.div className="absolute right-0 sm:right-4 -top-0 flex flex-col items-center" animate={{ rotate: -tilt }} transition={{ type: "spring", stiffness: 60, damping: 10 }}>
            <div className="w-0.5 h-24 bg-stone-400"></div>
            <div className="w-32 h-4 bg-stone-400 rounded-b-xl flex items-end justify-center gap-2 px-2 pb-1 relative">
              <div className="absolute bottom-4 flex gap-1 sm:gap-2 items-end">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-500 rounded-lg shadow-md border-b-4 border-indigo-700 flex items-center justify-center text-white font-bold text-lg sm:text-xl">
                  {level.right[0]}
                </div>
                {/* Missing / Selected Weight */}
                <div className={cn(
                  "w-10 h-10 sm:w-12 sm:h-12 rounded-lg shadow-md flex items-center justify-center text-lg sm:text-xl font-bold border-b-4 transition-all duration-300 relative",
                  selectedWeight !== null 
                    ? (isComplete ? "bg-emerald-500 border-emerald-700 text-white" : "bg-indigo-300 border-indigo-500 text-indigo-900")
                    : "bg-stone-50 border-stone-200 border-dashed text-stone-400 border-2"
                )}>
                  {selectedWeight !== null ? selectedWeight : '?'}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
        
        {/* Scale Base/Fulcrum */}
        <div className="w-0 h-0 border-[40px] border-transparent border-b-stone-400 z-0"></div>
        <div className="w-32 h-6 bg-stone-500 rounded-t-lg shadow-inner"></div>
      </div>

      {/* Choices */}
      <div className="flex flex-col items-center gap-6 z-20 print:hidden h-32">
        {!isComplete ? (
          <>
            <p className="text-stone-600 font-bold mb-2">{isGerman ? "Wähle das richtige Gewicht:" : "בחרו את המשקולת הנכונה:"}</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {level.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    "w-16 h-16 rounded-2xl shadow-lg border-b-4 border-indigo-700 flex items-center justify-center text-2xl font-bold transition-all active:scale-95 active:border-b-0 active:translate-y-1",
                    selectedWeight === opt ? "bg-indigo-600 text-white scale-110" : "bg-indigo-500 text-white hover:bg-indigo-400"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="bg-emerald-100 text-emerald-700 px-6 py-3 rounded-full shadow-sm flex items-center gap-3 border border-emerald-200">
              <Trophy className="w-6 h-6" />
              <span className="font-bold text-lg">{isGerman ? "Gut gemacht! Die Waage ist im Gleichgewicht!" : "כל הכבוד! המאזניים מאוזנים!"}</span>
            </div>
            <button
              onClick={initGame}
              className="flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95"
            >
              <span className="hidden sm:inline">{isGerman ? "Nächste Aufgabe" : "תרגיל הבא"}</span>
              <span className="sm:hidden">{isGerman ? "Nächste" : "הבא"}</span>
              <Check className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </div>

    </div>
  );
}
