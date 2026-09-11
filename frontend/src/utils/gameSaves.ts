import type { Difficulty } from '../types/game.types.js';

// Previous builds persisted saves; clear so they don't linger across rooms.
try {
  localStorage.removeItem('sudoku-game-saves');
} catch {
  // ignore
}

export interface GameSave {
  id: string;
  name: string;
  number: number;
  savedAt: number;
  roomCode: string;
  difficulty: Difficulty;
  /** Clue grid used to verify the save matches the current puzzle */
  puzzleGrid: (number | null)[];
  moves: Record<string, number>;
  notes: Record<string, number[]>;
  progress: number;
  timerStartTime: number | null;
  completionTime: number | null;
  elapsedSeconds: number;
}

export function getNextSaveNumber(saves: GameSave[]): number {
  if (saves.length === 0) return 1;
  return Math.max(...saves.map((s) => s.number)) + 1;
}

export function createGameSave(
  existingSaves: GameSave[],
  input: Omit<GameSave, 'id' | 'name' | 'number' | 'savedAt'>,
): GameSave {
  const number = getNextSaveNumber(existingSaves);
  return {
    ...input,
    id: `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Game ${number}`,
    number,
    savedAt: Date.now(),
  };
}

export function gridsMatch(
  a: (number | null)[],
  b: (number | null)[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function formatSaveTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}
