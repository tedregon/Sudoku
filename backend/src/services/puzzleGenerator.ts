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

  private countSolutions(puzzle: (number | null)[]): number {
    // Convert flat puzzle to 2D grid
    const tempGrid = this.flatToGrid(puzzle);
    let solutionCount = 0;

    const countSolutionsRecursive = (grid: number[][]): void => {
      // Find empty cell
      let emptyRow = -1;
      let emptyCol = -1;
      for (let row = 0; row < this.size; row++) {
        for (let col = 0; col < this.size; col++) {
          if (grid[row][col] === 0) {
            emptyRow = row;
            emptyCol = col;
            break;
          }
        }
        if (emptyRow !== -1) break;
      }

      // If no empty cell, we found a solution
      if (emptyRow === -1) {
        solutionCount++;
        return;
      }

      // Try numbers 1-9
      for (let num = 1; num <= 9; num++) {
        // Check if valid
        let valid = true;
        
        // Check row
        for (let x = 0; x < this.size; x++) {
          if (grid[emptyRow][x] === num) {
            valid = false;
            break;
          }
        }
        
        if (!valid) continue;
        
        // Check column
        for (let x = 0; x < this.size; x++) {
          if (grid[x][emptyCol] === num) {
            valid = false;
            break;
          }
        }
        
        if (!valid) continue;
        
        // Check box
        const boxRow = emptyRow - (emptyRow % this.boxSize);
        const boxCol = emptyCol - (emptyCol % this.boxSize);
        for (let i = 0; i < this.boxSize; i++) {
          for (let j = 0; j < this.boxSize; j++) {
            if (grid[boxRow + i][boxCol + j] === num) {
              valid = false;
              break;
            }
          }
          if (!valid) break;
        }
        
        if (!valid) continue;

        // Place number and recurse
        grid[emptyRow][emptyCol] = num;
        countSolutionsRecursive(grid);
        
        // Optimization: stop if we found 2 solutions (not unique)
        if (solutionCount >= 2) {
          grid[emptyRow][emptyCol] = 0;
          return;
        }
        
        // Backtrack
        grid[emptyRow][emptyCol] = 0;
      }
    };

    // Create a deep copy to avoid modifying the original
    const gridCopy = tempGrid.map(row => [...row]);
    countSolutionsRecursive(gridCopy);
    
    return solutionCount;
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

  private flatToGrid(flat: (number | null)[]): number[][] {
    const grid: number[][] = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
    for (let i = 0; i < flat.length; i++) {
      const row = Math.floor(i / this.size);
      const col = i % this.size;
      grid[row][col] = flat[i] ?? 0;
    }
    return grid;
  }

  private removeCells(solution: number[], cellsToKeep: number, seed?: string): (number | null)[] {
    // Start with complete solution
    const puzzle: (number | null)[] = [...solution];
    const totalCells = puzzle.length;
    const cellsToRemove = totalCells - cellsToKeep;
    
    // Create shuffled list of all cell positions
    const indices = Array.from({ length: totalCells }, (_, i) => i);
    const random = seed ? this.seededRandom(seed) : Math.random;
    
    // Shuffle indices
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    let removedCount = 0;
    let index = 0;
    
    // Try to remove cells while maintaining uniqueness
    while (removedCount < cellsToRemove && index < indices.length) {
      const cellIndex = indices[index];
      const originalValue = puzzle[cellIndex];
      
      // Temporarily remove the cell
      puzzle[cellIndex] = null;
      
      // Check if puzzle still has unique solution
      const solutionCount = this.countSolutions(puzzle);
      
      if (solutionCount === 1) {
        // Unique solution maintained, keep the removal
        removedCount++;
      } else {
        // Multiple solutions or no solution, restore the cell
        puzzle[cellIndex] = originalValue;
      }
      
      index++;
    }
    
    // Log warning if we couldn't remove enough cells
    if (removedCount < cellsToRemove) {
      console.warn(
        `Could only remove ${removedCount} cells while maintaining uniqueness, ` +
        `requested ${cellsToRemove} cells to remove. Puzzle may have more clues than intended.`
      );
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
