import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Board, BOARD_COLS, BOARD_ROWS } from '@/lib/tetris';
import COLORS from '@/constants/colors';

interface Props {
  board: Board;
}

const MINI_CELL = 5.5;

const MiniBoard = memo(({ board }: Props) => {
  return (
    <View style={[styles.board, {
      width: MINI_CELL * BOARD_COLS,
      height: MINI_CELL * BOARD_ROWS,
    }]}>
      {board.map((row, rIdx) => (
        <View key={rIdx} style={styles.row}>
          {row.map((cell, cIdx) => {
            const color = cell === 0
              ? undefined
              : cell === 8
              ? COLORS.garbageBlock
              : COLORS.pieceColors[cell];

            return (
              <View
                key={cIdx}
                style={[
                  styles.cell,
                  {
                    width: MINI_CELL,
                    height: MINI_CELL,
                    backgroundColor: color ?? 'rgba(0,0,0,0.25)',
                    borderColor: color ? 'transparent' : 'rgba(255,255,255,0.05)',
                    borderWidth: color ? 0 : 0.3,
                    borderRadius: color ? MINI_CELL * 0.22 : 0,
                  }
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
});

MiniBoard.displayName = 'MiniBoard';

export default MiniBoard;

const styles = StyleSheet.create({
  board: {
    borderRadius: 8,
    backgroundColor: 'rgba(30,0,80,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    padding: 2,
  },
  row: { flexDirection: 'row' },
  cell: { overflow: 'hidden' },
});
