/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  doc,
  collection,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase.ts';
import {
  GameModeType,
  Card,
  Suit,
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
  const clean = code.trim().toUpperCase();
  if (!clean) return '';
  return clean.startsWith('WHIST-') ? clean : `WHIST-${clean}`;
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
  private isProcessingAi: boolean = false;

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
    return this.cachedRooms;
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
      await setDoc(doc(db, 'rooms', roomId), newRoom);
      this.subscribeActiveRoom(roomId, 0);
    } catch (e) {
      console.warn('Error saving room to Firestore:', e);
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
        await updateDoc(roomRef, {
          players: room.players,
          updatedAt: room.updatedAt,
        });
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
    } catch {
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
  }

  // Check and process AI turns automatically by host
  private async checkAndProcessAiTurn(room: RoomSyncState) {
    if (this.isProcessingAi) return;
    if (room.status !== 'playing') return;
    if (room.hostId !== this.activePlayerId) return;

    const currentPlayer = room.players[room.currentTurn];
    if (!currentPlayer || !currentPlayer.isAi) return;

    this.isProcessingAi = true;
    try {
      if (room.phase === 'inspecting') {
        // Auto-advance after 5s or host trigger
      } else if (room.phase === 'bidding') {
        setTimeout(async () => {
          if (!this.cachedRoomState || this.cachedRoomState.room.phase !== 'bidding') return;
          const freshRoom = this.cachedRoomState.room;
          if (freshRoom.currentTurn !== currentPlayer.seatIndex) return;

          // Fetch AI's hand to compute bid
          const handSnap = await getDoc(
            doc(db, 'rooms', room.roomId, 'hands', String(currentPlayer.seatIndex))
          );
          const aiHand = handSnap.exists() ? (handSnap.data().cards as Card[]) || [] : [];
          const round = freshRoom.currentRound;
          if (!round) return;

          const isDealer = round.dealerIndex === currentPlayer.seatIndex;
          const forbidden = isDealer
            ? getForbiddenBid(
                freshRoom.players.map((p) => p.bid ?? null),
                round.cardCount,
                round.dealerIndex,
                currentPlayer.seatIndex
              )
            : -1;

          const aiBid = calculateAIBid(
            aiHand,
            freshRoom.trumpSuit,
            round.cardCount,
            freshRoom.players.map((p) => p.bid ?? null),
            round.dealerIndex,
            currentPlayer.seatIndex
          );

          await this.placeBid(room.roomId, currentPlayer.seatIndex, aiBid);
        }, 800);
      } else if (room.phase === 'playing') {
        setTimeout(async () => {
          if (!this.cachedRoomState || this.cachedRoomState.room.phase !== 'playing') return;
          const freshRoom = this.cachedRoomState.room;
          if (freshRoom.currentTurn !== currentPlayer.seatIndex) return;

          const handSnap = await getDoc(
            doc(db, 'rooms', room.roomId, 'hands', String(currentPlayer.seatIndex))
          );
          const aiHand = handSnap.exists() ? (handSnap.data().cards as Card[]) || [] : [];
          if (aiHand.length === 0) return;

          const trickForRules = freshRoom.currentTrick.map((t) => ({
            playerId: t.playerId,
            card: t.card,
          }));
          const legal = getLegalCards(aiHand, trickForRules, freshRoom.trumpSuit, true);

          const chosenCard = selectAICard(
            legal,
            trickForRules,
            freshRoom.trumpSuit,
            currentPlayer.bid ?? 0,
            currentPlayer.tricksWon ?? 0,
            aiHand.length
          );

          await this.playCard(room.roomId, currentPlayer.seatIndex, chosenCard);
        }, 800);
      }
    } finally {
      setTimeout(() => {
        this.isProcessingAi = false;
      }, 1000);
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
    await updateDoc(doc(db, 'rooms', roomId), {
      players: room.players,
      updatedAt: room.updatedAt,
    });
  }

  public async toggleReady(roomId: string, playerId: string) {
    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (!roomSnap.exists()) return;
    const room = roomSnap.data() as RoomSyncState;
    room.players = room.players.map((p) =>
      p.id === playerId ? { ...p, isReady: !p.isReady } : p
    );
    room.updatedAt = Date.now();
    await updateDoc(doc(db, 'rooms', roomId), {
      players: room.players,
      updatedAt: room.updatedAt,
    });
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

    for (let i = 0; i < count; i++) {
      // Sort cards
      hands[i].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return b.rank - a.rank;
      });
      await setDoc(doc(db, 'rooms', roomId, 'hands', String(i)), {
        cards: hands[i],
      });
    }

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

    await updateDoc(doc(db, 'rooms', roomId), {
      ...room,
    });
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

    await updateDoc(doc(db, 'rooms', roomId), {
      phase: room.phase,
      currentTurn: room.currentTurn,
      statusMessage: room.statusMessage,
      updatedAt: room.updatedAt,
    });
  }

  public async placeBid(roomId: string, seatIndex: number, bid: number) {
    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (!roomSnap.exists()) return;
    const room = roomSnap.data() as RoomSyncState;
    if (room.phase !== 'bidding') return;

    room.players[seatIndex].bid = bid;
    const allBidded = room.players.every((p) => p.bid !== null && p.bid !== undefined);

    if (allBidded) {
      const round = room.currentRound;
      const firstLeader = round ? (round.dealerIndex + 1) % room.players.length : 0;
      room.phase = 'playing';
      room.currentTurn = firstLeader;
      room.statusMessage = `Licitație încheiată! ${room.players[firstLeader].name} conduce prima cupă.`;
    } else {
      room.currentTurn = (room.currentTurn + 1) % room.players.length;
      room.statusMessage = `Rândul lui ${room.players[room.currentTurn].name} să liciteze.`;
    }
    room.updatedAt = Date.now();

    await updateDoc(doc(db, 'rooms', roomId), {
      players: room.players,
      phase: room.phase,
      currentTurn: room.currentTurn,
      statusMessage: room.statusMessage,
      updatedAt: room.updatedAt,
    });
  }

  public async playCard(roomId: string, seatIndex: number, card: Card) {
    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (!roomSnap.exists()) return;
    const room = roomSnap.data() as RoomSyncState;
    if (room.phase !== 'playing') return;

    // 1. Remove card from player hand in subcollection
    const handRef = doc(db, 'rooms', roomId, 'hands', String(seatIndex));
    const handSnap = await getDoc(handRef);
    if (handSnap.exists()) {
      const cards = ((handSnap.data().cards as Card[]) || []).filter((c) => c.id !== card.id);
      await updateDoc(handRef, { cards });
    }

    // 2. Add to trick
    const player = room.players[seatIndex];
    room.currentTrick.push({
      playerId: seatIndex,
      card,
      playerName: player.name,
    });

    if (room.currentTrick.length === room.players.length) {
      // Trick complete
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
      await updateDoc(doc(db, 'rooms', roomId), { ...room });

      // After 1.6s evaluate next trick or end round
      setTimeout(async () => {
        const freshSnap = await getDoc(doc(db, 'rooms', roomId));
        if (!freshSnap.exists()) return;
        const fresh = freshSnap.data() as RoomSyncState;

        // Check if hand is empty
        const remainingHandSnap = await getDoc(
          doc(db, 'rooms', roomId, 'hands', String(winnerSeat))
        );
        const remCards = remainingHandSnap.exists()
          ? (remainingHandSnap.data().cards as Card[]) || []
          : [];

        if (remCards.length === 0) {
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
            cardCount: fresh.currentRound?.cardCount || 1,
            trumpSuit: fresh.trumpSuit,
            playerResults: recapList,
          });

          fresh.phase = 'round_recap';
          fresh.currentTrick = [];
          fresh.winningCardId = null;
          fresh.trickWinnerBanner = null;
          fresh.statusMessage = `Runda ${fresh.currentRoundIdx + 1} s-a încheiat!`;
          fresh.updatedAt = Date.now();
          await updateDoc(doc(db, 'rooms', roomId), { ...fresh });
        } else {
          // Next trick
          fresh.phase = 'playing';
          fresh.currentTrick = [];
          fresh.winningCardId = null;
          fresh.trickWinnerBanner = null;
          fresh.currentTurn = winnerSeat;
          fresh.statusMessage = `Cupa nouă. Conduce ${winnerPlayer.name}.`;
          fresh.updatedAt = Date.now();
          await updateDoc(doc(db, 'rooms', roomId), { ...fresh });
        }
      }, 1600);
    } else {
      room.currentTurn = (room.currentTurn + 1) % room.players.length;
      room.statusMessage = `Rândul lui ${room.players[room.currentTurn].name}.`;
      room.updatedAt = Date.now();
      await updateDoc(doc(db, 'rooms', roomId), {
        currentTrick: room.currentTrick,
        currentTurn: room.currentTurn,
        statusMessage: room.statusMessage,
        updatedAt: room.updatedAt,
      });
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
      await updateDoc(doc(db, 'rooms', roomId), { ...room });
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

    for (let i = 0; i < count; i++) {
      hands[i].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return b.rank - a.rank;
      });
      await setDoc(doc(db, 'rooms', roomId, 'hands', String(i)), {
        cards: hands[i],
      });
    }

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

    await updateDoc(doc(db, 'rooms', roomId), { ...room });
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
        await updateDoc(doc(db, 'rooms', roomId), {
          players: room.players,
          hostId: room.hostId,
          updatedAt: room.updatedAt,
        });
      }
    } catch {
      // Ignored
    }
  }
}

export const multiplayerService = new RealtimeMultiplayerService();
