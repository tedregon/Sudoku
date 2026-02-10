import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { RoomManager } from './services/roomManager.js';
import { GameStateManager } from './services/gameStateManager.js';
import type { Difficulty, MakeMovePayload, JoinRoomPayload, PlayerState } from './types/game.types.js';

function serializePlayerState(playerState: PlayerState | undefined) {
  if (!playerState) return null;
  return {
    playerId: playerState.playerId,
    playerName: playerState.playerName,
    moves: Object.fromEntries(playerState.moves),
    progress: playerState.progress,
    timerStartTime: playerState.timerStartTime,
    completionTime: playerState.completionTime,
  };
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());

const roomManager = new RoomManager();
const gameStateManager = new GameStateManager();

// Store socket ID to player ID mapping
const socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();

// Helper function for safe logging
function safeLog(data: any) {
  try {
    const logPath = '/Users/chip/Documents/GitHub/Sudoku/.cursor/debug.log';
    const logDir = dirname(logPath);
    try {
      mkdirSync(logDir, { recursive: true });
    } catch (e) {
      // Directory might already exist, ignore
    }
    appendFileSync(logPath, JSON.stringify(data) + '\n');
  } catch (e) {
    // Silently fail if logging is not available (e.g., in production)
  }
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  // #region agent log
  safeLog({location:'server.ts:40',message:'Socket connected',data:{socketId:socket.id},timestamp:Date.now(),runId:'run1',hypothesisId:'A'});
  // #endregion

  socket.on('join-room', (payload: JoinRoomPayload) => {
    const { roomCode, playerName } = payload;
    const playerId = socket.id;

    let room = roomManager.getRoom(roomCode);

    if (!room) {
      // Try to join existing room first, if fails create new
      // For now, we'll require explicit room creation
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }

    // Check if this socket was previously in a room (reconnection scenario)
    // If the player was in this room before, try to find their old playerId
    let actualPlayerId = playerId;
    const existingPlayer = Array.from(room.players.values()).find(
      p => p.playerName === playerName
    );
    
    // If we find a player with the same name and they're not currently connected,
    // reuse their playerId to preserve their progress
    if (existingPlayer && !socketToPlayer.has(existingPlayer.playerId)) {
      actualPlayerId = existingPlayer.playerId;
      // Update the existing player's state (they're reconnecting)
      room.players.set(actualPlayerId, {
        ...existingPlayer,
        playerName, // Update name in case it changed
      });
    } else {
      // Join the room (will create new player or return existing)
      const joinedRoom = roomManager.joinRoom(roomCode, actualPlayerId, playerName);
      if (!joinedRoom) {
        socket.emit('room-error', { message: 'Failed to join room' });
        return;
      }
      room = joinedRoom;
    }

    socket.join(roomCode);
    socketToPlayer.set(socket.id, { roomCode, playerId: actualPlayerId });

    // Send current room state to the reconnecting player
    const playerState = gameStateManager.getPlayerState(room, actualPlayerId);
    const allPlayers = gameStateManager.getAllPlayersProgress(room);

    socket.emit('room-joined', {
      roomCode: room.roomCode,
      puzzle: room.puzzle,
      difficulty: room.difficulty,
      playerState: serializePlayerState(playerState),
      allPlayers,
    });

    // Notify other players (only if this is a new player, not a reconnection)
    if (actualPlayerId === playerId) {
      socket.to(roomCode).emit('player-joined', {
        playerId: actualPlayerId,
        playerName,
        allPlayers: gameStateManager.getAllPlayersProgress(room),
      });
    }
  });

  socket.on('create-room', (payload: { difficulty: Difficulty; playerName: string }) => {
    const { difficulty, playerName } = payload;
    const playerId = socket.id;

    const room = roomManager.createRoom(difficulty, playerId, playerName);
    socket.join(room.roomCode);
    socketToPlayer.set(socket.id, { roomCode: room.roomCode, playerId });

    const playerState = gameStateManager.getPlayerState(room, playerId);
    const allPlayers = gameStateManager.getAllPlayersProgress(room);

    socket.emit('room-created', {
      roomCode: room.roomCode,
      puzzle: room.puzzle,
      difficulty: room.difficulty,
      playerState: serializePlayerState(playerState),
      allPlayers,
    });
  });

  socket.on('make-move', (payload: MakeMovePayload) => {
    // #region agent log
    const mapEntries = Array.from(socketToPlayer.entries()).map(([k,v])=>({socketId:k,roomCode:v.roomCode,playerId:v.playerId}));
    safeLog({location:'server.ts:131',message:'make-move received',data:{socketId:socket.id,cellIndex:payload.cellIndex,value:payload.value,mapSize:socketToPlayer.size,mapEntries},timestamp:Date.now(),runId:'run1',hypothesisId:'A'});
    // #endregion
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      // #region agent log
      const mapEntries = Array.from(socketToPlayer.entries()).map(([k,v])=>({socketId:k,roomCode:v.roomCode,playerId:v.playerId}));
      safeLog({location:'server.ts:137',message:'make-move: playerInfo not found',data:{socketId:socket.id,mapSize:socketToPlayer.size,mapEntries},timestamp:Date.now(),runId:'run1',hypothesisId:'A'});
      // #endregion
      socket.emit('move-error', { message: 'Not in a room' });
      return;
    }

    const room = roomManager.getRoom(playerInfo.roomCode);
    if (!room) {
      socket.emit('move-error', { message: 'Room not found' });
      return;
    }

    const success = gameStateManager.makeMove(room, playerInfo.playerId, payload);
    if (!success) {
      socket.emit('move-error', { message: 'Invalid move' });
      return;
    }

    // Broadcast move to all players in room
    const allPlayers = gameStateManager.getAllPlayersProgress(room);
    io.to(playerInfo.roomCode).emit('move-made', {
      playerId: playerInfo.playerId,
      cellIndex: payload.cellIndex,
      value: payload.value,
      allPlayers,
    });
  });

  socket.on('leave-room', () => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (playerInfo) {
      roomManager.leaveRoom(playerInfo.roomCode, playerInfo.playerId);
      socket.leave(playerInfo.roomCode);
      
      // Notify other players
      const room = roomManager.getRoom(playerInfo.roomCode);
      if (room) {
        socket.to(playerInfo.roomCode).emit('player-left', {
          playerId: playerInfo.playerId,
          allPlayers: gameStateManager.getAllPlayersProgress(room),
        });
      }
      
      socketToPlayer.delete(socket.id);
    }
  });

  socket.on('disconnect', () => {
    // #region agent log
    safeLog({location:'server.ts:155',message:'Socket disconnect',data:{socketId:socket.id},timestamp:Date.now(),runId:'run1',hypothesisId:'B'});
    // #endregion
    const playerInfo = socketToPlayer.get(socket.id);
    if (playerInfo) {
      // #region agent log
      safeLog({location:'server.ts:160',message:'Disconnect: removing player from room',data:{socketId:socket.id,roomCode:playerInfo.roomCode,playerId:playerInfo.playerId},timestamp:Date.now(),runId:'run1',hypothesisId:'B'});
      // #endregion
      roomManager.leaveRoom(playerInfo.roomCode, playerInfo.playerId);
      socket.leave(playerInfo.roomCode);
      
      // Notify other players
      const room = roomManager.getRoom(playerInfo.roomCode);
      if (room) {
        socket.to(playerInfo.roomCode).emit('player-left', {
          playerId: playerInfo.playerId,
          allPlayers: gameStateManager.getAllPlayersProgress(room),
        });
      }
      
      socketToPlayer.delete(socket.id);
    }
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
