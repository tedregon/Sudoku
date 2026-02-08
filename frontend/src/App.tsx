import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { useGameState } from './hooks/useGameState';
import { GameBoard } from './components/GameBoard';
import { NumberSelector } from './components/NumberSelector';
import { DifficultySelector } from './components/DifficultySelector';
import { RoomCodeInput } from './components/RoomCodeInput';
import { ProgressBar } from './components/ProgressBar';
import { Timer } from './components/Timer';
import { PlayerList } from './components/PlayerList';
import type { Difficulty } from './types/game.types';
import './App.css';

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

  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [playerName, setPlayerName] = useState('');

  const handleCreateRoom = () => {
    if (difficulty && playerName.trim()) {
      createRoom(difficulty, playerName.trim());
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

  // Convert player moves Map to the format expected by GameBoard
  const playerMoves = roomState?.playerState?.moves instanceof Map
    ? roomState.playerState.moves
    : new Map(Object.entries(roomState?.playerState?.moves || {}).map(([k, v]) => [Number(k), v as number]));

  if (!roomState) {
    return (
      <div className="app">
        <div className="app__container">
          <h1 className="app__title">Multiplayer Sudoku</h1>
          
          <DifficultySelector
            selectedDifficulty={difficulty}
            onDifficultySelect={(diff) => {
              setDifficulty(diff);
            }}
          />
          {difficulty && (
            <div className="app__create-section">
              <div className="app__field">
                <label htmlFor="create-player-name" className="app__label">
                  Your Name:
                </label>
                <input
                  id="create-player-name"
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="app__text-input"
                  maxLength={20}
                />
              </div>
              <button
                onClick={handleCreateRoom}
                className="app__button app__button--primary"
                disabled={!playerName.trim()}
              >
                Create Room
              </button>
            </div>
          )}

          <div className="app__divider">OR</div>

          <RoomCodeInput onJoin={handleJoinRoom} />

          {error && <div className="app__error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app__container app__container--game">
        <div className="app__header">
          <h1 className="app__title">Multiplayer Sudoku</h1>
          <button onClick={leaveRoom} className="app__button app__button--secondary">
            Leave Room
          </button>
        </div>

        <div className="app__game-layout">
          <div className="app__main-content">
            <RoomCodeInput roomCode={roomState.roomCode} onJoin={handleJoinRoom} />

            {roomState.playerState && (
              <>
                {roomState.playerState.progress === 100 && (
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
                <div className="app__progress-section">
                  <ProgressBar
                    progress={roomState.playerState.progress}
                    label="Your Progress"
                  />
                  <Timer
                    timerStartTime={roomState.playerState.timerStartTime}
                    completionTime={roomState.playerState.completionTime}
                    label="Your Time"
                  />
                </div>

                <div className="app__game-area">
                  <GameBoard
                    puzzle={roomState.puzzle.grid}
                    playerMoves={playerMoves}
                    selectedCell={selectedCell}
                    selectedNumber={selectedNumber}
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
              </>
            )}
          </div>

          <div className="app__sidebar">
            <PlayerList
              players={roomState.allPlayers}
              currentPlayerId={roomState.playerState?.playerId || null}
            />
          </div>
        </div>

        {error && <div className="app__error">{error}</div>}
      </div>
    </div>
  );
}

export default App;
