import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform,
  Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePlayer } from '@/context/PlayerContext';
import COLORS from '@/constants/colors';

const { width } = Dimensions.get('window');

function GridBackground() {
  const cols = 10;
  const rows = 20;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={{ flexDirection: 'row', flex: 1 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <View key={c} style={{
              flex: 1,
              borderWidth: 0.3,
              borderColor: COLORS.textDim,
              opacity: 0.4,
            }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { playerId, wsReady } = usePlayer();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleSolo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/game');
  };

  const handleMulti = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/lobby');
  };

  const idGlowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <GridBackground />

      <View style={styles.header}>
        <Animated.Text style={[styles.logo, { transform: [{ scale: pulseAnim }] }]}>
          TETRA
        </Animated.Text>
        <Text style={styles.logoSub}>BATTLE</Text>
      </View>

      <View style={styles.idCard}>
        <Text style={styles.idLabel}>YOUR PLAYER ID</Text>
        <Animated.Text style={[styles.idValue, { opacity: idGlowOpacity }]}>
          {playerId ?? '-----'}
        </Animated.Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: wsReady ? COLORS.green : COLORS.red }]} />
          <Text style={styles.statusText}>{wsReady ? 'ONLINE' : 'CONNECTING...'}</Text>
        </View>
        <Text style={styles.idHint}>Share this ID to play with friends</Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnPrimary, { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          onPress={handleSolo}
        >
          <Ionicons name="game-controller" size={22} color={COLORS.bg} />
          <Text style={[styles.btnText, { color: COLORS.bg }]}>SOLO MODE</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnSecondary, {
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          }]}
          onPress={handleMulti}
        >
          <MaterialCommunityIcons name="sword-cross" size={22} color={COLORS.cyan} />
          <Text style={[styles.btnText, { color: COLORS.cyan }]}>BATTLE</Text>
        </Pressable>
      </View>

      <View style={styles.legend}>
        {[
          { label: 'CLEAR 2', desc: 'send 1 line' },
          { label: 'CLEAR 3', desc: 'send 2 lines' },
          { label: 'TETRIS', desc: 'send 4 lines' },
        ].map(item => (
          <View key={item.label} style={styles.legendItem}>
            <Text style={styles.legendLabel}>{item.label}</Text>
            <Text style={styles.legendDesc}>{item.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
  },
  logo: {
    fontSize: 52,
    fontFamily: 'Orbitron_900Black',
    color: COLORS.cyan,
    letterSpacing: 8,
    textShadowColor: COLORS.cyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  logoSub: {
    fontSize: 18,
    fontFamily: 'Orbitron_700Bold',
    color: COLORS.purple,
    letterSpacing: 12,
    marginTop: -8,
  },
  idCard: {
    width: '100%',
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cyan + '44',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  idLabel: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: COLORS.textSecondary,
    letterSpacing: 3,
  },
  idValue: {
    fontSize: 48,
    fontFamily: 'Orbitron_900Black',
    color: COLORS.cyan,
    letterSpacing: 6,
    textShadowColor: COLORS.cyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9,
    fontFamily: 'Orbitron_400Regular',
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
  idHint: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: COLORS.textDim,
    letterSpacing: 1,
    marginTop: 4,
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: COLORS.cyan,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.cyan,
  },
  btnText: {
    fontSize: 14,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 3,
  },
  legend: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  legendItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  legendLabel: {
    fontSize: 8,
    fontFamily: 'Orbitron_700Bold',
    color: COLORS.yellow,
    letterSpacing: 1,
  },
  legendDesc: {
    fontSize: 8,
    fontFamily: 'Orbitron_400Regular',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
});
