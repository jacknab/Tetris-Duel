import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Platform, ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePlayer } from '@/context/PlayerContext';
import COLORS from '@/constants/colors';

type LobbyStatus = 'idle' | 'sending' | 'waiting' | 'incoming';

export default function LobbyScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const { playerId, wsReady, sendWs, onWsEvent } = usePlayer();

  const [targetId, setTargetId] = useState('');
  const [lobbyStatus, setLobbyStatus] = useState<LobbyStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [incomingFrom, setIncomingFrom] = useState('');
  const [pendingRoomId, setPendingRoomId] = useState('');

  useEffect(() => {
    const unsub1 = onWsEvent('invite_sent', () => {
      setLobbyStatus('waiting');
      setErrorMsg('');
    });
    const unsub2 = onWsEvent('player_not_found', () => {
      setLobbyStatus('idle');
      setErrorMsg('Player not found. Check the ID and try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    });
    const unsub3 = onWsEvent('invite_rejected', () => {
      setLobbyStatus('idle');
      setErrorMsg('Player declined your invite.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    });
    const unsub4 = onWsEvent('invited', (data: any) => {
      setIncomingFrom(data.fromId);
      setPendingRoomId(data.roomId);
      setLobbyStatus('incoming');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
    const unsub5 = onWsEvent('game_start', (data: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/battle',
        params: { roomId: data.roomId, opponentId: data.opponentId },
      });
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [onWsEvent]);

  const handleInvite = () => {
    const id = targetId.trim();
    if (!id || id.length < 5) {
      setErrorMsg('Enter a valid 5-digit player ID.');
      return;
    }
    if (id === playerId) {
      setErrorMsg('You cannot invite yourself.');
      return;
    }
    setErrorMsg('');
    setLobbyStatus('sending');
    Keyboard.dismiss();
    sendWs({ type: 'invite', targetId: id });
  };

  const handleAccept = () => {
    sendWs({ type: 'respond_invite', roomId: pendingRoomId, accept: true });
  };

  const handleDecline = () => {
    sendWs({ type: 'respond_invite', roomId: pendingRoomId, accept: false });
    setLobbyStatus('idle');
    setIncomingFrom('');
    setPendingRoomId('');
  };

  const handleCancel = () => {
    setLobbyStatus('idle');
    setTargetId('');
    setErrorMsg('');
  };

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary} />
        </Pressable>
        <Text style={styles.topTitle}>BATTLE</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.content}>
        <View style={styles.myIdCard}>
          <Text style={styles.myIdLabel}>YOUR ID</Text>
          <Text style={styles.myId}>{playerId ?? '-----'}</Text>
          <Text style={styles.myIdHint}>Share with your opponent</Text>
        </View>

        {lobbyStatus === 'incoming' ? (
          <View style={styles.incomingCard}>
            <MaterialCommunityIcons name="sword-cross" size={40} color={COLORS.cyan} />
            <Text style={styles.incomingTitle}>CHALLENGE!</Text>
            <Text style={styles.incomingFrom}>Player <Text style={{ color: COLORS.cyan }}>{incomingFrom}</Text></Text>
            <Text style={styles.incomingFrom}>wants to battle you</Text>
            <View style={styles.incomingActions}>
              <Pressable style={[styles.actionBtn, { backgroundColor: COLORS.cyan }]} onPress={handleAccept}>
                <Ionicons name="checkmark" size={20} color={COLORS.bg} />
                <Text style={[styles.actionBtnText, { color: COLORS.bg }]}>ACCEPT</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { borderColor: COLORS.red, borderWidth: 1 }]} onPress={handleDecline}>
                <Ionicons name="close" size={20} color={COLORS.red} />
                <Text style={[styles.actionBtnText, { color: COLORS.red }]}>DECLINE</Text>
              </Pressable>
            </View>
          </View>
        ) : lobbyStatus === 'waiting' ? (
          <View style={styles.waitingCard}>
            <ActivityIndicator color={COLORS.cyan} size="large" />
            <Text style={styles.waitingText}>WAITING FOR RESPONSE</Text>
            <Text style={styles.waitingSubtext}>Invite sent to {targetId}</Text>
            <Pressable style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.inviteCard}>
            <Text style={styles.inviteTitle}>INVITE A PLAYER</Text>
            <Text style={styles.inviteSubtitle}>Enter your opponent's ID to challenge them</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={targetId}
                onChangeText={t => {
                  setTargetId(t.replace(/\D/g, '').slice(0, 5));
                  setErrorMsg('');
                }}
                placeholder="00000"
                placeholderTextColor={COLORS.textDim}
                keyboardType="numeric"
                maxLength={5}
                returnKeyType="done"
                onSubmitEditing={handleInvite}
              />
            </View>
            {!!errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
            <Pressable
              style={({ pressed }) => [
                styles.inviteBtn,
                { opacity: (!wsReady || lobbyStatus === 'sending') ? 0.5 : pressed ? 0.8 : 1 },
              ]}
              onPress={handleInvite}
              disabled={!wsReady || lobbyStatus === 'sending'}
            >
              {lobbyStatus === 'sending' ? (
                <ActivityIndicator color={COLORS.bg} size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="sword-cross" size={20} color={COLORS.bg} />
                  <Text style={styles.inviteBtnText}>SEND CHALLENGE</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        <View style={styles.rules}>
          <Text style={styles.rulesTitle}>BATTLE RULES</Text>
          <View style={styles.rulesList}>
            {[
              { icon: 'numeric-2-box', label: 'Clear 2 lines', val: '→ send 1 line' },
              { icon: 'numeric-3-box', label: 'Clear 3 lines', val: '→ send 2 lines' },
              { icon: 'numeric-4-box', label: 'TETRIS (4 lines)', val: '→ send 4 lines' },
            ].map(r => (
              <View key={r.icon} style={styles.ruleItem}>
                <MaterialCommunityIcons name={r.icon as any} size={16} color={COLORS.yellow} />
                <Text style={styles.ruleLabel}>{r.label}</Text>
                <Text style={styles.ruleVal}>{r.val}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 16,
    paddingTop: 8,
  },
  myIdCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cyan + '44',
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  myIdLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 3,
  },
  myId: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 40,
    color: COLORS.cyan,
    letterSpacing: 6,
    textShadowColor: COLORS.cyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  myIdHint: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 9,
    color: COLORS.textDim,
    letterSpacing: 1,
  },
  inviteCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 12,
  },
  inviteTitle: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  inviteSubtitle: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.bgDeep,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    fontFamily: 'Orbitron_900Black',
    fontSize: 28,
    color: COLORS.textPrimary,
    letterSpacing: 8,
    textAlign: 'center',
  },
  error: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 10,
    color: COLORS.red,
    letterSpacing: 0.5,
  },
  inviteBtn: {
    backgroundColor: COLORS.cyan,
    borderRadius: 10,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inviteBtnText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 13,
    color: COLORS.bg,
    letterSpacing: 2,
  },
  waitingCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  waitingText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 13,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  waitingSubtext: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
  },
  cancelBtnText: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
  incomingCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cyan + '66',
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  incomingTitle: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 24,
    color: COLORS.cyan,
    letterSpacing: 4,
    textShadowColor: COLORS.cyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  incomingFrom: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 12,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  incomingActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
  },
  actionBtnText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 12,
    letterSpacing: 2,
  },
  rules: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 10,
  },
  rulesTitle: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 3,
  },
  rulesList: {
    gap: 8,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 10,
    color: COLORS.textPrimary,
    flex: 1,
    letterSpacing: 0.5,
  },
  ruleVal: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 10,
    color: COLORS.green,
    letterSpacing: 0.5,
  },
});
