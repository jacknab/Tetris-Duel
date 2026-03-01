import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import TetrisBoard from '@/components/TetrisBoard';
import MiniBoard from '@/components/MiniBoard';
import {
  createBoard, randomPieceType, spawnPiece, isValidPosition,
  lockPiece, clearLines, calcScore, calcLevel, calcDropInterval,
  wallKick, garbageLinesForClears, addGarbageLines,
  Piece, Board, BOARD_COLS, BOARD_ROWS,
} from '@/lib/tetris';
import { usePlayer } from '@/context/PlayerContext';
import COLORS from '@/constants/colors';

const { width: SW, height: SH } = Dimensions.get('window');

function calcCellSize() {
  const availW = (SW - 60) * 0.58;
  const availH = SH * 0.55;
  return Math.floor(Math.min(availW / BOARD_COLS, availH / BOARD_ROWS));
}

type GameStatus = 'countdown' | 'playing' | 'won' | 'lost' | 'disconnected';

const COUNTDOWN = 3;

export default function BattleScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const { roomId, opponentId } = useLocalSearchParams<{ roomId: string; opponentId: string }>();
  const { sendWs, onWsEvent } = usePlayer();

  const cellSize = calcCellSize();

  const [board, setBoard] = useState<Board>(createBoard);
  const [piece, setPiece] = useState<Piece | null>(null);
  const [score, setScore] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [status, setStatus] = useState<GameStatus>('countdown');
  const [countdown, setCountdown] = useState(COUNTDOWN);
  const [opponentBoard, setOpponentBoard] = useState<Board>(createBoard);
  const [garbageQueue, setGarbageQueue] = useState(0);
  const [garbageAlert, setGarbageAlert] = useState(0);

  const boardRef = useRef<Board>(createBoard());
  const pieceRef = useRef<Piece | null>(null);
  const scoreRef = useRef(0);
  const totalLinesRef = useRef(0);
  const levelRef = useRef(1);
  const nextTypeRef = useRef(randomPieceType());
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<GameStatus>('countdown');
  const garbageQueueRef = useRef(0);
  const roomIdRef = useRef(roomId);
  const broadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncState = useCallback(() => {
    setBoard([...boardRef.current]);
    setPiece(pieceRef.current ? { ...pieceRef.current } : null);
    setScore(scoreRef.current);
    setTotalLines(totalLinesRef.current);
    setLevel(levelRef.current);
  }, []);

  const broadcastBoard = useCallback(() => {
    sendWs({ type: 'game_event', roomId: roomIdRef.current, eventType: 'board', data: { board: boardRef.current } });
  }, [sendWs]);

  const spawnNext = useCallback(() => {
    const type = nextTypeRef.current;
    const newPiece = spawnPiece(type);
    nextTypeRef.current = randomPieceType();

    if (garbageQueueRef.current > 0) {
      const lines = garbageQueueRef.current;
      garbageQueueRef.current = 0;
      setGarbageQueue(0);
      boardRef.current = addGarbageLines(boardRef.current, lines);
    }

    if (!isValidPosition(boardRef.current, newPiece)) {
      statusRef.current = 'lost';
      setStatus('lost');
      if (dropTimer.current) clearTimeout(dropTimer.current);
      sendWs({ type: 'game_event', roomId: roomIdRef.current, eventType: 'game_over', data: {} });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
    pieceRef.current = newPiece;
    return true;
  }, [sendWs]);

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

      const garbageToSend = garbageLinesForClears(linesCleared);
      if (garbageToSend > 0) {
        sendWs({ type: 'game_event', roomId: roomIdRef.current, eventType: 'garbage', data: { lines: garbageToSend } });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    broadcastBoard();
    spawnNext();
    syncState();
  }, [spawnNext, syncState, sendWs, broadcastBoard]);

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
      dropTimer.current = setTimeout(tick, calcDropInterval(levelRef.current));
    }
  }, [lockAndNext, syncState]);

  useEffect(() => {
    const unsub1 = onWsEvent('game_event', (data: any) => {
      if (data.eventType === 'garbage') {
        const lines: number = data.data?.lines ?? 0;
        garbageQueueRef.current += lines;
        setGarbageQueue(q => q + lines);
        setGarbageAlert(a => a + 1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (data.eventType === 'board') {
        setOpponentBoard(data.data?.board ?? createBoard());
      } else if (data.eventType === 'game_over') {
        statusRef.current = 'won';
        setStatus('won');
        if (dropTimer.current) clearTimeout(dropTimer.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
    const unsub2 = onWsEvent('opponent_disconnected', () => {
      statusRef.current = 'disconnected';
      setStatus('disconnected');
      if (dropTimer.current) clearTimeout(dropTimer.current);
    });
    return () => { unsub1(); unsub2(); };
  }, [onWsEvent]);

  useEffect(() => {
    let count = COUNTDOWN;
    const interval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        statusRef.current = 'playing';
        setStatus('playing');

        boardRef.current = createBoard();
        const firstPiece = spawnPiece(nextTypeRef.current);
        pieceRef.current = firstPiece;
        nextTypeRef.current = randomPieceType();
        syncState();
        dropTimer.current = setTimeout(tick, calcDropInterval(1));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [tick, syncState]);

  useEffect(() => {
    return () => {
      if (dropTimer.current) clearTimeout(dropTimer.current);
      if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
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

  const isGameOver = status === 'won' || status === 'lost' || status === 'disconnected';

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary} />
        </Pressable>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreText}>{score.toLocaleString()}</Text>
          <Text style={styles.levelText}>LVL {level}</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.gameArea}>
        <View style={styles.mySection}>
          {garbageQueue > 0 && (
            <View style={styles.garbageIndicator}>
              {Array.from({ length: Math.min(garbageQueue, 8) }).map((_, i) => (
                <View key={i} style={styles.garbageBar} />
              ))}
            </View>
          )}
          <TetrisBoard board={board} currentPiece={piece} cellSize={cellSize} />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <MaterialCommunityIcons name="sword-cross" size={20} color={COLORS.textDim} />
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.opponentSection}>
          <Text style={styles.opponentLabel}>#{opponentId}</Text>
          <MiniBoard board={opponentBoard} />
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: bottomInset + 4 }]}>
        <View style={styles.controlRow}>
          <Pressable style={styles.ctrlBtn} onPressIn={moveLeft}>
            <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
          </Pressable>
          <Pressable style={[styles.ctrlBtn, styles.ctrlBtnCenter]} onPress={rotatePiece}>
            <MaterialCommunityIcons name="rotate-right" size={26} color={COLORS.cyan} />
          </Pressable>
          <Pressable style={styles.ctrlBtn} onPressIn={moveRight}>
            <Ionicons name="chevron-forward" size={26} color={COLORS.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.controlRow}>
          <Pressable style={styles.ctrlBtn} onPressIn={softDrop}>
            <Ionicons name="chevron-down" size={26} color={COLORS.textPrimary} />
          </Pressable>
          <Pressable style={[styles.ctrlBtn, styles.ctrlBtnCenter, { borderColor: COLORS.purple + '44', backgroundColor: COLORS.purple + '11' }]} onPress={hardDrop}>
            <MaterialCommunityIcons name="arrow-collapse-down" size={24} color={COLORS.purple} />
          </Pressable>
          <View style={styles.ctrlBtn} />
        </View>
      </View>

      {status === 'countdown' && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <Text style={styles.countdownNum}>{countdown > 0 ? countdown : 'GO!'}</Text>
          <Text style={styles.vsText}>VS #{opponentId}</Text>
        </View>
      )}

      {isGameOver && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <Text style={[styles.resultTitle, {
            color: status === 'won' ? COLORS.green : status === 'disconnected' ? COLORS.yellow : COLORS.red,
          }]}>
            {status === 'won' ? 'VICTORY!' : status === 'disconnected' ? 'DISCONNECTED' : 'DEFEATED'}
          </Text>
          {status !== 'disconnected' && (
            <>
              <Text style={styles.finalScore}>{score.toLocaleString()}</Text>
              <Text style={styles.finalScoreLabel}>FINAL SCORE</Text>
            </>
          )}
          <Pressable style={[styles.overlayBtn, { marginTop: 24 }]} onPress={() => router.replace('/lobby')}>
            <Text style={styles.overlayBtnText}>REMATCH</Text>
          </Pressable>
          <Pressable style={[styles.overlayBtn, { marginTop: 12, backgroundColor: 'transparent', borderColor: COLORS.textSecondary }]} onPress={() => router.replace('/')}>
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
    paddingVertical: 6,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRow: {
    alignItems: 'center',
    gap: 2,
  },
  scoreText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 16,
    color: COLORS.cyan,
    letterSpacing: 2,
  },
  levelText: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
  gameArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  mySection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  garbageIndicator: {
    gap: 2,
    alignSelf: 'flex-end',
    marginBottom: 0,
  },
  garbageBar: {
    width: 10,
    height: 22,
    backgroundColor: COLORS.orange,
    borderRadius: 3,
    opacity: 0.9,
  },
  divider: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  dividerLine: {
    width: 1,
    flex: 1,
    backgroundColor: COLORS.border,
  },
  opponentSection: {
    alignItems: 'center',
    gap: 8,
  },
  opponentLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
  controls: {
    paddingHorizontal: 16,
    gap: 6,
    paddingTop: 6,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  ctrlBtn: {
    width: 60,
    height: 48,
    backgroundColor: COLORS.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnCenter: {
    width: 72,
    borderColor: COLORS.cyan + '44',
    backgroundColor: COLORS.cyan + '11',
  },
  overlay: {
    backgroundColor: 'rgba(10,10,15,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  countdownNum: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 80,
    color: COLORS.cyan,
    letterSpacing: 4,
    textShadowColor: COLORS.cyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  vsText: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 14,
    color: COLORS.textSecondary,
    letterSpacing: 3,
  },
  resultTitle: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 36,
    letterSpacing: 4,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 8,
  },
  finalScore: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 48,
    color: COLORS.textPrimary,
    letterSpacing: 4,
  },
  finalScoreLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 3,
  },
  overlayBtn: {
    paddingVertical: 14,
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
    fontSize: 13,
    color: COLORS.bg,
    letterSpacing: 3,
  },
});
