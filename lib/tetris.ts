export const BOARD_COLS = 10;
export const BOARD_ROWS = 20;

export type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Board = Cell[][];

export interface Piece {
  type: number;
  x: number;
  y: number;
  rotation: number;
}

const PIECES: number[][][][] = [
  [],
  [
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
    [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
  ],
  [
    [[1,1],[1,1]],
  ],
  [
    [[0,1,0],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,1],[0,1,0]],
    [[0,1,0],[1,1,0],[0,1,0]],
  ],
  [
    [[0,1,1],[1,1,0],[0,0,0]],
    [[0,1,0],[0,1,1],[0,0,1]],
    [[0,0,0],[0,1,1],[1,1,0]],
    [[1,0,0],[1,1,0],[0,1,0]],
  ],
  [
    [[1,1,0],[0,1,1],[0,0,0]],
    [[0,0,1],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,0],[0,1,1]],
    [[0,1,0],[1,1,0],[1,0,0]],
  ],
  [
    [[1,0,0],[1,1,1],[0,0,0]],
    [[0,1,1],[0,1,0],[0,1,0]],
    [[0,0,0],[1,1,1],[0,0,1]],
    [[0,1,0],[0,1,0],[1,1,0]],
  ],
  [
    [[0,0,1],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,0],[0,1,1]],
    [[0,0,0],[1,1,1],[1,0,0]],
    [[1,1,0],[0,1,0],[0,1,0]],
  ],
];

export function getPieceMatrix(type: number, rotation: number): number[][] {
  const piece = PIECES[type];
  return piece[rotation % piece.length];
}

export function createBoard(): Board {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array(BOARD_COLS).fill(0) as Cell[]
  );
}

export function isValidPosition(board: Board, piece: Piece, dx = 0, dy = 0, dr = 0): boolean {
  const matrix = getPieceMatrix(piece.type, piece.rotation + dr);
  const nx = piece.x + dx;
  const ny = piece.y + dy;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const row = ny + r;
      const col = nx + c;
      if (col < 0 || col >= BOARD_COLS || row >= BOARD_ROWS) return false;
      if (row >= 0 && board[row][col] !== 0) return false;
    }
  }
  return true;
}

export function lockPiece(board: Board, piece: Piece): Board {
  const matrix = getPieceMatrix(piece.type, piece.rotation);
  const newBoard = board.map(row => [...row]) as Board;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const row = piece.y + r;
      const col = piece.x + c;
      if (row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS) {
        newBoard[row][col] = piece.type as Cell;
      }
    }
  }
  return newBoard;
}

export function clearLines(board: Board): { board: Board; linesCleared: number } {
  const newBoard = board.filter(row => row.some(cell => cell === 0)) as Board;
  const linesCleared = BOARD_ROWS - newBoard.length;
  const empty = Array.from({ length: linesCleared }, () =>
    Array(BOARD_COLS).fill(0) as Cell[]
  );
  return { board: [...empty, ...newBoard] as Board, linesCleared };
}

export function randomPieceType(): number {
  return Math.floor(Math.random() * 7) + 1;
}

export function spawnPiece(type: number): Piece {
  return {
    type,
    x: type === 1 ? 3 : Math.floor((BOARD_COLS - getPieceMatrix(type, 0)[0].length) / 2),
    y: type === 1 ? -1 : -1,
    rotation: 0,
  };
}

export function getGhostY(board: Board, piece: Piece): number {
  let dy = 0;
  while (isValidPosition(board, piece, 0, dy + 1)) dy++;
  return piece.y + dy;
}

export function addGarbageLines(board: Board, count: number): Board {
  const newBoard = board.map(row => [...row]) as Board;
  const sliced = newBoard.slice(count) as Board;
  const garbageRows: Cell[][] = [];
  for (let i = 0; i < count; i++) {
    const holeCol = Math.floor(Math.random() * BOARD_COLS);
    const row: Cell[] = Array(BOARD_COLS).fill(8) as Cell[];
    row[holeCol] = 0;
    garbageRows.push(row);
  }
  return [...sliced, ...garbageRows] as Board;
}

export function garbageLinesForClears(linesCleared: number): number {
  if (linesCleared === 2) return 1;
  if (linesCleared === 3) return 2;
  if (linesCleared >= 4) return 4;
  return 0;
}

export function calcScore(linesCleared: number, level: number): number {
  const base = [0, 100, 300, 500, 800];
  return (base[Math.min(linesCleared, 4)] || 0) * level;
}

export function calcLevel(totalLines: number): number {
  return Math.floor(totalLines / 10) + 1;
}

export function calcDropInterval(level: number): number {
  return Math.max(100, 1000 - (level - 1) * 80);
}

export function wallKick(board: Board, piece: Piece, dr: number): number | null {
  const kicks = [0, -1, 1, -2, 2];
  for (const dx of kicks) {
    if (isValidPosition(board, piece, dx, 0, dr)) return dx;
  }
  return null;
}
