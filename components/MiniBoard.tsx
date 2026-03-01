import React, { memo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Board, BOARD_COLS, BOARD_ROWS } from '@/lib/tetris';
import COLORS from '@/constants/colors';

interface Props {
  board: Board;
  label?: string;
}

const MINI_CELL = 5;

const MiniBoard = memo(({ board, label }: Props) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.board, {
        width: MINI_CELL * BOARD_COLS,
        height: MINI_CELL * BOARD_ROWS,
      }]}>
        {board.map((row, rIdx) => (
          <View key={rIdx} style={styles.row}>
            {row.map((cell, cIdx) => (
              <View
                key={cIdx}
                style={[
                  styles.cell,
                  {
                    width: MINI_CELL,
                    height: MINI_CELL,
                    backgroundColor: cell === 0
                      ? 'transparent'
                      : cell === 8
                      ? '#ff6b00'
                      : COLORS.pieceColors[cell] ?? 'transparent',
                  }
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
});

MiniBoard.displayName = 'MiniBoard';

export default MiniBoard;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 8,
    fontFamily: 'Orbitron_400Regular',
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  board: {
    borderWidth: 1,
    borderColor: COLORS.borderBright,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderWidth: 0.2,
    borderColor: COLORS.textDim,
  },
});
