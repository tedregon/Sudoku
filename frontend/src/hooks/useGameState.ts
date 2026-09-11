import { useState, useEffect, useCallback, useRef } from 'react';
import type { RoomState, PlayerProgress, Difficulty } from '../types/game.types.js';
import { socketService, type RoomJoinedEvent, type MoveMadeEvent, type PuzzleRestartedEvent } from '../services/socketService.js';
import { getConflicts, getCandidates } from '../utils/sudokuValidator.js';

const STORAGE_KEYS = {
  lastRoomCode: 'sudoku-last-room-code',
  lastPlayerName: 'sudoku-last-player-name',
  lastDifficulty: 'sudoku-last-difficulty',
} as const;

function persistRoom(roomCode: string, playerName: string, difficulty: Difficulty) {
  try {
    localStorage.setItem(STORAGE_KEYS.lastRoomCode, roomCode);
    localStorage.setItem(STORAGE_KEYS.lastPlayerName, playerName);
    localStorage.setItem(STORAGE_KEYS.lastDifficulty, difficulty);
  } catch {
    // ignore
  }
}

function clearPersistedRoom() {
  try {
    localStorage.removeItem(STORAGE_KEYS.lastRoomCode);
    localStorage.removeItem(STORAGE_KEYS.lastPlayerName);
    localStorage.removeItem(STORAGE_KEYS.lastDifficulty);
  } catch {
    // ignore
  }
}

export type EntryMode = 'value' | 'notes';

interface MoveHistoryEntry {
  cellIndex: number;
  previousValue: number | null;
  previousNotes: number[];
}

function movesMapFromPlayerState(playerState: RoomState['playerState']): Map<number, number> {
  if (!playerState) return new Map();
  return playerState.moves instanceof Map
    ? new Map(playerState.moves)
    : new Map(Object.entries(playerState.moves || {}).map(([k, v]) => [Number(k), v as number]));
}

function notesArrayFromMap(notes: Map<number, Set<number>>, cellIndex: number): number[] {
  const set = notes.get(cellIndex);
  if (!set || set.size === 0) return [];
  return Array.from(set).sort((a, b) => a - b);
}

export function useGameState() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [clearModeActive, setClearModeActive] = useState(false);
  const [entryMode, setEntryModeState] = useState<EntryMode>('value');
  const [cellNotes, setCellNotes] = useState<Map<number, Set<number>>>(() => new Map());
  const [showCandidates, setShowCandidates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Bumps when undo stack changes so the Undo button enables/disables correctly. */
  const [historyVersion, setHistoryVersion] = useState(0);
  const roomStateRef = useRef<RoomState | null>(null);
  const cellNotesRef = useRef<Map<number, Set<number>>>(new Map());
  const moveHistoryRef = useRef<MoveHistoryEntry[]>([]);
  
  // Keep roomStateRef in sync with roomState
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    cellNotesRef.current = cellNotes;
  }, [cellNotes]);

  const clearMoveHistory = useCallback(() => {
    if (moveHistoryRef.current.length === 0) return;
    moveHistoryRef.current = [];
    setHistoryVersion((v) => v + 1);
  }, []);

  const pushMoveHistory = useCallback((entry: MoveHistoryEntry) => {
    moveHistoryRef.current.push(entry);
    setHistoryVersion((v) => v + 1);
  }, []);

  const snapshotCellForHistory = useCallback((cellIndex: number): MoveHistoryEntry | null => {
    const playerState = roomStateRef.current?.playerState;
    if (!playerState) return null;
    const moves = movesMapFromPlayerState(playerState);
    return {
      cellIndex,
      previousValue: moves.get(cellIndex) ?? null,
      previousNotes: notesArrayFromMap(cellNotesRef.current, cellIndex),
    };
  }, []);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    setIsConnected(socket.connected);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

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
      const playerName = data.playerState?.playerName || 'Player';
      persistRoom(data.roomCode, playerName, data.difficulty);
      moveHistoryRef.current = [];
      setHistoryVersion((v) => v + 1);
      setCellNotes(new Map());
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
      const playerName = data.playerState?.playerName || 'Player';
      persistRoom(data.roomCode, playerName, data.difficulty);

      const prev = roomStateRef.current;
      const sameSession =
        !!prev &&
        prev.roomCode === data.roomCode &&
        prev.playerState?.playerId === data.playerState?.playerId;

      // Soft reconnect: keep undo stack and local notes. Fresh join: reset both.
      if (!sameSession) {
        moveHistoryRef.current = [];
        setHistoryVersion((v) => v + 1);
        setCellNotes(new Map());
      }

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
      // Room no longer exists (e.g. server restart) — clear persisted room and state so we don't retry
      if (error.message === 'Room not found') {
        clearPersistedRoom();
        setCellNotes(new Map());
        setRoomState(null);
        setError('Room no longer available. It may have expired or the server restarted. Create a new room or enter another code.');
      } else {
        setError(error.message);
      }
    };

    const handleMoveMade = (data: MoveMadeEvent) => {
      const ourId = roomStateRef.current?.playerState?.playerId;
      if (
        ourId &&
        data.playerId === ourId &&
        data.value !== null &&
        data.value !== 0
      ) {
        setCellNotes((prev) => {
          const next = new Map(prev);
          next.delete(data.cellIndex);
          return next;
        });
      }

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

    const handlePuzzleRestarted = (data: PuzzleRestartedEvent) => {
      const isOurRestart = roomStateRef.current?.playerState?.playerId === data.playerId;
      if (isOurRestart) {
        moveHistoryRef.current = [];
        setHistoryVersion((v) => v + 1);
        setCellNotes(new Map());
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
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
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
    clearMoveHistory();
  }, [clearMoveHistory]);

  const leaveRoom = useCallback(() => {
    socketService.leaveRoom();
    clearPersistedRoom();
    setRoomState(null);
    setSelectedNumber(null);
    setClearModeActive(false);
    setEntryModeState('value');
    setCellNotes(new Map());
    clearMoveHistory();
  }, [clearMoveHistory]);

  const updatePlayerName = useCallback((newName: string) => {
    socketService.updatePlayerName(newName);
  }, []);

  const makeMove = useCallback((cellIndex: number, value: number | null) => {
    const prev = roomStateRef.current;
    if (!prev?.playerState) return;

    // Optimistic update so undo snapshots stay correct across rapid clicks
    const moves = movesMapFromPlayerState(prev.playerState);
    if (value === null || value === 0) {
      moves.delete(cellIndex);
    } else {
      moves.set(cellIndex, value);
    }
    const next = {
      ...prev,
      playerState: {
        ...prev.playerState,
        moves,
      },
    };
    roomStateRef.current = next;
    setRoomState(next);

    socketService.makeMove(cellIndex, value);
  }, []);

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

  const setEntryMode = useCallback((mode: EntryMode) => {
    setEntryModeState(mode);
    setClearModeActive(false);
  }, []);

  const getCellNotes = useCallback(
    (cellIndex: number): number[] => {
      return notesArrayFromMap(cellNotes, cellIndex);
    },
    [cellNotes],
  );

  const restoreCellNotes = useCallback((cellIndex: number, notes: number[]) => {
    setCellNotes((prev) => {
      const next = new Map(prev);
      if (notes.length === 0) {
        if (!next.has(cellIndex)) return prev;
        next.delete(cellIndex);
      } else {
        next.set(cellIndex, new Set(notes));
      }
      cellNotesRef.current = next;
      return next;
    });
  }, []);

  const clearCellNotes = useCallback((cellIndex: number) => {
    const snapshot = snapshotCellForHistory(cellIndex);
    if (!snapshot || snapshot.previousNotes.length === 0) return;

    pushMoveHistory(snapshot);
    setCellNotes((prev) => {
      if (!prev.has(cellIndex)) return prev;
      const next = new Map(prev);
      next.delete(cellIndex);
      cellNotesRef.current = next;
      return next;
    });
  }, [snapshotCellForHistory, pushMoveHistory]);

  const toggleCellNote = useCallback(
    (cellIndex: number, digit: number) => {
      if (!roomState?.playerState) return;
      if (roomState.puzzle.grid[cellIndex] !== null) return;
      const moves = movesMapFromPlayerState(roomState.playerState);
      if (moves.get(cellIndex)) return;

      const snapshot = snapshotCellForHistory(cellIndex);
      if (snapshot) {
        pushMoveHistory(snapshot);
      }

      setCellNotes((prev) => {
        const next = new Map(prev);
        const existing = next.get(cellIndex);
        const updated = existing ? new Set(existing) : new Set<number>();
        if (updated.has(digit)) {
          updated.delete(digit);
        } else {
          updated.add(digit);
        }
        if (updated.size === 0) {
          next.delete(cellIndex);
        } else {
          next.set(cellIndex, updated);
        }
        cellNotesRef.current = next;
        return next;
      });
    },
    [roomState, snapshotCellForHistory, pushMoveHistory],
  );

  const fillCell = useCallback((cellIndex: number, value: number) => {
    if (!roomState?.playerState) return;

    const snapshot = snapshotCellForHistory(cellIndex);
    if (
      snapshot &&
      (snapshot.previousValue !== value || snapshot.previousNotes.length > 0)
    ) {
      pushMoveHistory(snapshot);
    }

    setCellNotes((prev) => {
      if (!prev.has(cellIndex)) return prev;
      const next = new Map(prev);
      next.delete(cellIndex);
      cellNotesRef.current = next;
      return next;
    });
    makeMove(cellIndex, value);
  }, [roomState, makeMove, snapshotCellForHistory, pushMoveHistory]);

  const clearCell = useCallback((cellIndex: number) => {
    if (!roomState?.playerState) return;

    const snapshot = snapshotCellForHistory(cellIndex);
    if (
      snapshot &&
      (snapshot.previousValue !== null || snapshot.previousNotes.length > 0)
    ) {
      pushMoveHistory(snapshot);
    }

    // Clearing a digit shouldn't wipe notes history tracking — cell is empty of value
    makeMove(cellIndex, null);
  }, [roomState, makeMove, snapshotCellForHistory, pushMoveHistory]);

  const undo = useCallback(() => {
    if (!roomStateRef.current?.playerState || moveHistoryRef.current.length === 0) return;

    const lastMove = moveHistoryRef.current.pop();
    if (!lastMove) return;
    setHistoryVersion((v) => v + 1);

    restoreCellNotes(lastMove.cellIndex, lastMove.previousNotes);

    const moves = movesMapFromPlayerState(roomStateRef.current.playerState);
    const currentValue = moves.get(lastMove.cellIndex) ?? null;
    if (currentValue !== lastMove.previousValue) {
      makeMove(lastMove.cellIndex, lastMove.previousValue);
    }
  }, [makeMove, restoreCellNotes]);

  const canUndo = useCallback((): boolean => {
    return historyVersion >= 0 && moveHistoryRef.current.length > 0;
  }, [historyVersion]);

  const restartPuzzle = useCallback(() => {
    if (!roomState?.playerState) return;
    clearMoveHistory();
    socketService.restartPuzzle();
  }, [roomState, clearMoveHistory]);

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
    isConnected,
    selectedNumber,
    clearModeActive,
    entryMode,
    setEntryMode,
    showCandidates,
    error,
    setShowCandidates,
    createRoom,
    joinRoom,
    leaveRoom,
    updatePlayerName,
    selectNumber,
    activateClearMode,
    fillCell,
    clearCell,
    clearCellNotes,
    toggleCellNote,
    undo,
    canUndo,
    restartPuzzle,
    canRestartPuzzle,
    getCellValue,
    getCellCandidates,
    getCellConflicts,
    getHighlightedCells,
    getCompletedDigits,
    getCellNotes,
  };
}
