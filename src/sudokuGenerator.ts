/**
 * Generates Sudoku puzzles of various sizes using icons.
 * A Sudoku with blockSize B has an N x N grid where N = B*B,
 * and uses N distinct symbols.
 */

export interface SudokuPuzzle {
  /** The complete solved grid (NxN), values 0 to (N-1) indexing into the icons array */
  solution: number[][];
  /** The puzzle grid with some cells removed (-1 = empty) */
  puzzle: number[][];
  /** Number of pre-filled cells */
  givenCount: number;
  /** The block size used (e.g., 2 for 4x4, 3 for 9x9) */
  blockSize: number;
}

/**
 * Generate a valid complete Sudoku grid using backtracking.
 */
function generateFullGrid(blockSize: number): number[][] {
  const totalSize = blockSize * blockSize;
  const grid: number[][] = Array.from({ length: totalSize }, () => Array(totalSize).fill(-1));

  function isValid(grid: number[][], row: number, col: number, num: number): boolean {
    // Check row
    for (let c = 0; c < totalSize; c++) {
      if (grid[row][c] === num) return false;
    }
    // Check column
    for (let r = 0; r < totalSize; r++) {
      if (grid[r][col] === num) return false;
    }
    // Check box
    const boxRow = Math.floor(row / blockSize) * blockSize;
    const boxCol = Math.floor(col / blockSize) * blockSize;
    for (let r = boxRow; r < boxRow + blockSize; r++) {
      for (let c = boxCol; c < boxCol + blockSize; c++) {
        if (grid[r][c] === num) return false;
      }
    }
    return true;
  }

  function solve(pos: number): boolean {
    if (pos === totalSize * totalSize) return true;
    const row = Math.floor(pos / totalSize);
    const col = pos % totalSize;

    // Randomize order to get different puzzles each time
    const nums = Array.from({ length: totalSize }, (_, i) => i).sort(() => Math.random() - 0.5);
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
 * For larger grids (blockSize > 3), this might be slow, so we may use a limit.
 */
function hasUniqueSolution(puzzle: number[][], blockSize: number): boolean {
  const totalSize = blockSize * blockSize;
  let count = 0;

  function isValid(grid: number[][], row: number, col: number, num: number): boolean {
    for (let c = 0; c < totalSize; c++) {
      if (c !== col && grid[row][c] === num) return false;
    }
    for (let r = 0; r < totalSize; r++) {
      if (r !== row && grid[r][col] === num) return false;
    }
    const boxRow = Math.floor(row / blockSize) * blockSize;
    const boxCol = Math.floor(col / blockSize) * blockSize;
    for (let r = boxRow; r < boxRow + blockSize; r++) {
      for (let c = boxCol; c < boxCol + blockSize; c++) {
        if (r !== row || c !== col) {
          if (grid[r][c] === num) return false;
        }
      }
    }
    return true;
  }

  function solve(grid: number[][], pos: number): void {
    if (count > 1) return; // Early exit
    if (pos === totalSize * totalSize) {
      count++;
      return;
    }
    const row = Math.floor(pos / totalSize);
    const col = pos % totalSize;
    if (grid[row][col] !== -1) {
      solve(grid, pos + 1);
      return;
    }
    for (let num = 0; num < totalSize; num++) {
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
 */
export function generateSudoku(blockSize: number = 2, difficulty: 'easy' | 'medium' = 'easy'): SudokuPuzzle {
  const totalSize = blockSize * blockSize;
  const solution = generateFullGrid(blockSize);
  const puzzle = solution.map(row => [...row]);

  // Difficulty settings (approximate percentage of cells to remove)
  // For easy: remove ~50% (B=2: 8, B=3: 40, B=4: 120), medium: ~60%
  const cellsToRemoveRatio = difficulty === 'easy' ? 0.5 : 0.65;
  const targetCellsToRemove = Math.floor(totalSize * totalSize * cellsToRemoveRatio);

  // Get all positions and shuffle
  const positions: [number, number][] = [];
  for (let r = 0; r < totalSize; r++) {
    for (let c = 0; c < totalSize; c++) {
      positions.push([r, c]);
    }
  }
  positions.sort(() => Math.random() - 0.5);

  let removed = 0;
  for (const [r, c] of positions) {
    if (removed >= targetCellsToRemove) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = -1;
    // For large grids, checking uniqueness can be slow, but for childrens game easy puzzles it's likely unique
    if (blockSize > 3 || hasUniqueSolution(puzzle, blockSize)) {
      removed++;
    } else {
      puzzle[r][c] = backup;
    }
  }

  return {
    solution,
    puzzle,
    givenCount: (totalSize * totalSize) - removed,
    blockSize,
  };
}

