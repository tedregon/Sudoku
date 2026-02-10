import React from 'react';
import { Cell } from './Cell';

interface GameBoardProps {
  puzzle: (number | null)[];
  selectedCell: number | null;
  showCandidates: boolean;
  getCellValue: (cellIndex: number) => number | null;
  getCellCandidates: (cellIndex: number) => number[];
  getCellConflicts: (cellIndex: number, value: number | null) => number[];
  getHighlightedCells: () => number[];
  getInvalidCells: () => number[];
  onCellClick: (cellIndex: number) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  puzzle,
  selectedCell,
  showCandidates,
  getCellValue,
  getCellCandidates,
  getCellConflicts,
  getHighlightedCells,
  getInvalidCells,
  onCellClick,
  onKeyDown,
}) => {
  const highlightedCells = getHighlightedCells();
  const invalidCells = getInvalidCells();

  const renderCell = (cellIndex: number) => {
    const row = Math.floor(cellIndex / 9);
    const col = cellIndex % 9;

    const value = getCellValue(cellIndex);
    const isPrefilled = puzzle[cellIndex] !== null;
    const isSelected = selectedCell === cellIndex;
    const isHighlighted = highlightedCells.includes(cellIndex);
    const isInvalid = invalidCells.includes(cellIndex);
    const candidates = showCandidates ? getCellCandidates(cellIndex) : [];
    
    // Check for conflicts (check if this cell's value conflicts with other cells)
    let hasConflict = false;
    if (value !== null) {
      const conflicts = getCellConflicts(cellIndex, value);
      hasConflict = conflicts.length > 0;
    }

    // Add classes for thick borders
    const borderClasses: string[] = [];
    if (col === 2 || col === 5) {
      borderClasses.push('cell--thick-right');
    }
    if (row === 2 || row === 5) {
      borderClasses.push('cell--thick-bottom');
    }

    return (
      <Cell
        key={cellIndex}
        value={value}
        candidates={candidates}
        isPrefilled={isPrefilled}
        isSelected={isSelected}
        isHighlighted={isHighlighted}
        hasConflict={hasConflict}
        showCandidates={showCandidates}
        onClick={() => onCellClick(cellIndex)}
        onKeyDown={onKeyDown}
        cellIndex={cellIndex}
        className={borderClasses.join(' ')}
      />
    );
  };

  return (
    <div className="game-board">
      {Array.from({ length: 81 }, (_, i) => renderCell(i))}
    </div>
  );
};
