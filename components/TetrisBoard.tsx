import React, { memo, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import { Board, Piece, getPieceMatrix, getGhostY, BOARD_COLS, BOARD_ROWS } from '@/lib/tetris';
import COLORS from '@/constants/colors';

interface Props {
  board: Board;
  currentPiece: Piece | null;
  showGhost?: boolean;
  cellSize: number;
  clearedRows?: number[];
}

interface Particle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  color: string;
}

const Explosion = memo(({ row, cellSize }: { row: number; cellSize: number }) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  
  useEffect(() => {
    const newParticles: Particle[] = [];
    const particleCount = 12;
    
    for (let i = 0; i < particleCount; i++) {
      const startX = (Math.random() * BOARD_COLS) * cellSize;
      const startY = row * cellSize;
      
      const p: Particle = {
        id: Math.random(),
        x: new Animated.Value(startX),
        y: new Animated.Value(startY),
        opacity: new Animated.Value(1),
        color: Object.values(COLORS.pieceColors)[Math.floor(Math.random() * 7) + 1] as string,
      };
      
      newParticles.push(p);
      
      const angle = (Math.random() * Math.PI * 2);
      const velocity = 50 + Math.random() * 100;
      const destX = startX + Math.cos(angle) * velocity;
      const destY = startY + Math.sin(angle) * velocity;
      
      Animated.parallel([
        Animated.timing(p.x, {
          toValue: destX,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(p.y, {
          toValue: destY,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        })
      ]).start();
    }
    
    setParticles(newParticles);
    const timer = setTimeout(() => setParticles([]), 700);
    return () => clearTimeout(timer);
  }, [row, cellSize]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map(p => (
        <Animated.View
          key={p.id}
          style={[
            styles.particle,
            {
              backgroundColor: p.color,
              width: cellSize * 0.4,
              height: cellSize * 0.4,
              borderRadius: cellSize * 0.2,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y }
              ]
            }
          ]}
        />
      ))}
    </View>
  );
});

const Block = memo(({ color, shine, cellSize, isGhost, isGarbage }: BlockProps) => {
  const radius = cellSize * 0.28;
  const pad = Math.max(1.5, cellSize * 0.08);

  if (isGhost) {
    return (
      <View style={[styles.blockOuter, {
        width: cellSize - pad * 2,
        height: cellSize - pad * 2,
        margin: pad,
        borderRadius: radius,
        borderWidth: 1.5,
        borderColor: color + '88',
        backgroundColor: 'transparent',
      }]} />
    );
  }

  return (
    <View style={[styles.blockOuter, {
      width: cellSize - pad * 2,
      height: cellSize - pad * 2,
      margin: pad,
      borderRadius: radius,
      backgroundColor: color,
      shadowColor: color,
      shadowOpacity: Platform.OS !== 'web' ? 0.8 : 0,
      shadowRadius: cellSize * 0.35,
      shadowOffset: { width: 0, height: 2 },
      elevation: 6,
    }]}>
      <View style={[styles.blockShine, {
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        backgroundColor: shine,
      }]} />
      <View style={[styles.blockHighlight, {
        borderRadius: radius * 0.6,
        backgroundColor: 'rgba(255,255,255,0.55)',
      }]} />
    </View>
  );
});

Block.displayName = 'Block';

const TetrisBoard = memo(({ board, currentPiece, showGhost = true, cellSize, clearedRows = [] }: Props) => {
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
            if (displayBoard[row][col] === 0) displayBoard[row][col] = -1;
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

  const boardW = cellSize * BOARD_COLS;
  const boardH = cellSize * BOARD_ROWS;

  return (
    <View style={[styles.boardWrapper, { width: boardW + 8, height: boardH + 8 }]}>
      <View style={[styles.board, { width: boardW, height: boardH }]}>
        {clearedRows.map((row, idx) => (
          <Explosion key={`${row}-${idx}`} row={row} cellSize={cellSize} />
        ))}
        {displayBoard.map((row, rIdx) => (
          <View key={rIdx} style={styles.row}>
            {row.map((cell, cIdx) => {
              const isGhost = cell === -1;
              const isGarbage = cell === 8;
              const isEmpty = cell === 0;

              if (isEmpty) {
                return (
                  <View key={cIdx} style={[styles.emptyCell, {
                    width: cellSize,
                    height: cellSize,
                    borderRightWidth: cIdx < BOARD_COLS - 1 ? 0.5 : 0,
                    borderBottomWidth: rIdx < BOARD_ROWS - 1 ? 0.5 : 0,
                  }]} />
                );
              }

              const color = isGhost
                ? COLORS.pieceColors[currentPiece?.type ?? 1]
                : isGarbage
                ? COLORS.garbageBlock
                : COLORS.pieceColors[cell] ?? 'transparent';

              const shine = isGarbage
                ? COLORS.garbageShine
                : COLORS.pieceShine[cell] ?? 'transparent';

              return (
                <View key={cIdx} style={{ width: cellSize, height: cellSize }}>
                  <Block
                    color={color}
                    shine={shine}
                    cellSize={cellSize}
                    isGhost={isGhost}
                    isGarbage={isGarbage}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
});

TetrisBoard.displayName = 'TetrisBoard';

export default TetrisBoard;

const styles = StyleSheet.create({
  boardWrapper: {
    borderRadius: 12,
    backgroundColor: 'rgba(30,0,80,0.75)',
    padding: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#8800ff',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  board: {
    overflow: 'hidden',
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
  },
  emptyCell: {
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  blockOuter: {
    overflow: 'hidden',
  },
  blockShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    opacity: 0.45,
  },
  blockHighlight: {
    position: 'absolute',
    top: '10%',
    left: '12%',
    width: '32%',
    height: '28%',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  particle: {
    position: 'absolute',
    zIndex: 10,
  },
});
