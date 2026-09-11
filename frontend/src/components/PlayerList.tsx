import React, { useState } from 'react';
import { ProgressBar } from './ProgressBar';
import type { PlayerProgress } from '../types/game.types.js';

interface PlayerListProps {
  players: PlayerProgress[];
  currentPlayerId: string | null;
  onUpdatePlayerName?: (newName: string) => void;
}

export const PlayerList: React.FC<PlayerListProps> = ({ players, currentPlayerId, onUpdatePlayerName }) => {
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleEditClick = (player: PlayerProgress) => {
    setEditingPlayerId(player.playerId);
    setEditName(player.playerName);
  };

  const handleSave = (_playerId: string) => {
    if (editName.trim() && onUpdatePlayerName) {
      onUpdatePlayerName(editName.trim());
    }
    setEditingPlayerId(null);
    setEditName('');
  };

  const handleCancel = () => {
    setEditingPlayerId(null);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, playerId: string) => {
    if (e.key === 'Enter') {
      handleSave(playerId);
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="player-list">
      <h3 className="player-list__title">Players</h3>
      {players.map((player) => {
        const isCurrentPlayer = player.playerId === currentPlayerId;
        const isEditing = editingPlayerId === player.playerId;
        const isCompleted = player.completionTime !== null;

        return (
          <div
            key={player.playerId}
            className={`player-list__item ${
              isCurrentPlayer ? 'player-list__item--current' : ''
            } ${isCompleted ? 'player-list__item--completed' : ''}`}
          >
            <div className={`player-list__header${isEditing ? ' player-list__header--editing' : ''}`}>
              <div className="player-list__name-container">
                {isEditing ? (
                  <input
                    type="text"
                    className="player-list__name-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleSave(player.playerId)}
                    onKeyDown={(e) => handleKeyDown(e, player.playerId)}
                    autoFocus
                  />
                ) : isCurrentPlayer ? (
                  <button
                    type="button"
                    className="player-list__name-button"
                    onClick={() => handleEditClick(player)}
                    title="Edit name"
                    aria-label="Edit name"
                  >
                    <span className="player-list__name">{player.playerName}</span>
                    <span className="player-list__you">(You)</span>
                    <span className="player-list__edit-icon-wrap" aria-hidden="true">
                      <svg
                        className="player-list__edit-icon"
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        focusable="false"
                      >
                        <path
                          d="M4 20h4.5L19.5 9l-4.5-4.5L4 15.5V20z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M13.5 6l4.5 4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </button>
                ) : (
                  <span className="player-list__name">{player.playerName}</span>
                )}
              </div>
              {isCompleted && !isEditing && (
                <span className="player-list__completed" title="Finished" aria-label="Finished">
                  <svg
                    className="player-list__check-icon"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </div>
            <ProgressBar
              progress={player.progress}
              timerStartTime={player.timerStartTime}
              completionTime={player.completionTime}
            />
          </div>
        );
      })}
    </div>
  );
};
