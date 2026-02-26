import { useState, useEffect, useCallback, useRef } from 'react';
import type { RoomState, PlayerProgress, Difficulty } from '../types/game.types.js';
import { socketService, type RoomJoinedEvent, type MoveMadeEvent, type PuzzleRestartedEvent } from '../services/socketService.js';
import { getConflicts, getCandidates } from '../utils/sudokuValidator.js';

interface MoveHistoryEntry {
  cellIndex: number;
  previousValue: number | null;
}

export function useGameState() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [clearModeActive, setClearModeActive] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roomStateRef = useRef<RoomState | null>(null);
  const moveHistoryRef = useRef<MoveHistoryEntry[]>([]);
  
  // Keep roomStateRef in sync with roomState
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

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

    // Handle socket reconnection - rejoin room if we were in one
    const handleReconnect = () => {
      const currentRoomState = roomStateRef.current;
      if (currentRoomState && currentRoomState.playerState) {
        // Rejoin the room with the same player name
        const playerName = currentRoomState.playerState.playerName || 'Player';
        socketService.joinRoom(currentRoomState.roomCode, playerName);
      }
    };

    // Set up reconnect handler (only once)
    socket.on('connect', handleReconnect);
    
    // If already connected, check if we need to rejoin
    if (socket.connected) {
      handleReconnect();
    }

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
      // Clear move history on rejoin (can't undo moves from before disconnect)
      moveHistoryRef.current = [];
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
      
      // If this move is from another player, clear our history (we can't undo other players' moves)
      if (roomStateRef.current?.playerState && roomStateRef.current.playerState.playerId !== data.playerId) {
        moveHistoryRef.current = [];
      }
    };

    const handleMoveError = (error: { message: string }) => {
      setError(error.message);
    };

    const handlePuzzleRestarted = (data: PuzzleRestartedEvent) => {
      const isOurRestart = roomStateRef.current?.playerState?.playerId === data.playerId;
      if (isOurRestart) {
        moveHistoryRef.current = [];
      }
      setRoomState((prev) => {
        if (!prev) return null;
        const updatedPlayerState =
          prev.playerState?.playerId === data.playerId
            ? convertPlayerState(data.playerState)
            : prev.playerState;
        return {
          ...prev,
          playerState: updatedPlayerState,
          allPlayers: data.allPlayers,
        };
      });
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

    const handlePlayerNameUpdated = (data: { playerId: string; newName: string; allPlayers: PlayerProgress[] }) => {
      setRoomState((prev) => {
        if (!prev) return null;
        // Update local player state if it's our name change
        let updatedPlayerState = prev.playerState;
        if (prev.playerState && prev.playerState.playerId === data.playerId) {
          updatedPlayerState = {
            ...prev.playerState,
            playerName: data.newName,
          };
        }
        return {
          ...prev,
          playerState: updatedPlayerState,
          allPlayers: data.allPlayers,
        };
      });
    };

    socketService.onRoomCreated(handleRoomCreated);
    socketService.onRoomJoined(handleRoomJoined);
    socketService.onRoomError(handleRoomError);
    socketService.onMoveMade(handleMoveMade);
    socketService.onMoveError(handleMoveError);
    socketService.onPuzzleRestarted(handlePuzzleRestarted);
    socketService.onPlayerJoined(handlePlayerJoined);
    socketService.onPlayerLeft(handlePlayerLeft);
    socketService.onPlayerNameUpdated(handlePlayerNameUpdated);

    return () => {
      socket.off('connect', handleReconnect);
      socketService.off('room-created', handleRoomCreated);
      socketService.off('room-joined', handleRoomJoined);
      socketService.off('room-error', handleRoomError);
      socketService.off('move-made', handleMoveMade);
      socketService.off('move-error', handleMoveError);
      socketService.off('puzzle-restarted', handlePuzzleRestarted);
      socketService.off('player-joined', handlePlayerJoined);
      socketService.off('player-left', handlePlayerLeft);
      socketService.off('player-name-updated', handlePlayerNameUpdated);
    };
  }, []);

  const createRoom = useCallback((difficulty: Difficulty, playerName: string) => {
    socketService.createRoom(difficulty, playerName);
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    socketService.joinRoom(roomCode, playerName);
    moveHistoryRef.current = [];
  }, []);

  const leaveRoom = useCallback(() => {
    socketService.leaveRoom();
    setRoomState(null);
    setSelectedCell(null);
    setSelectedNumber(null);
    moveHistoryRef.current = [];
  }, []);

  const updatePlayerName = useCallback((newName: string) => {
    socketService.updatePlayerName(newName);
  }, []);

  const makeMove = useCallback((cellIndex: number, value: number | null, trackHistory: boolean = true) => {
    if (!roomState?.playerState) return;
    
    // Store the previous value before making the move (only if tracking history)
    if (trackHistory) {
      const moves = roomState.playerState.moves instanceof Map
        ? roomState.playerState.moves
        : new Map(Object.entries(roomState.playerState.moves || {}).map(([k, v]) => [Number(k), v as number]));
      const previousValue = moves.get(cellIndex) || null;
      
      // Only track history if the value is actually changing
      if (previousValue !== value) {
        moveHistoryRef.current.push({ cellIndex, previousValue });
      }
    }
    
    socketService.makeMove(cellIndex, value);
  }, [roomState]);

  const selectCell = useCallback((cellIndex: number) => {
    if (!roomState) return;
    setSelectedCell(cellIndex);
    // Do not set selectedNumber here - it is only set by the number pad / clear digit
    // (digit-first mode). Highlighting uses getCellValue(selectedCell) when selectedCell is set.
  }, [roomState]);

  const selectNumber = useCallback((number: number | null) => {
    setSelectedNumber(number);
    if (number !== null) {
      setClearModeActive(false);
    }
  }, []);

  const activateClearMode = useCallback(() => {
    setSelectedNumber(null);
    setClearModeActive(true);
  }, []);

  const fillCell = useCallback((cellIndex: number, value: number) => {
    if (!roomState?.playerState) return;
    makeMove(cellIndex, value);
  }, [roomState, makeMove]);

  const clearCell = useCallback((cellIndex: number) => {
    if (!roomState?.playerState) return;
    makeMove(cellIndex, null);
  }, [roomState, makeMove]);

  const undo = useCallback(() => {
    if (!roomState?.playerState || moveHistoryRef.current.length === 0) return;
    
    const lastMove = moveHistoryRef.current.pop();
    if (!lastMove) return;
    
    // Restore the previous value (don't track history for undo operations)
    makeMove(lastMove.cellIndex, lastMove.previousValue, false);
  }, [roomState, makeMove]);

  const canUndo = useCallback((): boolean => {
    return moveHistoryRef.current.length > 0;
  }, []);

  const restartPuzzle = useCallback(() => {
    if (!roomState?.playerState) return;
    moveHistoryRef.current = [];
    socketService.restartPuzzle();
  }, [roomState]);

  const canRestartPuzzle = useCallback((): boolean => {
    return !!roomState?.playerState;
  }, [roomState]);

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
    if (!roomState || selectedNumber === null) return [];
    // Highlight cells matching the active digit (only from number pad)
    const highlighted: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (getCellValue(i) === selectedNumber) {
        highlighted.push(i);
      }
    }
    return highlighted;
  }, [selectedNumber, roomState, getCellValue]);

  // Digits 1–9 that have all nine placed with no conflicts
  const getCompletedDigits = useCallback((): number[] => {
    if (!roomState) return [];
    const completed: number[] = [];
    for (let digit = 1; digit <= 9; digit++) {
      const indices: number[] = [];
      for (let i = 0; i < 81; i++) {
        if (getCellValue(i) === digit) indices.push(i);
      }
      if (indices.length !== 9) continue;
      const hasConflict = indices.some((i) => getCellConflicts(i, digit).length > 0);
      if (!hasConflict) completed.push(digit);
    }
    return completed;
  }, [roomState, getCellValue, getCellConflicts]);

  return {
    roomState,
    selectedCell,
    selectedNumber,
    clearModeActive,
    showCandidates,
    error,
    setShowCandidates,
    createRoom,
    joinRoom,
    leaveRoom,
    updatePlayerName,
    selectCell,
    selectNumber,
    activateClearMode,
    fillCell,
    clearCell,
    undo,
    canUndo,
    restartPuzzle,
    canRestartPuzzle,
    getCellValue,
    getCellCandidates,
    getCellConflicts,
    getHighlightedCells,
    getCompletedDigits,
  };
}
