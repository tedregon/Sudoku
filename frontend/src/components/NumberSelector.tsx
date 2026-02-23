import React from 'react';

interface NumberSelectorProps {
  selectedNumber: number | null;
  onNumberSelect: (number: number | null) => void;
  onClearDigit: () => void;
  isClearModeActive: boolean;
  onRestart: () => void;
  canRestart: boolean;
  onUndo: () => void;
  canUndo: boolean;
}

export const NumberSelector: React.FC<NumberSelectorProps> = ({
  selectedNumber,
  onNumberSelect,
  onClearDigit,
  isClearModeActive,
  onRestart,
  canRestart,
  onUndo,
  canUndo,
}) => {
  return (
    <div className="number-selector">
      <div className="number-selector__digit-group">
        <div className="number-selector__grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              className={`number-selector__button ${
                selectedNumber === num ? 'number-selector__button--selected' : ''
              }`}
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
        className="number-selector__restart"
        onClick={onRestart}
        disabled={!canRestart}
      >
        Restart
      </button>
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
