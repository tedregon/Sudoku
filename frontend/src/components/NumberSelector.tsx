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
      <div className="number-selector__toolbar">
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
      </div>
      <button
        type="button"
        className="number-selector__undo"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo"
      >
        <svg
          className="number-selector__undo-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 256 256"
          width="22"
          height="22"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M232,144a64.07,64.07,0,0,1-64,64H80a8,8,0,0,1,0-16h88a48,48,0,0,0,0-96H51.31l34.35,34.34a8,8,0,0,1-11.32,11.32l-48-48a8,8,0,0,1,0-11.32l48-48A8,8,0,0,1,85.66,45.66L51.31,80H168A64.07,64.07,0,0,1,232,144Z" />
        </svg>
        <span className="number-selector__undo-label">Undo</span>
      </button>
      <button
        type="button"
        className={`number-selector__clear-digit ${
          isClearModeActive ? 'number-selector__clear-digit--selected' : ''
        }`}
        onClick={onClearDigit}
        aria-label="Clear cell"
        title="Clear cell"
      >
        <svg
          className="number-selector__clear-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 256 256"
          width="28"
          height="28"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M225,80.4,183.6,39a24,24,0,0,0-33.94,0L31,157.66a24,24,0,0,0,0,33.94l30.06,30.06A8,8,0,0,0,66.74,224H216a8,8,0,0,0,0-16h-84.7L225,114.34A24,24,0,0,0,225,80.4ZM108.68,208H70.05L42.33,180.28a8,8,0,0,1,0-11.31L96,115.31,148.69,168Zm105-105L160,156.69,107.31,104,161,50.34a8,8,0,0,1,11.32,0l41.38,41.38a8,8,0,0,1,0,11.31Z" />
        </svg>
        <span className="number-selector__clear-label">Clear cell</span>
      </button>
      <div className="number-selector__digit-group">
        <div className="number-selector__grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              className={`number-selector__button ${
                selectedNumber === num ? 'number-selector__button--selected' : ''
              } ${completedDigits.includes(num) ? 'number-selector__button--complete' : ''}`}
              onClick={() => onNumberSelect(num)}
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
