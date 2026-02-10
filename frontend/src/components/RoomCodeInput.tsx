import React, { useState } from 'react';

interface RoomCodeInputProps {
  onJoin: (roomCode: string, playerName: string) => void;
  roomCode?: string;
}

export const RoomCodeInput: React.FC<RoomCodeInputProps> = ({ onJoin, roomCode }) => {
  const [inputCode, setInputCode] = useState('');
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = inputCode.trim().toUpperCase();
    const name = playerName.trim() || 'Player';
    if (code.length === 6) {
      onJoin(code, name);
    }
  };

  return (
    <div className="room-code-input">
      {roomCode ? (
        <div className="room-code-input__display">
          <label className="room-code-input__label">Room Code:</label>
          <div className="room-code-input__code">{roomCode}</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="room-code-input__form">
          <div className="room-code-input__field">
            <label htmlFor="player-name" className="room-code-input__label">
              Your Name:
            </label>
            <input
              id="player-name"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="room-code-input__text-input"
              maxLength={20}
            />
          </div>
          <div className="room-code-input__field">
            <label htmlFor="room-code" className="room-code-input__label">
              Room Code:
            </label>
            <input
              id="room-code"
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="Enter 6-character code"
              className="room-code-input__text-input room-code-input__text-input--code"
              maxLength={6}
              pattern="[A-Z0-9]{6}"
            />
          </div>
          <button
            type="submit"
            className="room-code-input__button"
            disabled={inputCode.length !== 6}
          >
            Join Room
          </button>
        </form>
      )}
    </div>
  );
};
