export type Difficulty = 'very-easy' | 'easy' | 'medium' | 'hard' | 'very-hard';

export interface Puzzle {
  grid: (number | null)[];
  solution: number[];
}

export interface PlayerState {
  playerId: string;
  playerName: string;
  moves: Map<number, number> | Record<number, number>;
  progress: number;
  timerStartTime: number | null;
  completionTime: number | null;
}

export interface PlayerProgress {
  playerId: string;
  playerName: string;
  progress: number;
  timerStartTime: number | null;
  completionTime: number | null;
}

export interface RoomState {
  roomCode: string;
  puzzle: Puzzle;
  difficulty: Difficulty;
  playerState: PlayerState | null;
  allPlayers: PlayerProgress[];
}
