import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Trophy, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { WORD_LIST, WordInfo } from './words';
import { GERMAN_WORD_LIST } from './wordsGerman';

const isGerman = typeof window !== 'undefined' && (window.location.pathname.includes('/german') || window.location.hash.includes('/german'));
const activeWordList = isGerman ? GERMAN_WORD_LIST : WORD_LIST;
import { generateIcon } from './services/imageService';
import { getFluentEmojiUrl } from './constants/iconMapping';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function BingoGame() {
    const [boardCards, setBoardCards] = useState<WordInfo[]>([]);
    const [targetWords, setTargetWords] = useState<WordInfo[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [stampedIndices, setStampedIndices] = useState<Set<number>>(new Set());
    const [isComplete, setIsComplete] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [wrongIndex, setWrongIndex] = useState<number | null>(null);

    const newGame = useCallback(() => {
        // Filter WORD_LIST to only include words that have a high-quality fluent emoji mapping
        // and ensure we don't have duplicate Hebrew words in the pool
        const uniqueWords = Array.from(new Map(activeWordList.map(w => [w.word, w])).values());
        const availableWords = uniqueWords.filter(w => !!getFluentEmojiUrl(w.label));

        // Pick 9 random words for a 3x3 grid
        const shuffledWords = [...availableWords].sort(() => Math.random() - 0.5).slice(0, 9);
        setBoardCards(shuffledWords);

        // Create the "draw pile" by shuffling those exact 9 words
        const drawPile = [...shuffledWords].sort(() => Math.random() - 0.5);
        setTargetWords(drawPile);

        setCurrentIndex(0);
        setStampedIndices(new Set());
        setIsComplete(false);
        setWrongIndex(null);
    }, []);

    useEffect(() => {
        newGame();
    }, [newGame]);

    useEffect(() => {
        if (stampedIndices.size === 9 && !isComplete) {
            setIsComplete(true);
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
    }, [stampedIndices, isComplete]);

    const handleCardClick = (index: number) => {
        if (isComplete) return;
        if (stampedIndices.has(index)) return; // already stamped

        const currentTarget = targetWords[currentIndex];
        const clickedCard = boardCards[index];

        if (clickedCard.word === currentTarget.word) {
            // Correct stamp!
            setStampedIndices(prev => {
                const next = new Set(prev);
                next.add(index);
                return next;
            });
            setCurrentIndex(prev => prev + 1);
        } else {
            // Wrong tap effect
            setWrongIndex(index);
            setTimeout(() => setWrongIndex(null), 500);
        }
    };

    const currentWordInfo = currentIndex < targetWords.length ? targetWords[currentIndex] : null;
    const currentWordDisplay = currentWordInfo ? (currentWordInfo.wordWithNiqqud || currentWordInfo.word) : '';

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto px-3 pb-12" dir={isGerman ? "ltr" : "rtl"}>
            {/* Header buttons */}
            <div className="flex items-center gap-3 w-full justify-center">
                <button
                    onClick={newGame}
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

            {/* Help section */}
            <AnimatePresence>
                {showHelp && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden w-full max-w-md mx-auto"
                    >
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-stone-600 space-y-2">
                            <p className="font-bold text-emerald-700">{isGerman ? "Wie spielt man?" : "איך משחקים?"}</p>
                            <ul className="space-y-1.5 list-disc list-inside">
                                <li>{isGerman ? "Das gesuchte Wort steht groß oben." : "המילה שצריך לחפש מופיעה בגדול למעלה."}</li>
                                <li>{isGerman ? "Finde das zum Wort passende Bild und tippe es an." : "מצאו את הציור שמתאים למילה ולחצו עליו."}</li>
                                <li>{isGerman ? "Vervollständige das ganze Brett, um zu gewinnen!" : "השלימו את כל הלוח כדי לנצח!"}</li>
                            </ul>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Target Word Display */}
            <div className="w-full flex justify-center h-24 items-center">
                <AnimatePresence mode="wait">
                    {!isComplete ? (
                        <motion.div
                            key={currentWordDisplay}
                            initial={{ opacity: 0, scale: 0.5, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.5, y: 20 }}
                            transition={{ type: "spring", bounce: 0.4 }}
                            className="bg-white px-8 py-4 rounded-3xl shadow-lg border-2 border-emerald-100"
                        >
                            <span className="text-4xl sm:text-6xl font-black text-stone-800 tracking-tight">
                                {currentWordDisplay}
                            </span>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="complete"
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="flex items-center gap-3 bg-emerald-500 text-white px-8 py-4 rounded-full shadow-xl"
                        >
                            <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />
                            <span className="font-bold text-xl sm:text-3xl">{isGerman ? "Bingo! Gut gemacht!" : "בינגו! כל הכבוד!"}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 3x3 Grid */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full aspect-square max-w-[400px]">
                {boardCards.map((card, idx) => {
                    const isStamped = stampedIndices.has(idx);
                    const isWrong = wrongIndex === idx;

                    return (
                        <motion.div
                            key={`${card.word}-${idx}`}
                            onClick={() => handleCardClick(idx)}
                            animate={isWrong ? { x: [-5, 5, -5, 5, 0] } : {}}
                            transition={{ duration: 0.3 }}
                            className={cn(
                                "relative w-full h-full cursor-pointer rounded-2xl sm:rounded-3xl border-4 transition-all duration-300",
                                isStamped 
                                    ? "bg-emerald-50 border-emerald-400 shadow-md scale-[0.98]" 
                                    : "bg-white border-stone-100 shadow-lg hover:-translate-y-1 hover:shadow-xl hover:border-emerald-200",
                                isWrong && "border-rose-400 bg-rose-50"
                            )}
                        >
                            <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-5">
                                <img
                                    src={generateIcon(card.word, card.label)}
                                    alt={card.label}
                                    className={cn(
                                        "w-full h-full object-contain pointer-events-none select-none transition-all duration-300 drop-shadow-md",
                                        isStamped && "opacity-40 grayscale-[50%]"
                                    )}
                                    draggable={false}
                                    referrerPolicy="no-referrer"
                                />
                            </div>

                            {/* Stamp Overlay */}
                            <AnimatePresence>
                                {isStamped && (
                                    <motion.div
                                        initial={{ scale: 0, opacity: 0, rotate: -45 }}
                                        animate={{ scale: 1, opacity: 1, rotate: -15 }}
                                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                    >
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border-4 border-emerald-500/50 backdrop-blur-sm shadow-xl">
                                            <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600 drop-shadow-md" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
