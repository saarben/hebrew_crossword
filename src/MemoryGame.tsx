import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Trophy, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { WORD_LIST, WordInfo } from './words';
import { GERMAN_WORD_LIST } from './wordsGerman';

import { generateIcon } from './services/imageService';
import { getFluentEmojiUrl } from './constants/iconMapping';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type CardType = 'image' | 'text';

interface MemoryCard {
    id: string; // unique ID for React key
    word: WordInfo;
    type: CardType;
}

export default function MemoryGame({ isGerman }: { isGerman: boolean }) {
    const activeWordList = isGerman ? GERMAN_WORD_LIST : WORD_LIST;
    const [cards, setCards] = useState<MemoryCard[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [matchedWords, setMatchedWords] = useState<Set<string>>(new Set());
    const [isComplete, setIsComplete] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [isLocked, setIsLocked] = useState(false);

    const newGame = useCallback(() => {
        // Filter WORD_LIST to only include words that have a high-quality fluent emoji mapping
        // and ensure we don't have duplicate Hebrew words in the pool
        const uniqueWords = Array.from(new Map(activeWordList.map(w => [w.word, w])).values());
        const availableWords = uniqueWords.filter(w => !!getFluentEmojiUrl(w.label));

        // Pick 12 random words for 24 cards
        const shuffledWords = [...availableWords].sort(() => Math.random() - 0.5).slice(0, 12);

        // Create 2 cards per word
        const gameCards: MemoryCard[] = [];
        shuffledWords.forEach((word, idx) => {
            gameCards.push({ id: `img-${idx}`, word, type: 'image' });
            gameCards.push({ id: `txt-${idx}`, word, type: 'text' });
        });

        // Shuffle cards globally
        gameCards.sort(() => Math.random() - 0.5);

        setCards(gameCards);
        setFlippedIndices([]);
        setMatchedWords(new Set());
        setIsComplete(false);
        setIsLocked(false);
    }, []);

    useEffect(() => {
        newGame();
    }, [newGame]);

    useEffect(() => {
        // 12 word pairs = 24 cards total
        if (cards.length > 0 && matchedWords.size === 12 && !isComplete) {
            setIsComplete(true);
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
    }, [matchedWords, cards.length, isComplete]);

    const handleCardClick = (index: number) => {
        if (isLocked) return;
        if (flippedIndices.includes(index)) return; // already flipped
        if (matchedWords.has(cards[index].word.word)) return; // already matched

        const newFlipped = [...flippedIndices, index];
        setFlippedIndices(newFlipped);

        if (newFlipped.length === 2) {
            setIsLocked(true);
            const [firstIdx, secondIdx] = newFlipped;
            const firstCard = cards[firstIdx];
            const secondCard = cards[secondIdx];

            if (firstCard.word.word === secondCard.word.word) {
                // Match!
                setTimeout(() => {
                    setMatchedWords(prev => {
                        const next = new Set(prev);
                        next.add(firstCard.word.word);
                        return next;
                    });
                    setFlippedIndices([]);
                    setIsLocked(false);
                }, 500);
            } else {
                // No match - turn face down again after 1.2s delay
                setTimeout(() => {
                    setFlippedIndices([]);
                    setIsLocked(false);
                }, 1200);
            }
        }
    };

    if (cards.length === 0) return null;

    return (
        <div className="flex flex-col items-center gap-4 w-full h-[calc(100dvh-12rem)] sm:h-[calc(100dvh-16rem)] max-w-5xl mx-auto px-1 sm:px-3 pb-2" dir={isGerman ? "ltr" : "rtl"}>
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
                                <li>{isGerman ? "Drehe immer zwei Karten um." : "הפכו שני קלפים בכל פעם."}</li>
                                <li>{isGerman ? "Finde Paare aus Bild und passendem Wort." : "מצאו זוגות של תמונה והמילה המתאימה לה."}</li>
                                <li>{isGerman ? "Merke dir die Positionen und gewinne das Spiel!" : "זכרו איפה כל קלף נמצא, ונצחו את המשחק!"}</li>
                            </ul>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Status message */}
            <AnimatePresence>
                {isComplete && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center gap-3 bg-emerald-500 text-white px-6 py-3 rounded-full shadow-xl"
                    >
                        <Trophy className="w-5 h-5" />
                        <span className="font-bold text-lg">{isGerman ? "Gut gemacht! Du hast alle Paare gefunden!" : "כל הכבוד! מצאתם את כל הזוגות!"}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 grid-rows-6 sm:grid-rows-4 gap-2 sm:gap-3 w-full flex-1 min-h-0" style={{ perspective: '1000px' }}>
                {cards.map((card, idx) => {
                    const isFlipped = flippedIndices.includes(idx);
                    const isMatched = matchedWords.has(card.word.word);
                    const isRevealed = isFlipped || isMatched;

                    return (
                        <div
                            key={card.id}
                            onClick={() => handleCardClick(idx)}
                            className="relative w-full h-full group cursor-pointer"
                        >
                            <motion.div
                                className="w-full h-full relative"
                                style={{ transformStyle: 'preserve-3d' }}
                                initial={false}
                                animate={{ rotateY: isRevealed ? 180 : 0 }}
                                transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                            >
                                {/* Back of card (visible when face down) */}
                                <div
                                    className={cn(
                                        "absolute inset-0 w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500",
                                        "rounded-2xl sm:rounded-3xl shadow-lg border-2 border-emerald-300 flex items-center justify-center",
                                        "hover:shadow-xl hover:-translate-y-1 transition-all"
                                    )}
                                    style={{ backfaceVisibility: 'hidden' }}
                                >
                                    <div className="w-8 h-8 sm:w-12 sm:h-12 border-4 border-white/30 rounded-full flex items-center justify-center">
                                        <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white/50 rounded-full" />
                                    </div>
                                </div>

                                {/* Front of card (visible when flipped) */}
                                <div
                                    className={cn(
                                        "absolute inset-0 w-full h-full bg-white",
                                        "rounded-2xl sm:rounded-3xl shadow-lg border-2 flex items-center justify-center p-2 sm:p-4",
                                        isMatched ? "border-emerald-400 bg-emerald-50" : "border-stone-200"
                                    )}
                                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                >
                                    {card.type === 'image' ? (
                                        <img
                                            src={generateIcon(card.word.word, card.word.label)}
                                            alt={card.word.label}
                                            className="w-full h-full object-contain pointer-events-none select-none drop-shadow-md"
                                            draggable={false}
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <span className="text-lg sm:text-3xl font-bold text-stone-800 text-center leading-tight">
                                            {card.word.wordWithNiqqud || card.word.word}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
