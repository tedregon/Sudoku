import type { RoomState, PlayerState, MakeMovePayload } from '../types/game.types.js';

export class GameStateManager {
  validateMove(room: RoomState, playerId: string, payload: MakeMovePayload): boolean {
    const player = room.players.get(playerId);
    if (!player) {
      return false;
    }

    const { cellIndex, value } = payload;

    // Check bounds
    if (cellIndex < 0 || cellIndex >= 81) {
      return false;
    }

    // Check if cell is pre-filled
    if (room.puzzle.grid[cellIndex] !== null) {
      return false;
    }

    // If clearing (value is null), allow it
    if (value === null || value === 0) {
      return true;
    }

    // Validate value range only (allow invalid moves, just check range)
    if (value < 1 || value > 9) {
      return false;
    }

    // Allow the move even if it conflicts - conflicts will be shown visually
    return true;
  }

  makeMove(room: RoomState, playerId: string, payload: MakeMovePayload): boolean {
    if (!this.validateMove(room, playerId, payload)) {
      return false;
    }

    const player = room.players.get(playerId);
    if (!player) {
      return false;
    }

    const { cellIndex, value } = payload;

    // Start timer on first move
    if (player.timerStartTime === null && (value !== null && value !== 0)) {
      player.timerStartTime = Date.now();
    }

    // Update move
    if (value === null || value === 0) {
      player.moves.delete(cellIndex);
    } else {
      player.moves.set(cellIndex, value);
    }

    // Update progress
    this.updateProgress(room, playerId);

    return true;
  }

  updateProgress(room: RoomState, playerId: string): void {
    const player = room.players.get(playerId);
    if (!player) {
      return;
    }

    // Count empty cells in puzzle
    const totalEmpty = room.puzzle.grid.filter(cell => cell === null).length;
    
    // Count valid (non-conflicting) cells filled by player
    let validMoves = 0;
    
    player.moves.forEach((value, cellIndex) => {
      const isValid = this.isValidMove(room, player, cellIndex, value);
      if (isValid) {
        validMoves++;
      }
    });
    
    // Calculate progress percentage based on valid (non-conflicting) moves
    const previousProgress = player.progress;
    player.progress = totalEmpty > 0 ? Math.round((validMoves / totalEmpty) * 100) : 100;
    
    // Check if player just completed the puzzle (reached 100% with all valid moves)
    if (player.progress === 100 && previousProgress < 100 && player.timerStartTime !== null) {
      // Check that all empty cells are filled and all moves are valid
      const allCellsFilled = player.moves.size === totalEmpty;
      const allMovesValid = validMoves === totalEmpty;
      
      if (allCellsFilled && allMovesValid) {
        player.completionTime = Date.now();
      }
    }
  }

  private isValidMove(room: RoomState, player: PlayerState, cellIndex: number, value: number): boolean {
    if (value < 1 || value > 9) return false;
    if (cellIndex < 0 || cellIndex >= 81) return false;
    if (room.puzzle.grid[cellIndex] !== null) return false; // Pre-filled cell

    const row = Math.floor(cellIndex / 9);
    const col = cellIndex % 9;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;

    // Build complete grid (puzzle + player moves)
    const allFilled = new Map<number, number>();
    
    // Add puzzle cells
    room.puzzle.grid.forEach((cell, idx) => {
      if (cell !== null) {
        allFilled.set(idx, cell);
      }
    });
    
    // Add player moves (excluding current cell)
    player.moves.forEach((val, idx) => {
      if (idx !== cellIndex) {
        allFilled.set(idx, val);
      }
    });

    // Check row
    for (let c = 0; c < 9; c++) {
      const idx = row * 9 + c;
      if (idx !== cellIndex && allFilled.get(idx) === value) {
        return false;
      }
    }

    // Check column
    for (let r = 0; r < 9; r++) {
      const idx = r * 9 + col;
      if (idx !== cellIndex && allFilled.get(idx) === value) {
        return false;
      }
    }

    // Check box
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const idx = (boxRow + r) * 9 + (boxCol + c);
        if (idx !== cellIndex && allFilled.get(idx) === value) {
          return false;
        }
      }
    }

    return true;
  }

  private isSolutionCorrect(room: RoomState, player: PlayerState): boolean {
    // Check that all empty cells are filled by player
    const totalEmpty = room.puzzle.grid.filter(cell => cell === null).length;
    if (player.moves.size !== totalEmpty) {
      return false; // Not all cells are filled
    }

    // Build the complete grid (puzzle + player moves)
    const completeGrid: (number | null)[] = [...room.puzzle.grid];
    player.moves.forEach((value, cellIndex) => {
      completeGrid[cellIndex] = value;
    });

    // Check that all cells match the solution
    for (let i = 0; i < 81; i++) {
      if (completeGrid[i] !== room.puzzle.solution[i]) {
        return false; // Found a mismatch
      }
    }

    return true; // All cells match the solution
  }

  getPlayerState(room: RoomState, playerId: string): PlayerState | undefined {
    return room.players.get(playerId);
  }

  getAllPlayersProgress(room: RoomState): Array<{ playerId: string; playerName: string; progress: number; timerStartTime: number | null; completionTime: number | null }> {
    const players: Array<{ playerId: string; playerName: string; progress: number; timerStartTime: number | null; completionTime: number | null }> = [];
    for (const player of room.players.values()) {
      players.push({
        playerId: player.playerId,
        playerName: player.playerName,
        progress: player.progress,
        timerStartTime: player.timerStartTime,
        completionTime: player.completionTime,
      });
    }
    return players;
  }
}
