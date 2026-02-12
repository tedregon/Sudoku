import { useState, useEffect, useCallback, useRef } from 'react';
import type { RoomState, PlayerProgress, Difficulty } from '../types/game.types.js';
import { socketService, type RoomJoinedEvent, type MoveMadeEvent } from '../services/socketService.js';
import { getConflicts, getCandidates } from '../utils/sudokuValidator.js';

export function useGameState() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roomStateRef = useRef<RoomState | null>(null);
  
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

    // Set up reconnect handler
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
    socketService.onPlayerJoined(handlePlayerJoined);
    socketService.onPlayerLeft(handlePlayerLeft);
    socketService.onPlayerNameUpdated(handlePlayerNameUpdated);

    // Set up reconnect handler
    socket.on('connect', handleReconnect);
    
    // If already connected, check if we need to rejoin
    if (socket.connected) {
      handleReconnect();
    }

    return () => {
      socket.off('connect', handleReconnect);
      socketService.off('room-created', handleRoomCreated);
      socketService.off('room-joined', handleRoomJoined);
      socketService.off('room-error', handleRoomError);
      socketService.off('move-made', handleMoveMade);
      socketService.off('move-error', handleMoveError);
      socketService.off('player-joined', handlePlayerJoined);
      socketService.off('player-left', handlePlayerLeft);
      socketService.off('player-name-updated', handlePlayerNameUpdated);
    };
  }, []);

  const createRoom = useCallback((difficulty: Difficulty, playerName: string) => {
    socketService.createRoom(difficulty, playerName);
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameState.ts:180',message:'joinRoom called',data:{roomCode,playerName},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    socketService.joinRoom(roomCode, playerName);
  }, []);

  const leaveRoom = useCallback(() => {
    socketService.leaveRoom();
    setRoomState(null);
    setSelectedCell(null);
    setSelectedNumber(null);
  }, []);

  const updatePlayerName = useCallback((newName: string) => {
    socketService.updatePlayerName(newName);
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
    if (!roomState) return [];
    
    // Get the value of the selected cell (if any)
    let numberToHighlight: number | null = null;
    if (selectedCell !== null) {
      numberToHighlight = getCellValue(selectedCell);
    }
    
    // If no selected cell or selected cell is empty, use selectedNumber as fallback
    if (numberToHighlight === null) {
      numberToHighlight = selectedNumber;
    }
    
    // If still no number to highlight, return empty array
    if (numberToHighlight === null) return [];
    
    // Find all cells that contain the same number
    const highlighted: number[] = [];
    for (let i = 0; i < 81; i++) {
      const value = getCellValue(i);
      if (value === numberToHighlight) {
        highlighted.push(i);
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameState.ts:315',message:'getHighlightedCells called',data:{selectedCell,selectedNumber,numberToHighlight,highlightedCount:highlighted.length,highlightedCells:highlighted.slice(0,10)},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    return highlighted;
  }, [selectedCell, selectedNumber, roomState, getCellValue]);

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
    updatePlayerName,
    selectCell,
    selectNumber,
    fillCell,
    clearCell,
    getCellValue,
    getCellCandidates,
    getCellConflicts,
    getHighlightedCells,
  };
}
