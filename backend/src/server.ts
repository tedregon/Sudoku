import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
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

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

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

    // Join the room
    const joinedRoom = roomManager.joinRoom(roomCode, playerId, playerName);
    if (!joinedRoom) {
      socket.emit('room-error', { message: 'Failed to join room' });
      return;
    }
    room = joinedRoom;

    socket.join(roomCode);
    socketToPlayer.set(socket.id, { roomCode, playerId });

    // Send current room state to the new player
    const playerState = gameStateManager.getPlayerState(room, playerId);
    const allPlayers = gameStateManager.getAllPlayersProgress(room);

    socket.emit('room-joined', {
      roomCode: room.roomCode,
      puzzle: room.puzzle,
      difficulty: room.difficulty,
      playerState: serializePlayerState(playerState),
      allPlayers,
    });

    // Notify other players
    socket.to(roomCode).emit('player-joined', {
      playerId,
      playerName,
      allPlayers: gameStateManager.getAllPlayersProgress(room),
    });
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
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
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
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
