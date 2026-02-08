export type Difficulty = 'very-easy' | 'easy' | 'medium' | 'hard' | 'very-hard';

export interface Puzzle {
  grid: (number | null)[];
  solution: number[];
}

export interface PlayerState {
  playerId: string;
  playerName: string;
  moves: Map<number, number>; // cellIndex -> value
  progress: number; // percentage of cells filled
  timerStartTime: number | null; // timestamp when timer started
  completionTime: number | null; // timestamp when puzzle was completed (100%)
}

export interface RoomState {
  roomCode: string;
  puzzle: Puzzle;
  difficulty: Difficulty;
  players: Map<string, PlayerState>;
  createdAt: number;
}

export interface MakeMovePayload {
  cellIndex: number;
  value: number | null;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
}
