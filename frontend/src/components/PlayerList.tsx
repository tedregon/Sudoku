import React, { useState } from 'react';
import { ProgressBar } from './ProgressBar';
import { Timer } from './Timer';
import './PlayerList.css';
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

  const handleSave = (playerId: string) => {
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

        return (
          <div
            key={player.playerId}
            className={`player-list__item ${
              isCurrentPlayer ? 'player-list__item--current' : ''
            } ${player.completionTime !== null ? 'player-list__item--completed' : ''}`}
          >
            <div className="player-list__header">
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
                ) : (
                  <div className="player-list__name">
                    {player.playerName}
                    {isCurrentPlayer && ' (You)'}
                    {player.completionTime !== null && ' ✓'}
                  </div>
                )}
                {isCurrentPlayer && !isEditing && (
                  <button
                    className="player-list__edit-btn"
                    onClick={() => handleEditClick(player)}
                    title="Edit name"
                    aria-label="Edit name"
                  >
                    ✏️
                  </button>
                )}
              </div>
              <Timer 
                timerStartTime={player.timerStartTime} 
                completionTime={player.completionTime}
              />
            </div>
            <ProgressBar progress={player.progress} />
          </div>
        );
      })}
    </div>
  );
};
