import React from 'react';
import { ProgressBar } from './ProgressBar';
import { Timer } from './Timer';
import './PlayerList.css';
import type { PlayerProgress } from '../types/game.types.js';

interface PlayerListProps {
  players: PlayerProgress[];
  currentPlayerId: string | null;
}

export const PlayerList: React.FC<PlayerListProps> = ({ players, currentPlayerId }) => {
  return (
    <div className="player-list">
      <h3 className="player-list__title">Players</h3>
      {players.map((player) => (
      <div
        key={player.playerId}
        className={`player-list__item ${
          player.playerId === currentPlayerId ? 'player-list__item--current' : ''
        } ${player.completionTime !== null ? 'player-list__item--completed' : ''}`}
      >
        <div className="player-list__name">
          {player.playerName}
          {player.playerId === currentPlayerId && ' (You)'}
          {player.completionTime !== null && ' ✓'}
        </div>
        <ProgressBar progress={player.progress} />
        <Timer 
          timerStartTime={player.timerStartTime} 
          completionTime={player.completionTime}
        />
      </div>
      ))}
    </div>
  );
};
