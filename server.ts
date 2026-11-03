/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  Card,
  Suit,
  RoundConfig,
  createDeck,
  shuffleDeck,
  generateRounds,
  getForbiddenBid,
  getLegalCards,
  evaluateTrickWinner,
  calculateRoundPoints,
  calculateAIBid,
  selectAICard,
} from './src/game/rules.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const app = express();

// Enable CORS for iframe and cross-origin clients
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// ==========================================
// SERVER MULTIPLAYER ROOM TYPES & STORE
// ==========================================

export interface ServerRoomPlayer {
  id: string;
  name: string;
  avatar: string;
  isAi: boolean;
  seatIndex: number;
  isReady: boolean;
  score: number;
  bid: number | null;
  tricksWon: number;
}

export interface ServerPlayedCard {
  playerId: number; // seat index 0..N-1
  card: Card;
  playerName: string;
}

export interface ServerRoomState {
  roomId: string;
  roomName: string;
  hasPassword: boolean;
  password?: string;
  hostId: string;
  maxPlayers: number;
  status: 'lobby' | 'playing' | 'round_recap' | 'game_over';
  players: ServerRoomPlayer[];
  rounds: RoundConfig[];
  currentRoundIdx: number;
  phase: 'dealing' | 'inspecting' | 'bidding' | 'playing' | 'trick_eval' | 'round_recap';
  currentTurn: number;
  trumpCard: Card | null;
  trumpSuit: Suit | null;
  hands: Record<number, Card[]>; // seatIndex -> cards
  currentTrick: ServerPlayedCard[];
  winningCardId: string | null;
  trickWinnerBanner: {
    winnerName: string;
    reason: string;
    winningCard: Card;
  } | null;
  statusMessage: string;
  history: Array<{
    roundNumber: number;
    cardCount: number;
    trumpSuit: Suit | null;
    playerResults: Array<{
      bid: number | null;
      tricksWon: number;
      points: number;
      runningTotal: number;
    }>;
  }>;
  createdAt: number;
  updatedAt: number;
}

// Persistent room storage backed by /tmp/whist_online_rooms.json
const rooms = new Map<string, ServerRoomState>();
const ROOMS_FILE = path.join('/tmp', 'whist_online_rooms.json');

function saveRoomsToDisk() {
  try {
    const list = Array.from(rooms.entries());
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(list), 'utf-8');
  } catch (err) {
    console.warn('Could not save rooms to disk:', err);
  }
}

function loadRoomsFromDisk() {
  try {
    if (fs.existsSync(ROOMS_FILE)) {
      const data = fs.readFileSync(ROOMS_FILE, 'utf-8');
      const list: Array<[string, ServerRoomState]> = JSON.parse(data);
      const now = Date.now();
      let count = 0;
      list.forEach(([id, room]) => {
        // Retain rooms created or updated within the last 6 hours
        if (now - (room.updatedAt || room.createdAt || 0) < 6 * 3600 * 1000) {
          rooms.set(id, room);
          count++;
        }
      });
      console.log(`Whist server: restored ${count} persistent rooms from storage.`);
    }
  } catch (err) {
    console.warn('Could not load rooms from disk:', err);
  }
}

// Load existing rooms on process startup
loadRoomsFromDisk();

export function getRoomById(rawId: string): ServerRoomState | undefined {
  if (!rawId) return undefined;
  const clean = rawId.trim().toUpperCase();
  const withPrefix = clean.startsWith('WHIST-') ? clean : `WHIST-${clean}`;
  if (rooms.has(clean)) return rooms.get(clean);
  if (rooms.has(withPrefix)) return rooms.get(withPrefix);
  for (const [id, room] of rooms.entries()) {
    if (id.toUpperCase() === clean || id.toUpperCase() === withPrefix) {
      return room;
    }
  }
  return undefined;
}

// Map socket to connection metadata
const socketRooms = new Map<WebSocket, { roomId: string; playerId: string; seatIndex: number }>();

const DEFAULT_AI_NAMES = ['Radu (AI)', 'Elena (AI)', 'Mihai (AI)', 'Andrei (AI)', 'Ioana (AI)'];
const DEFAULT_AI_AVATARS = ['🦊', '🦉', '🐻', '🦁', '🐺'];

// Helper to build client-specific payload
function buildClientRoomPayload(room: ServerRoomState, seatIndex: number) {
  const serializedRoom = {
    roomId: room.roomId,
    roomName: room.roomName,
    hasPassword: room.hasPassword,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    status: room.status,
    players: room.players,
    roundsCount: room.rounds.length,
    currentRoundIdx: room.currentRoundIdx,
    currentRound: room.rounds[room.currentRoundIdx] || null,
    phase: room.phase,
    currentTurn: room.currentTurn,
    trumpCard: room.trumpCard,
    trumpSuit: room.trumpSuit,
    currentTrick: room.currentTrick,
    winningCardId: room.winningCardId,
    trickWinnerBanner: room.trickWinnerBanner,
    statusMessage: room.statusMessage,
    history: room.history,
    updatedAt: room.updatedAt,
  };

  const mySeat = Math.max(0, seatIndex);
  const myHand = room.hands[mySeat] || [];
  const legalCards =
    room.phase === 'playing' && room.currentTurn === mySeat
      ? getLegalCards(
          myHand,
          room.currentTrick.map((t) => ({ playerId: t.playerId, card: t.card })),
          room.trumpSuit,
          true
        )
      : [];

  const currentRound = room.rounds[room.currentRoundIdx];
  const isDealer = currentRound ? currentRound.dealerIndex === mySeat : false;
  const forbiddenBid =
    room.phase === 'bidding' && currentRound && isDealer
      ? getForbiddenBid(
          room.players.map((p) => p.bid),
          currentRound.cardCount,
          currentRound.dealerIndex,
          mySeat
        )
      : -1;

  return {
    room: serializedRoom,
    mySeat,
    myHand,
    legalCards,
    forbiddenBid,
  };
}

// Helper to broadcast room state to all players in that room
function broadcastRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const meta = socketRooms.get(client);
      if (meta && meta.roomId === roomId) {
        const payload = buildClientRoomPayload(room, meta.seatIndex);
        client.send(
          JSON.stringify({
            type: 'ROOM_STATE',
            ...payload,
          })
        );
      }
    }
  });

  // Also broadcast listing update to lobby
  broadcastRoomsList();
}

// Helper to broadcast room listings
function broadcastRoomsList() {
  const list = Array.from(rooms.values()).map((r) => ({
    id: r.roomId,
    name: r.roomName,
    hasPassword: r.hasPassword,
    hostId: r.hostId,
    playerCount: r.players.length,
    maxPlayers: r.maxPlayers,
    status: r.status,
    updatedAt: r.updatedAt,
  }));

  const payload = JSON.stringify({ type: 'ROOMS_LIST', rooms: list });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Helper to start next round in a room
function serverStartRound(room: ServerRoomState, roundIdx: number) {
  if (roundIdx >= room.rounds.length) {
    room.status = 'game_over';
    room.phase = 'round_recap';
    room.updatedAt = Date.now();
    broadcastRoom(room.roomId);
    return;
  }

  room.currentRoundIdx = roundIdx;
  const count = room.players.length;
  const round = room.rounds[roundIdx];
  const deck = shuffleDeck(createDeck(count));

  // Trump card extracted first
  let revealedTrump: Card | null = null;
  let revealedTrumpSuit: Suit | null = null;
  if (round.hasTrump && deck.length > 0) {
    revealedTrump = deck.pop() || null;
    revealedTrumpSuit = revealedTrump?.suit || null;
  }

  // Deal cards
  room.hands = {};
  for (let p = 0; p < count; p++) {
    room.hands[p] = [];
  }
  for (let c = 0; c < round.cardCount; c++) {
    for (let p = 0; p < count; p++) {
      const card = deck.pop();
      if (card) room.hands[p].push(card);
    }
  }

  // Sort hands
  for (let p = 0; p < count; p++) {
    room.hands[p].sort((a, b) => {
      if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
      return b.rank - a.rank;
    });
  }

  room.trumpCard = revealedTrump;
  room.trumpSuit = revealedTrumpSuit;
  room.currentTrick = [];
  room.winningCardId = null;
  room.trickWinnerBanner = null;

  // Reset player bids and tricks
  room.players.forEach((p) => {
    p.bid = null;
    p.tricksWon = 0;
  });

  room.phase = 'inspecting';
  room.status = 'playing';
  room.statusMessage = `Runda ${roundIdx + 1} (${round.cardCount} ${
    round.cardCount === 1 ? 'carte' : 'cărți'
  }). Licitația începe în 5 secunde.`;
  room.updatedAt = Date.now();
  broadcastRoom(room.roomId);

  // Auto transition from inspecting to bidding after 5 seconds
  setTimeout(() => {
    const current = rooms.get(room.roomId);
    if (current && current.phase === 'inspecting' && current.currentRoundIdx === roundIdx) {
      serverStartBidding(current);
    }
  }, 5000);
}

function serverStartBidding(room: ServerRoomState) {
  const round = room.rounds[room.currentRoundIdx];
  if (!round) return;

  room.phase = 'bidding';
  const firstBidder = (round.dealerIndex + 1) % room.players.length;
  room.currentTurn = firstBidder;
  room.statusMessage = `Licitează ${room.players[firstBidder]?.name || 'Jucător'}...`;
  room.updatedAt = Date.now();
  broadcastRoom(room.roomId);

  // Check if first bidder is AI
  checkAndRunAiTurn(room);
}

function checkAndRunAiTurn(room: ServerRoomState) {
  if (room.status !== 'playing') return;

  const player = room.players[room.currentTurn];
  if (!player || !player.isAi) return;

  if (room.phase === 'bidding') {
    setTimeout(() => {
      const current = rooms.get(room.roomId);
      if (!current || current.phase !== 'bidding') return;
      const round = current.rounds[current.currentRoundIdx];
      const aiHand = current.hands[current.currentTurn] || [];
      const bidsSoFar = current.players.map((p) => p.bid);

      const aiBid = calculateAIBid(
        aiHand,
        current.trumpSuit,
        round.cardCount,
        bidsSoFar,
        round.dealerIndex,
        current.currentTurn
      );
      serverPlaceBid(current, current.currentTurn, aiBid);
    }, 600);
  } else if (room.phase === 'playing') {
    setTimeout(() => {
      const current = rooms.get(room.roomId);
      if (!current || current.phase !== 'playing') return;
      const aiHand = current.hands[current.currentTurn] || [];
      if (aiHand.length === 0) return;

      const trickForRules = current.currentTrick.map((t) => ({
        playerId: t.playerId,
        card: t.card,
      }));
      const legalCards = getLegalCards(aiHand, trickForRules, current.trumpSuit, true);
      const chosenCard = selectAICard(
        legalCards,
        trickForRules,
        current.trumpSuit,
        player.bid ?? 0,
        player.tricksWon ?? 0,
        aiHand.length
      );
      serverPlayCard(current, current.currentTurn, chosenCard);
    }, 700);
  }
}

function serverPlaceBid(room: ServerRoomState, seatIndex: number, bid: number) {
  if (room.phase !== 'bidding' || room.currentTurn !== seatIndex) return;
  const player = room.players[seatIndex];
  if (!player) return;

  player.bid = bid;
  const allBidsPlaced = room.players.every((p) => p.bid !== null);

  if (allBidsPlaced) {
    const round = room.rounds[room.currentRoundIdx];
    const firstPlayerToPlay = (round.dealerIndex + 1) % room.players.length;
    room.phase = 'playing';
    room.currentTurn = firstPlayerToPlay;
    room.statusMessage = `Licitații încheiate. ${room.players[firstPlayerToPlay]?.name} începe cupa!`;
  } else {
    const nextBidder = (seatIndex + 1) % room.players.length;
    room.currentTurn = nextBidder;
    room.statusMessage = `Licitează ${room.players[nextBidder]?.name}...`;
  }

  room.updatedAt = Date.now();
  broadcastRoom(room.roomId);
  checkAndRunAiTurn(room);
}

function serverPlayCard(room: ServerRoomState, seatIndex: number, card: Card) {
  if (room.phase !== 'playing' || room.currentTurn !== seatIndex) return;
  const player = room.players[seatIndex];
  if (!player) return;

  // Remove card from hand
  const hand = room.hands[seatIndex] || [];
  room.hands[seatIndex] = hand.filter((c) => c.id !== card.id);

  // Add to trick
  room.currentTrick.push({
    playerId: seatIndex,
    card,
    playerName: player.name,
  });

  if (room.currentTrick.length === room.players.length) {
    // Trick complete: evaluate winner
    room.phase = 'trick_eval';
    const trickForRules = room.currentTrick.map((t) => ({ playerId: t.playerId, card: t.card }));
    const evalResult = evaluateTrickWinner(trickForRules, room.trumpSuit);
    const winnerSeat = evalResult.winnerPlayerId;
    const winnerPlayer = room.players[winnerSeat];

    winnerPlayer.tricksWon += 1;
    room.winningCardId = evalResult.winningCard.id;
    room.trickWinnerBanner = {
      winnerName: winnerPlayer.name,
      reason: evalResult.reason,
      winningCard: evalResult.winningCard,
    };
    room.statusMessage = `${winnerPlayer.name} a câștigat mâna! (${evalResult.reason})`;
    room.updatedAt = Date.now();
    broadcastRoom(room.roomId);

    // Check if round is over
    const round = room.rounds[room.currentRoundIdx];
    const totalTricksInRound = room.players.reduce((sum, p) => sum + p.tricksWon, 0);
    const isRoundOver = totalTricksInRound >= round.cardCount;

    setTimeout(() => {
      const current = rooms.get(room.roomId);
      if (!current) return;

      current.currentTrick = [];
      current.winningCardId = null;
      current.trickWinnerBanner = null;

      if (isRoundOver) {
        // Finalize round scoring
        const roundResults = current.players.map((p) => {
          const pts = calculateRoundPoints(p.bid ?? 0, p.tricksWon);
          p.score += pts;
          return {
            bid: p.bid,
            tricksWon: p.tricksWon,
            points: pts,
            runningTotal: p.score,
          };
        });

        current.history.push({
          roundNumber: current.currentRoundIdx + 1,
          cardCount: round.cardCount,
          trumpSuit: current.trumpSuit,
          playerResults: roundResults,
        });

        current.phase = 'round_recap';
        current.statusMessage = `Runda ${current.currentRoundIdx + 1} s-a încheiat!`;
        current.updatedAt = Date.now();
        broadcastRoom(current.roomId);
      } else {
        current.phase = 'playing';
        current.currentTurn = winnerSeat;
        current.statusMessage = `${winnerPlayer.name} începe următoarea cupă.`;
        current.updatedAt = Date.now();
        broadcastRoom(current.roomId);
        checkAndRunAiTurn(current);
      }
    }, 1700);
  } else {
    // Next player's turn
    const nextTurn = (seatIndex + 1) % room.players.length;
    room.currentTurn = nextTurn;
    room.statusMessage = `Rândul lui ${room.players[nextTurn]?.name}...`;
    room.updatedAt = Date.now();
    broadcastRoom(room.roomId);
    checkAndRunAiTurn(room);
  }
}

// ==========================================
// SHARED ROOM LOGIC (USED BY BOTH WS & REST)
// ==========================================

function createRoomLogic(
  roomName: string,
  password: string | undefined,
  maxPlayers: number,
  hostPlayer: { id: string; name: string; avatar?: string }
) {
  const roomId = `WHIST-${Math.floor(1000 + Math.random() * 9000)}`;
  const newRoom: ServerRoomState = {
    roomId,
    roomName: roomName?.trim() || 'Masa de Whist Românesc',
    hasPassword: !!password && password.trim().length > 0,
    password: password ? password.trim() : undefined,
    hostId: hostPlayer.id,
    maxPlayers: Math.min(6, Math.max(3, maxPlayers || 4)),
    status: 'lobby',
    players: [
      {
        id: hostPlayer.id,
        name: hostPlayer.name || 'Gazdă',
        avatar: hostPlayer.avatar || '👑',
        isAi: false,
        seatIndex: 0,
        isReady: true,
        score: 0,
        bid: null,
        tricksWon: 0,
      },
    ],
    rounds: [],
    currentRoundIdx: 0,
    phase: 'dealing',
    currentTurn: 0,
    trumpCard: null,
    trumpSuit: null,
    hands: {},
    currentTrick: [],
    winningCardId: null,
    trickWinnerBanner: null,
    statusMessage: 'Sală creată. Așteptare jucători...',
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  rooms.set(roomId, newRoom);
  broadcastRoomsList();
  const payload = buildClientRoomPayload(newRoom, 0);
  return { roomId, ...payload };
}

function joinRoomLogic(
  roomId: string,
  player: { id: string; name: string; avatar?: string },
  password?: string
): { success: true; payload: ReturnType<typeof buildClientRoomPayload> } | { success: false; error: string } {
  const room = getRoomById(roomId);
  if (!room) {
    return { success: false, error: `Camera '${roomId}' nu există sau a expirat!` };
  }
  if (room.hasPassword && room.password !== password) {
    return { success: false, error: 'Parolă incorectă!' };
  }
  const existingIndex = room.players.findIndex((p) => p.id === player.id);
  if (existingIndex >= 0) {
    const payload = buildClientRoomPayload(room, existingIndex);
    return { success: true, payload };
  }
  if (room.players.length >= room.maxPlayers) {
    return { success: false, error: 'Camera este plină!' };
  }
  if (room.status !== 'lobby') {
    return { success: false, error: 'Partida a început deja!' };
  }

  const seatIndex = room.players.length;
  const newPlayer: ServerRoomPlayer = {
    id: player.id,
    name: player.name,
    avatar: player.avatar || '😎',
    isAi: false,
    seatIndex,
    isReady: false,
    score: 0,
    bid: null,
    tricksWon: 0,
  };

  room.players.push(newPlayer);
  room.updatedAt = Date.now();
  saveRoomsToDisk();
  broadcastRoom(room.roomId);
  broadcastRoomsList();

  const payload = buildClientRoomPayload(room, seatIndex);
  return { success: true, payload };
}

function handleRoomActionLogic(roomId: string, data: any): { success: boolean; error?: string } {
  const room = getRoomById(roomId);
  if (!room) return { success: false, error: `Camera '${roomId}' nu există!` };

  const { type, playerId, seatIndex, bid, card } = data;

  if (type === 'ADD_AI') {
    if (room.status !== 'lobby' || room.players.length >= room.maxPlayers) {
      return { success: false, error: 'Camera este plină' };
    }
    const idx = room.players.length;
    const aiName = DEFAULT_AI_NAMES[idx - 1] || `AI ${idx}`;
    const aiAvatar = DEFAULT_AI_AVATARS[idx - 1] || '🤖';
    room.players.push({
      id: `ai-${idx}-${Date.now()}`,
      name: aiName,
      avatar: aiAvatar,
      isAi: true,
      seatIndex: idx,
      isReady: true,
      score: 0,
      bid: null,
      tricksWon: 0,
    });
    room.updatedAt = Date.now();
    broadcastRoom(roomId);
    return { success: true };
  }

  if (type === 'TOGGLE_READY') {
    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.isReady = !player.isReady;
      room.updatedAt = Date.now();
      broadcastRoom(roomId);
      return { success: true };
    }
    return { success: false, error: 'Jucătorul nu a fost găsit' };
  }

  if (type === 'START_ROOM_GAME') {
    if (room.status !== 'lobby') return { success: false, error: 'Partida a început deja' };
    while (room.players.length < Math.max(3, room.maxPlayers)) {
      const idx = room.players.length;
      const aiName = DEFAULT_AI_NAMES[idx - 1] || `AI ${idx}`;
      const aiAvatar = DEFAULT_AI_AVATARS[idx - 1] || '🤖';
      room.players.push({
        id: `ai-${idx}-${Date.now()}`,
        name: aiName,
        avatar: aiAvatar,
        isAi: true,
        seatIndex: idx,
        isReady: true,
        score: 0,
        bid: null,
        tricksWon: 0,
      });
    }
    const count = room.players.length;
    room.rounds = generateRounds(count);
    room.status = 'playing';
    serverStartRound(room, 0);
    return { success: true };
  }

  if (type === 'START_BIDDING') {
    if (room.phase === 'inspecting') {
      serverStartBidding(room);
    }
    return { success: true };
  }

  if (type === 'PLACE_BID') {
    serverPlaceBid(room, seatIndex, bid);
    return { success: true };
  }

  if (type === 'PLAY_CARD') {
    serverPlayCard(room, seatIndex, card);
    return { success: true };
  }

  if (type === 'NEXT_ROUND') {
    if (room.phase === 'round_recap') {
      serverStartRound(room, room.currentRoundIdx + 1);
    }
    return { success: true };
  }

  if (type === 'LEAVE_ROOM') {
    room.players = room.players.filter((p) => p.id !== playerId);
    const hasHuman = room.players.some((p) => !p.isAi);
    if (room.players.length === 0 || !hasHuman) {
      rooms.delete(roomId);
    } else {
      room.players.forEach((p, idx) => {
        p.seatIndex = idx;
      });
      if (room.hostId === playerId && room.players[0]) {
        room.hostId = room.players[0].id;
      }
      broadcastRoom(roomId);
    }
    broadcastRoomsList();
    return { success: true };
  }

  return { success: false, error: 'Acțiune necunoscută' };
}

// ==========================================
// WEBSOCKET CONNECTION HANDLER
// ==========================================
wss.on('connection', (ws: WebSocket) => {
  broadcastRoomsList();

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      const { type } = data;

      if (type === 'GET_ROOMS') {
        broadcastRoomsList();
      } else if (type === 'CREATE_ROOM') {
        const { roomName, password, maxPlayers = 4, hostPlayer } = data;
        const result = createRoomLogic(roomName, password, maxPlayers, hostPlayer);
        socketRooms.set(ws, { roomId: result.roomId, playerId: hostPlayer.id, seatIndex: 0 });
        ws.send(JSON.stringify({ type: 'ROOM_STATE', ...result }));
      } else if (type === 'JOIN_ROOM') {
        const { roomId, player, password } = data;
        const result = joinRoomLogic(roomId, player, password);
        if (!result.success) {
          ws.send(JSON.stringify({ type: 'ERROR', message: result.error }));
          return;
        }
        socketRooms.set(ws, { roomId, playerId: player.id, seatIndex: result.payload.mySeat });
        ws.send(JSON.stringify({ type: 'ROOM_STATE', ...result.payload }));
      } else {
        const { roomId } = data;
        handleRoomActionLogic(roomId, data);
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    socketRooms.delete(ws);
  });
});

// ==========================================
// REST API ENDPOINTS
// ==========================================
app.get('/api/rooms', (_req: Request, res: Response) => {
  const list = Array.from(rooms.values()).map((r) => ({
    id: r.roomId,
    name: r.roomName,
    hasPassword: r.hasPassword,
    hostId: r.hostId,
    playerCount: r.players.length,
    maxPlayers: r.maxPlayers,
    status: r.status,
    updatedAt: r.updatedAt,
  }));
  res.json({ rooms: list });
});

app.post('/api/rooms/create', (req: Request, res: Response) => {
  const { roomName, password, maxPlayers = 4, hostPlayer } = req.body;
  if (!hostPlayer?.id) {
    res.status(400).json({ error: 'Jucător invalid' });
    return;
  }
  const result = createRoomLogic(roomName, password, maxPlayers, hostPlayer);
  saveRoomsToDisk();
  res.json({ success: true, ...result });
});

app.post('/api/rooms/:id/join', (req: Request, res: Response) => {
  const { player, password } = req.body;
  if (!player?.id) {
    res.status(400).json({ error: 'Jucător invalid' });
    return;
  }
  const result = joinRoomLogic(req.params.id, player, password);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  saveRoomsToDisk();
  res.json({ success: true, ...result.payload });
});

app.get('/api/rooms/:id/state', (req: Request, res: Response) => {
  const room = getRoomById(req.params.id);
  if (!room) {
    res.status(404).json({ error: 'Camera nu a fost găsită' });
    return;
  }
  const playerId = (req.query.playerId as string) || '';
  const seatIndex = room.players.findIndex((p) => p.id === playerId);
  const payload = buildClientRoomPayload(room, seatIndex >= 0 ? seatIndex : 0);
  res.json({ success: true, ...payload });
});

app.post('/api/rooms/:id/action', (req: Request, res: Response) => {
  const result = handleRoomActionLogic(req.params.id, req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  saveRoomsToDisk();
  const playerId = req.body.playerId || '';
  const room = getRoomById(req.params.id);
  if (room) {
    const seatIndex = room.players.findIndex((p) => p.id === playerId);
    const payload = buildClientRoomPayload(room, seatIndex >= 0 ? seatIndex : 0);
    res.json({ success: true, ...payload });
  } else {
    res.json({ success: true });
  }
});

app.get('/api/rooms/:id', (req: Request, res: Response) => {
  const room = getRoomById(req.params.id);
  if (!room) {
    res.status(404).json({ error: 'Camera nu a fost găsită' });
    return;
  }
  res.json({
    room: {
      roomId: room.roomId,
      roomName: room.roomName,
      hasPassword: room.hasPassword,
      hostId: room.hostId,
      maxPlayers: room.maxPlayers,
      playerCount: room.players.length,
      status: room.status,
    },
  });
});

// ==========================================
// VITE MIDDLEWARES / STATIC ASSETS
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Whist Românesc running on port ${PORT}`);
  });
}

startServer();
