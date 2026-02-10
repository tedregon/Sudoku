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
    
    // Count only valid (correct) cells filled by player
    let correctMoves = 0;
    player.moves.forEach((value, cellIndex) => {
      // Check if the move matches the solution
      if (value === room.puzzle.solution[cellIndex]) {
        correctMoves++;
      }
    });
    
    // Calculate progress percentage based on correct moves only
    const previousProgress = player.progress;
    player.progress = totalEmpty > 0 ? Math.round((correctMoves / totalEmpty) * 100) : 100;
    
    // Check if player just completed the puzzle (reached 100% AND solution is correct)
    if (player.progress === 100 && previousProgress < 100 && player.timerStartTime !== null) {
      // Validate that all filled cells match the solution
      const isCorrect = this.isSolutionCorrect(room, player);
      if (isCorrect) {
        player.completionTime = Date.now();
      } else {
        // Don't set completionTime if solution is incorrect
        // Progress can still be 100% but completionTime remains null
      }
    }
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
