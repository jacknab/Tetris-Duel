import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Platform, ActivityIndicator, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePlayer } from '@/context/PlayerContext';
import COLORS from '@/constants/colors';

type LobbyStatus = 'idle' | 'sending' | 'waiting';

export default function LobbyScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const { playerId, wsReady, sendWs, onWsEvent } = usePlayer();
  const [targetId, setTargetId] = useState('');
  const [lobbyStatus, setLobbyStatus] = useState<LobbyStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const u1 = onWsEvent('invite_sent', () => { setLobbyStatus('waiting'); setErrorMsg(''); });
    const u2 = onWsEvent('player_not_found', () => {
      setLobbyStatus('idle');
      setErrorMsg('Player not found. Check the ID and try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    });
    const u3 = onWsEvent('invite_rejected', () => {
      setLobbyStatus('idle');
      setErrorMsg('Player declined your invite.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    });
    return () => { u1(); u2(); u3(); };
  }, [onWsEvent]);

  const handleInvite = () => {
    const id = targetId.trim();
    if (!id || id.length < 5) { setErrorMsg('Enter a valid 5-digit player ID.'); return; }
    if (id === playerId) { setErrorMsg('You cannot invite yourself.'); return; }
    setErrorMsg('');
    setLobbyStatus('sending');
    Keyboard.dismiss();
    sendWs({ type: 'invite', targetId: id });
  };

  return (
    <LinearGradient colors={['#2d0080', '#12003a', '#001a5a']} locations={[0, 0.5, 1]} style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.decorBlob} />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <Text style={styles.topTitle}>BATTLE</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.content}>
        <View style={styles.myIdCard}>
          <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.03)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.myIdLabel}>YOUR PLAYER ID</Text>
          <Text style={styles.myId}>{playerId ?? '-----'}</Text>
          <Text style={styles.myIdHint}>Share this with your opponent</Text>
        </View>

        {lobbyStatus === 'waiting' ? (
          <View style={styles.waitingCard}>
            <LinearGradient colors={['rgba(0,229,255,0.12)', 'transparent']} style={StyleSheet.absoluteFill} />
            <ActivityIndicator color={COLORS.cyan} size="large" />
            <Text style={styles.waitingTitle}>WAITING...</Text>
            <Text style={styles.waitingSub}>Challenge sent to player {targetId}</Text>
            <Text style={styles.waitingSub}>They'll see a pop-up on their screen</Text>
            <Pressable style={styles.cancelBtn} onPress={() => { setLobbyStatus('idle'); setTargetId(''); }}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.inviteCard}>
            <LinearGradient colors={['rgba(255,255,255,0.08)', 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={styles.inviteTitle}>CHALLENGE A PLAYER</Text>
            <Text style={styles.inviteSub}>Enter your opponent's 5-digit ID</Text>
            <TextInput
              style={styles.input}
              value={targetId}
              onChangeText={t => { setTargetId(t.replace(/\D/g, '').slice(0, 5)); setErrorMsg(''); }}
              placeholder="00000"
              placeholderTextColor="rgba(255,255,255,0.2)"
              keyboardType="numeric"
              maxLength={5}
              returnKeyType="done"
              onSubmitEditing={handleInvite}
            />
            {!!errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
            <Pressable
              style={({ pressed }) => [{ opacity: (!wsReady || lobbyStatus === 'sending') ? 0.5 : pressed ? 0.85 : 1 }]}
              onPress={handleInvite}
              disabled={!wsReady || lobbyStatus === 'sending'}
            >
              <LinearGradient colors={[COLORS.pink, COLORS.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.inviteBtn}>
                {lobbyStatus === 'sending' ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="sword-cross" size={20} color={COLORS.white} />
                    <Text style={styles.inviteBtnText}>SEND CHALLENGE</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        )}

        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>GARBAGE RULES</Text>
          <View style={styles.rulesList}>
            {[
              { lines: 'Clear 2 lines', send: '→ +1 garbage line', color: COLORS.blue },
              { lines: 'Clear 3 lines', send: '→ +2 garbage lines', color: COLORS.purple },
              { lines: 'TETRIS (4 lines)', send: '→ +4 garbage lines', color: COLORS.pink },
            ].map(r => (
              <View key={r.lines} style={styles.ruleItem}>
                <View style={[styles.ruleDot, { backgroundColor: r.color }]} />
                <Text style={styles.ruleText}>{r.lines}</Text>
                <Text style={[styles.ruleVal, { color: r.color }]}>{r.send}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  decorBlob: {
    position: 'absolute', top: -60, right: -80, width: 220, height: 220,
    borderRadius: 110, backgroundColor: COLORS.pink, opacity: 0.1,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: 'Orbitron_700Bold', color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: 4 },
  content: { flex: 1, paddingHorizontal: 20, gap: 16 },
  myIdCard: {
    borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    padding: 24, alignItems: 'center', gap: 6, overflow: 'hidden',
  },
  myIdLabel: { fontFamily: 'Orbitron_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 3 },
  myId: {
    fontSize: 48, fontFamily: 'Orbitron_900Black', color: COLORS.white, letterSpacing: 8,
    textShadowColor: COLORS.pink, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18,
  },
  myIdHint: { fontFamily: 'Orbitron_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 },
  inviteCard: {
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    padding: 20, gap: 12, overflow: 'hidden',
  },
  inviteTitle: { fontFamily: 'Orbitron_700Bold', fontSize: 13, color: COLORS.white, letterSpacing: 2 },
  inviteSub: { fontFamily: 'Orbitron_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)', padding: 16,
    fontFamily: 'Orbitron_900Black', fontSize: 30, color: COLORS.white, letterSpacing: 10, textAlign: 'center',
  },
  error: { fontFamily: 'Orbitron_400Regular', fontSize: 10, color: COLORS.pink, letterSpacing: 0.5 },
  inviteBtn: {
    borderRadius: 14, paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: COLORS.pink, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  inviteBtnText: { fontFamily: 'Orbitron_700Bold', fontSize: 14, color: COLORS.white, letterSpacing: 2 },
  waitingCard: {
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,229,255,0.25)',
    padding: 30, alignItems: 'center', gap: 12, overflow: 'hidden',
  },
  waitingTitle: { fontFamily: 'Orbitron_700Bold', fontSize: 16, color: COLORS.cyan, letterSpacing: 3 },
  waitingSub: { fontFamily: 'Orbitron_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5, textAlign: 'center' },
  cancelBtn: {
    marginTop: 4, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelBtnText: { fontFamily: 'Orbitron_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 },
  rulesCard: {
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, gap: 12,
  },
  rulesTitle: { fontFamily: 'Orbitron_700Bold', fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 4 },
  rulesList: { gap: 10 },
  ruleItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleDot: { width: 8, height: 8, borderRadius: 4 },
  ruleText: { fontFamily: 'Orbitron_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.7)', flex: 1, letterSpacing: 0.3 },
  ruleVal: { fontFamily: 'Orbitron_700Bold', fontSize: 10, letterSpacing: 0.5 },
});
