import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform,
  Dimensions, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import TetrisBoard from '@/components/TetrisBoard';
import {
  createBoard, randomPieceType, spawnPiece, isValidPosition,
  lockPiece, clearLines, calcScore, calcLevel, calcDropInterval,
  wallKick, garbageLinesForClears, addGarbageLines,
  Piece, Board, getPieceMatrix, BOARD_COLS, BOARD_ROWS,
} from '@/lib/tetris';
import COLORS from '@/constants/colors';

const { width: SW, height: SH } = Dimensions.get('window');

function calcCellSize() {
  const availW = SW - 48;
  const availH = SH * 0.6;
  return Math.floor(Math.min(availW / BOARD_COLS, availH / BOARD_ROWS));
}

function NextPiecePreview({ type }: { type: number }) {
  const matrix = getPieceMatrix(type, 0);
  const cellSize = 14;
  return (
    <View style={previewStyles.container}>
      {matrix.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((cell, c) => (
            <View key={c} style={{
              width: cellSize, height: cellSize,
              backgroundColor: cell ? COLORS.pieceColors[type] : 'transparent',
              margin: 1,
              borderRadius: 2,
            }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const previewStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', minHeight: 60 },
});

type GameStatus = 'idle' | 'playing' | 'paused' | 'over';

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const cellSize = calcCellSize();

  const [board, setBoard] = useState<Board>(createBoard);
  const [piece, setPiece] = useState<Piece | null>(null);
  const [nextType, setNextType] = useState(randomPieceType());
  const [score, setScore] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [status, setStatus] = useState<GameStatus>('idle');

  const boardRef = useRef<Board>(createBoard());
  const pieceRef = useRef<Piece | null>(null);
  const nextTypeRef = useRef(nextType);
  const scoreRef = useRef(0);
  const totalLinesRef = useRef(0);
  const levelRef = useRef(1);
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<GameStatus>('idle');

  const syncState = useCallback(() => {
    setBoard([...boardRef.current]);
    setPiece(pieceRef.current ? { ...pieceRef.current } : null);
    setScore(scoreRef.current);
    setTotalLines(totalLinesRef.current);
    setLevel(levelRef.current);
  }, []);

  const spawnNext = useCallback(() => {
    const type = nextTypeRef.current;
    const newPiece = spawnPiece(type);
    nextTypeRef.current = randomPieceType();
    setNextType(nextTypeRef.current);

    if (!isValidPosition(boardRef.current, newPiece)) {
      setStatus('over');
      statusRef.current = 'over';
      if (dropTimer.current) clearTimeout(dropTimer.current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
    pieceRef.current = newPiece;
    return true;
  }, []);

  const lockAndNext = useCallback(() => {
    if (!pieceRef.current) return;
    const locked = lockPiece(boardRef.current, pieceRef.current);
    const { board: cleared, linesCleared } = clearLines(locked);
    boardRef.current = cleared;
    pieceRef.current = null;

    if (linesCleared > 0) {
      const points = calcScore(linesCleared, levelRef.current);
      scoreRef.current += points;
      totalLinesRef.current += linesCleared;
      levelRef.current = calcLevel(totalLinesRef.current);
      if (linesCleared >= 2) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    spawnNext();
    syncState();
  }, [spawnNext, syncState]);

  const tick = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    if (!pieceRef.current) return;

    if (isValidPosition(boardRef.current, pieceRef.current, 0, 1)) {
      pieceRef.current = { ...pieceRef.current, y: pieceRef.current.y + 1 };
      syncState();
    } else {
      lockAndNext();
    }

    if (statusRef.current === 'playing') {
      const interval = calcDropInterval(levelRef.current);
      dropTimer.current = setTimeout(tick, interval);
    }
  }, [lockAndNext, syncState]);

  const startGame = useCallback(() => {
    boardRef.current = createBoard();
    pieceRef.current = null;
    nextTypeRef.current = randomPieceType();
    scoreRef.current = 0;
    totalLinesRef.current = 0;
    levelRef.current = 1;
    setNextType(nextTypeRef.current);
    setStatus('playing');
    statusRef.current = 'playing';

    const firstType = randomPieceType();
    nextTypeRef.current = firstType;
    const firstPiece = spawnPiece(firstType);
    pieceRef.current = firstPiece;
    nextTypeRef.current = randomPieceType();
    setNextType(nextTypeRef.current);
    syncState();

    if (dropTimer.current) clearTimeout(dropTimer.current);
    dropTimer.current = setTimeout(tick, calcDropInterval(1));
  }, [tick, syncState]);

  useEffect(() => {
    return () => {
      if (dropTimer.current) clearTimeout(dropTimer.current);
    };
  }, []);

  const moveLeft = useCallback(() => {
    if (statusRef.current !== 'playing' || !pieceRef.current) return;
    if (isValidPosition(boardRef.current, pieceRef.current, -1)) {
      pieceRef.current = { ...pieceRef.current, x: pieceRef.current.x - 1 };
      syncState();
    }
  }, [syncState]);

  const moveRight = useCallback(() => {
    if (statusRef.current !== 'playing' || !pieceRef.current) return;
    if (isValidPosition(boardRef.current, pieceRef.current, 1)) {
      pieceRef.current = { ...pieceRef.current, x: pieceRef.current.x + 1 };
      syncState();
    }
  }, [syncState]);

  const rotatePiece = useCallback(() => {
    if (statusRef.current !== 'playing' || !pieceRef.current) return;
    const dx = wallKick(boardRef.current, pieceRef.current, 1);
    if (dx !== null) {
      pieceRef.current = {
        ...pieceRef.current,
        x: pieceRef.current.x + dx,
        rotation: (pieceRef.current.rotation + 1) % 4,
      };
      syncState();
      Haptics.selectionAsync();
    }
  }, [syncState]);

  const softDrop = useCallback(() => {
    if (statusRef.current !== 'playing' || !pieceRef.current) return;
    if (isValidPosition(boardRef.current, pieceRef.current, 0, 1)) {
      pieceRef.current = { ...pieceRef.current, y: pieceRef.current.y + 1 };
      scoreRef.current += 1;
      syncState();
    }
  }, [syncState]);

  const hardDrop = useCallback(() => {
    if (statusRef.current !== 'playing' || !pieceRef.current) return;
    let dy = 0;
    while (isValidPosition(boardRef.current, pieceRef.current, 0, dy + 1)) dy++;
    scoreRef.current += dy * 2;
    pieceRef.current = { ...pieceRef.current, y: pieceRef.current.y + dy };
    syncState();
    lockAndNext();
    if (dropTimer.current) clearTimeout(dropTimer.current);
    if (statusRef.current === 'playing') {
      dropTimer.current = setTimeout(tick, calcDropInterval(levelRef.current));
    }
  }, [lockAndNext, syncState, tick]);

  const togglePause = useCallback(() => {
    if (statusRef.current === 'playing') {
      statusRef.current = 'paused';
      setStatus('paused');
      if (dropTimer.current) clearTimeout(dropTimer.current);
    } else if (statusRef.current === 'paused') {
      statusRef.current = 'playing';
      setStatus('playing');
      dropTimer.current = setTimeout(tick, calcDropInterval(levelRef.current));
    }
  }, [tick]);

  const boardWidth = cellSize * BOARD_COLS;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary} />
        </Pressable>
        <Text style={styles.topTitle}>SOLO</Text>
        {status === 'playing' || status === 'paused' ? (
          <Pressable onPress={togglePause} style={styles.iconBtn}>
            <Ionicons name={status === 'paused' ? 'play' : 'pause'} size={22} color={COLORS.textSecondary} />
          </Pressable>
        ) : <View style={styles.iconBtn} />}
      </View>

      <View style={styles.gameArea}>
        <View style={styles.sidePanel}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>SCORE</Text>
            <Text style={styles.statValue}>{score.toLocaleString()}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>LEVEL</Text>
            <Text style={styles.statValue}>{level}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>LINES</Text>
            <Text style={styles.statValue}>{totalLines}</Text>
          </View>
        </View>

        <View>
          <TetrisBoard board={board} currentPiece={piece} cellSize={cellSize} />
        </View>

        <View style={styles.sidePanel}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>NEXT</Text>
            <NextPiecePreview type={nextType} />
          </View>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: bottomInset + 8 }]}>
        <View style={styles.controlRow}>
          <Pressable style={styles.ctrlBtn} onPressIn={moveLeft}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
          </Pressable>
          <Pressable style={[styles.ctrlBtn, styles.ctrlBtnLarge]} onPress={rotatePiece}>
            <MaterialCommunityIcons name="rotate-right" size={28} color={COLORS.cyan} />
          </Pressable>
          <Pressable style={styles.ctrlBtn} onPressIn={moveRight}>
            <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.controlRow}>
          <Pressable style={styles.ctrlBtn} onPressIn={softDrop}>
            <Ionicons name="chevron-down" size={28} color={COLORS.textPrimary} />
          </Pressable>
          <Pressable style={[styles.ctrlBtn, styles.ctrlBtnLarge, { backgroundColor: COLORS.purple + '22', borderColor: COLORS.purple + '44' }]} onPress={hardDrop}>
            <MaterialCommunityIcons name="arrow-collapse-down" size={26} color={COLORS.purple} />
          </Pressable>
          <View style={styles.ctrlBtn} />
        </View>
      </View>

      {status === 'idle' && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <Text style={styles.overlayTitle}>TETRA BATTLE</Text>
          <Pressable style={styles.overlayBtn} onPress={startGame}>
            <Text style={styles.overlayBtnText}>START GAME</Text>
          </Pressable>
        </View>
      )}

      {status === 'paused' && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <Text style={styles.overlayTitle}>PAUSED</Text>
          <Pressable style={styles.overlayBtn} onPress={togglePause}>
            <Text style={styles.overlayBtnText}>RESUME</Text>
          </Pressable>
          <Pressable style={[styles.overlayBtn, { marginTop: 12, backgroundColor: 'transparent', borderColor: COLORS.textSecondary }]} onPress={() => router.back()}>
            <Text style={[styles.overlayBtnText, { color: COLORS.textSecondary }]}>QUIT</Text>
          </Pressable>
        </View>
      )}

      {status === 'over' && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <Text style={[styles.overlayTitle, { color: COLORS.red }]}>GAME OVER</Text>
          <Text style={styles.overlayScore}>{score.toLocaleString()}</Text>
          <Text style={styles.overlayScoreLabel}>FINAL SCORE</Text>
          <Pressable style={[styles.overlayBtn, { marginTop: 24 }]} onPress={startGame}>
            <Text style={styles.overlayBtnText}>PLAY AGAIN</Text>
          </Pressable>
          <Pressable style={[styles.overlayBtn, { marginTop: 12, backgroundColor: 'transparent', borderColor: COLORS.textSecondary }]} onPress={() => router.back()}>
            <Text style={[styles.overlayBtnText, { color: COLORS.textSecondary }]}>MENU</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontFamily: 'Orbitron_700Bold',
    color: COLORS.textSecondary,
    fontSize: 13,
    letterSpacing: 4,
  },
  gameArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  sidePanel: {
    gap: 10,
    width: 68,
    alignItems: 'center',
  },
  statCard: {
    width: '100%',
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 8,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
  },
  statValue: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  controls: {
    paddingHorizontal: 24,
    gap: 8,
    paddingTop: 8,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  ctrlBtn: {
    width: 64,
    height: 54,
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnLarge: {
    width: 80,
    borderColor: COLORS.cyan + '44',
    backgroundColor: COLORS.cyan + '11',
  },
  overlay: {
    backgroundColor: 'rgba(10,10,15,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  overlayTitle: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 32,
    color: COLORS.cyan,
    letterSpacing: 6,
    textShadowColor: COLORS.cyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 8,
  },
  overlayScore: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 48,
    color: COLORS.textPrimary,
    letterSpacing: 4,
  },
  overlayScoreLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 3,
  },
  overlayBtn: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 10,
    backgroundColor: COLORS.cyan,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    minWidth: 200,
    alignItems: 'center',
  },
  overlayBtnText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 14,
    color: COLORS.bg,
    letterSpacing: 3,
  },
});
