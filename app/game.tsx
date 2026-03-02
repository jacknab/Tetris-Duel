import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import TetrisBoard from '@/components/TetrisBoard';
import {
  createBoard, randomPieceType, spawnPiece, isValidPosition,
  lockPiece, clearLines, calcScore, calcLevel, calcDropInterval,
  wallKick, Piece, Board, getPieceMatrix, BOARD_COLS, BOARD_ROWS,
} from '@/lib/tetris';
import COLORS from '@/constants/colors';

const { width: SW, height: SH } = Dimensions.get('window');

function calcCellSize() {
  const availW = SW - 48;
  const availH = SH * 0.58;
  return Math.floor(Math.min(availW / BOARD_COLS, availH / BOARD_ROWS));
}

function NextPreview({ type }: { type: number }) {
  const matrix = getPieceMatrix(type, 0);
  const cs = 13;
  const color = COLORS.pieceColors[type];
  const shine = COLORS.pieceShine[type];
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 56 }}>
      {matrix.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((cell, c) => (
            <View key={c} style={{ width: cs, height: cs }}>
              {!!cell && (
                <View style={[{
                  width: cs - 2,
                  height: cs - 2,
                  margin: 1,
                  borderRadius: cs * 0.28,
                  backgroundColor: color,
                  overflow: 'hidden',
                }]}>
                  <View style={[{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
                    backgroundColor: shine, opacity: 0.45,
                    borderTopLeftRadius: cs * 0.28, borderTopRightRadius: cs * 0.28,
                  }]} />
                </View>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

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
  const [clearedRows, setClearedRows] = useState<number[]>([]);

  const boardRef = useRef<Board>(createBoard());
  const pieceRef = useRef<Piece | null>(null);
  const nextTypeRef = useRef(nextType);
  const scoreRef = useRef(0);
  const totalLinesRef = useRef(0);
  const levelRef = useRef(1);
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<GameStatus>('idle');
  const rotatePlayer = useAudioPlayer(require('@/assets/sounds/rotate.mp3'));
  const lockPlayer = useAudioPlayer(require('@/assets/sounds/lock.mp3'));
  const clearPlayer = useAudioPlayer(require('@/assets/sounds/clear.mp3'));
  const dropPlayer = useAudioPlayer(require('@/assets/sounds/drop.mp3'));

  const playSound = useCallback((name: string) => {
    try {
      if (name === 'rotate') rotatePlayer.play();
      if (name === 'lock') lockPlayer.play();
      if (name === 'clear') clearPlayer.play();
      if (name === 'drop') dropPlayer.play();
    } catch (e) {}
  }, [rotatePlayer, lockPlayer, clearPlayer, dropPlayer]);

  const syncState = useCallback(() => {
    setBoard([...boardRef.current]);
    setPiece(pieceRef.current ? { ...pieceRef.current } : null);
    setScore(scoreRef.current);
    setTotalLines(totalLinesRef.current);
    setLevel(levelRef.current);
  }, []);

  const spawnNext = useCallback(() => {
    setClearedRows([]);
    const type = nextTypeRef.current;
    const newPiece = spawnPiece(type);
    nextTypeRef.current = randomPieceType();
    setNextType(nextTypeRef.current);
    if (!isValidPosition(boardRef.current, newPiece)) {
      setStatus('over'); statusRef.current = 'over';
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
    const { board: cleared, linesCleared, clearedRows: newClearedRows } = clearLines(locked);
    boardRef.current = cleared;
    pieceRef.current = null;
    if (linesCleared > 0) {
      setClearedRows(newClearedRows);
      scoreRef.current += calcScore(linesCleared, levelRef.current);
      totalLinesRef.current += linesCleared;
      levelRef.current = calcLevel(totalLinesRef.current);
      Haptics.impactAsync(linesCleared >= 2 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
      playSound('clear');
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      playSound('lock');
    }
    spawnNext(); syncState();
  }, [spawnNext, syncState]);

  const tick = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    if (!pieceRef.current) return;
    if (isValidPosition(boardRef.current, pieceRef.current, 0, 1)) {
      pieceRef.current = { ...pieceRef.current, y: pieceRef.current.y + 1 };
      syncState();
    } else { lockAndNext(); }
    if (statusRef.current === 'playing') {
      dropTimer.current = setTimeout(tick, calcDropInterval(levelRef.current));
    }
  }, [lockAndNext, syncState]);

  const startGame = useCallback(() => {
    boardRef.current = createBoard();
    pieceRef.current = null;
    scoreRef.current = 0; totalLinesRef.current = 0; levelRef.current = 1;
    const firstType = randomPieceType();
    nextTypeRef.current = firstType;
    pieceRef.current = spawnPiece(firstType);
    nextTypeRef.current = randomPieceType();
    setNextType(nextTypeRef.current);
    setStatus('playing'); statusRef.current = 'playing';
    syncState();
    if (dropTimer.current) clearTimeout(dropTimer.current);
    dropTimer.current = setTimeout(tick, calcDropInterval(1));
  }, [tick, syncState]);

  useEffect(() => () => { if (dropTimer.current) clearTimeout(dropTimer.current); }, []);

  const moveLeft = useCallback(() => {
    if (statusRef.current !== 'playing' || !pieceRef.current) return;
    if (isValidPosition(boardRef.current, pieceRef.current, -1)) {
      pieceRef.current = { ...pieceRef.current, x: pieceRef.current.x - 1 }; syncState();
    }
  }, [syncState]);

  const moveRight = useCallback(() => {
    if (statusRef.current !== 'playing' || !pieceRef.current) return;
    if (isValidPosition(boardRef.current, pieceRef.current, 1)) {
      pieceRef.current = { ...pieceRef.current, x: pieceRef.current.x + 1 }; syncState();
    }
  }, [syncState]);

  const rotatePiece = useCallback(() => {
    if (statusRef.current !== 'playing' || !pieceRef.current) return;
    const dx = wallKick(boardRef.current, pieceRef.current, 1);
    if (dx !== null) {
      pieceRef.current = { ...pieceRef.current, x: pieceRef.current.x + dx, rotation: (pieceRef.current.rotation + 1) % 4 };
      syncState(); Haptics.selectionAsync();
      playSound('rotate');
    }
  }, [syncState]);

  const softDrop = useCallback(() => {
    if (statusRef.current !== 'playing' || !pieceRef.current) return;
    if (isValidPosition(boardRef.current, pieceRef.current, 0, 1)) {
      pieceRef.current = { ...pieceRef.current, y: pieceRef.current.y + 1 };
      scoreRef.current += 1; syncState();
    }
  }, [syncState]);

  const hardDrop = useCallback(() => {
    if (statusRef.current !== 'playing' || !pieceRef.current) return;
    let dy = 0;
    while (isValidPosition(boardRef.current, pieceRef.current, 0, dy + 1)) dy++;
    scoreRef.current += dy * 2;
    pieceRef.current = { ...pieceRef.current, y: pieceRef.current.y + dy };
    syncState(); lockAndNext();
    playSound('drop');
    if (dropTimer.current) clearTimeout(dropTimer.current);
    if (statusRef.current === 'playing') dropTimer.current = setTimeout(tick, calcDropInterval(levelRef.current));
  }, [lockAndNext, syncState, tick]);

  const togglePause = useCallback(() => {
    if (statusRef.current === 'playing') {
      statusRef.current = 'paused'; setStatus('paused');
      if (dropTimer.current) clearTimeout(dropTimer.current);
    } else if (statusRef.current === 'paused') {
      statusRef.current = 'playing'; setStatus('playing');
      dropTimer.current = setTimeout(tick, calcDropInterval(levelRef.current));
    }
  }, [tick]);

  return (
    <LinearGradient colors={['#2d0080', '#12003a', '#001a5a']} locations={[0, 0.5, 1]} style={styles.container}>
      <View style={{ paddingTop: topInset }}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <Text style={styles.topTitle}>SOLO</Text>
          {status === 'playing' || status === 'paused' ? (
            <Pressable onPress={togglePause} style={styles.iconBtn}>
              <Ionicons name={status === 'paused' ? 'play' : 'pause'} size={22} color="rgba(255,255,255,0.6)" />
            </Pressable>
          ) : <View style={styles.iconBtn} />}
        </View>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: 'SCORE', value: score.toLocaleString(), color: COLORS.pink },
          { label: 'LEVEL', value: String(level), color: COLORS.cyan },
          { label: 'LINES', value: String(totalLines), color: COLORS.yellow },
        ].map(s => (
          <LinearGradient key={s.label} colors={[s.color + '33', s.color + '11']} style={styles.statPill}>
            <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </LinearGradient>
        ))}
      </View>

      <View style={styles.gameArea}>
        <View style={styles.leftPanel}>
          <View style={styles.sideCard}>
            <Text style={styles.sideLabel}>NEXT</Text>
            <NextPreview type={nextType} />
          </View>
        </View>

        <TetrisBoard board={board} currentPiece={piece} cellSize={cellSize} clearedRows={clearedRows} />

        <View style={styles.rightPanel} />
      </View>

      <View style={[styles.controls, { paddingBottom: bottomInset + 4 }]}>
        <View style={styles.controlRow}>
          <Pressable style={styles.ctrlBtn} onPressIn={moveLeft}>
            <Ionicons name="chevron-back" size={28} color={COLORS.white} />
          </Pressable>
          <Pressable style={[styles.ctrlBtn, styles.ctrlBtnRotate]} onPress={rotatePiece}>
            <MaterialCommunityIcons name="rotate-right" size={28} color={COLORS.white} />
          </Pressable>
          <Pressable style={styles.ctrlBtn} onPressIn={moveRight}>
            <Ionicons name="chevron-forward" size={28} color={COLORS.white} />
          </Pressable>
        </View>
        <View style={styles.controlRow}>
          <Pressable style={styles.ctrlBtn} onPressIn={softDrop}>
            <Ionicons name="chevron-down" size={28} color={COLORS.white} />
          </Pressable>
          <Pressable style={[styles.ctrlBtn, styles.ctrlBtnDrop]} onPress={hardDrop}>
            <MaterialCommunityIcons name="arrow-collapse-down" size={26} color={COLORS.white} />
          </Pressable>
          <View style={styles.ctrlBtn} />
        </View>
      </View>

      {(status === 'idle' || status === 'paused' || status === 'over') && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <LinearGradient colors={['rgba(45,0,128,0.95)', 'rgba(18,0,58,0.97)']} style={StyleSheet.absoluteFill} />
          {status === 'idle' && (
            <>
              <Text style={styles.overlayTitle}>READY?</Text>
              <Pressable onPress={startGame}>
                <LinearGradient colors={[COLORS.pink, COLORS.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.overlayBtn}>
                  <Text style={styles.overlayBtnText}>START GAME</Text>
                </LinearGradient>
              </Pressable>
            </>
          )}
          {status === 'paused' && (
            <>
              <Text style={styles.overlayTitle}>PAUSED</Text>
              <Pressable onPress={togglePause}>
                <LinearGradient colors={[COLORS.pink, COLORS.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.overlayBtn}>
                  <Text style={styles.overlayBtnText}>RESUME</Text>
                </LinearGradient>
              </Pressable>
              <Pressable style={styles.overlayBtnGhost} onPress={() => router.back()}>
                <Text style={styles.overlayBtnGhostText}>QUIT</Text>
              </Pressable>
            </>
          )}
          {status === 'over' && (
            <>
              <Text style={[styles.overlayTitle, { color: COLORS.pink }]}>GAME OVER</Text>
              <Text style={styles.finalScore}>{score.toLocaleString()}</Text>
              <Text style={styles.finalLabel}>FINAL SCORE</Text>
              <Pressable onPress={startGame} style={{ marginTop: 20 }}>
                <LinearGradient colors={[COLORS.pink, COLORS.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.overlayBtn}>
                  <Text style={styles.overlayBtnText}>PLAY AGAIN</Text>
                </LinearGradient>
              </Pressable>
              <Pressable style={styles.overlayBtnGhost} onPress={() => router.back()}>
                <Text style={styles.overlayBtnGhostText}>MENU</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 6,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: 'Orbitron_700Bold', color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 4 },
  statPill: {
    flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center', gap: 2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  statVal: { fontFamily: 'Orbitron_700Bold', fontSize: 15, letterSpacing: 1 },
  statLabel: { fontFamily: 'Orbitron_400Regular', fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 },
  gameArea: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, gap: 6,
  },
  leftPanel: { width: 70, alignItems: 'center' },
  rightPanel: { width: 70 },
  sideCard: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 10, alignItems: 'center', gap: 6,
  },
  sideLabel: { fontFamily: 'Orbitron_400Regular', fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 },
  controls: { paddingHorizontal: 20, gap: 8, paddingTop: 8 },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  ctrlBtn: {
    width: 66, height: 54, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctrlBtnRotate: {
    width: 82, backgroundColor: 'rgba(255,61,205,0.25)', borderColor: 'rgba(255,61,205,0.4)',
  },
  ctrlBtnDrop: {
    width: 82, backgroundColor: 'rgba(196,77,255,0.25)', borderColor: 'rgba(196,77,255,0.4)',
  },
  overlay: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  overlayTitle: {
    fontFamily: 'Orbitron_900Black', fontSize: 36, color: COLORS.white,
    letterSpacing: 6, textShadowColor: COLORS.pink, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24,
    marginBottom: 8,
  },
  finalScore: { fontFamily: 'Orbitron_900Black', fontSize: 52, color: COLORS.white, letterSpacing: 4 },
  finalLabel: { fontFamily: 'Orbitron_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 3 },
  overlayBtn: {
    paddingVertical: 16, paddingHorizontal: 44, borderRadius: 16,
    minWidth: 220, alignItems: 'center', shadowColor: COLORS.pink, shadowOpacity: 0.6, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  overlayBtnText: { fontFamily: 'Orbitron_700Bold', fontSize: 15, color: COLORS.white, letterSpacing: 3 },
  overlayBtnGhost: {
    paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)', minWidth: 160, alignItems: 'center', marginTop: 4,
  },
  overlayBtnGhostText: { fontFamily: 'Orbitron_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 },
});
