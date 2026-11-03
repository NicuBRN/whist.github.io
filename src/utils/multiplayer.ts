import { GameModeType, Card, Suit } from '../game/rules.ts';

export interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  isAi: boolean;
  seatIndex: number; // 0..3
  isReady: boolean;
  score: number;
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
  gameMode: GameModeType;
  hostId: string;
  status: 'lobby' | 'playing' | 'round_over' | 'game_over';
  players: RoomPlayer[];
  currentRoundIdx: number;
  phase: 'dealing' | 'bidding' | 'playing' | 'trick_won' | 'round_end';
  currentTurnPlayerId: number;
  trumpSuit: Suit | null;
  trumpCard: Card | null;
  bids: (number | null)[];
  tricksWon: number[];
  currentTrick: RoomTrickCard[];
  lastTrickWinnerName: string | null;
  updatedAt: number;
}

export interface RoomListing {
  id: string;
  name: string;
  hasPassword: boolean;
  gameMode: GameModeType;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: 'lobby' | 'playing';
  updatedAt: number;
}

const STORAGE_ROOMS_KEY = 'romanian_whist_saved_rooms_v1';
const BROADCAST_CHANNEL_NAME = 'romanian_whist_network';

type RoomMessage =
  | { type: 'ROOM_ANNOUNCE'; room: RoomSyncState }
  | { type: 'ROOM_STATE_UPDATE'; room: RoomSyncState }
  | { type: 'PLAYER_JOIN'; roomId: string; player: RoomPlayer; passwordAttempt?: string }
  | { type: 'PLAYER_LEAVE'; roomId: string; playerId: string }
  | { type: 'PLAYER_READY_TOGGLE'; roomId: string; playerId: string }
  | { type: 'PLAYER_ACTION'; roomId: string; action: unknown };

export class MultiplayerNetwork {
  private channel: BroadcastChannel | null = null;
  private messageListeners: ((msg: RoomMessage) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          this.notifyListeners(event.data);
        };
      } catch {
        this.channel = null;
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'whist_cross_msg' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            this.notifyListeners(data);
          } catch {}
        }
      });
    }
  }

  public subscribe(listener: (msg: RoomMessage) => void): () => void {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(msg: RoomMessage) {
    for (const listener of this.messageListeners) {
      try {
        listener(msg);
      } catch {}
    }
  }

  public broadcast(msg: RoomMessage) {
    if (this.channel) {
      this.channel.postMessage(msg);
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('whist_cross_msg', JSON.stringify({ ...msg, _t: Date.now() }));
      } catch {}
    }
  }

  // Room Persistence Helpers
  public static getAllStoredRooms(): Record<string, RoomSyncState> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_ROOMS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public static saveRoom(room: RoomSyncState) {
    if (typeof window === 'undefined') return;
    try {
      const rooms = MultiplayerNetwork.getAllStoredRooms();
      rooms[room.roomId] = room;
      localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms));
    } catch {}
  }

  public static deleteRoom(roomId: string) {
    if (typeof window === 'undefined') return;
    try {
      const rooms = MultiplayerNetwork.getAllStoredRooms();
      delete rooms[roomId];
      localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms));
    } catch {}
  }
}

export const multiplayerNet = new MultiplayerNetwork();
