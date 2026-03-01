import React, { memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Board, Piece, getPieceMatrix, getGhostY, BOARD_COLS, BOARD_ROWS } from '@/lib/tetris';
import COLORS from '@/constants/colors';

interface Props {
  board: Board;
  currentPiece: Piece | null;
  showGhost?: boolean;
  cellSize: number;
}

function getCellColor(cellValue: number): string {
  return COLORS.pieceColors[cellValue] ?? 'transparent';
}

const TetrisBoard = memo(({ board, currentPiece, showGhost = true, cellSize }: Props) => {
  const displayBoard: number[][] = board.map(row => [...row]);

  let ghostY: number | null = null;
  if (currentPiece && showGhost) {
    ghostY = getGhostY(board, currentPiece);
  }

  if (currentPiece) {
    const matrix = getPieceMatrix(currentPiece.type, currentPiece.rotation);

    if (ghostY !== null && ghostY !== currentPiece.y) {
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (!matrix[r][c]) continue;
          const row = ghostY + r;
          const col = currentPiece.x + c;
          if (row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS) {
            if (displayBoard[row][col] === 0) {
              displayBoard[row][col] = -1;
            }
          }
        }
      }
    }

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const row = currentPiece.y + r;
        const col = currentPiece.x + c;
        if (row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS) {
          displayBoard[row][col] = currentPiece.type;
        }
      }
    }
  }

  const cs = cellSize;
  const border = Math.max(1, cs * 0.06);

  return (
    <View style={[styles.board, {
      width: cs * BOARD_COLS,
      height: cs * BOARD_ROWS,
      borderColor: COLORS.borderBright,
    }]}>
      {displayBoard.map((row, rIdx) => (
        <View key={rIdx} style={styles.row}>
          {row.map((cell, cIdx) => {
            const isGhost = cell === -1;
            const isGarbage = cell === 8;
            const color = isGhost ? 'transparent' : isGarbage ? COLORS.orange : getCellColor(cell);

            return (
              <View
                key={cIdx}
                style={[
                  styles.cell,
                  {
                    width: cs,
                    height: cs,
                    backgroundColor: isGhost ? 'transparent' : isGarbage ? '#331100' : cell === 0 ? 'transparent' : '#0a0a0f',
                    borderWidth: cell === 0 ? 0.3 : isGhost ? 0.6 : 0,
                    borderColor: cell === 0 ? COLORS.textDim : isGhost ? color : 'transparent',
                  }
                ]}
              >
                {cell !== 0 && !isGhost && (
                  <View style={[styles.block, {
                    backgroundColor: isGarbage ? '#ff6b00' : color,
                    margin: border,
                    borderRadius: Math.max(1, cs * 0.08),
                    shadowColor: isGarbage ? '#ff6b00' : color,
                    shadowOpacity: Platform.OS !== 'web' ? 0.9 : 0,
                    shadowRadius: cs * 0.3,
                    shadowOffset: { width: 0, height: 0 },
                  }]} />
                )}
                {isGhost && (
                  <View style={[styles.ghost, {
                    borderColor: color,
                    margin: border,
                    borderRadius: Math.max(1, cs * 0.08),
                    borderWidth: 1,
                  }]} />
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
});

TetrisBoard.displayName = 'TetrisBoard';

export default TetrisBoard;

const styles = StyleSheet.create({
  board: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    overflow: 'hidden',
  },
  block: {
    flex: 1,
  },
  ghost: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
