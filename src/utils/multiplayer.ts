/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GameModeType,
  Card,
  Suit,
  createDeck,
  shuffleDeck,
  generateRounds,
  getLegalCards,
  getForbiddenBid,
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

type ServerMessage =
  | { type: 'ROOMS_LIST'; rooms: RoomListing[] }
  | ({ type: 'ROOM_STATE' } & RoomStatePayload)
  | { type: 'ERROR'; message: string };

type RoomsListListener = (rooms: RoomListing[]) => void;
type RoomStateListener = (data: RoomStatePayload) => void;
type ErrorListener = (errorMsg: string) => void;

class RealtimeMultiplayerService {
  private ws: WebSocket | null = null;
  private bc: BroadcastChannel | null = null;
  private roomsListListeners: RoomsListListener[] = [];
  private roomStateListeners: RoomStateListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private cachedRooms: RoomListing[] = [];
  private cachedRoomState: RoomStatePayload | null = null;
  private localHands: Record<number, Card[]> = {};
  private activeRoomId: string | null = null;
  private activePlayerId: string = 'user-1';
  private pollingTimer: number | null = null;
  private lobbyPollingTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBroadcastChannel();
      this.initWebSocket();
      this.fetchInitialRooms();
      this.startLobbyPolling();
    }
  }

  private initBroadcastChannel() {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      this.bc = new BroadcastChannel('whist_ro_multiplayer_channel');
      this.bc.onmessage = (event) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'BC_ROOM_UPDATE' && msg.room) {
          const room = msg.room as RoomSyncState;
          this.updateRoomListingLocal(room);
          if (this.activeRoomId === room.roomId && this.cachedRoomState) {
            const seat = this.cachedRoomState.mySeat;
            const updated: RoomStatePayload = {
              ...this.cachedRoomState,
              room,
            };
            this.cachedRoomState = updated;
            this.roomStateListeners.forEach((l) => l(updated));
          }
        } else if (msg.type === 'BC_ROOM_LIST_REQUEST') {
          if (this.cachedRooms.length > 0) {
            this.bc?.postMessage({
              type: 'BC_ROOM_LIST_RESPONSE',
              rooms: this.cachedRooms,
            });
          }
        } else if (msg.type === 'BC_ROOM_LIST_RESPONSE' && Array.isArray(msg.rooms)) {
          this.mergeRoomsList(msg.rooms);
        }
      };
    } catch {
      // Ignore broadcast channel errors in restricted environments
    }
  }

  private initWebSocket() {
    if (typeof window === 'undefined') return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.sendWs({ type: 'GET_ROOMS' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data: ServerMessage = JSON.parse(event.data);
          if (data.type === 'ROOMS_LIST') {
            this.mergeRoomsList(data.rooms);
          } else if (data.type === 'ROOM_STATE') {
            this.activeRoomId = data.room.roomId;
            const payload: RoomStatePayload = {
              room: data.room,
              mySeat: data.mySeat,
              myHand: data.myHand || this.cachedRoomState?.myHand || [],
              legalCards: data.legalCards || this.cachedRoomState?.legalCards || [],
              forbiddenBid: data.forbiddenBid ?? -1,
            };
            this.cachedRoomState = payload;
            this.roomStateListeners.forEach((l) => l(payload));
            this.updateRoomListingLocal(data.room);
          } else if (data.type === 'ERROR') {
            this.errorListeners.forEach((l) => l(data.message));
          }
        } catch {
          // Ignore
        }
      };

      this.ws.onclose = () => {
        // Will rely on HTTP REST polling
      };

      this.ws.onerror = () => {
        // Fall back gracefully to REST
      };
    } catch {
      // Ignore, HTTP fallback is active
    }
  }

  private sendWs(data: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch {
        // Fall back to REST
      }
    }
  }

  private mergeRoomsList(serverRooms: RoomListing[]) {
    const map = new Map<string, RoomListing>();
    serverRooms.forEach((r) => map.set(r.id, r));
    this.cachedRooms.forEach((r) => {
      if (!map.has(r.id) && Date.now() - r.updatedAt < 1000 * 60 * 30) {
        map.set(r.id, r);
      }
    });
    this.cachedRooms = Array.from(map.values());
    this.roomsListListeners.forEach((l) => l(this.cachedRooms));
  }

  private updateRoomListingLocal(room: RoomSyncState) {
    const listing: RoomListing = {
      id: room.roomId,
      name: room.roomName,
      hasPassword: room.hasPassword,
      hostId: room.hostId,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      status: room.status,
      updatedAt: room.updatedAt || Date.now(),
    };
    const idx = this.cachedRooms.findIndex((r) => r.id === listing.id);
    if (idx >= 0) {
      this.cachedRooms[idx] = listing;
    } else {
      this.cachedRooms.unshift(listing);
    }
    this.roomsListListeners.forEach((l) => l(this.cachedRooms));
  }

  private startLobbyPolling() {
    if (typeof window === 'undefined') return;
    if (this.lobbyPollingTimer) clearInterval(this.lobbyPollingTimer);
    this.lobbyPollingTimer = window.setInterval(() => {
      if (!this.activeRoomId) {
        this.fetchInitialRooms();
      }
    }, 2500);
  }

  private startRoomPolling(roomId: string) {
    this.activeRoomId = roomId;
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.pollingTimer = window.setInterval(async () => {
      if (!this.activeRoomId || this.activeRoomId !== roomId) {
        if (this.pollingTimer) clearInterval(this.pollingTimer);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(
          `/api/rooms/${roomId}/state?playerId=${encodeURIComponent(this.activePlayerId)}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.room) {
            const payload: RoomStatePayload = {
              room: data.room,
              mySeat: data.mySeat,
              myHand: data.myHand || this.cachedRoomState?.myHand || [],
              legalCards: data.legalCards || this.cachedRoomState?.legalCards || [],
              forbiddenBid: data.forbiddenBid ?? -1,
            };
            this.cachedRoomState = payload;
            this.roomStateListeners.forEach((l) => l(payload));
            this.updateRoomListingLocal(data.room);
          }
        }
      } catch {
        // Ignore network glitches
      }
    }, 1200);
  }

  public async fetchInitialRooms(): Promise<RoomListing[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('/api/rooms', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.rooms) {
          this.mergeRoomsList(data.rooms);
          return this.cachedRooms;
        }
      }
    } catch {
      // Ignore
    }
    // Ask broadcast channel as well
    this.bc?.postMessage({ type: 'BC_ROOM_LIST_REQUEST' });
    return this.cachedRooms;
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

  // Create Room (Guaranteed to return a valid RoomStatePayload without freezing)
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

    // Send over WS immediately if open
    this.sendWs({
      type: 'CREATE_ROOM',
      roomName,
      password: password || undefined,
      maxPlayers,
      hostPlayer,
    });

    // Try server creation with a 2.5s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          password: password || undefined,
          maxPlayers,
          hostPlayer,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.room) {
          const payload: RoomStatePayload = {
            room: data.room,
            mySeat: data.mySeat ?? 0,
            myHand: data.myHand || [],
            legalCards: data.legalCards || [],
            forbiddenBid: data.forbiddenBid ?? -1,
          };
          this.activeRoomId = data.room.roomId;
          this.cachedRoomState = payload;
          this.roomStateListeners.forEach((l) => l(payload));
          this.updateRoomListingLocal(data.room);
          this.bc?.postMessage({ type: 'BC_ROOM_UPDATE', room: data.room });
          this.startRoomPolling(data.room.roomId);
          this.fetchInitialRooms();
          return payload;
        }
      }
    } catch (e) {
      console.warn('Server room creation fallback triggered:', e);
    }

    // Instant local/fallback room so the user is NEVER blocked
    const fallbackRoomId = `WHIST-${Math.floor(1000 + Math.random() * 9000)}`;
    const fallbackRoom: RoomSyncState = {
      roomId: fallbackRoomId,
      roomName: roomName?.trim() || 'Masa de Whist Românesc',
      hasPassword: !!password && password.trim().length > 0,
      password: password ? password.trim() : undefined,
      hostId: hostPlayer.id,
      maxPlayers: Math.min(6, Math.max(3, maxPlayers || 4)),
      status: 'lobby',
      players: [
        {
          id: hostPlayer.id,
          name: hostPlayer.name || 'Tu',
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
      trumpSuit: null,
      trumpCard: null,
      currentTrick: [],
      statusMessage: 'Sală creată. Așteptare jucători...',
      history: [],
      updatedAt: Date.now(),
    };

    const payload: RoomStatePayload = {
      room: fallbackRoom,
      mySeat: 0,
      myHand: [],
      legalCards: [],
      forbiddenBid: -1,
    };

    this.activeRoomId = fallbackRoomId;
    this.cachedRoomState = payload;
    this.roomStateListeners.forEach((l) => l(payload));
    this.updateRoomListingLocal(fallbackRoom);
    this.bc?.postMessage({ type: 'BC_ROOM_UPDATE', room: fallbackRoom });
    this.startRoomPolling(fallbackRoomId);

    return payload;
  }

  // Fetch Room Info by code
  public async fetchRoomInfo(rawRoomId: string): Promise<RoomListing | null> {
    const roomId = normalizeRoomCode(rawRoomId);
    if (!roomId) return null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          const listing: RoomListing = {
            id: data.room.roomId,
            name: data.room.roomName,
            hasPassword: data.room.hasPassword,
            hostId: data.room.hostId,
            playerCount: data.room.playerCount || 1,
            maxPlayers: data.room.maxPlayers || 4,
            status: data.room.status || 'lobby',
            updatedAt: Date.now(),
          };
          this.updateRoomListingLocal(data.room);
          return listing;
        }
      }
    } catch {
      // Ignored
    }
    return this.cachedRooms.find((r) => r.id === roomId) || null;
  }

  // Join Room
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

    // Send over WS
    this.sendWs({
      type: 'JOIN_ROOM',
      roomId,
      player,
      password: password || undefined,
    });

    // Call REST endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player,
          password: password || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data.success && data.room) {
        const payload: RoomStatePayload = {
          room: data.room,
          mySeat: data.mySeat ?? 0,
          myHand: data.myHand || [],
          legalCards: data.legalCards || [],
          forbiddenBid: data.forbiddenBid ?? -1,
        };
        this.activeRoomId = roomId;
        this.cachedRoomState = payload;
        this.roomStateListeners.forEach((l) => l(payload));
        this.updateRoomListingLocal(data.room);
        this.bc?.postMessage({ type: 'BC_ROOM_UPDATE', room: data.room });
        this.startRoomPolling(roomId);
        this.fetchInitialRooms();
        return { success: true, payload };
      } else {
        const errMsg = data.error || 'Nu s-a putut intra în cameră!';
        this.errorListeners.forEach((l) => l(errMsg));
        return { success: false, error: errMsg };
      }
    } catch {
      // Local fallback join if matching local room exists
      if (this.cachedRoomState && this.cachedRoomState.room.roomId === roomId) {
        const room = { ...this.cachedRoomState.room };
        if (room.hasPassword && room.password !== password) {
          return { success: false, error: 'Parolă incorectă!' };
        }
        if (room.players.length >= room.maxPlayers) {
          return { success: false, error: 'Camera este plină!' };
        }
        const seatIndex = room.players.length;
        room.players = [
          ...room.players,
          {
            id: player.id,
            name: player.name,
            avatar: player.avatar || '😎',
            isAi: false,
            seatIndex,
            isReady: false,
            score: 0,
            bid: null,
            tricksWon: 0,
          },
        ];
        room.updatedAt = Date.now();
        const payload: RoomStatePayload = {
          room,
          mySeat: seatIndex,
          myHand: [],
          legalCards: [],
          forbiddenBid: -1,
        };
        this.activeRoomId = roomId;
        this.cachedRoomState = payload;
        this.roomStateListeners.forEach((l) => l(payload));
        this.updateRoomListingLocal(room);
        this.bc?.postMessage({ type: 'BC_ROOM_UPDATE', room });
        return { success: true, payload };
      }

      const errMsg = 'Eroare de conexiune la server!';
      this.errorListeners.forEach((l) => l(errMsg));
      return { success: false, error: errMsg };
    }
  }

  // Action Dispatcher
  public async sendAction(roomId: string, actionData: Record<string, unknown>) {
    // Send over WS
    this.sendWs({
      roomId,
      playerId: this.activePlayerId,
      ...actionData,
    });

    // Send over REST
    try {
      const res = await fetch(`/api/rooms/${roomId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.activePlayerId,
          ...actionData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.room) {
          const payload: RoomStatePayload = {
            room: data.room,
            mySeat: data.mySeat ?? 0,
            myHand: data.myHand || this.cachedRoomState?.myHand || [],
            legalCards: data.legalCards || this.cachedRoomState?.legalCards || [],
            forbiddenBid: data.forbiddenBid ?? -1,
          };
          this.cachedRoomState = payload;
          this.roomStateListeners.forEach((l) => l(payload));
          this.updateRoomListingLocal(data.room);
          this.bc?.postMessage({ type: 'BC_ROOM_UPDATE', room: data.room });
          return;
        }
      }
    } catch {
      // Ignored
    }

    // Local optimistic update fallback for seamless responsiveness
    if (this.cachedRoomState && this.cachedRoomState.room.roomId === roomId) {
      const room = { ...this.cachedRoomState.room };
      const actionType = actionData.type as string;

      if (actionType === 'ADD_AI' && room.players.length < room.maxPlayers) {
        const idx = room.players.length;
        const aiNames = ['Radu (AI)', 'Elena (AI)', 'Mihai (AI)', 'Andrei (AI)', 'Ioana (AI)'];
        const aiAvatars = ['🦊', '🦉', '🐻', '🦁', '🐺'];
        room.players = [
          ...room.players,
          {
            id: `ai-${idx}-${Date.now()}`,
            name: aiNames[idx - 1] || `AI ${idx}`,
            avatar: aiAvatars[idx - 1] || '🤖',
            isAi: true,
            seatIndex: idx,
            isReady: true,
            score: 0,
            bid: null,
            tricksWon: 0,
          },
        ];
        room.updatedAt = Date.now();
        const updatedPayload = { ...this.cachedRoomState, room };
        this.cachedRoomState = updatedPayload;
        this.roomStateListeners.forEach((l) => l(updatedPayload));
        this.updateRoomListingLocal(room);
        this.bc?.postMessage({ type: 'BC_ROOM_UPDATE', room });
      } else if (actionType === 'TOGGLE_READY') {
        const pId = (actionData.playerId as string) || this.activePlayerId;
        room.players = room.players.map((p) =>
          p.id === pId ? { ...p, isReady: !p.isReady } : p
        );
        room.updatedAt = Date.now();
        const updatedPayload = { ...this.cachedRoomState, room };
        this.cachedRoomState = updatedPayload;
        this.roomStateListeners.forEach((l) => l(updatedPayload));
        this.updateRoomListingLocal(room);
        this.bc?.postMessage({ type: 'BC_ROOM_UPDATE', room });
      } else if (actionType === 'START_ROOM_GAME') {
        // Fallback local game launch if server took longer
        while (room.players.length < Math.max(3, room.maxPlayers)) {
          const idx = room.players.length;
          const aiNames = ['Radu (AI)', 'Elena (AI)', 'Mihai (AI)', 'Andrei (AI)', 'Ioana (AI)'];
          const aiAvatars = ['🦊', '🦉', '🐻', '🦁', '🐺'];
          room.players.push({
            id: `ai-${idx}-${Date.now()}`,
            name: aiNames[idx - 1] || `AI ${idx}`,
            avatar: aiAvatars[idx - 1] || '🤖',
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
        room.roundsCount = rounds.length;
        room.currentRoundIdx = 0;
        room.currentRound = {
          roundNumber: rounds[0].roundIndex + 1,
          cardCount: rounds[0].cardCount,
          hasTrump: rounds[0].hasTrump,
          dealerIndex: rounds[0].dealerIndex,
        };
        room.status = 'playing';
        room.phase = 'inspecting';
        room.currentTurn = (rounds[0].dealerIndex + 1) % count;

        const deck = shuffleDeck(createDeck(count));
        let trumpCard: Card | null = null;
        let trumpSuit: Suit | null = null;
        if (rounds[0].hasTrump && deck.length > 0) {
          trumpCard = deck.pop() || null;
          trumpSuit = trumpCard?.suit || null;
        }
        room.trumpCard = trumpCard;
        room.trumpSuit = trumpSuit;

        // Deal hands
        const hands: Record<number, Card[]> = {};
        for (let i = 0; i < count; i++) hands[i] = [];
        for (let c = 0; c < rounds[0].cardCount; c++) {
          for (let p = 0; p < count; p++) {
            const card = deck.pop();
            if (card) hands[p].push(card);
          }
        }
        this.localHands = hands;
        const mySeat = this.cachedRoomState.mySeat;
        const myHand = hands[mySeat] || [];

        room.updatedAt = Date.now();
        const updatedPayload: RoomStatePayload = {
          room,
          mySeat,
          myHand,
          legalCards: [],
          forbiddenBid: -1,
        };
        this.cachedRoomState = updatedPayload;
        this.roomStateListeners.forEach((l) => l(updatedPayload));
        this.updateRoomListingLocal(room);
        this.bc?.postMessage({ type: 'BC_ROOM_UPDATE', room });
      }
    }
  }

  public addAi(roomId: string) {
    this.sendAction(roomId, { type: 'ADD_AI' });
  }

  public toggleReady(roomId: string, playerId: string) {
    this.sendAction(roomId, { type: 'TOGGLE_READY', playerId });
  }

  public startRoomGame(roomId: string) {
    this.sendAction(roomId, { type: 'START_ROOM_GAME' });
  }

  public startBidding(roomId: string) {
    this.sendAction(roomId, { type: 'START_BIDDING' });
  }

  public placeBid(roomId: string, seatIndex: number, bid: number) {
    this.sendAction(roomId, { type: 'PLACE_BID', seatIndex, bid });
  }

  public playCard(roomId: string, seatIndex: number, card: Card) {
    this.sendAction(roomId, { type: 'PLAY_CARD', seatIndex, card });
  }

  public nextRound(roomId: string) {
    this.sendAction(roomId, { type: 'NEXT_ROUND' });
  }

  public leaveRoom(roomId: string, playerId: string) {
    this.sendAction(roomId, { type: 'LEAVE_ROOM', playerId });
    this.activeRoomId = null;
    this.cachedRoomState = null;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.fetchInitialRooms();
  }
}

export const multiplayerService = new RealtimeMultiplayerService();
