import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const availW = (SW - 56) * 0.60;
  const availH = SH * 0.52;
  return Math.floor(Math.min(availW / BOARD_COLS, availH / BOARD_ROWS));
}

type GameStatus = 'countdown' | 'playing' | 'won' | 'lost' | 'disconnected';
const COUNTDOWN = 3;

export default function BattleScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const { roomId, opponentId } = useLocalSearchParams<{ roomId: string; opponentId: string }>();
  const { sendWs, onWsEvent, playerId } = usePlayer();
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
      statusRef.current = 'lost'; setStatus('lost');
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
      scoreRef.current += calcScore(linesCleared, levelRef.current);
      totalLinesRef.current += linesCleared;
      levelRef.current = calcLevel(totalLinesRef.current);
      const g = garbageLinesForClears(linesCleared);
      if (g > 0) {
        sendWs({ type: 'game_event', roomId: roomIdRef.current, eventType: 'garbage', data: { lines: g } });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    broadcastBoard(); spawnNext(); syncState();
  }, [spawnNext, syncState, sendWs, broadcastBoard]);

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

  useEffect(() => {
    const unsub1 = onWsEvent('game_event', (data: any) => {
      if (data.eventType === 'garbage') {
        const lines: number = data.data?.lines ?? 0;
        garbageQueueRef.current += lines;
        setGarbageQueue(q => q + lines);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (data.eventType === 'board') {
        setOpponentBoard(data.data?.board ?? createBoard());
      } else if (data.eventType === 'game_over') {
        statusRef.current = 'won'; setStatus('won');
        if (dropTimer.current) clearTimeout(dropTimer.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
    const unsub2 = onWsEvent('opponent_disconnected', () => {
      statusRef.current = 'disconnected'; setStatus('disconnected');
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
        statusRef.current = 'playing'; setStatus('playing');
        boardRef.current = createBoard();
        pieceRef.current = spawnPiece(nextTypeRef.current);
        nextTypeRef.current = randomPieceType();
        syncState();
        dropTimer.current = setTimeout(tick, calcDropInterval(1));
      }
    }, 1000);
    return () => clearInterval(interval);
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
    if (dropTimer.current) clearTimeout(dropTimer.current);
    if (statusRef.current === 'playing') dropTimer.current = setTimeout(tick, calcDropInterval(levelRef.current));
  }, [lockAndNext, syncState, tick]);

  const isGameOver = status === 'won' || status === 'lost' || status === 'disconnected';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#001a5a', '#12003a', '#4a001a']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={{ paddingTop: topInset }}>
        <View style={styles.vsBar}>
          <LinearGradient colors={[COLORS.player1 + 'cc', COLORS.player1 + '44']} style={styles.scorePill}>
            <Text style={styles.scorePillLabel}>YOU</Text>
            <Text style={styles.scorePillValue}>{score.toLocaleString()}</Text>
          </LinearGradient>

          <Pressable onPress={() => router.back()} style={styles.vsIcon}>
            <MaterialCommunityIcons name="sword-cross" size={22} color="rgba(255,255,255,0.5)" />
          </Pressable>

          <LinearGradient colors={[COLORS.player2 + '44', COLORS.player2 + 'cc']} style={[styles.scorePill, { alignItems: 'flex-end' }]}>
            <Text style={styles.scorePillLabel}>#{opponentId}</Text>
            <Text style={styles.scorePillValue}>???</Text>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.linesRow}>
        <Text style={styles.linesText}>LVL {level}  ·  {totalLines} LINES</Text>
        {garbageQueue > 0 && (
          <View style={styles.garbageTag}>
            <Text style={styles.garbageTagText}>+{garbageQueue} INCOMING</Text>
          </View>
        )}
      </View>

      <View style={styles.gameArea}>
        <View style={styles.mySection}>
          {garbageQueue > 0 && (
            <View style={styles.garbageCol}>
              {Array.from({ length: Math.min(garbageQueue, 10) }).map((_, i) => (
                <LinearGradient key={i} colors={[COLORS.orange, COLORS.red]} style={styles.garbageBar} />
              ))}
            </View>
          )}
          <TetrisBoard board={board} currentPiece={piece} cellSize={cellSize} />
        </View>

        <View style={styles.divider}>
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.2)', 'transparent']} style={styles.dividerLine} />
          <View style={styles.dividerBolt}>
            <Text style={styles.boltText}>⚡</Text>
          </View>
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.2)', 'transparent']} style={styles.dividerLine} />
        </View>

        <View style={styles.opponentSection}>
          <MiniBoard board={opponentBoard} />
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: bottomInset + 4 }]}>
        <View style={styles.controlRow}>
          <Pressable style={styles.ctrlBtn} onPressIn={moveLeft}>
            <Ionicons name="chevron-back" size={26} color={COLORS.white} />
          </Pressable>
          <Pressable style={[styles.ctrlBtn, styles.ctrlBtnRotate]} onPress={rotatePiece}>
            <MaterialCommunityIcons name="rotate-right" size={26} color={COLORS.white} />
          </Pressable>
          <Pressable style={styles.ctrlBtn} onPressIn={moveRight}>
            <Ionicons name="chevron-forward" size={26} color={COLORS.white} />
          </Pressable>
        </View>
        <View style={styles.controlRow}>
          <Pressable style={styles.ctrlBtn} onPressIn={softDrop}>
            <Ionicons name="chevron-down" size={26} color={COLORS.white} />
          </Pressable>
          <Pressable style={[styles.ctrlBtn, styles.ctrlBtnDrop]} onPress={hardDrop}>
            <MaterialCommunityIcons name="arrow-collapse-down" size={24} color={COLORS.white} />
          </Pressable>
          <View style={styles.ctrlBtn} />
        </View>
      </View>

      {status === 'countdown' && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <LinearGradient colors={['rgba(0,26,90,0.94)', 'rgba(74,0,26,0.94)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.countdownNum}>{countdown > 0 ? countdown : 'GO!'}</Text>
          <Text style={styles.vsLabel}>VS PLAYER {opponentId}</Text>
        </View>
      )}

      {isGameOver && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <LinearGradient colors={['rgba(45,0,128,0.97)', 'rgba(18,0,58,0.98)']} style={StyleSheet.absoluteFill} />
          {status === 'won' && (
            <Text style={[styles.resultTitle, { color: COLORS.yellow }]}>VICTORY!</Text>
          )}
          {status === 'lost' && (
            <Text style={[styles.resultTitle, { color: COLORS.pink }]}>DEFEATED</Text>
          )}
          {status === 'disconnected' && (
            <Text style={[styles.resultTitle, { color: COLORS.yellow }]}>OPPONENT LEFT</Text>
          )}
          {status !== 'disconnected' && (
            <>
              <Text style={styles.finalScore}>{score.toLocaleString()}</Text>
              <Text style={styles.finalLabel}>FINAL SCORE</Text>
            </>
          )}
          <Pressable onPress={() => router.replace('/lobby')} style={{ marginTop: 24 }}>
            <LinearGradient colors={[COLORS.pink, COLORS.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.overlayBtn}>
              <Text style={styles.overlayBtnText}>REMATCH</Text>
            </LinearGradient>
          </Pressable>
          <Pressable style={styles.overlayBtnGhost} onPress={() => router.replace('/')}>
            <Text style={styles.overlayBtnGhostText}>MENU</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  vsBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  scorePill: {
    flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  scorePillLabel: { fontFamily: 'Orbitron_400Regular', fontSize: 8, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 },
  scorePillValue: { fontFamily: 'Orbitron_700Bold', fontSize: 16, color: COLORS.white, letterSpacing: 1 },
  vsIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  linesRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingHorizontal: 12, marginBottom: 4,
  },
  linesText: { fontFamily: 'Orbitron_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 },
  garbageTag: {
    backgroundColor: COLORS.orange + 'cc', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8,
  },
  garbageTagText: { fontFamily: 'Orbitron_700Bold', fontSize: 9, color: COLORS.white, letterSpacing: 1 },
  gameArea: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, gap: 6,
  },
  mySection: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  garbageCol: { gap: 2, alignSelf: 'flex-end' },
  garbageBar: { width: 10, height: 20, borderRadius: 3 },
  divider: { alignItems: 'center', gap: 0, width: 24 },
  dividerLine: { width: 2, flex: 1 },
  dividerBolt: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  boltText: { fontSize: 14 },
  opponentSection: { alignItems: 'center', gap: 6 },
  controls: { paddingHorizontal: 16, gap: 7, paddingTop: 6 },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  ctrlBtn: {
    width: 60, height: 48, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctrlBtnRotate: { width: 74, backgroundColor: 'rgba(255,61,205,0.25)', borderColor: 'rgba(255,61,205,0.4)' },
  ctrlBtnDrop: { width: 74, backgroundColor: 'rgba(196,77,255,0.25)', borderColor: 'rgba(196,77,255,0.4)' },
  overlay: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  countdownNum: {
    fontFamily: 'Orbitron_900Black', fontSize: 88, color: COLORS.white,
    letterSpacing: 4, textShadowColor: COLORS.pink, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 32,
  },
  vsLabel: { fontFamily: 'Orbitron_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)', letterSpacing: 3 },
  resultTitle: {
    fontFamily: 'Orbitron_900Black', fontSize: 38, letterSpacing: 4,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24, marginBottom: 8,
  },
  finalScore: { fontFamily: 'Orbitron_900Black', fontSize: 52, color: COLORS.white, letterSpacing: 4 },
  finalLabel: { fontFamily: 'Orbitron_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 3 },
  overlayBtn: {
    paddingVertical: 16, paddingHorizontal: 44, borderRadius: 16, minWidth: 220, alignItems: 'center',
    shadowColor: COLORS.pink, shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  overlayBtnText: { fontFamily: 'Orbitron_700Bold', fontSize: 15, color: COLORS.white, letterSpacing: 3 },
  overlayBtnGhost: {
    paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)', minWidth: 160, alignItems: 'center', marginTop: 6,
  },
  overlayBtnGhostText: { fontFamily: 'Orbitron_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 },
});
