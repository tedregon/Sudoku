import { useState, useEffect, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import { useGameState } from './hooks/useGameState';
import { socketService } from './services/socketService';
import { GameBoard } from './components/GameBoard';
import { NumberSelector } from './components/NumberSelector';
import { JoinRoomModal } from './components/JoinRoomModal';
import { LoadGameModal } from './components/LoadGameModal';
import { PlayerList } from './components/PlayerList';
import { Timer } from './components/Timer';
import type { Difficulty } from './types/game.types';
import {
  createGameSave,
  type GameSave,
} from './utils/gameSaves';
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
    isConnected,
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
    entryMode,
    setEntryMode,
    fillCell,
    clearCell,
    clearCellNotes,
    toggleCellNote,
    clearModeActive,
    undo,
    canUndo,
    restartPuzzle,
    canRestartPuzzle,
    getNotesSnapshot,
    loadSavedGame,
    getCellValue,
    getCellCandidates,
    getCellNotes,
    getCellConflicts,
    getHighlightedCells,
    getCompletedDigits,
  } = useGameState();

  const [playerName, setPlayerName] = useState(() => {
    // Try to get name from localStorage, otherwise use default
    return localStorage.getItem('sudoku-player-name') || 'Player';
  });
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [gameSaves, setGameSaves] = useState<GameSave[]>([]);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  const [showCopyNotification, setShowCopyNotification] = useState(false);
  const [showReconnectedMessage, setShowReconnectedMessage] = useState(false);
  const [cellDigitFontSize, setCellDigitFontSize] = useState(1.75); // rem
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const [newVersionBannerDismissed, setNewVersionBannerDismissed] = useState(false);
  /** Hold Cmd (Mac) / Ctrl (Windows) to temporarily use Notes while Value is selected. */
  const [notesModifierHeld, setNotesModifierHeld] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const hasAutoCreated = useRef(false);
  const hasCheckedUrlParams = useRef(false);
  const hasUrlRoomCode = useRef(false);
  const prevIsConnectedRef = useRef(isConnected);
  const savesRoomCodeRef = useRef<string | null>(null);

  const effectiveEntryMode =
    entryMode === 'value' && notesModifierHeld ? 'notes' : entryMode;

  // Temporary Value → Notes while Cmd/Ctrl is held
  useEffect(() => {
    const clearModifier = () => setNotesModifierHeld(false);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') {
        setNotesModifierHeld(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control' || (!e.metaKey && !e.ctrlKey)) {
        clearModifier();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) clearModifier();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearModifier);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearModifier);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Saves belong only to the current room session; drop them on leave or room switch
  useEffect(() => {
    const nextRoomCode = roomState?.roomCode ?? null;
    if (nextRoomCode === savesRoomCodeRef.current) return;
    savesRoomCodeRef.current = nextRoomCode;
    setGameSaves([]);
    setShowLoadModal(false);
  }, [roomState?.roomCode]);

  // Close nav menu on outside click / Escape
  useEffect(() => {
    if (!navMenuOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (navMenuRef.current && !navMenuRef.current.contains(target)) {
        setNavMenuOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavMenuOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [navMenuOpen]);

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

  // Show a temporary "back online" message after we've been offline
  useEffect(() => {
    const wasConnected = prevIsConnectedRef.current;
    prevIsConnectedRef.current = isConnected;

    if (!wasConnected && isConnected) {
      setShowReconnectedMessage(true);
      const timeout = window.setTimeout(() => {
        setShowReconnectedMessage(false);
      }, 3000);
      return () => window.clearTimeout(timeout);
    }
  }, [isConnected]);

  // Try to re-join last room from localStorage (after URL check, before auto-create)
  useEffect(() => {
    if (roomState || hasUrlRoomCode.current) {
      return;
    }
    const storedCode = localStorage.getItem('sudoku-last-room-code');
    const storedName = localStorage.getItem('sudoku-last-player-name') || playerName;
    if (storedCode) {
      joinRoom(storedCode, storedName);
    }
  }, [joinRoom, playerName, roomState]);

  // Auto-create "Very Hard" room on mount only when no URL room and no stored room to try
  useEffect(() => {
    // Don't auto-create if we're already in a room or have already auto-created
    if (roomState || hasAutoCreated.current) {
      return;
    }
    // Don't auto-create if we are trying to join from URL params
    if (hasUrlRoomCode.current) {
      return;
    }
    
    // Wait a bit to see if URL or stored-room join will run first
    const checkDelay = setTimeout(() => {
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
    }, 800); // Wait for URL or stored-room join attempt

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

  const handleNewGameClick = () => {
    const difficulty = roomState?.difficulty ?? 'very-hard';
    handleDifficultyClick(difficulty);
  };

  const handleJoinRoom = (roomCode: string, name: string) => {
    setPlayerName(name);
    joinRoom(roomCode, name);
  };

  const handleSaveGame = () => {
    if (!roomState?.playerState) return;

    const movesRecord: Record<string, number> = {};
    const moves =
      roomState.playerState.moves instanceof Map
        ? roomState.playerState.moves
        : new Map(
            Object.entries(roomState.playerState.moves || {}).map(([k, v]) => [
              Number(k),
              v as number,
            ]),
          );
    moves.forEach((value, cellIndex) => {
      movesRecord[String(cellIndex)] = value;
    });

    let elapsedSeconds = 0;
    if (roomState.playerState.timerStartTime != null) {
      const end = roomState.playerState.completionTime ?? Date.now();
      elapsedSeconds = Math.max(
        0,
        Math.floor((end - roomState.playerState.timerStartTime) / 1000),
      );
    }

    const save = createGameSave(gameSaves, {
      roomCode: roomState.roomCode,
      difficulty: roomState.difficulty,
      puzzleGrid: [...roomState.puzzle.grid],
      moves: movesRecord,
      notes: getNotesSnapshot(),
      progress: roomState.playerState.progress,
      timerStartTime: roomState.playerState.timerStartTime,
      completionTime: roomState.playerState.completionTime,
      elapsedSeconds,
    });

    setGameSaves((prev) => [save, ...prev]);
    setSaveNotification(`Saved game ${save.number}`);
    window.setTimeout(() => setSaveNotification(null), 2500);
  };

  const handleLoadGame = (save: GameSave) => {
    const result = loadSavedGame(save);
    if (!result.ok) {
      setSaveNotification(result.error);
      window.setTimeout(() => setSaveNotification(null), 3500);
    }
  };

  const handleDeleteSave = (saveId: string) => {
    setGameSaves((prev) => prev.filter((save) => save.id !== saveId));
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

    if (effectiveEntryMode === 'notes') {
      if (clearModeActive) {
        clearCellNotes(cellIndex);
        return;
      }
      if (selectedNumber !== null) {
        const currentValue = getCellValue(cellIndex);
        if (currentValue !== null) return;
        toggleCellNote(cellIndex, selectedNumber);
      }
      return;
    }

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

  const showVersionBanner = newVersionAvailable && !newVersionBannerDismissed;

  return (
    <div
      className={`app${showVersionBanner ? ' app--version-banner-visible' : ''}`}
      style={{ ['--cell-digit-font-size' as string]: `${cellDigitFontSize}rem` }}
    >
      {showVersionBanner && (
        <div className="app__new-version-banner" role="status">
          <span>New version available.</span>
          <div className="app__new-version-banner-actions">
            <button
              type="button"
              className="app__new-version-banner-btn app__new-version-banner-btn--primary"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="app__new-version-banner-btn app__new-version-banner-btn--cancel"
              onClick={() => setNewVersionBannerDismissed(true)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* Left navbar */}
      <div className="app__sidebar">
        <nav className="app__nav" ref={navMenuRef}>
          <div className="app__nav-content">
            <div className="app__nav-top">
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
                    href="https://designwithchip.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="app__nav-footer-link"
                  >
                    designwithchip.com
                  </a>
                </p>
              </div>
              <button
                type="button"
                className={`app__nav-menu-toggle${navMenuOpen ? ' app__nav-menu-toggle--open' : ''}`}
                aria-expanded={navMenuOpen}
                aria-controls="app-nav-menu"
                aria-label={navMenuOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setNavMenuOpen((open) => !open)}
              >
                <span className="app__nav-menu-toggle-bar" aria-hidden="true" />
                <span className="app__nav-menu-toggle-bar" aria-hidden="true" />
                <span className="app__nav-menu-toggle-bar" aria-hidden="true" />
              </button>
            </div>
            <div
              id="app-nav-menu"
              className={`app__nav-menu${navMenuOpen ? ' app__nav-menu--open' : ''}`}
            >
              <div className="app__nav-difficulties" role="group" aria-label="Difficulty">
                <span className="app__nav-difficulty-label" id="difficulty-label">
                  Difficulty
                </span>
                <select
                  id="difficulty-select"
                  className="app__nav-difficulty-select"
                  aria-labelledby="difficulty-label"
                  value={roomState?.difficulty ?? 'very-hard'}
                  onChange={(e) => handleDifficultyClick(e.target.value as Difficulty)}
                >
                  {DIFFICULTIES.map((difficulty) => (
                    <option key={difficulty.value} value={difficulty.value}>
                      {difficulty.label}
                    </option>
                  ))}
                </select>
                <div className="app__nav-difficulty-buttons">
                  {DIFFICULTIES.map((difficulty) => {
                    const isActive = (roomState?.difficulty ?? 'very-hard') === difficulty.value;
                    return (
                      <button
                        key={difficulty.value}
                        type="button"
                        className={`app__nav-difficulty-btn${isActive ? ' app__nav-difficulty-btn--active' : ''}`}
                        aria-pressed={isActive}
                        onClick={() => {
                          handleDifficultyClick(difficulty.value);
                          setNavMenuOpen(false);
                        }}
                      >
                        {difficulty.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="app__nav-actions">
                <button
                  type="button"
                  onClick={() => {
                    handleNewGameClick();
                    setNavMenuOpen(false);
                  }}
                  className="app__nav-join-btn"
                >
                  New Game
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinModal(true);
                    setNavMenuOpen(false);
                  }}
                  className="app__nav-join-btn app__nav-join-btn--secondary"
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>
        </nav>
        {roomState && roomState.playerState && (
          <div className="app__players">
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

      <div className="app__main">
      {/* Join Room Modal */}
      <JoinRoomModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoin={handleJoinRoom}
      />
      <LoadGameModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        saves={gameSaves}
        onLoad={handleLoadGame}
        onDelete={handleDeleteSave}
      />

      {/* Main Content */}
      <div className="app__container app__container--game">
        <div className="app__game-content">
          {/* Subheader - Inside app_container */}
          {roomState && (
            <div className="app__subheader">
              <div className="app__subheader-room">
                <h2 className="app__subheader-title">
                  Room
                </h2>
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
              </div>
              <div className="app__subheader-controls">
                <button
                  type="button"
                  onClick={restartPuzzle}
                  disabled={!canRestartPuzzle()}
                  className="app__button app__button--restart"
                  title="Restart puzzle"
                  aria-label="Restart puzzle"
                >
                  <svg
                    className="app__restart-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 256 256"
                    width="20"
                    height="20"
                    fill="currentColor"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M24,128A72.08,72.08,0,0,1,96,56H204.69L194.34,45.66a8,8,0,0,1,11.32-11.32l24,24a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L204.69,72H96a56.06,56.06,0,0,0-56,56,8,8,0,0,1-16,0Zm200-8a8,8,0,0,0-8,8,56.06,56.06,0,0,1-56,56H51.31l10.35-10.34a8,8,0,0,0-11.32-11.32l-24,24a8,8,0,0,0,0,11.32l24,24a8,8,0,0,0,11.32-11.32L51.31,200H160a72.08,72.08,0,0,0,72-72A8,8,0,0,0,224,120Z" />
                  </svg>
                  <span className="app__restart-label">Restart</span>
                </button>
                <div className="app__save-load app__save-load--subheader">
                  <button
                    type="button"
                    className="app__save-load-btn app__save-load-btn--secondary"
                    onClick={handleSaveGame}
                    disabled={!roomState?.playerState}
                    title="Save game"
                    aria-label="Save game"
                  >
                    <svg
                      className="app__save-load-icon"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 256 256"
                      width="20"
                      height="20"
                      fill="currentColor"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V83.31A15.86,15.86,0,0,0,219.31,72ZM168,208H88V152h80Zm40,0H184V152a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v56H48V48H172.69L208,83.31ZM160,72a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h56A8,8,0,0,1,160,72Z" />
                    </svg>
                    <span className="app__save-load-label">Save</span>
                  </button>
                  <button
                    type="button"
                    className="app__save-load-btn app__save-load-btn--secondary"
                    onClick={() => setShowLoadModal(true)}
                    title="Load game"
                    aria-label="Load game"
                  >
                    <svg
                      className="app__save-load-icon"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 256 256"
                      width="20"
                      height="20"
                      fill="currentColor"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72ZM40,56H92.69l16,16H40ZM216,200H40V88H216Z" />
                    </svg>
                    <span className="app__save-load-label">Load</span>
                  </button>
                </div>
              </div>
              <div className="app__subheader-messages">
                {roomState && !isConnected && (
                  <div className="app__reconnecting" role="status">
                    You're offline. We're trying to reconnect you back.
                  </div>
                )}
                {roomState && isConnected && showReconnectedMessage && (
                  <div className="app__reconnecting" role="status">
                    Hooray! We're back online!
                  </div>
                )}
                {saveNotification && (
                  <div
                    className={
                      saveNotification.startsWith('Saved')
                        ? 'app__status-message'
                        : 'app__error'
                    }
                    role="status"
                  >
                    {saveNotification}
                  </div>
                )}
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
                      showCandidates={showCandidates}
                      getCellValue={getCellValue}
                      getCellCandidates={getCellCandidates}
                      getCellNotes={getCellNotes}
                      getCellConflicts={getCellConflicts}
                      getHighlightedCells={getHighlightedCells}
                      onCellClick={handleCellClick}
                      onKeyDown={handleKeyDown}
                    />

                    <div className="app__game-controls">
                      <NumberSelector
                        entryMode={effectiveEntryMode}
                        onEntryModeChange={setEntryMode}
                        selectedNumber={selectedNumber}
                        onNumberSelect={handleNumberSelect}
                        onClearDigit={handleClearDigit}
                        isClearModeActive={clearModeActive}
                        onUndo={undo}
                        canUndo={canUndo()}
                        completedDigits={getCompletedDigits()}
                      />

                      <div className="app__controls">
                        <div className="app__save-load app__save-load--controls">
                          <button
                            type="button"
                            className="app__save-load-btn app__save-load-btn--secondary"
                            onClick={handleSaveGame}
                            disabled={!roomState?.playerState}
                            title="Save game"
                            aria-label="Save game"
                          >
                            <svg
                              className="app__save-load-icon"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 256 256"
                              width="20"
                              height="20"
                              fill="currentColor"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path d="M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V83.31A15.86,15.86,0,0,0,219.31,72ZM168,208H88V152h80Zm40,0H184V152a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v56H48V48H172.69L208,83.31ZM160,72a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h56A8,8,0,0,1,160,72Z" />
                            </svg>
                            <span className="app__save-load-label">Save</span>
                          </button>
                          <button
                            type="button"
                            className="app__save-load-btn app__save-load-btn--secondary"
                            onClick={() => setShowLoadModal(true)}
                            title="Load game"
                            aria-label="Load game"
                          >
                            <svg
                              className="app__save-load-icon"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 256 256"
                              width="20"
                              height="20"
                              fill="currentColor"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path d="M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72ZM40,56H92.69l16,16H40ZM216,200H40V88H216Z" />
                            </svg>
                            <span className="app__save-load-label">Load</span>
                          </button>
                        </div>
                        <div className="app__controls-secondary">
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
