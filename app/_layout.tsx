import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { PlayerProvider, usePlayer } from "@/context/PlayerContext";
import { useFonts, Orbitron_400Regular, Orbitron_700Bold, Orbitron_900Black } from "@expo-google-fonts/orbitron";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

function GlobalInviteHandler() {
  const { onWsEvent, sendWs } = usePlayer();
  const [invite, setInvite] = useState<{ fromId: string; roomId: string } | null>(null);

  useEffect(() => {
    const unsubInvite = onWsEvent('invited', (data: any) => {
      setInvite({ fromId: data.fromId, roomId: data.roomId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
    const unsubStart = onWsEvent('game_start', (data: any) => {
      setInvite(null);
      router.push({
        pathname: '/battle',
        params: { roomId: data.roomId, opponentId: data.opponentId },
      });
    });
    return () => { unsubInvite(); unsubStart(); };
  }, [onWsEvent]);

  const handleAccept = () => {
    if (!invite) return;
    sendWs({ type: 'respond_invite', roomId: invite.roomId, accept: true });
    setInvite(null);
  };

  const handleDecline = () => {
    if (!invite) return;
    sendWs({ type: 'respond_invite', roomId: invite.roomId, accept: false });
    setInvite(null);
  };

  if (!invite) return null;

  return (
    <Modal transparent animationType="fade" visible={!!invite}>
      <View style={modalStyles.overlay}>
        <LinearGradient
          colors={['rgba(45,0,128,0.96)', 'rgba(74,0,26,0.97)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={modalStyles.card}>
          <LinearGradient
            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={modalStyles.icon}>
            <LinearGradient colors={[COLORS.pink, COLORS.purple]} style={StyleSheet.absoluteFill} />
            <MaterialCommunityIcons name="sword-cross" size={36} color={COLORS.white} />
          </View>
          <Text style={modalStyles.title}>CHALLENGE!</Text>
          <Text style={modalStyles.fromLine}>
            Player <Text style={{ color: COLORS.cyan, fontFamily: 'Orbitron_700Bold' }}>{invite.fromId}</Text>
          </Text>
          <Text style={modalStyles.sub}>wants to battle you!</Text>
          <View style={modalStyles.actions}>
            <Pressable style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.85 : 1 }]} onPress={handleAccept}>
              <LinearGradient colors={[COLORS.green + 'ee', '#00b84a']} style={modalStyles.btn}>
                <Text style={modalStyles.btnText}>ACCEPT</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={({ pressed }) => [modalStyles.btnDecline, { opacity: pressed ? 0.85 : 1 }]} onPress={handleDecline}>
              <Text style={[modalStyles.btnText, { color: COLORS.pink }]}>DECLINE</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  card: {
    width: '100%', borderRadius: 24, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)', padding: 28,
    alignItems: 'center', gap: 8, overflow: 'hidden',
  },
  icon: {
    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    marginBottom: 4, overflow: 'hidden',
    shadowColor: COLORS.pink, shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  title: {
    fontFamily: 'Orbitron_900Black', fontSize: 28, color: COLORS.white, letterSpacing: 4,
    textShadowColor: COLORS.pink, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18,
  },
  fromLine: { fontFamily: 'Orbitron_400Regular', fontSize: 13, color: COLORS.white, letterSpacing: 1 },
  sub: { fontFamily: 'Orbitron_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' },
  btn: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.green, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  btnDecline: {
    flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.pink + '66',
  },
  btnText: { fontFamily: 'Orbitron_700Bold', fontSize: 14, color: COLORS.white, letterSpacing: 2 },
});

function RootLayoutNav() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="game" />
        <Stack.Screen name="lobby" />
        <Stack.Screen name="battle" />
      </Stack>
      <GlobalInviteHandler />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Orbitron_400Regular,
    Orbitron_700Bold,
    Orbitron_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <PlayerProvider>
            <RootLayoutNav />
          </PlayerProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
