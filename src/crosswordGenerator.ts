import { WordInfo } from './words';

export interface GridCell {
  char?: string;
  isWordStart?: boolean;
  wordIndices?: number[]; // Indices of words that pass through this cell
  clueIcon?: any;
  clueImageUrl?: string;
  clueDirection?: 'H' | 'V';
  clueLabel?: string;
  isClue?: boolean;
}

export interface PlacedWord {
  word: string;
  x: number;
  y: number;
  direction: 'H' | 'V';
  icon: any;
  imageUrl: string;
  label: string;
}

export interface CrosswordData {
  grid: (GridCell | null)[][];
  placedWords: PlacedWord[];
  size: number;
}

export function generateCrossword(words: WordInfo[], size: number = 10): CrosswordData {
  const grid: (GridCell | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
  const placedWords: PlacedWord[] = [];

  // Sort words by length descending to place longer words first
  const sortedWords = [...words].sort((a, b) => b.word.length - a.word.length);

  for (const wordInfo of sortedWords) {
    const word = wordInfo.word;
    let bestPlacement: { x: number; y: number; direction: 'H' | 'V'; score: number } | null = null;

    // Try all possible placements
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        for (const direction of ['H', 'V'] as const) {
          const score = checkPlacement(grid, word, x, y, direction, size, placedWords);
          if (score > 0) {
            if (!bestPlacement || score > bestPlacement.score) {
              bestPlacement = { x, y, direction, score };
            }
          }
        }
      }
    }

    if (bestPlacement) {
      placeWord(grid, wordInfo, bestPlacement.x, bestPlacement.y, bestPlacement.direction, placedWords.length);
      placedWords.push({
        word,
        x: bestPlacement.x,
        y: bestPlacement.y,
        direction: bestPlacement.direction,
        icon: wordInfo.icon,
        imageUrl: wordInfo.imageUrl,
        label: wordInfo.label
      });
    }
  }

  return { grid, placedWords, size };
}

function checkPlacement(grid: (GridCell | null)[][], word: string, x: number, y: number, direction: 'H' | 'V', size: number, placedWords: PlacedWord[]): number {
  if (direction === 'H' && x + word.length > size) return -1;
  if (direction === 'V' && y + word.length > size) return -1;

  // Rule: Only one definition (word) per line (row for H, column for V)
  if (direction === 'H') {
    if (placedWords.some(pw => pw.y === y && pw.direction === 'H')) return -1;
  } else {
    if (placedWords.some(pw => pw.x === x && pw.direction === 'V')) return -1;
  }

  // Tashbetz Rule: Clue needs its own cell before the word
  const clueX = direction === 'H' ? x - 1 : x;
  const clueY = direction === 'V' ? y - 1 : y;
  
  if (!isValidCoord(clueX, clueY, size)) return -1;
  if (grid[clueY][clueX] !== null) return -1;

  let score = 0;
  let intersections = 0;

  for (let i = 0; i < word.length; i++) {
    const curX = direction === 'H' ? x + i : x;
    const curY = direction === 'V' ? y + i : y;
    const cell = grid[curY][curX];

    if (cell) {
      if (cell.char !== word[i]) return -1; // Conflict
      intersections++;
    } else {
      // Check neighbors to avoid adjacent words (unless they intersect)
      if (hasIllegalNeighbors(grid, word, x, y, direction, i, size)) return -1;
    }
  }

  // If no intersections and not the first word, lower priority
  if (intersections === 0 && grid.some(row => row.some(c => c !== null))) {
    score = 1; 
  } else {
    score = intersections * 10 + 5;
  }

  return score;
}

function hasIllegalNeighbors(grid: (GridCell | null)[][], word: string, x: number, y: number, direction: 'H' | 'V', index: number, size: number): boolean {
  const curX = direction === 'H' ? x + index : x;
  const curY = direction === 'V' ? y + index : y;

  // Check start and end of word
  if (index === 0) {
    const prevX = direction === 'H' ? curX - 1 : curX;
    const prevY = direction === 'V' ? curY - 1 : curY;
    if (isValidCoord(prevX, prevY, size) && grid[prevY][prevX]) return true;
  }
  if (index === word.length - 1) {
    const nextX = direction === 'H' ? curX + 1 : curX;
    const nextY = direction === 'V' ? curY + 1 : curY;
    if (isValidCoord(nextX, nextY, size) && grid[nextY][nextX]) return true;
  }

  // Check sides
  const neighbors = direction === 'H' 
    ? [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }] 
    : [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }];

  for (const { dx, dy } of neighbors) {
    const nx = curX + dx;
    const ny = curY + dy;
    if (isValidCoord(nx, ny, size) && grid[ny][nx]) return true;
  }

  return false;
}

function isValidCoord(x: number, y: number, size: number) {
  return x >= 0 && x < size && y >= 0 && y < size;
}

function placeWord(grid: (GridCell | null)[][], wordInfo: WordInfo, x: number, y: number, direction: 'H' | 'V', wordIndex: number) {
  const word = wordInfo.word;
  
  // Place clue cell
  const clueX = direction === 'H' ? x - 1 : x;
  const clueY = direction === 'V' ? y - 1 : y;
  grid[clueY][clueX] = {
    isClue: true,
    clueIcon: wordInfo.icon,
    clueImageUrl: wordInfo.imageUrl,
    clueDirection: direction,
    clueLabel: wordInfo.label
  };

  for (let i = 0; i < word.length; i++) {
    const curX = direction === 'H' ? x + i : x;
    const curY = direction === 'V' ? y + i : y;

    if (!grid[curY][curX]) {
      grid[curY][curX] = {
        char: word[i],
        isWordStart: i === 0,
        wordIndices: [wordIndex],
      };
    } else {
      grid[curY][curX]!.wordIndices!.push(wordIndex);
    }
  }
}

// Remove the unused placedWordsCount function
