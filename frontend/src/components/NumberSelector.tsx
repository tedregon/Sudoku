import React from 'react';
import type { EntryMode } from '../hooks/useGameState.js';

interface NumberSelectorProps {
  entryMode: EntryMode;
  onEntryModeChange: (mode: EntryMode) => void;
  selectedNumber: number | null;
  onNumberSelect: (number: number | null) => void;
  onClearDigit: () => void;
  isClearModeActive: boolean;
  onUndo: () => void;
  canUndo: boolean;
  completedDigits?: number[];
}

export const NumberSelector: React.FC<NumberSelectorProps> = ({
  entryMode,
  onEntryModeChange,
  selectedNumber,
  onNumberSelect,
  onClearDigit,
  isClearModeActive,
  onUndo,
  canUndo,
  completedDigits = [],
}) => {
  return (
    <div className="number-selector">
      <div
        className="number-selector__entry-mode"
        role="tablist"
        aria-label="Enter values or pencil notes"
      >
        <button
          type="button"
          role="tab"
          aria-selected={entryMode === 'value'}
          className={`number-selector__entry-segment ${
            entryMode === 'value' ? 'number-selector__entry-segment--active' : ''
          }`}
          onClick={() => onEntryModeChange('value')}
        >
          Value
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={entryMode === 'notes'}
          className={`number-selector__entry-segment ${
            entryMode === 'notes' ? 'number-selector__entry-segment--active' : ''
          }`}
          onClick={() => onEntryModeChange('notes')}
        >
          Notes
        </button>
      </div>
      <div className="number-selector__digit-group">
        <div className="number-selector__grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              className={`number-selector__button ${
                selectedNumber === num ? 'number-selector__button--selected' : ''
              } ${completedDigits.includes(num) ? 'number-selector__button--complete' : ''}`}
              onClick={() => onNumberSelect(num)}
            >
              {num}
            </button>
          ))}
        </div>
        <button
          className={`number-selector__clear-digit ${
            isClearModeActive ? 'number-selector__clear-digit--selected' : ''
          }`}
          onClick={onClearDigit}
        >
          Clear cell
        </button>
      </div>
      <button
        className="number-selector__undo"
        onClick={onUndo}
        disabled={!canUndo}
      >
        Undo
      </button>
    </div>
  );
};
