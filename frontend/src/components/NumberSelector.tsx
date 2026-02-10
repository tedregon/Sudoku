import React from 'react';

interface NumberSelectorProps {
  selectedNumber: number | null;
  hasSelectedCell: boolean;
  onNumberSelect: (number: number | null) => void;
  onClear: () => void;
}

export const NumberSelector: React.FC<NumberSelectorProps> = ({
  selectedNumber,
  hasSelectedCell,
  onNumberSelect,
  onClear,
}) => {
  return (
    <div className="number-selector">
      <div className="number-selector__grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            className={`number-selector__button ${
              selectedNumber === num ? 'number-selector__button--selected' : ''
            }`}
            onClick={() => onNumberSelect(num)}
            disabled={!hasSelectedCell}
          >
            {num}
          </button>
        ))}
      </div>
      <button
        className="number-selector__clear"
        onClick={onClear}
        disabled={!hasSelectedCell}
      >
        Clear
      </button>
    </div>
  );
};
