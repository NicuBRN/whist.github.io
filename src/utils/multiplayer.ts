/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameModeType, Card, Suit } from '../game/rules.ts';

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

type ServerMessage =
  | { type: 'ROOMS_LIST'; rooms: RoomListing[] }
  | ({ type: 'ROOM_STATE' } & RoomStatePayload)
  | { type: 'ERROR'; message: string };

type RoomsListListener = (rooms: RoomListing[]) => void;
type RoomStateListener = (data: RoomStatePayload) => void;
type ErrorListener = (errorMsg: string) => void;

class RealtimeMultiplayerService {
  private ws: WebSocket | null = null;
  private roomsListListeners: RoomsListListener[] = [];
  private roomStateListeners: RoomStateListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private cachedRooms: RoomListing[] = [];
  private cachedRoomState: RoomStatePayload | null = null;
  private activeRoomId: string | null = null;
  private activePlayerId: string = 'user-1';
  private pollingTimer: number | null = null;
  private lobbyPollingTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initWebSocket();
      this.fetchInitialRooms();
      this.startLobbyPolling();
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
            this.cachedRooms = data.rooms;
            this.roomsListListeners.forEach((l) => l(data.rooms));
          } else if (data.type === 'ROOM_STATE') {
            this.activeRoomId = data.room.roomId;
            this.cachedRoomState = {
              room: data.room,
              mySeat: data.mySeat,
              myHand: data.myHand || [],
              legalCards: data.legalCards || [],
              forbiddenBid: data.forbiddenBid ?? -1,
            };
            this.roomStateListeners.forEach((l) => l(this.cachedRoomState!));
          } else if (data.type === 'ERROR') {
            this.errorListeners.forEach((l) => l(data.message));
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };

      this.ws.onclose = () => {
        setTimeout(() => this.initWebSocket(), 4000);
      };

      this.ws.onerror = () => {
        // Will rely on HTTP REST polling
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
        const res = await fetch(`/api/rooms/${roomId}/state?playerId=${encodeURIComponent(this.activePlayerId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.room) {
            this.cachedRoomState = {
              room: data.room,
              mySeat: data.mySeat,
              myHand: data.myHand || [],
              legalCards: data.legalCards || [],
              forbiddenBid: data.forbiddenBid ?? -1,
            };
            this.roomStateListeners.forEach((l) => l(this.cachedRoomState!));
          }
        }
      } catch {
        // Ignore network glitches
      }
    }, 1200);
  }

  public async fetchInitialRooms(): Promise<RoomListing[]> {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        if (data.rooms) {
          this.cachedRooms = data.rooms;
          this.roomsListListeners.forEach((l) => l(data.rooms));
          return data.rooms;
        }
      }
    } catch {
      // Ignore
    }
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

  // Create Room (Hybrid: sends REST and WS)
  public async createRoom(
    roomName: string,
    password?: string,
    maxPlayers: number = 4,
    hostPlayer: { id: string; name: string; avatar?: string } = {
      id: 'host-1',
      name: 'Tu',
      avatar: '👑',
    }
  ): Promise<RoomStatePayload | null> {
    this.activePlayerId = hostPlayer.id;

    // Send over WS
    this.sendWs({
      type: 'CREATE_ROOM',
      roomName,
      password: password || undefined,
      maxPlayers,
      hostPlayer,
    });

    // Call REST endpoint
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          password: password || undefined,
          maxPlayers,
          hostPlayer,
        }),
      });

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
          this.startRoomPolling(data.room.roomId);
          this.fetchInitialRooms();
          return payload;
        }
      }
    } catch (e) {
      console.error('HTTP createRoom failed', e);
    }

    return null;
  }

  // Join Room (Hybrid)
  public async joinRoom(
    roomId: string,
    player: { id: string; name: string; avatar?: string },
    password?: string
  ): Promise<{ success: boolean; payload?: RoomStatePayload; error?: string }> {
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
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player,
          password: password || undefined,
        }),
      });

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
        this.startRoomPolling(roomId);
        this.fetchInitialRooms();
        return { success: true, payload };
      } else {
        const errMsg = data.error || 'Nu s-a putut intra în cameră!';
        this.errorListeners.forEach((l) => l(errMsg));
        return { success: false, error: errMsg };
      }
    } catch {
      const errMsg = 'Eroare de conexiune la server!';
      this.errorListeners.forEach((l) => l(errMsg));
      return { success: false, error: errMsg };
    }
  }

  // Action Dispatcher (POST /api/rooms/:id/action + WS)
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
            myHand: data.myHand || [],
            legalCards: data.legalCards || [],
            forbiddenBid: data.forbiddenBid ?? -1,
          };
          this.cachedRoomState = payload;
          this.roomStateListeners.forEach((l) => l(payload));
        }
      }
    } catch {
      // Ignored
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
