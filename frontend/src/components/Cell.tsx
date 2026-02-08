import React from 'react';
import './Cell.css';

interface CellProps {
  value: number | null;
  candidates: number[];
  isPrefilled: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  hasConflict: boolean;
  showCandidates: boolean;
  onClick: () => void;
  className?: string;
}

export const Cell: React.FC<CellProps> = ({
  value,
  candidates,
  isPrefilled,
  isSelected,
  isHighlighted,
  hasConflict,
  showCandidates,
  onClick,
  className = '',
}) => {
  const cellClasses = [
    'cell',
    isPrefilled && 'cell--prefilled',
    isSelected && 'cell--selected',
    isHighlighted && 'cell--highlighted',
    hasConflict && 'cell--conflict',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cellClasses} onClick={onClick}>
      {value !== null ? (
        <span className="cell__value">{value}</span>
      ) : showCandidates && candidates.length > 0 ? (
        <div className="cell__candidates">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <span
              key={num}
              className={`cell__candidate ${candidates.includes(num) ? 'cell__candidate--visible' : ''}`}
            >
              {candidates.includes(num) ? num : ''}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
