import type { RoomState, Difficulty, PlayerState } from '../types/game.types.js';
import { generateRoomCode } from '../utils/roomCodeGenerator.js';
import { PuzzleGenerator } from './puzzleGenerator.js';

export class RoomManager {
  private rooms: Map<string, RoomState>;
  private puzzleGenerator: PuzzleGenerator;
  private readonly ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.rooms = new Map();
    this.puzzleGenerator = new PuzzleGenerator();
    // Cleanup expired rooms every hour
    setInterval(() => this.cleanupExpiredRooms(), 60 * 60 * 1000);
  }

  createRoom(difficulty: Difficulty, playerId: string, playerName: string): RoomState {
    let roomCode: string;
    do {
      roomCode = generateRoomCode();
    } while (this.rooms.has(roomCode));

    const puzzle = this.puzzleGenerator.generate(difficulty, roomCode);

    const room: RoomState = {
      roomCode,
      puzzle,
      difficulty,
      players: new Map(),
      createdAt: Date.now(),
    };

    // Add creator as first player
    const playerState: PlayerState = {
      playerId,
      playerName,
      moves: new Map(),
      progress: 0,
      timerStartTime: null,
      completionTime: null,
    };
    room.players.set(playerId, playerState);

    this.rooms.set(roomCode, room);
    return room;
  }

  getRoom(roomCode: string): RoomState | undefined {
    const room = this.rooms.get(roomCode);
    if (room && this.isRoomExpired(room)) {
      this.rooms.delete(roomCode);
      return undefined;
    }
    return room;
  }

  joinRoom(roomCode: string, playerId: string, playerName: string): RoomState | null {
    const room = this.getRoom(roomCode);
    if (!room) {
      return null;
    }

    // Check if player already in room
    if (room.players.has(playerId)) {
      return room;
    }

    // Add new player
    const playerState: PlayerState = {
      playerId,
      playerName,
      moves: new Map(),
      progress: 0,
      timerStartTime: null,
      completionTime: null,
    };
    room.players.set(playerId, playerState);

    return room;
  }

  leaveRoom(roomCode: string, playerId: string): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.players.delete(playerId);
      // Remove room if empty
      if (room.players.size === 0) {
        this.rooms.delete(roomCode);
      }
    }
  }

  updatePlayerName(roomCode: string, playerId: string, newName: string): boolean {
    const room = this.getRoom(roomCode);
    if (!room) {
      return false;
    }

    const player = room.players.get(playerId);
    if (!player) {
      return false;
    }

    player.playerName = newName;
    return true;
  }

  private isRoomExpired(room: RoomState): boolean {
    return Date.now() - room.createdAt > this.ROOM_EXPIRY_MS;
  }

  private cleanupExpiredRooms(): void {
    const now = Date.now();
    for (const [roomCode, room] of this.rooms.entries()) {
      if (now - room.createdAt > this.ROOM_EXPIRY_MS) {
        this.rooms.delete(roomCode);
      }
    }
  }
}
