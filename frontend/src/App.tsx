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
import copyIcon from './assets/img/copy.svg';
import './App.css';

const DIFFICULTIES: Array<{ value: Difficulty; label: string }> = [
  { value: 'very-easy', label: 'Very Easy' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'very-hard', label: 'Very Hard' },
];

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
    updatePlayerName,
    selectNumber,
    activateClearMode,
    fillCell,
    clearCell,
    clearModeActive,
    undo,
    canUndo,
    restartPuzzle,
    canRestartPuzzle,
    getCellValue,
    getCellCandidates,
    getCellConflicts,
    getHighlightedCells,
    getCompletedDigits,
  } = useGameState();

  const [playerName, setPlayerName] = useState(() => {
    // Try to get name from localStorage, otherwise use default
    return localStorage.getItem('sudoku-player-name') || 'Player';
  });
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCopyNotification, setShowCopyNotification] = useState(false);
  const [cellDigitFontSize, setCellDigitFontSize] = useState(1.75); // rem
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const hasAutoCreated = useRef(false);
  const hasCheckedUrlParams = useRef(false);
  const hasUrlRoomCode = useRef(false);

  // Check URL parameters for room code and auto-join (runs first, before auto-create)
  useEffect(() => {
    if (hasCheckedUrlParams.current || roomState) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    hasUrlRoomCode.current = !!roomCode;
    hasCheckedUrlParams.current = true;

    if (roomCode) {
      // Clear URL params after reading them
      window.history.replaceState({}, '', window.location.pathname);
      
      // Use joinRoom which now handles waiting for socket connection internally
      // This is more robust than manually checking socket state
      joinRoom(roomCode, playerName);
    }
  }, [joinRoom, playerName, roomState]);

  // Auto-create "Very Hard" room on mount, waiting for socket connection
  // Only runs if no URL params were found and no room exists
  useEffect(() => {
    // Don't auto-create if we're already in a room or have already auto-created
    if (roomState || hasAutoCreated.current) {
      return;
    }
    
    // Wait a bit to see if URL params will trigger a join
    const checkDelay = setTimeout(() => {
      // Double-check that we're not joining from URL and no room exists
      if (!roomState && !hasAutoCreated.current && !hasUrlRoomCode.current) {
        const socket = socketService.getSocket();
        if (!socket) {
          // Socket not created yet, wait a bit and retry
          setTimeout(() => {
            const retrySocket = socketService.getSocket();
            if (retrySocket && retrySocket.connected && !hasAutoCreated.current && !roomState) {
              hasAutoCreated.current = true;
              createRoom('very-hard', playerName);
            }
          }, 100);
          return;
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
      }
    }, 500); // Wait 500ms to see if URL join happens

    return () => {
      clearTimeout(checkDelay);
    };
  }, [roomState, createRoom, playerName]);

  // Save player name to localStorage when it changes
  useEffect(() => {
    if (playerName) {
      localStorage.setItem('sudoku-player-name', playerName);
    }
  }, [playerName]);

  // Check for a newer deployed version and prompt refresh
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version && data.version !== __APP_VERSION__) {
          setNewVersionAvailable(true);
        }
      } catch {
        // ignore
      }
    };
    const interval = setInterval(checkVersion, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };
    document.addEventListener('visibilitychange', onVisibility);
    checkVersion();
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Focus the selected cell when it changes
  useEffect(() => {
    if (selectedCell !== null) {
      // Find the cell element and focus it
      const cellElement = document.querySelector(`[data-cell-index="${selectedCell}"]`) as HTMLElement;
      if (cellElement) {
        cellElement.focus();
      }
    }
  }, [selectedCell]);

  const handleGoHome = () => {
    window.history.replaceState({}, '', window.location.pathname);
    const difficulty = roomState?.difficulty ?? 'very-hard';
    if (roomState) {
      leaveRoom();
      setTimeout(() => {
        createRoom(difficulty, playerName);
      }, 100);
    } else {
      createRoom(difficulty, playerName);
    }
  };

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

  const handleCopyRoomCode = async () => {
    if (!roomState) return;

    const roomCode = roomState.roomCode;
    
    try {
      await navigator.clipboard.writeText(roomCode);
      setShowCopyNotification(true);
      setTimeout(() => {
        setShowCopyNotification(false);
      }, 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = roomCode;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setShowCopyNotification(true);
        setTimeout(() => {
          setShowCopyNotification(false);
        }, 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy room code:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  // Digit-first: tap digit = fill mode; tap "Clear digit" = erase mode. Then tap cells to apply.
  const handleNumberSelect = (number: number | null) => {
    selectNumber(number);
  };

  const handleCellClick = (cellIndex: number) => {
    const isPrefilled = roomState?.puzzle.grid[cellIndex] !== null;
    if (isPrefilled) return;

    if (clearModeActive) {
      clearCell(cellIndex);
      return;
    }

    if (selectedNumber !== null) {
      const currentValue = getCellValue(cellIndex);
      if (currentValue === null) {
        fillCell(cellIndex, selectedNumber);
      } else if (currentValue === selectedNumber) {
        clearCell(cellIndex);
      } else {
        fillCell(cellIndex, selectedNumber);
      }
    }
  };

  const handleClearDigit = () => {
    activateClearMode();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const number = parseInt(e.key);
    if (number >= 1 && number <= 9) {
      e.preventDefault();
      selectNumber(number);
    }
  };

  return (
    <div
      className="app"
      style={{ ['--cell-digit-font-size' as string]: `${cellDigitFontSize}rem` }}
    >
      {newVersionAvailable && (
        <div className="app__new-version-banner" role="status">
          <span>New version available.</span>
          <button
            type="button"
            className="app__new-version-banner-btn"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      )}
      {/* Left navbar */}
      <nav className="app__nav">
        <div className="app__nav-content">
          <div className="app__nav-brand">
            <button
              type="button"
              className="app__nav-title app__nav-title--link"
              onClick={handleGoHome}
            >
              SudokuRivals
            </button>
            <p className="app__nav-footer">
              by{' '}
              <a
                href="https://chipdoes.app"
                target="_blank"
                rel="noopener noreferrer"
                className="app__nav-footer-link"
              >
                chipdoes.app
              </a>
            </p>
          </div>
          <div className="app__nav-difficulties">
            <label htmlFor="difficulty-select" className="app__nav-difficulty-label">
              Difficulty
            </label>
            <select
              id="difficulty-select"
              className="app__nav-difficulty-select"
              value={roomState?.difficulty ?? 'very-hard'}
              onChange={(e) => handleDifficultyClick(e.target.value as Difficulty)}
            >
              {DIFFICULTIES.map((difficulty) => (
                <option key={difficulty.value} value={difficulty.value}>
                  {difficulty.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowJoinModal(true)}
            className="app__nav-join-btn"
          >
            Join Room
          </button>
          {roomState && roomState.playerState && (
            <div className="app__nav-players">
              <PlayerList
                players={roomState.allPlayers}
                currentPlayerId={roomState.playerState?.playerId || null}
                onUpdatePlayerName={(newName) => {
                  setPlayerName(newName);
                  updatePlayerName(newName);
                }}
              />
            </div>
          )}
        </div>
      </nav>

      <div className="app__main">
      {/* Join Room Modal */}
      <JoinRoomModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoin={handleJoinRoom}
      />

      {/* Main Content */}
      <div className="app__container app__container--game">
        <div className="app__game-content">
          {/* Subheader - Inside app_container */}
          {roomState && (
            <div className="app__subheader">
              <h2 className="app__subheader-title">
                Room
              </h2>
              <div className="app__subheader-controls">
                <div className="app__copy-code-wrapper">
                  <button
                    type="button"
                    onClick={handleCopyRoomCode}
                    className="app__copy-code-trigger"
                    title="Copy room code"
                  >
                    <span className="app__subheader-code-text">{roomState.roomCode}</span>
                    <img src={copyIcon} alt="" className="app__copy-icon" aria-hidden />
                  </button>
                  {showCopyNotification && (
                    <div className="app__notification">
                      Room code copied!
                    </div>
                  )}
                </div>
                <button
                  onClick={restartPuzzle}
                  disabled={!canRestartPuzzle()}
                  className="app__button app__button--restart"
                  title="Restart puzzle"
                >
                  Restart
                </button>
              </div>
              <div className="app__subheader-messages">
                {error && <div className="app__error">{error}</div>}
                {roomState.playerState?.completionTime != null && (
                  <div className="app__completion-message">
                    <h2 className="app__completion-title">🎉 You Finished in</h2>
                    <div className="app__completion-time">
                      <Timer
                        timerStartTime={roomState.playerState.timerStartTime}
                        completionTime={roomState.playerState.completionTime}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {roomState && roomState.playerState && (
            <>
              <div className="app__game-layout">
                <div className="app__main-content">
                  <div
                    className={`app__game-area${selectedNumber !== null || clearModeActive ? ' app__game-area--digit-active' : ''}`}
                  >
                    <GameBoard
                      puzzle={roomState.puzzle.grid}
                      selectedCell={null}
                      showCandidates={showCandidates}
                      getCellValue={getCellValue}
                      getCellCandidates={getCellCandidates}
                      getCellConflicts={getCellConflicts}
                      getHighlightedCells={getHighlightedCells}
                      onCellClick={handleCellClick}
                      onKeyDown={handleKeyDown}
                    />

                    <div className="app__game-controls">
                      <NumberSelector
                        selectedNumber={selectedNumber}
                        onNumberSelect={handleNumberSelect}
                        onClearDigit={handleClearDigit}
                        isClearModeActive={clearModeActive}
                        onUndo={undo}
                        canUndo={canUndo()}
                        completedDigits={getCompletedDigits()}
                      />

                      <div className="app__controls">
                        <label className="app__toggle">
                          <input
                            type="checkbox"
                            checked={showCandidates}
                            onChange={(e) => setShowCandidates(e.target.checked)}
                          />
                          <span>Show candidates</span>
                        </label>
                        <div className="app__font-size-buttons">
                          <button
                            type="button"
                            className="app__font-size-btn"
                            onClick={() => setCellDigitFontSize((s) => Math.max(1, s - 0.25))}
                            title="Decrease cell digit size"
                          >
                            A-
                          </button>
                          <button
                            type="button"
                            className="app__font-size-btn"
                            onClick={() => setCellDigitFontSize((s) => Math.min(2.5, s + 0.25))}
                            title="Increase cell digit size"
                          >
                            A+
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default App;
