import type { Difficulty, Puzzle } from '../types/game.types.js';

const DIFFICULTY_CELL_COUNTS: Record<Difficulty, number> = {
  'very-easy': 37,
  'easy': 34,
  'medium': 31,
  'hard': 28,
  'very-hard': 24,
};

export class PuzzleGenerator {
  private grid: number[][];
  private size: number = 9;
  private boxSize: number = 3;

  constructor() {
    this.grid = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
  }

  generate(difficulty: Difficulty, seed?: string): Puzzle {
    // Reset grid for each generation
    this.grid = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
    
    // Generate complete solution
    this.fillDiagonalBoxes();
    const solved = this.solve();
    
    if (!solved) {
      throw new Error('Failed to generate valid Sudoku solution');
    }
    
    const solution = this.flattenGrid();
    
    // Create puzzle by removing cells based on difficulty
    const puzzle = this.removeCells(solution, DIFFICULTY_CELL_COUNTS[difficulty], seed);
    
    return {
      grid: puzzle,
      solution: solution,
    };
  }

  private fillDiagonalBoxes(): void {
    for (let box = 0; box < this.size; box += this.boxSize) {
      this.fillBox(box, box);
    }
  }

  private fillBox(row: number, col: number): void {
    const numbers = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let index = 0;
    
    for (let i = 0; i < this.boxSize; i++) {
      for (let j = 0; j < this.boxSize; j++) {
        this.grid[row + i][col + j] = numbers[index++];
      }
    }
  }

  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private solve(): boolean {
    const empty = this.findEmpty();
    if (!empty) {
      return true; // Puzzle solved
    }

    const [row, col] = empty;
    const numbers = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    for (const num of numbers) {
      if (this.isValid(row, col, num)) {
        this.grid[row][col] = num;

        if (this.solve()) {
          return true;
        }

        this.grid[row][col] = 0;
      }
    }

    return false;
  }

  private findEmpty(): [number, number] | null {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.grid[row][col] === 0) {
          return [row, col];
        }
      }
    }
    return null;
  }

  private isValid(row: number, col: number, num: number): boolean {
    // Check row
    for (let x = 0; x < this.size; x++) {
      if (this.grid[row][x] === num) {
        return false;
      }
    }

    // Check column
    for (let x = 0; x < this.size; x++) {
      if (this.grid[x][col] === num) {
        return false;
      }
    }

    // Check box
    const boxRow = row - (row % this.boxSize);
    const boxCol = col - (col % this.boxSize);
    for (let i = 0; i < this.boxSize; i++) {
      for (let j = 0; j < this.boxSize; j++) {
        if (this.grid[boxRow + i][boxCol + j] === num) {
          return false;
        }
      }
    }

    return true;
  }

  private flattenGrid(): number[] {
    const flat: number[] = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        flat.push(this.grid[row][col]);
      }
    }
    return flat;
  }

  private removeCells(solution: number[], cellsToKeep: number, seed?: string): (number | null)[] {
    const puzzle = [...solution];
    const totalCells = puzzle.length;
    const cellsToRemove = totalCells - cellsToKeep;
    
    // Use seed for reproducibility if provided
    let random = seed ? this.seededRandom(seed) : Math.random;
    
    const indices = Array.from({ length: totalCells }, (_, i) => i);
    // Shuffle using seeded random if seed provided
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    // Remove cells (keep first cellsToKeep indices)
    for (let i = cellsToKeep; i < indices.length; i++) {
      puzzle[indices[i]] = null;
    }
    
    return puzzle;
  }

  private seededRandom(seed: string): () => number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    let value = Math.abs(hash);
    return () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  }
}
