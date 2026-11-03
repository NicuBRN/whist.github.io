import React, { useState, useEffect } from 'react';
import { GameModeType } from '../game/rules.ts';
import { RoomSyncState, RoomPlayer, MultiplayerNetwork } from '../utils/multiplayer.ts';
import { X, Users, Lock, KeyRound, Plus, Play, UserCheck, Bot, Copy, Check } from 'lucide-react';

interface MultiplayerLobbyModalProps {
  currentUserId: string;
  currentUserName: string;
  onStartRoomGame: (room: RoomSyncState) => void;
  onClose: () => void;
}

export const MultiplayerLobbyModal: React.FC<MultiplayerLobbyModalProps> = ({
  currentUserId,
  currentUserName,
  onStartRoomGame,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'create' | 'in_room'>('browse');
  const [rooms, setRooms] = useState<Record<string, RoomSyncState>>({});
  const [currentRoom, setCurrentRoom] = useState<RoomSyncState | null>(null);

  // Form states for creating a room
  const [createName, setCreateName] = useState('Masa de Whist');
  const [createPassword, setCreatePassword] = useState('');
  const [createMode, setCreateMode] = useState<GameModeType>('standard');

  // Form states for joining
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinError, setJoinError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Load existing rooms
  useEffect(() => {
    const refreshRooms = () => {
      setRooms(MultiplayerNetwork.getAllStoredRooms());
    };
    refreshRooms();
    const interval = setInterval(refreshRooms, 1500);
    return () => clearInterval(interval);
  }, []);

  // Listen for room updates
  useEffect(() => {
    const handleStorageChange = () => {
      const all = MultiplayerNetwork.getAllStoredRooms();
      setRooms(all);
      if (currentRoom && all[currentRoom.roomId]) {
        setCurrentRoom(all[currentRoom.roomId]);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentRoom]);

  // Create room handler
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const randomCode = `WHIST-${Math.floor(1000 + Math.random() * 9000)}`;
    const hostPlayer: RoomPlayer = {
      id: currentUserId,
      name: currentUserName || 'Tu (Gazdă)',
      avatar: '👑',
      isAi: false,
      seatIndex: 0,
      isReady: true,
      score: 0,
    };

    const newRoom: RoomSyncState = {
      roomId: randomCode,
      roomName: createName.trim() || 'Masa de Whist',
      hasPassword: createPassword.trim().length > 0,
      password: createPassword.trim() || undefined,
      gameMode: createMode,
      hostId: currentUserId,
      status: 'lobby',
      players: [hostPlayer],
      currentRoundIdx: 0,
      phase: 'dealing',
      currentTurnPlayerId: 0,
      trumpSuit: null,
      trumpCard: null,
      bids: [null, null, null, null],
      tricksWon: [0, 0, 0, 0],
      currentTrick: [],
      lastTrickWinnerName: null,
      updatedAt: Date.now(),
    };

    MultiplayerNetwork.saveRoom(newRoom);
    setCurrentRoom(newRoom);
    setActiveTab('in_room');
  };

  // Join room handler
  const handleJoinRoom = (room: RoomSyncState) => {
    if (room.hasPassword) {
      setJoinRoomId(room.roomId);
      setJoinError('');
      return;
    }
    executeJoin(room.roomId, '');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeJoin(joinRoomId, joinPassword);
  };

  const executeJoin = (roomId: string, pass: string) => {
    const target = rooms[roomId];
    if (!target) {
      setJoinError('Camera nu a fost găsită!');
      return;
    }
    if (target.hasPassword && target.password !== pass) {
      setJoinError('Parolă incorectă!');
      return;
    }
    if (target.players.length >= 4) {
      setJoinError('Camera este plină (4/4 jucători)!');
      return;
    }

    // Add player
    const existing = target.players.find(p => p.id === currentUserId);
    if (!existing) {
      const newPlayer: RoomPlayer = {
        id: currentUserId,
        name: currentUserName || `Jucător ${target.players.length + 1}`,
        avatar: '👤',
        isAi: false,
        seatIndex: target.players.length,
        isReady: false,
        score: 0,
      };
      target.players.push(newPlayer);
      target.updatedAt = Date.now();
      MultiplayerNetwork.saveRoom(target);
    }
    setCurrentRoom(target);
    setActiveTab('in_room');
    setJoinError('');
  };

  // Add AI bot to room
  const handleAddAi = () => {
    if (!currentRoom || currentRoom.players.length >= 4) return;
    const aiNames = ['Radu (AI)', 'Elena (AI)', 'Mihai (AI)', 'Andreea (AI)', 'Vlad (AI)'];
    const usedNames = currentRoom.players.map(p => p.name);
    const availableName = aiNames.find(n => !usedNames.includes(n)) || `Robot ${currentRoom.players.length + 1}`;

    const updatedRoom: RoomSyncState = {
      ...currentRoom,
      players: [
        ...currentRoom.players,
        {
          id: `ai-${Date.now()}-${Math.random()}`,
          name: availableName,
          avatar: '🤖',
          isAi: true,
          seatIndex: currentRoom.players.length,
          isReady: true,
          score: 0,
        },
      ],
      updatedAt: Date.now(),
    };
    MultiplayerNetwork.saveRoom(updatedRoom);
    setCurrentRoom(updatedRoom);
  };

  // Toggle ready
  const handleToggleReady = () => {
    if (!currentRoom) return;
    const updatedPlayers = currentRoom.players.map(p => {
      if (p.id === currentUserId) {
        return { ...p, isReady: !p.isReady };
      }
      return p;
    });
    const updatedRoom: RoomSyncState = {
      ...currentRoom,
      players: updatedPlayers,
      updatedAt: Date.now(),
    };
    MultiplayerNetwork.saveRoom(updatedRoom);
    setCurrentRoom(updatedRoom);
  };

  // Start game from room
  const handleLaunchGame = () => {
    if (!currentRoom || currentRoom.players.length < 4) return;
    const updatedRoom: RoomSyncState = {
      ...currentRoom,
      status: 'playing',
      updatedAt: Date.now(),
    };
    MultiplayerNetwork.saveRoom(updatedRoom);
    onStartRoomGame(updatedRoom);
  };

  const handleCopyCode = () => {
    if (!currentRoom) return;
    navigator.clipboard?.writeText(currentRoom.roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 border border-amber-500/50 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-emerald-800/60 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg sm:text-xl font-bold font-cinzel text-amber-400">
              Camere Multiplayer cu Parolă
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide fereastra"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs if not in room */}
        {activeTab !== 'in_room' && (
          <div className="flex border-b border-emerald-900/60 bg-slate-950/60">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'browse'
                  ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Camere Active
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'create'
                  ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              + Creează Cameră Nouă
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {/* TAB 1: Browse / Join Rooms */}
          {activeTab === 'browse' && (
            <div className="space-y-4">
              {joinRoomId ? (
                /* Password Entry Form */
                <form onSubmit={handlePasswordSubmit} className="bg-slate-950/80 border border-amber-500/40 rounded-xl p-5 space-y-4 max-w-md mx-auto">
                  <div className="text-center">
                    <Lock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <h3 className="text-base font-bold text-amber-300">
                      Camera este protejată cu parolă
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Cod cameră: <span className="font-mono text-white font-bold">{joinRoomId}</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Introdu Parola Camerei:
                    </label>
                    <input
                      type="password"
                      value={joinPassword}
                      onChange={(e) => setJoinPassword(e.target.value)}
                      placeholder="Parola stabilită de gazdă"
                      autoFocus
                      required
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-hidden focus:border-amber-400"
                    />
                  </div>

                  {joinError && (
                    <div className="text-xs text-red-400 bg-red-950/40 p-2 rounded border border-red-500/30 text-center">
                      {joinError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setJoinRoomId('')}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Renunță
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
                    >
                      Intră în Cameră
                    </button>
                  </div>
                </form>
              ) : (
                /* Rooms List */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Camere disponibile pe această rețea:</span>
                    <span>{Object.keys(rooms).length} camere</span>
                  </div>

                  {Object.keys(rooms).length === 0 ? (
                    <div className="text-center py-10 bg-slate-950/40 border border-emerald-900/40 rounded-xl space-y-3">
                      <Users className="w-10 h-10 text-slate-600 mx-auto" />
                      <div className="text-sm font-semibold text-slate-300">
                        Nu este nicio cameră activă momentan.
                      </div>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Fii tu primul! Creează o cameră nouă, setează o parolă și invită-ți prietenii sau adaugă boți AI.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('create')}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl cursor-pointer shadow-md inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" /> Creează o Cameră Acum
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {Object.values(rooms).map((r) => (
                        <div
                          key={r.roomId}
                          className="bg-slate-950/60 border border-emerald-900/60 hover:border-amber-500/50 rounded-xl p-3.5 flex items-center justify-between transition-all"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-100">{r.roomName}</span>
                              {r.hasPassword && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-500/40">
                                  <Lock className="w-2.5 h-2.5" /> Cu Parolă
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                              <span>Cod: <strong>{r.roomId}</strong></span>
                              <span>•</span>
                              <span>Format: {r.gameMode === 'standard' ? '1-8-1 (32 cărți)' : 'Complet (52 cărți)'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs font-bold text-emerald-400">
                                {r.players.length}/4 Jucători
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {r.status === 'playing' ? 'În desfășurare' : 'În Așteptare'}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleJoinRoom(r)}
                              disabled={r.players.length >= 4}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                r.players.length >= 4
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                              }`}
                            >
                              {r.hasPassword ? 'Intră cu Parolă' : 'Alătură-te'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Create Room Form */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateRoom} className="space-y-4 max-w-lg mx-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Numele Mesei / Camerei:
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="ex: Masa Campionilor"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Parola Camerei (opțională sau obligatorie):</span>
                  <span className="text-[10px] text-amber-300 font-mono">Pentru acces securizat</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="ex: whist2026"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-hidden focus:border-amber-400"
                  />
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Dacă setezi o parolă, doar jucătorii care o cunosc vor putea intra la această masă.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Formatul Jocului de Whist:
                </label>
                <select
                  value={createMode}
                  onChange={(e) => setCreateMode(e.target.value as GameModeType)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-hidden focus:border-amber-400 cursor-pointer"
                >
                  <option value="standard">Standard Românesc (1-8-1, 24 runde, 32 cărți 7..A)</option>
                  <option value="full52">Complet 52 cărți (1-13-1, 34 runde, pachet complet 2..A)</option>
                  <option value="quick">Joc Rapid (1-4-1, 16 runde)</option>
                  <option value="single13">Rundă Unică de 13 cărți (o singură mână completă)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('browse')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Înapoi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-950/50"
                >
                  Deschide Camera
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Inside Room Lobby */}
          {activeTab === 'in_room' && currentRoom && (
            <div className="space-y-4">
              {/* Room details banner */}
              <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base text-amber-300">{currentRoom.roomName}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                    <span>Cod: <strong className="text-white">{currentRoom.roomId}</strong></span>
                    {currentRoom.hasPassword && (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Parolă: {currentRoom.password || 'activă'}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copiat!' : 'Copiază Cod'}</span>
                </button>
              </div>

              {/* 4 Player Slots */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((slotIdx) => {
                  const player = currentRoom.players[slotIdx];
                  return (
                    <div
                      key={slotIdx}
                      className={`p-3.5 rounded-xl border flex items-center justify-between ${
                        player
                          ? 'bg-slate-900/80 border-emerald-800/80'
                          : 'bg-slate-950/40 border-dashed border-slate-800'
                      }`}
                    >
                      {player ? (
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{player.avatar}</span>
                          <div>
                            <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                              <span>{player.name}</span>
                              {player.id === currentRoom.hostId && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-sans">
                                  Gazdă
                                </span>
                              )}
                              {player.isAi && (
                                <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/40 px-1.5 py-0.2 rounded font-sans">
                                  AI
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Locul {slotIdx + 1} ({slotIdx === 0 ? 'Sud' : slotIdx === 1 ? 'Vest' : slotIdx === 2 ? 'Nord' : 'Est'})
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-500 text-xs flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Locul {slotIdx + 1} liber</span>
                        </div>
                      )}

                      <div>
                        {player ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              player.isReady
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {player.isReady ? 'Gata' : 'În pregătire'}
                          </span>
                        ) : currentRoom.hostId === currentUserId ? (
                          <button
                            type="button"
                            onClick={handleAddAi}
                            className="px-2.5 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/40 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Bot className="w-3 h-3" /> + Robot AI
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lobby Action Controls */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-900/60">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('browse');
                    setCurrentRoom(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Părăsește Camera
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleToggleReady}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Sunt Gata</span>
                  </button>

                  {currentRoom.hostId === currentUserId && (
                    <button
                      type="button"
                      onClick={handleLaunchGame}
                      disabled={currentRoom.players.length < 4}
                      className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                        currentRoom.players.length === 4
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-950/50'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-4 h-4" />
                      <span>{currentRoom.players.length < 4 ? `Așteaptă 4 jucători (${currentRoom.players.length}/4)` : 'Pornește Jocul!'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
