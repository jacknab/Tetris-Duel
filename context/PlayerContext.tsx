import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '@/lib/query-client';

export type WsEventHandler = (data: unknown) => void;

interface PlayerContextValue {
  playerId: string | null;
  wsReady: boolean;
  sendWs: (msg: object) => void;
  onWsEvent: (type: string, handler: WsEventHandler) => () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

function getWsUrl(): string {
  const apiUrl = getApiUrl();
  const url = new URL(apiUrl);
  const proto = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${url.host}/ws`;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [wsReady, setWsReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<WsEventHandler>>>(new Map());
  const pendingMessages = useRef<object[]>([]);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storedIdRef = useRef<string | null>(null);

  const emit = useCallback((type: string, data: unknown) => {
    const handlers = handlersRef.current.get(type);
    if (handlers) {
      handlers.forEach(h => h(data));
    }
  }, []);

  const sendWs = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      pendingMessages.current.push(msg);
    }
  }, []);

  const onWsEvent = useCallback((type: string, handler: WsEventHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    try {
      const wsUrl = getWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsReady(true);
        ws.send(JSON.stringify({ type: 'register', playerId: storedIdRef.current ?? undefined }));
        pendingMessages.current.forEach(m => ws.send(JSON.stringify(m)));
        pendingMessages.current = [];
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'registered') {
            setPlayerId(msg.playerId);
            storedIdRef.current = msg.playerId;
            AsyncStorage.setItem('playerId', msg.playerId);
          }
          emit(msg.type, msg);
        } catch {}
      };

      ws.onclose = () => {
        setWsReady(false);
        reconnectTimer.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {}
  }, [emit]);

  useEffect(() => {
    AsyncStorage.getItem('playerId').then(id => {
      storedIdRef.current = id;
      connect();
    });

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const value = useMemo(() => ({ playerId, wsReady, sendWs, onWsEvent }), [
    playerId, wsReady, sendWs, onWsEvent
  ]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
