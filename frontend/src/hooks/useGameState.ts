import { useState, useEffect, useCallback } from 'react';
import type { RoomState, PlayerProgress, Difficulty } from '../types/game.types.js';
import { socketService, type RoomJoinedEvent, type MoveMadeEvent } from '../services/socketService.js';
import { getConflicts, getCandidates, isValidMove } from '../utils/sudokuValidator.js';

export function useGameState() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const convertPlayerState = (playerState: any) => {
      if (!playerState) return null;
      return {
        ...playerState,
        moves: playerState.moves instanceof Map 
          ? playerState.moves 
          : new Map(Object.entries(playerState.moves || {}).map(([k, v]) => [Number(k), v as number])),
        completionTime: playerState.completionTime || null,
      };
    };

    const handleRoomCreated = (data: RoomJoinedEvent) => {
      setRoomState({
        roomCode: data.roomCode,
        puzzle: data.puzzle,
        difficulty: data.difficulty,
        playerState: convertPlayerState(data.playerState),
        allPlayers: data.allPlayers,
      });
      setError(null);
    };

    const handleRoomJoined = (data: RoomJoinedEvent) => {
      setRoomState({
        roomCode: data.roomCode,
        puzzle: data.puzzle,
        difficulty: data.difficulty,
        playerState: convertPlayerState(data.playerState),
        allPlayers: data.allPlayers,
      });
      setError(null);
    };

    const handleRoomError = (error: { message: string }) => {
      setError(error.message);
    };

    const handleMoveMade = (data: MoveMadeEvent) => {
      setRoomState((prev) => {
        if (!prev) return null;

        const updatedPlayers = prev.allPlayers.map((p) => {
          const updatedPlayer = data.allPlayers.find((ap) => ap.playerId === p.playerId);
          if (updatedPlayer) {
            return updatedPlayer; // Use the complete updated player object from backend
          }
          return p;
        });

        // Update local player state if it's our move
        let updatedPlayerState = prev.playerState;
        if (prev.playerState && prev.playerState.playerId === data.playerId) {
          const moves = prev.playerState.moves instanceof Map 
            ? new Map(prev.playerState.moves)
            : new Map(Object.entries(prev.playerState.moves || {}).map(([k, v]) => [Number(k), v as number]));
          
          if (data.value === null || data.value === 0) {
            moves.delete(data.cellIndex);
          } else {
            moves.set(data.cellIndex, data.value);
          }

          const playerProgress = data.allPlayers.find((p) => p.playerId === data.playerId);
          updatedPlayerState = {
            ...prev.playerState,
            moves,
            progress: playerProgress?.progress || prev.playerState.progress,
            timerStartTime: playerProgress?.timerStartTime || prev.playerState.timerStartTime,
            completionTime: playerProgress?.completionTime || prev.playerState.completionTime,
          };
        }

        return {
          ...prev,
          playerState: updatedPlayerState,
          allPlayers: updatedPlayers,
        };
      });
    };

    const handleMoveError = (error: { message: string }) => {
      setError(error.message);
    };

    const handlePlayerJoined = (data: { playerId: string; playerName: string; allPlayers: PlayerProgress[] }) => {
      setRoomState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          allPlayers: data.allPlayers,
        };
      });
    };

    const handlePlayerLeft = (data: { playerId: string; allPlayers: PlayerProgress[] }) => {
      setRoomState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          allPlayers: data.allPlayers,
        };
      });
    };

    socketService.onRoomCreated(handleRoomCreated);
    socketService.onRoomJoined(handleRoomJoined);
    socketService.onRoomError(handleRoomError);
    socketService.onMoveMade(handleMoveMade);
    socketService.onMoveError(handleMoveError);
    socketService.onPlayerJoined(handlePlayerJoined);
    socketService.onPlayerLeft(handlePlayerLeft);

    return () => {
      socketService.off('room-created', handleRoomCreated);
      socketService.off('room-joined', handleRoomJoined);
      socketService.off('room-error', handleRoomError);
      socketService.off('move-made', handleMoveMade);
      socketService.off('move-error', handleMoveError);
      socketService.off('player-joined', handlePlayerJoined);
      socketService.off('player-left', handlePlayerLeft);
    };
  }, []);

  const createRoom = useCallback((difficulty: Difficulty, playerName: string) => {
    socketService.createRoom(difficulty, playerName);
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    socketService.joinRoom(roomCode, playerName);
  }, []);

  const leaveRoom = useCallback(() => {
    socketService.leaveRoom();
    setRoomState(null);
    setSelectedCell(null);
    setSelectedNumber(null);
  }, []);

  const makeMove = useCallback((cellIndex: number, value: number | null) => {
    if (!roomState?.playerState) return;
    socketService.makeMove(cellIndex, value);
  }, [roomState]);

  const selectCell = useCallback((cellIndex: number) => {
    if (!roomState) return;
    setSelectedCell(cellIndex);
    
    // If selecting a pre-filled cell, highlight that number
    let cellValue: number | null = null;
    // Check if pre-filled
    if (roomState.puzzle.grid[cellIndex] !== null) {
      cellValue = roomState.puzzle.grid[cellIndex];
    } else if (roomState.playerState) {
      // Check player moves
      const moves = roomState.playerState.moves instanceof Map
        ? roomState.playerState.moves
        : new Map(Object.entries(roomState.playerState.moves || {}).map(([k, v]) => [Number(k), v as number]));
      cellValue = moves.get(cellIndex) || null;
    }
    
    if (cellValue !== null) {
      setSelectedNumber(cellValue);
    } else {
      setSelectedNumber(null);
    }
  }, [roomState]);

  const selectNumber = useCallback((number: number | null) => {
    setSelectedNumber(number);
  }, []);

  const fillCell = useCallback((cellIndex: number, value: number) => {
    if (!roomState?.playerState) return;
    makeMove(cellIndex, value);
  }, [roomState, makeMove]);

  const clearCell = useCallback((cellIndex: number) => {
    if (!roomState?.playerState) return;
    makeMove(cellIndex, null);
  }, [roomState, makeMove]);

  const getCellValue = useCallback((cellIndex: number): number | null => {
    if (!roomState) return null;
    // Check if pre-filled
    if (roomState.puzzle.grid[cellIndex] !== null) {
      return roomState.puzzle.grid[cellIndex];
    }
    // Check player moves
    if (!roomState.playerState) return null;
    const moves = roomState.playerState.moves instanceof Map
      ? roomState.playerState.moves
      : new Map(Object.entries(roomState.playerState.moves || {}).map(([k, v]) => [Number(k), v as number]));
    return moves.get(cellIndex) || null;
  }, [roomState]);

  const getCellCandidates = useCallback((cellIndex: number): number[] => {
    if (!roomState?.playerState) return [];
    const moves = roomState.playerState.moves instanceof Map
      ? roomState.playerState.moves
      : new Map(Object.entries(roomState.playerState.moves || {}).map(([k, v]) => [Number(k), v as number]));
    return getCandidates(roomState.puzzle.grid, cellIndex, moves);
  }, [roomState]);

  const getCellConflicts = useCallback((cellIndex: number, value: number | null): number[] => {
    if (!roomState?.playerState || !value) return [];
    const moves = roomState.playerState.moves instanceof Map
      ? roomState.playerState.moves
      : new Map(Object.entries(roomState.playerState.moves || {}).map(([k, v]) => [Number(k), v as number]));
    return getConflicts(roomState.puzzle.grid, cellIndex, value, moves);
  }, [roomState]);

  const getHighlightedCells = useCallback((): number[] => {
    if (!selectedNumber || !roomState) return [];
    const highlighted: number[] = [];
    for (let i = 0; i < 81; i++) {
      const value = getCellValue(i);
      if (value === selectedNumber) {
        highlighted.push(i);
      }
    }
    return highlighted;
  }, [selectedNumber, roomState, getCellValue]);

  const getInvalidCells = useCallback((): number[] => {
    if (!selectedNumber || !roomState || !roomState.playerState) return [];
    const invalid: number[] = [];
    const moves = roomState.playerState.moves instanceof Map
      ? roomState.playerState.moves
      : new Map(Object.entries(roomState.playerState.moves || {}).map(([k, v]) => [Number(k), v as number]));
    for (let i = 0; i < 81; i++) {
      // Skip pre-filled cells
      if (roomState.puzzle.grid[i] !== null) continue;
      // Skip cells that already have the selected number
      const value = getCellValue(i);
      if (value === selectedNumber) continue;
      // Check if this number can be placed here
      if (!isValidMove(roomState.puzzle.grid, i, selectedNumber, moves)) {
        invalid.push(i);
      }
    }
    return invalid;
  }, [selectedNumber, roomState, getCellValue]);

  return {
    roomState,
    selectedCell,
    selectedNumber,
    showCandidates,
    error,
    setShowCandidates,
    createRoom,
    joinRoom,
    leaveRoom,
    selectCell,
    selectNumber,
    fillCell,
    clearCell,
    getCellValue,
    getCellCandidates,
    getCellConflicts,
    getHighlightedCells,
    getInvalidCells,
  };
}
