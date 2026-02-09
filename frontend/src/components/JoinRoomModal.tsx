import React, { useState } from 'react';
import './JoinRoomModal.css';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (roomCode: string, playerName: string) => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({ isOpen, onClose, onJoin }) => {
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    const name = playerName.trim() || 'Player';
    if (code.length === 6) {
      onJoin(code, name);
      setRoomCode('');
      setPlayerName('');
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="join-room-modal" onClick={handleBackdropClick}>
      <div className="join-room-modal__content">
        <button className="join-room-modal__close" onClick={onClose}>
          ×
        </button>
        <h2 className="join-room-modal__title">Join Room</h2>
        <form onSubmit={handleSubmit} className="join-room-modal__form">
          <div className="join-room-modal__field">
            <label htmlFor="modal-player-name" className="join-room-modal__label">
              Your Name:
            </label>
            <input
              id="modal-player-name"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="join-room-modal__input"
              maxLength={20}
              autoFocus
            />
          </div>
          <div className="join-room-modal__field">
            <label htmlFor="modal-room-code" className="join-room-modal__label">
              Room Code:
            </label>
            <input
              id="modal-room-code"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="Enter 6-character code"
              className="join-room-modal__input join-room-modal__input--code"
              maxLength={6}
              pattern="[A-Z0-9]{6}"
            />
          </div>
          <button
            type="submit"
            className="join-room-modal__button"
            disabled={roomCode.length !== 6}
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
};
