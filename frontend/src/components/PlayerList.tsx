import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ProgressBar } from './ProgressBar';
import type { PlayerProgress } from '../types/game.types.js';

interface PlayerListProps {
  players: PlayerProgress[];
  currentPlayerId: string | null;
  onUpdatePlayerName?: (newName: string) => void;
}

export const PlayerList: React.FC<PlayerListProps> = ({
  players,
  currentPlayerId,
  onUpdatePlayerName,
}) => {
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const orderedPlayers = [...players].sort((a, b) => {
    if (a.playerId === currentPlayerId) return -1;
    if (b.playerId === currentPlayerId) return 1;
    return 0;
  });

  const editingPlayer = players.find((player) => player.playerId === editingPlayerId) ?? null;

  useEffect(() => {
    if (!editingPlayer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEditingPlayerId(null);
        setEditName('');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editingPlayer]);

  const handleEditClick = (player: PlayerProgress) => {
    setEditingPlayerId(player.playerId);
    setEditName(player.playerName);
  };

  const handleCancel = () => {
    setEditingPlayerId(null);
    setEditName('');
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const name = editName.trim();
    if (!name || !editingPlayer) return;
    if (name !== editingPlayer.playerName && onUpdatePlayerName) {
      onUpdatePlayerName(name);
    }
    setEditingPlayerId(null);
    setEditName('');
  };

  return (
    <div className="player-list">
      <h3 className="player-list__title">Players</h3>
      <div className="player-list__grid">
        {orderedPlayers.map((player) => {
          const isCurrentPlayer = player.playerId === currentPlayerId;
          const bar = (
            <ProgressBar
              progress={player.progress}
              timerStartTime={player.timerStartTime}
              completionTime={player.completionTime}
            />
          );
          const name = <span className="player-list__name">{player.playerName}</span>;

          return (
            <div
              key={player.playerId}
              className={`player-list__item${isCurrentPlayer ? ' player-list__item--current' : ''}`}
            >
              {isCurrentPlayer ? (
                <button
                  type="button"
                  className="player-list__rename"
                  onClick={() => handleEditClick(player)}
                  aria-label={`Change name, ${player.playerName}`}
                >
                  {bar}
                  {name}
                </button>
              ) : (
                <>
                  {bar}
                  <div className="player-list__name-container">{name}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {editingPlayer &&
        createPortal(
          <div
            className="join-room-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-title"
            onClick={(event) => {
              if (event.target === event.currentTarget) handleCancel();
            }}
          >
            <div className="join-room-modal__content">
              <button type="button" className="join-room-modal__close" onClick={handleCancel} aria-label="Close">
                ×
              </button>
              <h2 id="rename-title" className="join-room-modal__title">
                Change name
              </h2>
              <form onSubmit={handleSave} className="join-room-modal__form">
                <div className="join-room-modal__field">
                  <label htmlFor="rename-input" className="join-room-modal__label">
                    Your name
                  </label>
                  <input
                    id="rename-input"
                    type="text"
                    className="join-room-modal__input"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onFocus={(event) => event.target.select()}
                    maxLength={20}
                    autoFocus
                  />
                </div>
                <button type="submit" className="join-room-modal__button" disabled={!editName.trim()}>
                  Save
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
