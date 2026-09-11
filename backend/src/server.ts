import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './services/roomManager.js';
import { GameStateManager } from './services/gameStateManager.js';
import type { MakeMovePayload, JoinRoomPayload, CreateRoomPayload, PlayerState } from './types/game.types.js';
import { clientIpFromSocket, logSocketEvent, shortUserAgent } from './socketLog.js';

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

/** Prefer a stable client UUID; fall back to socket.id for older clients. */
function resolvePlayerId(clientId: string | undefined, socketId: string): string {
  const trimmed = clientId?.trim();
  if (trimmed && trimmed.length >= 8 && trimmed.length <= 128) {
    return trimmed;
  }
  return socketId;
}

function isPlayerIdConnected(playerId: string, socketToPlayer: Map<string, { roomCode: string; playerId: string }>): boolean {
  for (const info of socketToPlayer.values()) {
    if (info.playerId === playerId) return true;
  }
  return false;
}

/** Map this socket to a logical player, taking over any prior socket for that player. */
function bindSocketToPlayer(
  socketToPlayer: Map<string, { roomCode: string; playerId: string }>,
  socketId: string,
  roomCode: string,
  playerId: string,
): void {
  for (const [sid, info] of socketToPlayer.entries()) {
    if (info.playerId === playerId && sid !== socketId) {
      socketToPlayer.delete(sid);
    }
  }
  socketToPlayer.set(socketId, { roomCode, playerId });
}

/**
 * Remove disconnected same-name slots left behind by pre-clientId reconnects
 * (socket.id-based identity). Keeps the reclaimed/current player intact.
 */
function removeDisconnectedNameOrphans(
  room: { players: Map<string, PlayerState> },
  keepPlayerId: string,
  playerName: string,
  socketToPlayer: Map<string, { roomCode: string; playerId: string }>,
): string[] {
  const removed: string[] = [];
  for (const [pid, player] of room.players.entries()) {
    if (pid === keepPlayerId) continue;
    if (player.playerName !== playerName) continue;
    if (isPlayerIdConnected(pid, socketToPlayer)) continue;
    room.players.delete(pid);
    removed.push(pid);
  }
  return removed;
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

// Store socket ID to logical player ID mapping
const socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();

io.on('connection', (socket) => {
  logSocketEvent('socket_connect', {
    socketId: socket.id,
    transport: socket.conn.transport.name,
    clientIp: clientIpFromSocket(socket),
    userAgent: shortUserAgent(socket) ?? '',
  });

  socket.on('join-room', (payload: JoinRoomPayload) => {
    const { roomCode, playerName } = payload;
    const playerId = resolvePlayerId(payload.clientId, socket.id);
    const hasStableClientId = playerId !== socket.id;

    let room = roomManager.getRoom(roomCode);

    if (!room) {
      logSocketEvent('room_join_error', {
        socketId: socket.id,
        roomCode,
        playerName,
        detail: 'room_not_found',
      });
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }

    let isNewPlayer = false;
    let actualPlayerId = playerId;
    let migratedFromId: string | null = null;

    if (room.players.has(playerId)) {
      // Same browser/client reconnecting — restore progress and take over the socket mapping
      const existing = room.players.get(playerId)!;
      existing.playerName = playerName;
      actualPlayerId = playerId;
    } else {
      // Adopt the newest disconnected same-name slot (legacy socket.id orphans or mid-deploy migrate)
      const disconnectedSameName = Array.from(room.players.values())
        .filter(
          (p) =>
            p.playerName === playerName &&
            !isPlayerIdConnected(p.playerId, socketToPlayer),
        )
        .sort((a, b) => {
          const aTime = a.timerStartTime ?? 0;
          const bTime = b.timerStartTime ?? 0;
          return bTime - aTime;
        });
      const orphanToAdopt = disconnectedSameName[0];

      if (orphanToAdopt) {
        if (hasStableClientId) {
          // Move progress onto the stable clientId, then drop the old key
          migratedFromId = orphanToAdopt.playerId;
          room.players.delete(orphanToAdopt.playerId);
          room.players.set(playerId, {
            ...orphanToAdopt,
            playerId,
            playerName,
          });
          actualPlayerId = playerId;
        } else {
          actualPlayerId = orphanToAdopt.playerId;
          orphanToAdopt.playerName = playerName;
        }
      } else {
        const joinedRoom = roomManager.joinRoom(roomCode, playerId, playerName);
        if (!joinedRoom) {
          logSocketEvent('room_join_error', {
            socketId: socket.id,
            roomCode,
            playerName,
            detail: 'join_room_failed',
          });
          socket.emit('room-error', { message: 'Failed to join room' });
          return;
        }
        room = joinedRoom;
        isNewPlayer = true;
      }
    }

    // Drop zombie duplicates from older reconnects (same name, no live socket)
    const removedOrphans = removeDisconnectedNameOrphans(
      room,
      actualPlayerId,
      playerName,
      socketToPlayer,
    );

    // If this socket was mapped to a different room/player, leave the old Socket.IO room
    const previous = socketToPlayer.get(socket.id);
    if (previous && previous.roomCode !== roomCode) {
      socket.leave(previous.roomCode);
    }

    socket.join(roomCode);
    bindSocketToPlayer(socketToPlayer, socket.id, roomCode, actualPlayerId);

    const roomAfterJoin = roomManager.getRoom(roomCode);
    const playerCount = roomAfterJoin?.players.size ?? 0;
    logSocketEvent('room_joined', {
      socketId: socket.id,
      roomCode,
      playerId: actualPlayerId,
      playerName,
      reusedLogicalPlayerId: !isNewPlayer,
      hasStableClientId,
      migratedFromId: migratedFromId ?? '',
      removedOrphanCount: removedOrphans.length,
      playerCount,
      difficulty: roomAfterJoin?.difficulty ?? '',
    });

    const playerState = gameStateManager.getPlayerState(room, actualPlayerId);
    const allPlayers = gameStateManager.getAllPlayersProgress(room);

    socket.emit('room-joined', {
      roomCode: room.roomCode,
      puzzle: room.puzzle,
      difficulty: room.difficulty,
      playerState: serializePlayerState(playerState),
      allPlayers,
    });

    if (isNewPlayer) {
      socket.to(roomCode).emit('player-joined', {
        playerId: actualPlayerId,
        playerName,
        allPlayers,
      });
    } else if (migratedFromId || removedOrphans.length > 0) {
      // Sidebar sync after identity migrate / zombie prune (clients replace from allPlayers)
      socket.to(roomCode).emit('player-left', {
        playerId: migratedFromId ?? removedOrphans[0],
        allPlayers,
      });
    }
  });

  socket.on('create-room', (payload: CreateRoomPayload) => {
    const { difficulty, playerName } = payload;
    const playerId = resolvePlayerId(payload.clientId, socket.id);

    // Drop prior room mapping for this socket if any
    const previous = socketToPlayer.get(socket.id);
    if (previous) {
      socket.leave(previous.roomCode);
    }

    const room = roomManager.createRoom(difficulty, playerId, playerName);
    socket.join(room.roomCode);
    bindSocketToPlayer(socketToPlayer, socket.id, room.roomCode, playerId);

    logSocketEvent('room_created', {
      socketId: socket.id,
      roomCode: room.roomCode,
      playerId,
      playerName,
      difficulty,
      playerCount: room.players.size,
    });

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

  socket.on('restart-puzzle', () => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      socket.emit('room-error', { message: 'Not in a room' });
      return;
    }

    const room = roomManager.getRoom(playerInfo.roomCode);
    if (!room) {
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }

    const success = gameStateManager.restartPlayerPuzzle(room, playerInfo.playerId);
    if (!success) {
      socket.emit('room-error', { message: 'Failed to restart puzzle' });
      return;
    }

    const playerState = gameStateManager.getPlayerState(room, playerInfo.playerId);
    const allPlayers = gameStateManager.getAllPlayersProgress(room);
    io.to(playerInfo.roomCode).emit('puzzle-restarted', {
      playerId: playerInfo.playerId,
      playerState: serializePlayerState(playerState),
      allPlayers,
    });
  });

  socket.on('update-player-name', (payload: { newName: string }) => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      socket.emit('room-error', { message: 'Not in a room' });
      return;
    }

    const room = roomManager.getRoom(playerInfo.roomCode);
    if (!room) {
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }

    const success = roomManager.updatePlayerName(playerInfo.roomCode, playerInfo.playerId, payload.newName);
    if (!success) {
      socket.emit('room-error', { message: 'Failed to update player name' });
      return;
    }

    // Broadcast updated player list to all players in room
    const allPlayers = gameStateManager.getAllPlayersProgress(room);
    io.to(playerInfo.roomCode).emit('player-name-updated', {
      playerId: playerInfo.playerId,
      newName: payload.newName,
      allPlayers,
    });
  });

  socket.on('leave-room', () => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (playerInfo) {
      const roomBeforeLeave = roomManager.getRoom(playerInfo.roomCode);
      const playerName = roomBeforeLeave?.players.get(playerInfo.playerId)?.playerName ?? '';
      logSocketEvent('room_leave_explicit', {
        socketId: socket.id,
        roomCode: playerInfo.roomCode,
        playerId: playerInfo.playerId,
        playerName,
        playerCountBefore: roomBeforeLeave?.players.size ?? 0,
      });
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

  socket.on('disconnect', (reason) => {
    const playerInfo = socketToPlayer.get(socket.id);
    let playerName = '';
    let roomPlayerCount = 0;
    let difficulty: string | undefined;
    if (playerInfo) {
      const room = roomManager.getRoom(playerInfo.roomCode);
      playerName = room?.players.get(playerInfo.playerId)?.playerName ?? '';
      roomPlayerCount = room?.players.size ?? 0;
      difficulty = room?.difficulty;
      // Don't call leaveRoom - preserve player state for reconnection
      // Just remove the socket mapping so they can reconnect with the same playerId
      socket.leave(playerInfo.roomCode);
      // Don't notify other players - they're just disconnected, not left
      // The player state remains in the room for reconnection
      socketToPlayer.delete(socket.id);
    }

    logSocketEvent('socket_disconnect', {
      socketId: socket.id,
      disconnectReason: reason,
      hadActiveRoomMapping: Boolean(playerInfo),
      roomCode: playerInfo?.roomCode ?? '',
      playerId: playerInfo?.playerId ?? '',
      playerName,
      roomPlayerCount,
      difficulty: difficulty ?? '',
      transportAtDisconnect: socket.conn.transport.name,
    });
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
