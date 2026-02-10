import React from 'react';
import type { Difficulty } from '../types/game.types.js';

interface DifficultySelectorProps {
  selectedDifficulty: Difficulty | null;
  onDifficultySelect: (difficulty: Difficulty) => void;
}

const DIFFICULTIES: Array<{ value: Difficulty; label: string }> = [
  { value: 'very-easy', label: 'Very Easy' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'very-hard', label: 'Very Hard' },
];

export const DifficultySelector: React.FC<DifficultySelectorProps> = ({
  selectedDifficulty,
  onDifficultySelect,
}) => {
  return (
    <div className="difficulty-selector">
      <label className="difficulty-selector__label">Select Difficulty:</label>
      <div className="difficulty-selector__options">
        {DIFFICULTIES.map((difficulty) => (
          <button
            key={difficulty.value}
            className={`difficulty-selector__button ${
              selectedDifficulty === difficulty.value
                ? 'difficulty-selector__button--selected'
                : ''
            }`}
            onClick={() => onDifficultySelect(difficulty.value)}
          >
            {difficulty.label}
          </button>
        ))}
      </div>
    </div>
  );
};
