export function isValidMove(
  grid: (number | null)[],
  cellIndex: number,
  value: number,
  playerMoves: Map<number, number>
): boolean {
  if (value < 1 || value > 9) return false;
  if (cellIndex < 0 || cellIndex >= 81) return false;
  if (grid[cellIndex] !== null) return false; // Pre-filled cell

  const row = Math.floor(cellIndex / 9);
  const col = cellIndex % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  // Check all filled cells (puzzle + player moves)
  const allFilled = new Map<number, number>();
  
  // Add puzzle cells
  grid.forEach((cell, idx) => {
    if (cell !== null) {
      allFilled.set(idx, cell);
    }
  });
  
  // Add player moves
  playerMoves.forEach((val, idx) => {
    if (idx !== cellIndex) {
      allFilled.set(idx, val);
    }
  });

  // Check row
  for (let c = 0; c < 9; c++) {
    const idx = row * 9 + c;
    if (idx !== cellIndex && allFilled.get(idx) === value) {
      return false;
    }
  }

  // Check column
  for (let r = 0; r < 9; r++) {
    const idx = r * 9 + col;
    if (idx !== cellIndex && allFilled.get(idx) === value) {
      return false;
    }
  }

  // Check box
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = (boxRow + r) * 9 + (boxCol + c);
      if (idx !== cellIndex && allFilled.get(idx) === value) {
        return false;
      }
    }
  }

  return true;
}

export function getConflicts(
  grid: (number | null)[],
  cellIndex: number,
  value: number,
  playerMoves: Map<number, number>
): number[] {
  const conflicts: number[] = [];
  if (value < 1 || value > 9) return conflicts;

  const row = Math.floor(cellIndex / 9);
  const col = cellIndex % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  const allFilled = new Map<number, number>();
  grid.forEach((cell, idx) => {
    if (cell !== null) {
      allFilled.set(idx, cell);
    }
  });
  playerMoves.forEach((val, idx) => {
    if (idx !== cellIndex) {
      allFilled.set(idx, val);
    }
  });

  // Check row
  for (let c = 0; c < 9; c++) {
    const idx = row * 9 + c;
    if (idx !== cellIndex && allFilled.get(idx) === value) {
      conflicts.push(idx);
    }
  }

  // Check column
  for (let r = 0; r < 9; r++) {
    const idx = r * 9 + col;
    if (idx !== cellIndex && allFilled.get(idx) === value) {
      conflicts.push(idx);
    }
  }

  // Check box
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = (boxRow + r) * 9 + (boxCol + c);
      if (idx !== cellIndex && allFilled.get(idx) === value) {
        conflicts.push(idx);
      }
    }
  }

  return conflicts;
}

export function getCandidates(
  grid: (number | null)[],
  cellIndex: number,
  playerMoves: Map<number, number>
): number[] {
  if (grid[cellIndex] !== null) return []; // Pre-filled cell

  const candidates: number[] = [];
  for (let num = 1; num <= 9; num++) {
    if (isValidMove(grid, cellIndex, num, playerMoves)) {
      candidates.push(num);
    }
  }
  return candidates;
}
