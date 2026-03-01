import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

type WsMessage =
  | { type: 'register'; playerId?: string }
  | { type: 'invite'; targetId: string }
  | { type: 'respond_invite'; roomId: string; accept: boolean }
  | { type: 'game_event'; roomId: string; eventType: string; data: unknown }
  | { type: 'ping' };

type ServerMessage =
  | { type: 'registered'; playerId: string }
  | { type: 'invited'; fromId: string; fromName?: string; roomId: string }
  | { type: 'invite_sent'; targetId: string }
  | { type: 'invite_rejected'; targetId: string }
  | { type: 'player_not_found'; targetId: string }
  | { type: 'game_start'; roomId: string; opponentId: string }
  | { type: 'game_event'; eventType: string; data: unknown }
  | { type: 'opponent_disconnected' }
  | { type: 'error'; message: string }
  | { type: 'pong' };

interface PlayerEntry {
  ws: WebSocket;
  playerId: string;
}

const players = new Map<string, PlayerEntry>();
const rooms = new Map<string, [string, string]>();
const pendingInvites = new Map<string, { fromId: string; roomId: string }>();
let nextId = 10000;

function generatePlayerId(): string {
  const id = String(nextId++);
  if (players.has(id)) return generatePlayerId();
  return id;
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function getOpponentId(roomId: string, myId: string): string | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  return room[0] === myId ? room[1] : room[0];
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get('/api/player-exists/:id', (req, res) => {
    const { id } = req.params;
    res.json({ exists: players.has(id) });
  });

  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let playerId: string | null = null;

    ws.on('message', (raw: Buffer) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'ping') {
        send(ws, { type: 'pong' });
        return;
      }

      if (msg.type === 'register') {
        let id = msg.playerId;
        if (!id || players.has(id)) {
          id = generatePlayerId();
        }
        playerId = id;
        players.set(id, { ws, playerId: id });
        send(ws, { type: 'registered', playerId: id });
        return;
      }

      if (!playerId) {
        send(ws, { type: 'error', message: 'Not registered' });
        return;
      }

      if (msg.type === 'invite') {
        const target = players.get(msg.targetId);
        if (!target) {
          send(ws, { type: 'player_not_found', targetId: msg.targetId });
          return;
        }
        if (msg.targetId === playerId) {
          send(ws, { type: 'error', message: 'Cannot invite yourself' });
          return;
        }
        const roomId = `${playerId}-${msg.targetId}-${Date.now()}`;
        pendingInvites.set(msg.targetId, { fromId: playerId!, roomId });
        send(target.ws, { type: 'invited', fromId: playerId!, roomId });
        send(ws, { type: 'invite_sent', targetId: msg.targetId });
        return;
      }

      if (msg.type === 'respond_invite') {
        const invite = pendingInvites.get(playerId!);
        if (!invite || invite.roomId !== msg.roomId) {
          send(ws, { type: 'error', message: 'Invite not found' });
          return;
        }
        pendingInvites.delete(playerId!);

        const fromPlayer = players.get(invite.fromId);
        if (!fromPlayer) {
          send(ws, { type: 'error', message: 'Inviter disconnected' });
          return;
        }

        if (!msg.accept) {
          send(fromPlayer.ws, { type: 'invite_rejected', targetId: playerId! });
          return;
        }

        rooms.set(msg.roomId, [invite.fromId, playerId!]);
        send(fromPlayer.ws, { type: 'game_start', roomId: msg.roomId, opponentId: playerId! });
        send(ws, { type: 'game_start', roomId: msg.roomId, opponentId: invite.fromId });
        return;
      }

      if (msg.type === 'game_event') {
        const opponentId = getOpponentId(msg.roomId, playerId!);
        if (!opponentId) return;
        const opponent = players.get(opponentId);
        if (!opponent) return;
        send(opponent.ws, { type: 'game_event', eventType: msg.eventType, data: msg.data });
        return;
      }
    });

    ws.on('close', () => {
      if (!playerId) return;
      players.delete(playerId);

      for (const [roomId, [p1, p2]] of rooms.entries()) {
        if (p1 === playerId || p2 === playerId) {
          const opponentId = p1 === playerId ? p2 : p1;
          const opponent = players.get(opponentId);
          if (opponent) send(opponent.ws, { type: 'opponent_disconnected' });
          rooms.delete(roomId);
        }
      }
    });
  });

  return httpServer;
}
