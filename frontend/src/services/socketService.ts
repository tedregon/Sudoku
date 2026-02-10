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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socketService.ts:32',message:'connect() called',data:{socketExists:!!this.socket,isConnected:this.socket?.connected||false,socketId:this.socket?.id||null,socketUrl:SOCKET_URL},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // If socket exists and is connected, return it
    if (this.socket?.connected) {
      return this.socket;
    }

    // If socket exists but not connected yet, return it (don't create a new one)
    // This prevents multiple socket instances from being created
    if (this.socket) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socketService.ts:40',message:'Reusing existing socket (not connected yet)',data:{socketId:this.socket?.id||null},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return this.socket;
    }

    // Only create a new socket if one doesn't exist
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socketService.ts:45',message:'Creating new socket',data:{socketUrl:SOCKET_URL},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      // Add reconnection options to handle transient failures gracefully
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Add event listeners to track connection state
    this.socket.on('connect', () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socketService.ts:56',message:'Socket connected',data:{socketId:this.socket?.id||null},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    });

    this.socket.on('connect_error', (error) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socketService.ts:61',message:'Socket connect_error',data:{error:error.message||'unknown error',socketId:this.socket?.id||null},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    });

    this.socket.on('disconnect', () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socketService.ts:66',message:'Socket disconnected',data:{socketId:this.socket?.id||null},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socketService.ts:90',message:'joinRoom called',data:{roomCode,playerName,socketExists:!!this.socket,isConnected:this.socket?.connected||false,socketId:this.socket?.id||null},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Ensure socket exists
    if (!this.socket) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socketService.ts:95',message:'joinRoom: No socket, connecting first',data:{roomCode,playerName},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      this.connect();
    }
    
    // If socket is connected, emit immediately
    if (this.socket.connected) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socketService.ts:102',message:'joinRoom: Socket connected, emitting join-room',data:{roomCode,playerName},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      this.socket.emit('join-room', { roomCode, playerName });
    } else {
      // Socket not connected yet, wait for connection
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socketService.ts:107',message:'joinRoom: Socket not connected, waiting for connect event',data:{roomCode,playerName},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      this.socket.once('connect', () => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'socketService.ts:110',message:'joinRoom: Socket connected, emitting join-room',data:{roomCode,playerName},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        this.socket?.emit('join-room', { roomCode, playerName });
      });
    }
  }

  leaveRoom(): void {
    this.socket?.emit('leave-room');
  }

  // Game events
  makeMove(cellIndex: number, value: number | null): void {
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
