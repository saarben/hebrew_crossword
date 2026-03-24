/**
 * Generates 4x4 Sudoku puzzles using icons.
 * A 4x4 Sudoku has 2x2 sub-grids and uses 4 distinct symbols.
 */

export interface SudokuPuzzle {
  /** The complete solved grid (4x4), values 0-3 indexing into the icons array */
  solution: number[][];
  /** The puzzle grid with some cells removed (-1 = empty) */
  puzzle: number[][];
  /** Number of pre-filled cells */
  givenCount: number;
}

/**
 * Generate a valid complete 4x4 Sudoku grid using backtracking.
 */
function generateFullGrid(): number[][] {
  const grid: number[][] = Array.from({ length: 4 }, () => Array(4).fill(-1));

  function isValid(grid: number[][], row: number, col: number, num: number): boolean {
    // Check row
    for (let c = 0; c < 4; c++) {
      if (grid[row][c] === num) return false;
    }
    // Check column
    for (let r = 0; r < 4; r++) {
      if (grid[r][col] === num) return false;
    }
    // Check 2x2 box
    const boxRow = Math.floor(row / 2) * 2;
    const boxCol = Math.floor(col / 2) * 2;
    for (let r = boxRow; r < boxRow + 2; r++) {
      for (let c = boxCol; c < boxCol + 2; c++) {
        if (grid[r][c] === num) return false;
      }
    }
    return true;
  }

  function solve(pos: number): boolean {
    if (pos === 16) return true;
    const row = Math.floor(pos / 4);
    const col = pos % 4;

    // Randomize order to get different puzzles each time
    const nums = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    for (const num of nums) {
      if (isValid(grid, row, col, num)) {
        grid[row][col] = num;
        if (solve(pos + 1)) return true;
        grid[row][col] = -1;
      }
    }
    return false;
  }

  solve(0);
  return grid;
}

/**
 * Check if a puzzle has a unique solution.
 */
function hasUniqueSolution(puzzle: number[][]): boolean {
  let count = 0;

  function isValid(grid: number[][], row: number, col: number, num: number): boolean {
    for (let c = 0; c < 4; c++) {
      if (c !== col && grid[row][c] === num) return false;
    }
    for (let r = 0; r < 4; r++) {
      if (r !== row && grid[r][col] === num) return false;
    }
    const boxRow = Math.floor(row / 2) * 2;
    const boxCol = Math.floor(col / 2) * 2;
    for (let r = boxRow; r < boxRow + 2; r++) {
      for (let c = boxCol; c < boxCol + 2; c++) {
        if (r !== row || c !== col) {
          if (grid[r][c] === num) return false;
        }
      }
    }
    return true;
  }

  function solve(grid: number[][], pos: number): void {
    if (count > 1) return; // Early exit
    if (pos === 16) {
      count++;
      return;
    }
    const row = Math.floor(pos / 4);
    const col = pos % 4;
    if (grid[row][col] !== -1) {
      solve(grid, pos + 1);
      return;
    }
    for (let num = 0; num < 4; num++) {
      if (isValid(grid, row, col, num)) {
        grid[row][col] = num;
        solve(grid, pos + 1);
        grid[row][col] = -1;
      }
    }
  }

  const copy = puzzle.map(row => [...row]);
  solve(copy, 0);
  return count === 1;
}

/**
 * Generate a puzzle by removing cells from a complete grid.
 * For 6-year-olds, we keep more givens (6-8 out of 16).
 */
export function generateSudoku(difficulty: 'easy' | 'medium' = 'easy'): SudokuPuzzle {
  const solution = generateFullGrid();
  const puzzle = solution.map(row => [...row]);

  // For easy: remove 8 cells (keep 8 givens), for medium: remove 10 (keep 6)
  const cellsToRemove = difficulty === 'easy' ? 8 : 10;

  // Get all positions and shuffle
  const positions: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      positions.push([r, c]);
    }
  }
  positions.sort(() => Math.random() - 0.5);

  let removed = 0;
  for (const [r, c] of positions) {
    if (removed >= cellsToRemove) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = -1;
    if (hasUniqueSolution(puzzle)) {
      removed++;
    } else {
      puzzle[r][c] = backup;
    }
  }

  return {
    solution,
    puzzle,
    givenCount: 16 - removed,
  };
}
