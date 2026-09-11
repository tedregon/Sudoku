import React from 'react';
import type { GameSave } from '../utils/gameSaves.js';
import { formatSaveTime } from '../utils/gameSaves.js';

interface LoadGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  saves: GameSave[];
  onLoad: (save: GameSave) => void;
  onDelete: (saveId: string) => void;
}

export const LoadGameModal: React.FC<LoadGameModalProps> = ({
  isOpen,
  onClose,
  saves,
  onLoad,
  onDelete,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="load-game-modal" onClick={handleBackdropClick}>
      <div className="load-game-modal__content" role="dialog" aria-labelledby="load-game-title">
        <button type="button" className="load-game-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="load-game-title" className="load-game-modal__title">
          Load game
        </h2>
        {saves.length === 0 ? (
          <p className="load-game-modal__empty">No saved games yet.</p>
        ) : (
          <ul className="load-game-modal__list">
            {saves.map((save) => (
              <li key={save.id} className="load-game-modal__item">
                <button
                  type="button"
                  className="load-game-modal__load-btn"
                  onClick={() => {
                    onLoad(save);
                    onClose();
                  }}
                >
                  <span className="load-game-modal__item-header">
                    <span className="load-game-modal__item-name">{save.name}</span>
                    <span className="load-game-modal__item-progress">
                      {Math.round(save.progress)}%
                    </span>
                  </span>
                  <span className="load-game-modal__item-date">{formatSaveTime(save.savedAt)}</span>
                </button>
                <button
                  type="button"
                  className="load-game-modal__delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(save.id);
                  }}
                  aria-label={`Delete ${save.name}`}
                  title="Delete save"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
