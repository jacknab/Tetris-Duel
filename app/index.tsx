import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform,
  Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePlayer } from '@/context/PlayerContext';
import COLORS from '@/constants/colors';

const { width: SW } = Dimensions.get('window');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { playerId, wsReady } = usePlayer();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 1400, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
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

  return (
    <LinearGradient
      colors={['#2d0080', '#12003a', '#001a5a']}
      locations={[0, 0.5, 1]}
      style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}
    >
      <View style={styles.decorLeft} />
      <View style={styles.decorRight} />

      <View style={styles.header}>
        <Animated.Text style={[styles.logo, { transform: [{ translateY: floatAnim }] }]}>
          TETRA
        </Animated.Text>
        <Text style={styles.logoSub}>BATTLE</Text>
        <View style={styles.logoDivider} />
      </View>

      <View style={styles.idSection}>
        <View style={styles.idCard}>
          <LinearGradient
            colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.idTopRow}>
            <View style={[styles.dot, { backgroundColor: wsReady ? COLORS.green : COLORS.red }]} />
            <Text style={styles.idLabel}>YOUR PLAYER ID</Text>
          </View>
          <Animated.Text style={[styles.idValue, { transform: [{ scale: pulseAnim }] }]}>
            {playerId ?? '-----'}
          </Animated.Text>
          <Text style={styles.idHint}>Share this ID to play with friends</Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.96 : 1 }] }]}
          onPress={handleSolo}
        >
          <LinearGradient
            colors={['#ff3dcd', '#c44dff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btn}
          >
            <Ionicons name="game-controller" size={24} color={COLORS.white} />
            <Text style={styles.btnText}>SOLO MODE</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.96 : 1 }] }]}
          onPress={handleMulti}
        >
          <LinearGradient
            colors={['#4d8bff', '#00e5ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btn}
          >
            <MaterialCommunityIcons name="sword-cross" size={24} color={COLORS.white} />
            <Text style={styles.btnText}>BATTLE MODE</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={styles.garbage}>
        <Text style={styles.garbageTitle}>GARBAGE RULES</Text>
        <View style={styles.garbageRow}>
          {[
            { lines: '2', send: '1', color: COLORS.blue },
            { lines: '3', send: '2', color: COLORS.purple },
            { lines: '4', send: '4', color: COLORS.pink },
          ].map(item => (
            <LinearGradient
              key={item.lines}
              colors={[item.color + 'cc', item.color + '55']}
              style={styles.garbageCard}
            >
              <Text style={styles.garbageLines}>×{item.lines}</Text>
              <Text style={styles.garbageArrow}>↓</Text>
              <Text style={styles.garbageSend}>+{item.send}</Text>
            </LinearGradient>
          ))}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  decorLeft: {
    position: 'absolute',
    top: 0,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#ff3dcd',
    opacity: 0.12,
  },
  decorRight: {
    position: 'absolute',
    top: 60,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#4d8bff',
    opacity: 0.12,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    gap: 2,
  },
  logo: {
    fontSize: 56,
    fontFamily: 'Orbitron_900Black',
    color: COLORS.white,
    letterSpacing: 10,
    textShadowColor: '#ff3dcd',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  logoSub: {
    fontSize: 20,
    fontFamily: 'Orbitron_700Bold',
    color: '#ff3dcd',
    letterSpacing: 14,
    marginTop: -8,
  },
  logoDivider: {
    width: 60,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#ff3dcd',
    marginTop: 10,
    opacity: 0.7,
  },
  idSection: {
    alignItems: 'center',
  },
  idCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 24,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  idTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  idLabel: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: COLORS.textSecondary,
    letterSpacing: 3,
  },
  idValue: {
    fontSize: 52,
    fontFamily: 'Orbitron_900Black',
    color: COLORS.white,
    letterSpacing: 8,
    textShadowColor: '#ff3dcd',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  idHint: {
    fontSize: 10,
    fontFamily: 'Orbitron_400Regular',
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  buttons: {
    gap: 14,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#ff3dcd',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  btnText: {
    fontSize: 16,
    fontFamily: 'Orbitron_700Bold',
    color: COLORS.white,
    letterSpacing: 3,
  },
  garbage: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  garbageTitle: {
    fontSize: 9,
    fontFamily: 'Orbitron_700Bold',
    color: COLORS.textSecondary,
    letterSpacing: 4,
  },
  garbageRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  garbageCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  garbageLines: {
    fontSize: 18,
    fontFamily: 'Orbitron_900Black',
    color: COLORS.white,
  },
  garbageArrow: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  garbageSend: {
    fontSize: 13,
    fontFamily: 'Orbitron_700Bold',
    color: COLORS.white,
    letterSpacing: 1,
  },
});
