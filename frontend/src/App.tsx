import { useState, useEffect, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import { useGameState } from './hooks/useGameState';
import { socketService } from './services/socketService';
import { GameBoard } from './components/GameBoard';
import { NumberSelector } from './components/NumberSelector';
import { JoinRoomModal } from './components/JoinRoomModal';
import { PlayerList } from './components/PlayerList';
import { Timer } from './components/Timer';
import type { Difficulty } from './types/game.types';
import './App.css';

const DIFFICULTIES: Array<{ value: Difficulty; label: string }> = [
  { value: 'very-easy', label: 'Very Easy' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'very-hard', label: 'Very Hard' },
];

const getDifficultyLabel = (difficulty: Difficulty): string => {
  return DIFFICULTIES.find(d => d.value === difficulty)?.label || difficulty;
};

function App() {
  useSocket();
  const {
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
  } = useGameState();

  const [playerName, setPlayerName] = useState(() => {
    // Try to get name from localStorage, otherwise use default
    return localStorage.getItem('sudoku-player-name') || 'Player';
  });
  const [showJoinModal, setShowJoinModal] = useState(false);
  const hasAutoCreated = useRef(false);

  // Auto-create "Very Hard" room on mount, waiting for socket connection
  useEffect(() => {
    if (roomState || hasAutoCreated.current) {
      return;
    }

    const socket = socketService.getSocket();
    if (!socket) {
      // Socket not created yet, wait a bit and retry
      const timeoutId = setTimeout(() => {
        const retrySocket = socketService.getSocket();
        if (retrySocket && retrySocket.connected && !hasAutoCreated.current && !roomState) {
          hasAutoCreated.current = true;
          createRoom('very-hard', playerName);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }

    const tryCreateRoom = () => {
      // Re-check socket connection status and state
      const currentSocket = socketService.getSocket();
      if (currentSocket?.connected && !hasAutoCreated.current && !roomState) {
        hasAutoCreated.current = true;
        createRoom('very-hard', playerName);
      }
    };

    if (socket.connected) {
      tryCreateRoom();
    } else {
      socket.once('connect', tryCreateRoom);
    }

    return () => {
      socket.off('connect', tryCreateRoom);
    };
  }, [roomState, createRoom, playerName]);

  // Save player name to localStorage when it changes
  useEffect(() => {
    if (playerName) {
      localStorage.setItem('sudoku-player-name', playerName);
    }
  }, [playerName]);

  const handleDifficultyClick = (difficulty: Difficulty) => {
    // Leave current room if in one, then create new room
    if (roomState) {
      leaveRoom();
      // Small delay to ensure leave completes before creating new room
      setTimeout(() => {
        createRoom(difficulty, playerName);
      }, 100);
    } else {
      createRoom(difficulty, playerName);
    }
  };

  const handleJoinRoom = (roomCode: string, name: string) => {
    setPlayerName(name);
    joinRoom(roomCode, name);
  };

  const handleNumberSelect = (number: number | null) => {
    selectNumber(number);
    if (selectedCell !== null && number !== null) {
      fillCell(selectedCell, number);
    }
  };

  const handleClear = () => {
    if (selectedCell !== null) {
      clearCell(selectedCell);
      selectNumber(null);
    }
  };

  return (
    <div className="app">
      {/* App Header - Outside app_container */}
      <header className="app-header">
        <div className="app-header__content">
          <h1 className="app-header__title">Sudoku</h1>
          <div className="app-header__difficulties">
            {DIFFICULTIES.map((difficulty) => (
              <button
                key={difficulty.value}
                className="app-header__difficulty-btn"
                onClick={() => handleDifficultyClick(difficulty.value)}
              >
                {difficulty.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowJoinModal(true)}
            className="app-header__join-btn"
          >
            Join Room
          </button>
        </div>
      </header>

      {/* Join Room Modal */}
      <JoinRoomModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoin={handleJoinRoom}
      />

      {/* Main Content */}
      <div className="app__container app__container--game">
        {/* Subheader - Inside app_container */}
        {roomState && (
          <div className="app__subheader">
            <h2 className="app__subheader-title">
              {getDifficultyLabel(roomState.difficulty)}
            </h2>
            <div className="app__subheader-room-code">
              Room: <span className="app__subheader-code">{roomState.roomCode}</span>
            </div>
          </div>
        )}

        {roomState && roomState.playerState && (
          <>
            {roomState.playerState.completionTime !== null && (
              <div className="app__completion-message">
                <h2 className="app__completion-title">🎉 You Finished!</h2>
                <div className="app__completion-time">
                  Your time: <Timer 
                    timerStartTime={roomState.playerState.timerStartTime}
                    completionTime={roomState.playerState.completionTime}
                  />
                </div>
              </div>
            )}

            <div className="app__game-layout">
              <div className="app__main-content">
                <div className="app__game-area">
                  <GameBoard
                    puzzle={roomState.puzzle.grid}
                    selectedCell={selectedCell}
                    showCandidates={showCandidates}
                    getCellValue={getCellValue}
                    getCellCandidates={getCellCandidates}
                    getCellConflicts={getCellConflicts}
                    getHighlightedCells={getHighlightedCells}
                    getInvalidCells={getInvalidCells}
                    onCellClick={selectCell}
                  />

                  <div className="app__game-controls">
                    <NumberSelector
                      selectedNumber={selectedNumber}
                      hasSelectedCell={selectedCell !== null}
                      onNumberSelect={handleNumberSelect}
                      onClear={handleClear}
                    />

                    <div className="app__controls">
                      <label className="app__toggle">
                        <input
                          type="checkbox"
                          checked={showCandidates}
                          onChange={(e) => setShowCandidates(e.target.checked)}
                        />
                        <span>Show Candidates</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="app__sidebar">
                <PlayerList
                  players={roomState.allPlayers}
                  currentPlayerId={roomState.playerState?.playerId || null}
                />
              </div>
            </div>
          </>
        )}

        {error && <div className="app__error">{error}</div>}
      </div>

      {/* Footer */}
      <footer className="app__footer">
        Created by{' '}
        <a
          href="https://chipdoes.app"
          target="_blank"
          rel="noopener noreferrer"
          className="app__footer-link"
        >
          chipdoes.app
        </a>
      </footer>
    </div>
  );
}

export default App;
