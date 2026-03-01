import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
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
  const inviteRef = useRef<{ fromId: string; roomId: string } | null>(null);

  useEffect(() => {
    const unsubInvite = onWsEvent('invited', (data: any) => {
      inviteRef.current = { fromId: data.fromId, roomId: data.roomId };
      setInvite({ fromId: data.fromId, roomId: data.roomId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

    const unsubStart = onWsEvent('game_start', (data: any) => {
      setInvite(null);
      inviteRef.current = null;
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
    inviteRef.current = null;
  };

  if (!invite) return null;

  return (
    <Modal transparent animationType="fade" visible={!!invite}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <MaterialCommunityIcons name="sword-cross" size={44} color={COLORS.cyan} />
          <Text style={modalStyles.title}>CHALLENGE!</Text>
          <Text style={modalStyles.sub}>
            Player <Text style={{ color: COLORS.cyan, fontFamily: 'Orbitron_700Bold' }}>{invite.fromId}</Text>
          </Text>
          <Text style={modalStyles.sub}>wants to battle you</Text>
          <View style={modalStyles.actions}>
            <Pressable style={[modalStyles.btn, { backgroundColor: COLORS.cyan }]} onPress={handleAccept}>
              <Text style={[modalStyles.btnText, { color: COLORS.bg }]}>ACCEPT</Text>
            </Pressable>
            <Pressable style={[modalStyles.btn, { borderColor: COLORS.red, borderWidth: 1.5 }]} onPress={handleDecline}>
              <Text style={[modalStyles.btnText, { color: COLORS.red }]}>DECLINE</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,10,15,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.cyan + '55',
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 26,
    color: COLORS.cyan,
    letterSpacing: 4,
    textShadowColor: COLORS.cyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
    marginTop: 4,
  },
  sub: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 12,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 13,
    letterSpacing: 2,
  },
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
