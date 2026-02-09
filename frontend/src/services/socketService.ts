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

export class SocketService {
  private socket: Socket | null = null;

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
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
    this.socket?.emit('join-room', { roomCode, playerName });
  }

  leaveRoom(): void {
    this.socket?.emit('leave-room');
  }

  // Game events
  makeMove(cellIndex: number, value: number | null): void {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socketService.ts:69',message:'makeMove called',data:{socketExists:!!this.socket,isConnected:this.socket?.connected||false,socketId:this.socket?.id||null,cellIndex,value},timestamp:Date.now(),runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    this.socket?.emit('make-move', { cellIndex, value });
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

  onMoveError(callback: (error: { message: string }) => void): void {
    this.socket?.on('move-error', callback);
  }

  onPlayerJoined(callback: (data: { playerId: string; playerName: string; allPlayers: PlayerProgress[] }) => void): void {
    this.socket?.on('player-joined', callback);
  }

  onPlayerLeft(callback: (data: { playerId: string; allPlayers: PlayerProgress[] }) => void): void {
    this.socket?.on('player-left', callback);
  }

  // Remove listeners
  off(event: string, callback?: (...args: any[]) => void): void {
    this.socket?.off(event, callback);
  }
}

export const socketService = new SocketService();
