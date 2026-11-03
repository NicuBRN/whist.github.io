/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase.ts';

/**
 * Remove undefined properties recursively so Firestore does not reject with invalid-argument error
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const res: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      if (val !== undefined) {
        res[key] = cleanForFirestore(val);
      }
    }
    return res as T;
  }
  return data;
}
import {
  GameModeType,
  Card,
  Suit,
  Rank,
  createDeck,
  shuffleDeck,
  generateRounds,
  getLegalCards,
  getForbiddenBid,
  evaluateTrickWinner,
  calculateRoundPoints,
  calculateAIBid,
  selectAICard,
} from '../game/rules.ts';

export interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  isAi: boolean;
  seatIndex: number;
  isReady: boolean;
  score: number;
  bid?: number | null;
  tricksWon?: number;
}

export interface RoomTrickCard {
  playerId: number;
  card: Card;
  playerName: string;
}

export interface RoomSyncState {
  roomId: string;
  roomName: string;
  hasPassword: boolean;
  password?: string;
  gameMode?: GameModeType;
  hostId: string;
  maxPlayers: number;
  status: 'lobby' | 'playing' | 'round_recap' | 'game_over';
  players: RoomPlayer[];
  roundsCount?: number;
  currentRoundIdx: number;
  currentRound?: {
    roundNumber: number;
    cardCount: number;
    hasTrump: boolean;
    dealerIndex: number;
  } | null;
  phase: 'dealing' | 'inspecting' | 'bidding' | 'playing' | 'trick_eval' | 'round_recap';
  currentTurn: number;
  trumpSuit: Suit | null;
  trumpCard: Card | null;
  currentTrick: RoomTrickCard[];
  winningCardId?: string | null;
  trickWinnerBanner?: {
    winnerName: string;
    reason: string;
    winningCard: Card;
  } | null;
  statusMessage?: string;
  history?: Array<{
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
  aiHands?: Record<string, Card[]>;
  updatedAt: number;
}

export interface RoomListing {
  id: string;
  name: string;
  hasPassword: boolean;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  status: 'lobby' | 'playing' | 'round_recap' | 'game_over';
  updatedAt: number;
}

export interface RoomStatePayload {
  room: RoomSyncState;
  mySeat: number;
  myHand: Card[];
  legalCards: Card[];
  forbiddenBid: number;
}

export function normalizeRoomCode(code: string): string {
  if (!code) return '';
  let clean = code.trim().toUpperCase();
  clean = clean.replace(/^[#\s]+/, '');
  clean = clean.replace(/^WHIST[\s\-_:]*/i, '');
  if (!clean) return '';
  return `WHIST-${clean}`;
}

type RoomsListListener = (rooms: RoomListing[]) => void;
type RoomStateListener = (data: RoomStatePayload) => void;
type ErrorListener = (errorMsg: string) => void;

const DEFAULT_AI_NAMES = ['Radu (AI)', 'Elena (AI)', 'Mihai (AI)', 'Andrei (AI)', 'Ioana (AI)'];
const DEFAULT_AI_AVATARS = ['🦊', '🦉', '🐻', '🦁', '🐺'];

class RealtimeMultiplayerService {
  private roomsListListeners: RoomsListListener[] = [];
  private roomStateListeners: RoomStateListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private cachedRooms: RoomListing[] = [];
  private cachedRoomState: RoomStatePayload | null = null;
  private activeRoomId: string | null = null;
  private activePlayerId: string = 'user-1';
  private roomDocUnsub: Unsubscribe | null = null;
  private handDocUnsub: Unsubscribe | null = null;
  private roomsListUnsub: Unsubscribe | null = null;
  private scheduledTurnKey: string | null = null;
  private aiTurnTimeout: ReturnType<typeof setTimeout> | null = null;
  private watchdogInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initRoomsListSubscription();
    }
  }

  // Subscribe to public rooms list in Firestore
  private initRoomsListSubscription() {
    try {
      const roomsQuery = query(collection(db, 'rooms'), limit(50));
      this.roomsListUnsub = onSnapshot(
        roomsQuery,
        (snapshot) => {
          const list: RoomListing[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Partial<RoomSyncState>;
            if (data && data.roomId) {
              list.push({
                id: data.roomId,
                name: data.roomName || 'Masă Whist',
                hasPassword: !!data.hasPassword,
                hostId: data.hostId || '',
                playerCount: Array.isArray(data.players) ? data.players.length : 1,
                maxPlayers: data.maxPlayers || 4,
                status: data.status || 'lobby',
                updatedAt: data.updatedAt || Date.now(),
              });
            }
          });
          // Sort by latest activity
          list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          this.cachedRooms = list;
          this.roomsListListeners.forEach((l) => l(list));
        },
        (error) => {
          console.warn('Rooms list snapshot warning:', error);
        }
      );
    } catch (e) {
      console.warn('Failed to setup Firestore rooms list subscription:', e);
    }
  }

  public getCachedRooms(): RoomListing[] {
    return this.cachedRooms;
  }

  public getCachedRoomState(): RoomStatePayload | null {
    return this.cachedRoomState;
  }

  public subscribeRoomsList(listener: RoomsListListener): () => void {
    this.roomsListListeners.push(listener);
    listener(this.cachedRooms);
    return () => {
      this.roomsListListeners = this.roomsListListeners.filter((l) => l !== listener);
    };
  }

  public subscribeRoomState(listener: RoomStateListener): () => void {
    this.roomStateListeners.push(listener);
    if (this.cachedRoomState) {
      listener(this.cachedRoomState);
    }
    return () => {
      this.roomStateListeners = this.roomStateListeners.filter((l) => l !== listener);
    };
  }

  public subscribeErrors(listener: ErrorListener): () => void {
    this.errorListeners.push(listener);
    return () => {
      this.errorListeners = this.errorListeners.filter((l) => l !== listener);
    };
  }

  public async fetchInitialRooms(): Promise<RoomListing[]> {
    try {
      const snap = await getDocs(query(collection(db, 'rooms'), limit(50)));
      const list: RoomListing[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Partial<RoomSyncState>;
        if (data && data.roomId) {
          list.push({
            id: data.roomId,
            name: data.roomName || 'Masă Whist',
            hasPassword: !!data.hasPassword,
            hostId: data.hostId || '',
            playerCount: Array.isArray(data.players) ? data.players.length : 1,
            maxPlayers: data.maxPlayers || 4,
            status: data.status || 'lobby',
            updatedAt: data.updatedAt || Date.now(),
          });
        }
      });
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      this.cachedRooms = list;
      this.roomsListListeners.forEach((l) => l(list));
      return list;
    } catch (err) {
      console.warn('fetchInitialRooms error:', err);
      return this.cachedRooms;
    }
  }

  // Fetch Room Info by code
  public async fetchRoomInfo(rawRoomId: string): Promise<RoomListing | null> {
    const roomId = normalizeRoomCode(rawRoomId);
    if (!roomId) return null;
    try {
      const docRef = doc(db, 'rooms', roomId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as RoomSyncState;
        return {
          id: data.roomId,
          name: data.roomName,
          hasPassword: data.hasPassword,
          hostId: data.hostId,
          playerCount: data.players.length,
          maxPlayers: data.maxPlayers,
          status: data.status,
          updatedAt: data.updatedAt,
        };
      }
    } catch {
      // Ignored
    }
    return this.cachedRooms.find((r) => r.id === roomId) || null;
  }

  // Create Room in Firestore
  public async createRoom(
    roomName: string,
    password?: string,
    maxPlayers: number = 4,
    hostPlayer: { id: string; name: string; avatar?: string } = {
      id: 'host-1',
      name: 'Tu',
      avatar: '👑',
    }
  ): Promise<RoomStatePayload> {
    this.activePlayerId = hostPlayer.id;
    const roomId = `WHIST-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRoom: RoomSyncState = {
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
      currentRoundIdx: 0,
      phase: 'dealing',
      currentTurn: 0,
      trumpCard: null,
      trumpSuit: null,
      currentTrick: [],
      winningCardId: null,
      trickWinnerBanner: null,
      statusMessage: 'Sală creată. Așteptare jucători...',
      history: [],
      updatedAt: Date.now(),
    };

    const payload: RoomStatePayload = {
      room: newRoom,
      mySeat: 0,
      myHand: [],
      legalCards: [],
      forbiddenBid: -1,
    };

    this.activeRoomId = roomId;
    this.cachedRoomState = payload;
    this.roomStateListeners.forEach((l) => l(payload));

    // Save to Firestore
    try {
      const cleanData = cleanForFirestore(newRoom);
      await setDoc(doc(db, 'rooms', roomId), cleanData);
      this.subscribeActiveRoom(roomId, 0);
    } catch (e) {
      console.error('Error saving room to Firestore:', e);
      throw new Error('Eroare la salvarea camerei pe server! Vă rugăm să reîncercați.');
    }

    return payload;
  }

  // Join Room in Firestore
  public async joinRoom(
    rawRoomId: string,
    player: { id: string; name: string; avatar?: string },
    password?: string
  ): Promise<{ success: boolean; payload?: RoomStatePayload; error?: string }> {
    const roomId = normalizeRoomCode(rawRoomId);
    if (!roomId) {
      return { success: false, error: 'Cod de cameră invalid!' };
    }
    this.activePlayerId = player.id;

    try {
      const roomRef = doc(db, 'rooms', roomId);
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        return { success: false, error: `Camera '${roomId}' nu a fost găsită pe server!` };
      }

      const room = snap.data() as RoomSyncState;
      if (room.hasPassword && room.password !== password) {
        return { success: false, error: 'Parolă incorectă!' };
      }

      const existingIndex = room.players.findIndex((p) => p.id === player.id);
      let seatIndex = existingIndex;

      if (existingIndex < 0) {
        if (room.players.length >= room.maxPlayers) {
          return { success: false, error: 'Camera este plină!' };
        }
        if (room.status !== 'lobby') {
          return { success: false, error: 'Partida a început deja!' };
        }

        seatIndex = room.players.length;
        const newPlayer: RoomPlayer = {
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
        await updateDoc(roomRef, cleanForFirestore({
          players: room.players,
          updatedAt: room.updatedAt,
        }));
      }

      const payload: RoomStatePayload = {
        room,
        mySeat: seatIndex,
        myHand: this.cachedRoomState?.myHand || [],
        legalCards: [],
        forbiddenBid: -1,
      };

      this.activeRoomId = roomId;
      this.cachedRoomState = payload;
      this.roomStateListeners.forEach((l) => l(payload));
      this.subscribeActiveRoom(roomId, seatIndex);

      return { success: true, payload };
    } catch (err) {
      console.error('joinRoom error:', err);
      return { success: false, error: 'Eroare de conexiune la server!' };
    }
  }

  // Subscribe to active room document and private hand subcollection
  private subscribeActiveRoom(roomId: string, seatIndex: number) {
    if (this.roomDocUnsub) {
      this.roomDocUnsub();
      this.roomDocUnsub = null;
    }
    if (this.handDocUnsub) {
      this.handDocUnsub();
      this.handDocUnsub = null;
    }
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }

    // 1. Listen to Room state
    this.roomDocUnsub = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (!snap.exists()) return;
      const room = snap.data() as RoomSyncState;
      const currentHand = this.cachedRoomState?.myHand || [];

      // Calculate legal cards if it's my turn
      const legalCards =
        room.phase === 'playing' && room.currentTurn === seatIndex
          ? getLegalCards(
              currentHand,
              room.currentTrick.map((t) => ({ playerId: t.playerId, card: t.card })),
              room.trumpSuit,
              true
            )
          : [];

      // Calculate forbidden bid if dealer
      const currentRound = room.currentRound;
      const isDealer = currentRound ? currentRound.dealerIndex === seatIndex : false;
      const forbiddenBid =
        room.phase === 'bidding' && currentRound && isDealer
          ? getForbiddenBid(
              room.players.map((p) => p.bid ?? null),
              currentRound.cardCount,
              currentRound.dealerIndex,
              seatIndex
            ) ?? -1
          : -1;

      const payload: RoomStatePayload = {
        room,
        mySeat: seatIndex,
        myHand: currentHand,
        legalCards,
        forbiddenBid,
      };

      this.cachedRoomState = payload;
      this.roomStateListeners.forEach((l) => l(payload));

      // Trigger AI turn processing if host and current turn is AI
      this.checkAndProcessAiTurn(room);
    });

    // 2. Listen to My Hand subcollection
    this.handDocUnsub = onSnapshot(
      doc(db, 'rooms', roomId, 'hands', String(seatIndex)),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as { cards?: Card[] };
        const myHand = data.cards || [];

        if (this.cachedRoomState) {
          const room = this.cachedRoomState.room;
          const legalCards =
            room.phase === 'playing' && room.currentTurn === seatIndex
              ? getLegalCards(
                  myHand,
                  room.currentTrick.map((t) => ({ playerId: t.playerId, card: t.card })),
                  room.trumpSuit,
                  true
                )
              : [];

          const updated: RoomStatePayload = {
            ...this.cachedRoomState,
            myHand,
            legalCards,
          };
          this.cachedRoomState = updated;
          this.roomStateListeners.forEach((l) => l(updated));
        }
      }
    );

    // 3. Resilient Watchdog ticker: recovers stalled AI turns or backgrounded tabs
    this.watchdogInterval = setInterval(() => {
      this.runWatchdogTick();
    }, 1000);
  }

  // Periodic Watchdog to prevent state freezes across tabs and network delays
  private async runWatchdogTick() {
    if (!this.cachedRoomState) return;
    const room = this.cachedRoomState.room;
    if (!room || room.status !== 'playing') return;

    const now = Date.now();
    const timeSinceUpdate = now - (room.updatedAt || 0);

    // 1. Inspecting phase timeout (if > 6s has passed and still inspecting)
    if (room.phase === 'inspecting' && timeSinceUpdate > 6000) {
      await this.startBidding(room.roomId);
      return;
    }

    // 2. Trick evaluation phase timeout (if > 2.5s has passed and still in trick_eval)
    if (room.phase === 'trick_eval' && timeSinceUpdate > 2500) {
      await this.finalizeTrickEval(room.roomId);
      return;
    }

    // 3. AI turn watchdog (if in bidding or playing, current player is AI, and > 1800ms has elapsed)
    const currentPlayer = room.players[room.currentTurn];
    if (currentPlayer && currentPlayer.isAi && timeSinceUpdate > 1800) {
      await this.executeAiTurnNow(room, currentPlayer.seatIndex);
    }
  }

  // Check and process AI turns automatically by host (with fallback if host disconnects or sleeps)
  private async checkAndProcessAiTurn(room: RoomSyncState) {
    if (room.status !== 'playing') return;

    // Auto-advance inspecting phase after 5s (host) or 6.5s (fallback)
    if (room.phase === 'inspecting') {
      const isHost = room.hostId === this.activePlayerId;
      const key = `${room.roomId}-inspecting-${room.currentRoundIdx}`;
      if (this.scheduledTurnKey !== key) {
        this.scheduledTurnKey = key;
        const delay = isHost ? 5000 : 6500;
        if (this.aiTurnTimeout) clearTimeout(this.aiTurnTimeout);
        this.aiTurnTimeout = setTimeout(async () => {
          try {
            const fresh = this.cachedRoomState?.room?.roomId === room.roomId
              ? this.cachedRoomState.room
              : ((await getDoc(doc(db, 'rooms', room.roomId))).data() as RoomSyncState | undefined);
            if (fresh && fresh.phase === 'inspecting' && fresh.currentRoundIdx === room.currentRoundIdx) {
              await this.startBidding(room.roomId);
            }
          } catch (e) {
            console.warn('Auto startBidding warning:', e);
          } finally {
            if (this.scheduledTurnKey === key) this.scheduledTurnKey = null;
          }
        }, delay);
      }
      return;
    }

    const currentPlayer = room.players[room.currentTurn];
    if (!currentPlayer || !currentPlayer.isAi) {
      if (this.aiTurnTimeout) {
        clearTimeout(this.aiTurnTimeout);
        this.aiTurnTimeout = null;
      }
      this.scheduledTurnKey = null;
      return;
    }

    // If player already placed a bid in bidding phase, nothing to do
    if (room.phase === 'bidding' && currentPlayer.bid !== null && currentPlayer.bid !== undefined) {
      if (this.aiTurnTimeout) {
        clearTimeout(this.aiTurnTimeout);
        this.aiTurnTimeout = null;
      }
      this.scheduledTurnKey = null;
      return;
    }

    const turnKey = `${room.roomId}-${room.phase}-${room.currentRoundIdx}-${room.currentTurn}`;
    if (this.scheduledTurnKey === turnKey) {
      // Already scheduled for this exact turn
      return;
    }

    this.scheduledTurnKey = turnKey;
    if (this.aiTurnTimeout) {
      clearTimeout(this.aiTurnTimeout);
      this.aiTurnTimeout = null;
    }

    const isHost = room.hostId === this.activePlayerId;
    const delay = isHost ? 450 : 1000;

    this.aiTurnTimeout = setTimeout(async () => {
      try {
        await this.executeAiTurnNow(room, currentPlayer.seatIndex);
      } catch (err) {
        console.warn('checkAndProcessAiTurn error:', err);
      } finally {
        if (this.scheduledTurnKey === turnKey) {
          this.scheduledTurnKey = null;
        }
      }
    }, delay);
  }

  // Executes an AI turn immediately, safely reading freshest state
  private async executeAiTurnNow(room: RoomSyncState, seatIndex: number) {
    const latestRoom = this.cachedRoomState?.room?.roomId === room.roomId
      ? this.cachedRoomState.room
      : ((await getDoc(doc(db, 'rooms', room.roomId))).data() as RoomSyncState | undefined);

    if (!latestRoom || latestRoom.status !== 'playing') return;
    if (latestRoom.currentTurn !== seatIndex) return;

    const currentPlayer = latestRoom.players[seatIndex];
    if (!currentPlayer || !currentPlayer.isAi) return;

    if (latestRoom.phase === 'bidding') {
      if (currentPlayer.bid !== null && currentPlayer.bid !== undefined) return;
      const round = latestRoom.currentRound;
      if (!round) return;

      // 1. Get AI hand (prefer latestRoom.aiHands, fallback to subcollection, fallback to synthetic hand)
      let aiHand: Card[] = (latestRoom.aiHands && latestRoom.aiHands[String(seatIndex)]) || [];
      if (!aiHand || aiHand.length === 0) {
        try {
          const handSnap = await getDoc(doc(db, 'rooms', latestRoom.roomId, 'hands', String(seatIndex)));
          if (handSnap.exists()) {
            aiHand = (handSnap.data().cards as Card[]) || [];
          }
        } catch (e) {
          console.warn('Could not read AI hand subcollection:', e);
        }
      }

      // If hand is still empty (e.g. edge case in legacy room), synthesize plausible cards
      if (!aiHand || aiHand.length === 0) {
        aiHand = Array.from({ length: round.cardCount }, (_, i) => ({
          id: `card-${seatIndex}-${i}`,
          suit: (latestRoom.trumpSuit || 'SPADES') as Suit,
          rank: (9 + (i % 5)) as Rank,
        }));
      }

      const aiBid = calculateAIBid(
        aiHand,
        latestRoom.trumpSuit,
        round.cardCount,
        latestRoom.players.map((p) => p.bid ?? null),
        round.dealerIndex,
        seatIndex
      );

      await this.placeBid(latestRoom.roomId, seatIndex, aiBid);
    } else if (latestRoom.phase === 'playing') {
      // 1. Get AI hand
      let aiHand: Card[] = (latestRoom.aiHands && latestRoom.aiHands[String(seatIndex)]) || [];
      if (!aiHand || aiHand.length === 0) {
        try {
          const handSnap = await getDoc(doc(db, 'rooms', latestRoom.roomId, 'hands', String(seatIndex)));
          if (handSnap.exists()) {
            aiHand = (handSnap.data().cards as Card[]) || [];
          }
        } catch (e) {
          console.warn('Could not read AI hand subcollection for play:', e);
        }
      }

      if (!aiHand || aiHand.length === 0) {
        console.warn('AI hand empty for seat in playing phase', seatIndex);
        return;
      }

      const trickForRules = latestRoom.currentTrick.map((t) => ({
        playerId: t.playerId,
        card: t.card,
      }));
      const legal = getLegalCards(aiHand, trickForRules, latestRoom.trumpSuit, true);
      const chosenCard = selectAICard(
        legal,
        trickForRules,
        latestRoom.trumpSuit,
        currentPlayer.bid ?? 0,
        currentPlayer.tricksWon ?? 0,
        aiHand.length
      );

      await this.playCard(latestRoom.roomId, seatIndex, chosenCard);
    }
  }

  // Room Actions
  public async addAi(roomId: string) {
    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (!roomSnap.exists()) return;
    const room = roomSnap.data() as RoomSyncState;
    if (room.status !== 'lobby' || room.players.length >= room.maxPlayers) return;

    const idx = room.players.length;
    room.players.push({
      id: `ai-${idx}-${Date.now()}`,
      name: DEFAULT_AI_NAMES[idx - 1] || `AI ${idx}`,
      avatar: DEFAULT_AI_AVATARS[idx - 1] || '🤖',
      isAi: true,
      seatIndex: idx,
      isReady: true,
      score: 0,
      bid: null,
      tricksWon: 0,
    });
    room.updatedAt = Date.now();
    await updateDoc(doc(db, 'rooms', roomId), cleanForFirestore({
      players: room.players,
      updatedAt: room.updatedAt,
    }));
  }

  public async toggleReady(roomId: string, playerId: string) {
    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (!roomSnap.exists()) return;
    const room = roomSnap.data() as RoomSyncState;
    room.players = room.players.map((p) =>
      p.id === playerId ? { ...p, isReady: !p.isReady } : p
    );
    room.updatedAt = Date.now();
    await updateDoc(doc(db, 'rooms', roomId), cleanForFirestore({
      players: room.players,
      updatedAt: room.updatedAt,
    }));
  }

  public async startRoomGame(roomId: string) {
    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (!roomSnap.exists()) return;
    const room = roomSnap.data() as RoomSyncState;

    while (room.players.length < Math.max(3, room.maxPlayers)) {
      const idx = room.players.length;
      room.players.push({
        id: `ai-${idx}-${Date.now()}`,
        name: DEFAULT_AI_NAMES[idx - 1] || `AI ${idx}`,
        avatar: DEFAULT_AI_AVATARS[idx - 1] || '🤖',
        isAi: true,
        seatIndex: idx,
        isReady: true,
        score: 0,
        bid: null,
        tricksWon: 0,
      });
    }

    const count = room.players.length;
    const rounds = generateRounds(count);
    const round0 = rounds[0];
    const deck = shuffleDeck(createDeck(count));

    let trumpCard: Card | null = null;
    let trumpSuit: Suit | null = null;
    if (round0.hasTrump && deck.length > 0) {
      trumpCard = deck.pop() || null;
      trumpSuit = trumpCard?.suit || null;
    }

    // Deal hands and write to subcollection
    const hands: Record<number, Card[]> = {};
    for (let i = 0; i < count; i++) hands[i] = [];
    for (let c = 0; c < round0.cardCount; c++) {
      for (let p = 0; p < count; p++) {
        const card = deck.pop();
        if (card) hands[p].push(card);
      }
    }

    const aiHandsMap: Record<string, Card[]> = {};
    for (let i = 0; i < count; i++) {
      // Sort cards
      hands[i].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return b.rank - a.rank;
      });
      await setDoc(doc(db, 'rooms', roomId, 'hands', String(i)), cleanForFirestore({
        cards: hands[i],
      }));
      if (room.players[i]?.isAi) {
        aiHandsMap[String(i)] = hands[i];
      }
    }
    room.aiHands = aiHandsMap;

    room.roundsCount = rounds.length;
    room.currentRoundIdx = 0;
    room.currentRound = {
      roundNumber: 1,
      cardCount: round0.cardCount,
      hasTrump: round0.hasTrump,
      dealerIndex: round0.dealerIndex,
    };
    room.status = 'playing';
    room.phase = 'inspecting';
    room.currentTurn = (round0.dealerIndex + 1) % count;
    room.trumpCard = trumpCard;
    room.trumpSuit = trumpSuit;
    room.currentTrick = [];
    room.winningCardId = null;
    room.trickWinnerBanner = null;
    room.statusMessage = 'Runda 1. Analizează cărțile! Licitația începe în 5 secunde.';
    room.updatedAt = Date.now();

    await updateDoc(doc(db, 'rooms', roomId), cleanForFirestore({
      ...room,
    }));
  }

  public async startBidding(roomId: string) {
    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (!roomSnap.exists()) return;
    const room = roomSnap.data() as RoomSyncState;
    if (room.phase !== 'inspecting') return;

    const round = room.currentRound;
    const firstBidder = round ? (round.dealerIndex + 1) % room.players.length : 0;
    room.phase = 'bidding';
    room.currentTurn = firstBidder;
    room.statusMessage = `Se licitează pentru Runda ${room.currentRoundIdx + 1}! Începe ${
      room.players[firstBidder]?.name || 'Jucător'
    }.`;
    room.updatedAt = Date.now();

    await updateDoc(doc(db, 'rooms', roomId), cleanForFirestore({
      phase: room.phase,
      currentTurn: room.currentTurn,
      statusMessage: room.statusMessage,
      updatedAt: room.updatedAt,
    }));
  }

  public async placeBid(roomId: string, seatIndex: number, bid: number) {
    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (!roomSnap.exists()) return;
    const room = roomSnap.data() as RoomSyncState;
    if (room.phase !== 'bidding') return;

    // Concurrency / Duplicate guard:
    if (room.players[seatIndex].bid !== null && room.players[seatIndex].bid !== undefined) {
      return;
    }
    if (room.currentTurn !== seatIndex) {
      return;
    }

    room.players[seatIndex].bid = bid;
    const allBidded = room.players.every((p) => p.bid !== null && p.bid !== undefined);

    if (allBidded) {
      const round = room.currentRound;
      const firstLeader = round ? (round.dealerIndex + 1) % room.players.length : 0;
      room.phase = 'playing';
      room.currentTurn = firstLeader;
      room.statusMessage = `Licitație încheiată! ${room.players[firstLeader].name} conduce prima cupă.`;
    } else {
      room.currentTurn = (seatIndex + 1) % room.players.length;
      room.statusMessage = `Rândul lui ${room.players[room.currentTurn].name} să liciteze.`;
    }
    room.updatedAt = Date.now();

    await updateDoc(doc(db, 'rooms', roomId), cleanForFirestore({
      players: room.players,
      phase: room.phase,
      currentTurn: room.currentTurn,
      statusMessage: room.statusMessage,
      updatedAt: room.updatedAt,
    }));
  }

  public async playCard(roomId: string, seatIndex: number, card: Card) {
    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (!roomSnap.exists()) return;
    const room = roomSnap.data() as RoomSyncState;
    if (room.phase !== 'playing') return;
    if (room.currentTurn !== seatIndex) return;

    // 1. Remove card from player hand in subcollection and aiHands
    const handRef = doc(db, 'rooms', roomId, 'hands', String(seatIndex));
    try {
      const handSnap = await getDoc(handRef);
      if (handSnap.exists()) {
        const cards = ((handSnap.data().cards as Card[]) || []).filter((c) => c.id !== card.id);
        await updateDoc(handRef, cleanForFirestore({ cards }));
      }
    } catch (e) {
      console.warn('Error updating hand doc:', e);
    }
    if (room.aiHands && room.aiHands[String(seatIndex)]) {
      room.aiHands[String(seatIndex)] = room.aiHands[String(seatIndex)].filter((c) => c.id !== card.id);
    }

    // 2. Add to trick
    const player = room.players[seatIndex];
    room.currentTrick.push({
      playerId: seatIndex,
      card,
      playerName: player.name,
    });

    if (room.currentTrick.length === room.players.length) {
      // Trick is full: strictly transition to 'trick_eval'
      room.phase = 'trick_eval';
      const trickForRules = room.currentTrick.map((t) => ({
        playerId: t.playerId,
        card: t.card,
      }));
      const evalResult = evaluateTrickWinner(trickForRules, room.trumpSuit);
      const winnerSeat = evalResult.winnerPlayerId;
      const winnerPlayer = room.players[winnerSeat];
      winnerPlayer.tricksWon = (winnerPlayer.tricksWon || 0) + 1;

      room.winningCardId = evalResult.winningCard.id;
      room.trickWinnerBanner = {
        winnerName: winnerPlayer.name,
        reason: evalResult.reason,
        winningCard: evalResult.winningCard,
      };
      room.statusMessage = `${winnerPlayer.name} a luat cupa!`;
      room.updatedAt = Date.now();
      await updateDoc(doc(db, 'rooms', roomId), cleanForFirestore({ ...room }));

      // Schedule trick finalization after 1.8s visual display
      setTimeout(() => {
        this.finalizeTrickEval(roomId);
      }, 1800);
    } else {
      room.currentTurn = (seatIndex + 1) % room.players.length;
      room.statusMessage = `Rândul lui ${room.players[room.currentTurn].name}.`;
      room.updatedAt = Date.now();
      await updateDoc(doc(db, 'rooms', roomId), cleanForFirestore({
        currentTrick: room.currentTrick,
        currentTurn: room.currentTurn,
        statusMessage: room.statusMessage,
        aiHands: room.aiHands,
        updatedAt: room.updatedAt,
      }));
    }
  }

  // Finalizes trick evaluation safely (deterministic and callable by timer or watchdog)
  public async finalizeTrickEval(roomId: string) {
    const freshSnap = await getDoc(doc(db, 'rooms', roomId));
    if (!freshSnap.exists()) return;
    const fresh = freshSnap.data() as RoomSyncState;
    if (fresh.phase !== 'trick_eval') return;

    // Deterministic check: compare total tricks won in this round with round card count
    const totalTricksWon = fresh.players.reduce((sum, p) => sum + (p.tricksWon || 0), 0);
    const roundCardCount = fresh.currentRound?.cardCount || 1;

    let winnerSeat = 0;
    let winnerPlayer = fresh.players[0];
    if (fresh.currentTrick && fresh.currentTrick.length > 0) {
      const evalResult = evaluateTrickWinner(
        fresh.currentTrick.map((t) => ({ playerId: t.playerId, card: t.card })),
        fresh.trumpSuit
      );
      winnerSeat = evalResult.winnerPlayerId;
      winnerPlayer = fresh.players[winnerSeat];
    }

    if (totalTricksWon >= roundCardCount) {
      // Round finished! Finalize scores
      const recapList = fresh.players.map((p) => {
        const pts = calculateRoundPoints(p.bid ?? 0, p.tricksWon || 0);
        return {
          bid: p.bid ?? 0,
          tricksWon: p.tricksWon || 0,
          points: pts,
          runningTotal: p.score + pts,
        };
      });

      fresh.players.forEach((p, idx) => {
        p.score = recapList[idx].runningTotal;
      });

      fresh.history = fresh.history || [];
      fresh.history.push({
        roundNumber: fresh.currentRoundIdx + 1,
        cardCount: roundCardCount,
        trumpSuit: fresh.trumpSuit,
        playerResults: recapList,
      });

      fresh.phase = 'round_recap';
      fresh.currentTrick = [];
      fresh.winningCardId = null;
      fresh.trickWinnerBanner = null;
      fresh.statusMessage = `Runda ${fresh.currentRoundIdx + 1} s-a încheiat!`;
      fresh.updatedAt = Date.now();
      await updateDoc(doc(db, 'rooms', roomId), cleanForFirestore({ ...fresh }));
    } else {
      // Next trick
      fresh.phase = 'playing';
      fresh.currentTrick = [];
      fresh.winningCardId = null;
      fresh.trickWinnerBanner = null;
      fresh.currentTurn = winnerSeat;
      fresh.statusMessage = `Cupa nouă. Conduce ${winnerPlayer?.name || 'Jucătorul'}.`;
      fresh.updatedAt = Date.now();
      await updateDoc(doc(db, 'rooms', roomId), cleanForFirestore({ ...fresh }));
    }
  }

  public async nextRound(roomId: string) {
    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (!roomSnap.exists()) return;
    const room = roomSnap.data() as RoomSyncState;

    const count = room.players.length;
    const rounds = generateRounds(count);
    const nextIdx = room.currentRoundIdx + 1;

    if (nextIdx >= rounds.length) {
      room.status = 'game_over';
      room.statusMessage = 'Joc terminat!';
      room.updatedAt = Date.now();
      await updateDoc(doc(db, 'rooms', roomId), cleanForFirestore({ ...room }));
      return;
    }

    const nextRoundConfig = rounds[nextIdx];
    const deck = shuffleDeck(createDeck(count));

    let trumpCard: Card | null = null;
    let trumpSuit: Suit | null = null;
    if (nextRoundConfig.hasTrump && deck.length > 0) {
      trumpCard = deck.pop() || null;
      trumpSuit = trumpCard?.suit || null;
    }

    const hands: Record<number, Card[]> = {};
    for (let i = 0; i < count; i++) hands[i] = [];
    for (let c = 0; c < nextRoundConfig.cardCount; c++) {
      for (let p = 0; p < count; p++) {
        const card = deck.pop();
        if (card) hands[p].push(card);
      }
    }

    const aiHandsMap: Record<string, Card[]> = {};
    for (let i = 0; i < count; i++) {
      hands[i].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return b.rank - a.rank;
      });
      await setDoc(doc(db, 'rooms', roomId, 'hands', String(i)), cleanForFirestore({
        cards: hands[i],
      }));
      if (room.players[i]?.isAi) {
        aiHandsMap[String(i)] = hands[i];
      }
    }
    room.aiHands = aiHandsMap;

    room.players.forEach((p) => {
      p.bid = null;
      p.tricksWon = 0;
    });

    room.currentRoundIdx = nextIdx;
    room.currentRound = {
      roundNumber: nextIdx + 1,
      cardCount: nextRoundConfig.cardCount,
      hasTrump: nextRoundConfig.hasTrump,
      dealerIndex: nextRoundConfig.dealerIndex,
    };
    room.phase = 'inspecting';
    room.currentTurn = (nextRoundConfig.dealerIndex + 1) % count;
    room.trumpCard = trumpCard;
    room.trumpSuit = trumpSuit;
    room.currentTrick = [];
    room.winningCardId = null;
    room.trickWinnerBanner = null;
    room.statusMessage = `Runda ${nextIdx + 1} (${nextRoundConfig.cardCount} cărți). Analizează cărțile!`;
    room.updatedAt = Date.now();

    await updateDoc(doc(db, 'rooms', roomId), cleanForFirestore({ ...room }));
  }

  public async leaveRoom(roomId: string, playerId: string) {
    if (this.roomDocUnsub) {
      this.roomDocUnsub();
      this.roomDocUnsub = null;
    }
    if (this.handDocUnsub) {
      this.handDocUnsub();
      this.handDocUnsub = null;
    }

    if (this.aiTurnTimeout) {
      clearTimeout(this.aiTurnTimeout);
      this.aiTurnTimeout = null;
    }
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
    this.scheduledTurnKey = null;

    this.activeRoomId = null;
    this.cachedRoomState = null;

    try {
      const roomSnap = await getDoc(doc(db, 'rooms', roomId));
      if (!roomSnap.exists()) return;
      const room = roomSnap.data() as RoomSyncState;
      room.players = room.players.filter((p) => p.id !== playerId);

      const hasHumans = room.players.some((p) => !p.isAi);
      if (room.players.length === 0 || !hasHumans) {
        await deleteDoc(doc(db, 'rooms', roomId));
      } else {
        room.players.forEach((p, idx) => {
          p.seatIndex = idx;
        });
        if (room.hostId === playerId && room.players[0]) {
          room.hostId = room.players[0].id;
        }
        room.updatedAt = Date.now();
        await updateDoc(doc(db, 'rooms', roomId), cleanForFirestore({
          players: room.players,
          hostId: room.hostId,
          updatedAt: room.updatedAt,
        }));
      }
    } catch {
      // Ignored
    }
  }
}

export const multiplayerService = new RealtimeMultiplayerService();
