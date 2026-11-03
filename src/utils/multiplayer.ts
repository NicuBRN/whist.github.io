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

type ServerMessage =
  | { type: 'ROOMS_LIST'; rooms: RoomListing[] }
  | {
      type: 'ROOM_STATE';
      room: RoomSyncState;
      mySeat: number;
      myHand: Card[];
      legalCards: Card[];
      forbiddenBid: number;
    }
  | { type: 'ERROR'; message: string };

type RoomsListListener = (rooms: RoomListing[]) => void;
type RoomStateListener = (data: {
  room: RoomSyncState;
  mySeat: number;
  myHand: Card[];
  legalCards: Card[];
  forbiddenBid: number;
}) => void;
type ErrorListener = (errorMsg: string) => void;

class RealtimeMultiplayerService {
  private ws: WebSocket | null = null;
  private roomsListListeners: RoomsListListener[] = [];
  private roomStateListeners: RoomStateListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private cachedRooms: RoomListing[] = [];
  private isConnected = false;
  private reconnectTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect();
      this.fetchInitialRooms();
    }
  }

  private connect() {
    if (typeof window === 'undefined') return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.send({ type: 'GET_ROOMS' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data: ServerMessage = JSON.parse(event.data);
          if (data.type === 'ROOMS_LIST') {
            this.cachedRooms = data.rooms;
            this.roomsListListeners.forEach((l) => l(data.rooms));
          } else if (data.type === 'ROOM_STATE') {
            this.roomStateListeners.forEach((l) => l(data));
          } else if (data.type === 'ERROR') {
            this.errorListeners.forEach((l) => l(data.message));
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2500);
  }

  private send(data: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      // Reconnect if closed
      this.connect();
      setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(data));
        }
      }, 500);
    }
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

  public subscribeRoomsList(listener: RoomsListListener): () => void {
    this.roomsListListeners.push(listener);
    listener(this.cachedRooms);
    return () => {
      this.roomsListListeners = this.roomsListListeners.filter((l) => l !== listener);
    };
  }

  public subscribeRoomState(listener: RoomStateListener): () => void {
    this.roomStateListeners.push(listener);
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

  public createRoom(
    roomName: string,
    password?: string,
    maxPlayers: number = 4,
    hostPlayer: { id: string; name: string; avatar?: string } = {
      id: 'host-1',
      name: 'Tu',
      avatar: '👑',
    }
  ) {
    this.send({
      type: 'CREATE_ROOM',
      roomName,
      password: password || undefined,
      maxPlayers,
      hostPlayer,
    });
  }

  public joinRoom(
    roomId: string,
    player: { id: string; name: string; avatar?: string },
    password?: string
  ) {
    this.send({
      type: 'JOIN_ROOM',
      roomId,
      player,
      password: password || undefined,
    });
  }

  public addAi(roomId: string) {
    this.send({ type: 'ADD_AI', roomId });
  }

  public toggleReady(roomId: string, playerId: string) {
    this.send({ type: 'TOGGLE_READY', roomId, playerId });
  }

  public startRoomGame(roomId: string) {
    this.send({ type: 'START_ROOM_GAME', roomId });
  }

  public startBidding(roomId: string) {
    this.send({ type: 'START_BIDDING', roomId });
  }

  public placeBid(roomId: string, seatIndex: number, bid: number) {
    this.send({ type: 'PLACE_BID', roomId, seatIndex, bid });
  }

  public playCard(roomId: string, seatIndex: number, card: Card) {
    this.send({ type: 'PLAY_CARD', roomId, seatIndex, card });
  }

  public nextRound(roomId: string) {
    this.send({ type: 'NEXT_ROUND', roomId });
  }

  public leaveRoom(roomId: string, playerId: string) {
    this.send({ type: 'LEAVE_ROOM', roomId, playerId });
  }
}

export const multiplayerService = new RealtimeMultiplayerService();
