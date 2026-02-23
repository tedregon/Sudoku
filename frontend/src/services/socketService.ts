import { io, Socket } from 'socket.io-client';
import type { Difficulty, Puzzle, PlayerState, PlayerProgress } from '../types/game.types.js';

// Get socket URL from environment variable
// In Railway, set VITE_SOCKET_URL to your backend service URL
// Example: https://sudoku-backend-production-xxxx.up.railway.app
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
  (import.meta.env.PROD 
    ? window.location.origin.replace('sudoku-frontend', 'sudoku-backend')
    : 'http://localhost:3001');

export interface RoomJoinedEvent {
  roomCode: string;
  puzzle: Puzzle;
  difficulty: Difficulty;
  playerState: PlayerState | null;
  allPlayers: PlayerProgress[];
}

export interface RoomCreatedEvent extends RoomJoinedEvent {}

export interface MoveMadeEvent {
  playerId: string;
  cellIndex: number;
  value: number | null;
  allPlayers: PlayerProgress[];
}

export interface PuzzleRestartedEvent {
  playerId: string;
  playerState: PlayerState | null;
  allPlayers: PlayerProgress[];
}

export class SocketService {
  private socket: Socket | null = null;

  connect(): Socket {
    // If socket exists and is connected, return it
    if (this.socket?.connected) {
      return this.socket;
    }

    // If socket exists but not connected yet, return it (don't create a new one)
    // This prevents multiple socket instances from being created
    if (this.socket) {
      return this.socket;
    }

    // Only create a new socket if one doesn't exist
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      // Add reconnection options to handle transient failures gracefully
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Room events
  createRoom(difficulty: Difficulty, playerName: string): void {
    this.socket?.emit('create-room', { difficulty, playerName });
  }

  joinRoom(roomCode: string, playerName: string): void {
    // Ensure socket exists
    if (!this.socket) {
      this.connect();
    }
    
    // If socket is connected, emit immediately
    if (this.socket && this.socket.connected) {
      this.socket.emit('join-room', { roomCode, playerName });
    } else if (this.socket) {
      // Socket not connected yet, wait for connection
      this.socket.once('connect', () => {
        this.socket?.emit('join-room', { roomCode, playerName });
      });
    }
  }

  leaveRoom(): void {
    this.socket?.emit('leave-room');
  }

  updatePlayerName(newName: string): void {
    this.socket?.emit('update-player-name', { newName });
  }

  // Game events
  makeMove(cellIndex: number, value: number | null): void {
    this.socket?.emit('make-move', { cellIndex, value });
  }

  restartPuzzle(): void {
    this.socket?.emit('restart-puzzle');
  }

  // Event listeners
  onRoomCreated(callback: (data: RoomCreatedEvent) => void): void {
    this.socket?.on('room-created', callback);
  }

  onRoomJoined(callback: (data: RoomJoinedEvent) => void): void {
    this.socket?.on('room-joined', callback);
  }

  onRoomError(callback: (error: { message: string }) => void): void {
    this.socket?.on('room-error', callback);
  }

  onMoveMade(callback: (data: MoveMadeEvent) => void): void {
    this.socket?.on('move-made', callback);
  }

  onPuzzleRestarted(callback: (data: PuzzleRestartedEvent) => void): void {
    this.socket?.on('puzzle-restarted', callback);
  }

  onMoveError(callback: (error: { message: string }) => void): void {
    this.socket?.on('move-error', callback);
  }

  onPlayerJoined(callback: (data: { playerId: string; playerName: string; allPlayers: PlayerProgress[] }) => void): void {
    this.socket?.on('player-joined', callback);
  }

  onPlayerLeft(callback: (data: { playerId: string; allPlayers: PlayerProgress[] }) => void): void {
    this.socket?.on('player-left', callback);
  }

  onPlayerNameUpdated(callback: (data: { playerId: string; newName: string; allPlayers: PlayerProgress[] }) => void): void {
    this.socket?.on('player-name-updated', callback);
  }

  // Remove listeners
  off(event: string, callback?: (...args: any[]) => void): void {
    this.socket?.off(event, callback);
  }
}

export const socketService = new SocketService();
