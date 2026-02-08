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
    
    // Count filled cells by player
    const filled = player.moves.size;
    
    // Calculate progress percentage
    const previousProgress = player.progress;
    player.progress = totalEmpty > 0 ? Math.round((filled / totalEmpty) * 100) : 100;
    
    // Check if player just completed the puzzle (reached 100%)
    if (player.progress === 100 && previousProgress < 100 && player.timerStartTime !== null) {
      player.completionTime = Date.now();
    }
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
