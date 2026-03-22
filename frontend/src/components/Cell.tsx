import React from 'react';

interface CellProps {
  value: number | null;
  pencilMarks: number[];
  isPrefilled: boolean;
  isHighlighted: boolean;
  hasConflict: boolean;
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  cellIndex?: number;
  className?: string;
}

export const Cell: React.FC<CellProps> = ({
  value,
  pencilMarks,
  isPrefilled,
  isHighlighted,
  hasConflict,
  onClick,
  onKeyDown,
  cellIndex,
  className = '',
}) => {
  const cellClasses = [
    'cell',
    isPrefilled && 'cell--prefilled',
    isHighlighted && 'cell--highlighted',
    hasConflict && 'cell--conflict',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cellClasses}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={-1}
      data-cell-index={cellIndex}
    >
      {value !== null ? (
        <span className="cell__value">{value}</span>
      ) : pencilMarks.length > 0 ? (
        <div className="cell__candidates">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <span
              key={num}
              className={`cell__candidate ${pencilMarks.includes(num) ? 'cell__candidate--visible' : ''}`}
            >
              {pencilMarks.includes(num) ? num : ''}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
