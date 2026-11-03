/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  RoomSyncState,
  RoomListing,
  multiplayerService,
} from '../utils/multiplayer.ts';
import {
  X,
  Users,
  Lock,
  KeyRound,
  Plus,
  Play,
  UserCheck,
  Bot,
  Copy,
  Check,
  Globe,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface MultiplayerLobbyModalProps {
  currentUserId: string;
  currentUserName: string;
  onStartRoomGame: (room: RoomSyncState, mySeat: number) => void;
  onClose: () => void;
}

export const MultiplayerLobbyModal: React.FC<MultiplayerLobbyModalProps> = ({
  currentUserId,
  currentUserName,
  onStartRoomGame,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'create' | 'in_room'>('browse');
  const [roomsList, setRoomsList] = useState<RoomListing[]>([]);
  const [currentRoom, setCurrentRoom] = useState<RoomSyncState | null>(null);
  const [mySeat, setMySeat] = useState<number>(0);

  // Form states for creating a room
  const [createName, setCreateName] = useState('Masa de Whist Românesc');
  const [createPassword, setCreatePassword] = useState('');
  const [createMaxPlayers, setCreateMaxPlayers] = useState<number>(4);

  // Form states for joining
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [manualRoomCode, setManualRoomCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Setup WebSocket room listings and active room sync
  useEffect(() => {
    const unsubRooms = multiplayerService.subscribeRoomsList((rooms) => {
      setRoomsList(rooms);
    });

    const unsubRoom = multiplayerService.subscribeRoomState((data) => {
      setCurrentRoom(data.room);
      setMySeat(data.mySeat);
      if (data.room.status === 'playing') {
        onStartRoomGame(data.room, data.mySeat);
      }
    });

    const unsubErrors = multiplayerService.subscribeErrors((msg) => {
      setErrorMessage(msg);
      setIsSubmitting(false);
    });

    multiplayerService.fetchInitialRooms();

    // Check if there is an existing cached room
    const cached = multiplayerService.getCachedRoomState();
    if (cached) {
      setCurrentRoom(cached.room);
      setMySeat(cached.mySeat);
    }

    return () => {
      unsubRooms();
      unsubRoom();
      unsubErrors();
    };
  }, [onStartRoomGame]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await multiplayerService.fetchInitialRooms();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Create room handler
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const payload = await multiplayerService.createRoom(
        createName.trim() || 'Masa de Whist Românesc',
        createPassword.trim() || undefined,
        createMaxPlayers,
        {
          id: currentUserId,
          name: currentUserName.trim() || 'Tu',
          avatar: '👑',
        }
      );

      if (payload && payload.room) {
        setCurrentRoom(payload.room);
        setMySeat(payload.mySeat);
        setActiveTab('in_room');
      } else {
        setErrorMessage('Nu s-a putut inițializa camera. Vă rugăm să reîncercați.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Eroare la crearea camerei!';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Join room initiation
  const handleJoinRoomClick = (room: RoomListing) => {
    setErrorMessage('');
    if (room.hasPassword) {
      setJoinRoomId(room.id);
      setJoinPassword('');
      return;
    }
    executeJoin(room.id, '');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeJoin(joinRoomId, joinPassword);
  };

  const executeJoin = async (roomId: string, pass: string) => {
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const result = await multiplayerService.joinRoom(
        roomId,
        {
          id: currentUserId,
          name: currentUserName.trim() || 'Jucător',
          avatar: '😎',
        },
        pass
      );

      if (result.success && result.payload?.room) {
        setCurrentRoom(result.payload.room);
        setMySeat(result.payload.mySeat);
        setActiveTab('in_room');
        setJoinRoomId('');
        setJoinPassword('');
      } else {
        setErrorMessage(result.error || 'Parolă incorectă sau camera este indisponibilă!');
      }
    } catch {
      setErrorMessage('Nu s-a putut conecta la cameră!');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct room code join handler
  const handleDirectCodeJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualRoomCode.trim().toUpperCase();
    if (!clean) {
      setErrorMessage('Introduceți codul mesei (ex: WHIST-1234 sau 1234).');
      return;
    }
    const code = clean.startsWith('WHIST-') ? clean : `WHIST-${clean}`;
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const info = await multiplayerService.fetchRoomInfo(code);
      if (info && info.hasPassword) {
        setJoinRoomId(info.id);
        setJoinPassword('');
        return;
      }
      await executeJoin(code, '');
    } catch {
      setErrorMessage(`Masa cu codul '${code}' nu a putut fi găsită.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add AI bot to room
  const handleAddAi = () => {
    if (!currentRoom) return;
    multiplayerService.addAi(currentRoom.roomId);
  };

  // Toggle ready status
  const handleToggleReady = () => {
    if (!currentRoom) return;
    multiplayerService.toggleReady(currentRoom.roomId, currentUserId);
  };

  // Start game from room
  const handleLaunchGame = () => {
    if (!currentRoom) return;
    multiplayerService.startRoomGame(currentRoom.roomId);
  };

  const handleLeaveRoom = () => {
    if (currentRoom) {
      multiplayerService.leaveRoom(currentRoom.roomId, currentUserId);
      setCurrentRoom(null);
    }
    setActiveTab('browse');
    setJoinRoomId('');
    setErrorMessage('');
  };

  const handleCopyCode = () => {
    if (!currentRoom) return;
    navigator.clipboard?.writeText(currentRoom.roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const maxSlots = currentRoom ? currentRoom.maxPlayers || 4 : 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 border border-amber-500/50 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-emerald-800/60 flex items-center justify-between bg-slate-950/85">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-amber-400 animate-pulse" />
            <div>
              <h2 className="text-base sm:text-lg font-bold font-cinzel text-amber-300">
                Multiplayer Online (Peste Tot)
              </h2>
              <div className="text-[10px] sm:text-xs text-emerald-400 font-mono">
                Camere în timp real pe Internet • Telefon / Tabletă / PC
              </div>
            </div>
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

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="px-4 py-2 bg-red-950/80 border-b border-red-500/50 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Navigation Tabs (Always accessible unless inside an active room with confirmed room) */}
        {activeTab !== 'in_room' && (
          <div className="flex border-b border-emerald-900/60 bg-slate-950/60">
            <button
              type="button"
              onClick={() => {
                setActiveTab('browse');
                setJoinRoomId('');
                setErrorMessage('');
              }}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'browse'
                  ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Camere Active ({roomsList.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('create');
                setErrorMessage('');
              }}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'create'
                  ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              + Creează Masă Nouă
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4 sm:p-5">
          {/* TAB 1: Browse / Join Rooms */}
          {activeTab === 'browse' && (
            <div className="space-y-4">
              {joinRoomId ? (
                /* Password Entry Form */
                <form
                  onSubmit={handlePasswordSubmit}
                  className="bg-slate-950/80 border border-amber-500/40 rounded-xl p-5 space-y-4 max-w-md mx-auto"
                >
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
                      Introdu Parola stabilită de gazdă:
                    </label>
                    <input
                      type="password"
                      value={joinPassword}
                      onChange={(e) => setJoinPassword(e.target.value)}
                      placeholder="Parola camerei"
                      autoFocus
                      required
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-hidden focus:border-amber-400"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setJoinRoomId('')}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Renunță
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Se verifică...</span>
                        </>
                      ) : (
                        <span>Intră în Cameră</span>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Rooms List */
                <div className="space-y-4">
                  {/* Direct Room Code Input Box */}
                  <div className="bg-slate-950/80 border border-amber-500/40 rounded-xl p-3 sm:p-4 shadow-lg">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-2">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span>Ai primit un cod de masă? Intră direct aici:</span>
                    </div>
                    <form onSubmit={handleDirectCodeJoin} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={manualRoomCode}
                        onChange={(e) => setManualRoomCode(e.target.value.toUpperCase())}
                        placeholder="Ex: WHIST-8232 sau 8232"
                        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm tracking-wider uppercase focus:outline-hidden focus:border-amber-400 placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500"
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting || !manualRoomCode.trim()}
                        className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Se verifică...</span>
                          </>
                        ) : (
                          <span>Intră în Masă</span>
                        )}
                      </button>
                    </form>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span>Mese de joc disponibile pe server:</span>
                      <strong className="text-amber-300">{roomsList.length}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={handleManualRefresh}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-amber-300 p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Reîmprospătează lista"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>Actualizează</span>
                    </button>
                  </div>

                  {roomsList.length === 0 ? (
                    <div className="text-center py-10 bg-slate-950/40 border border-emerald-900/40 rounded-xl space-y-3">
                      <Users className="w-10 h-10 text-slate-600 mx-auto" />
                      <div className="text-sm font-semibold text-slate-300">
                        Nicio masă online activă în acest moment.
                      </div>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Creează tu prima masă, stabilește numărul de jucători (3-6) și trimite codul prietenilor tăi de pe telefon sau PC!
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('create')}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl cursor-pointer shadow-md inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" /> Creează o Masă Acum
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {roomsList.map((r) => (
                        <div
                          key={r.id}
                          className="bg-slate-950/60 border border-emerald-900/60 hover:border-amber-500/50 rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-all"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-100 truncate">
                                {r.name}
                              </span>
                              {r.hasPassword && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-500/40 shrink-0">
                                  <Lock className="w-2.5 h-2.5" /> Parolă
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                              <span>
                                Cod: <strong className="text-white">{r.id}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Max: <strong>{r.maxPlayers || 4} jucători</strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <div className="text-xs font-bold text-emerald-400">
                                {r.playerCount}/{r.maxPlayers || 4} Jucători
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {r.status === 'playing' ? 'În desfășurare' : 'Lobby'}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleJoinRoomClick(r)}
                              disabled={r.playerCount >= (r.maxPlayers || 4) || r.status === 'playing' || isSubmitting}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                r.playerCount >= (r.maxPlayers || 4) || r.status === 'playing'
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Număr de Jucători la Masă:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCreateMaxPlayers(num)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        createMaxPlayers === num
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {num} Jucători
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Regulamentul oficial de Whist Românesc adaptează pachetul la numărul de jucători (8 cărți/jucător).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Parola Camerei (opțională):</span>
                  <span className="text-[10px] text-amber-300 font-mono">Pentru joc privat cu prietenii</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Lăsați liber pentru cameră publică"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-hidden focus:border-amber-400"
                  />
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
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
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-950/50 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Se creează camera...</span>
                    </>
                  ) : (
                    <span>Deschide Camera Online</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Inside Room Lobby */}
          {activeTab === 'in_room' && (
            !currentRoom ? (
              <div className="text-center py-10 space-y-4">
                <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                <div className="text-sm font-bold text-amber-300">
                  Nu a fost găsită nicio cameră activă
                </div>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Vă rugăm să selectați o cameră din listă sau să creați o cameră nouă.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('browse');
                    setCurrentRoom(null);
                    setErrorMessage('');
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl cursor-pointer shadow-md"
                >
                  Înapoi la Lista de Camere
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Room details banner */}
                <div className="bg-gradient-to-r from-slate-950 via-emerald-950/70 to-slate-950 border border-amber-500/50 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                        Masa Online Activă
                      </span>
                      {currentRoom.hasPassword && (
                        <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Protejată cu parolă
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-amber-300 font-cinzel">{currentRoom.roomName}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-300 font-mono mt-1">
                      <span>Trimite codul prietenilor:</span>
                      <span className="bg-amber-400/20 text-amber-300 border border-amber-400/50 px-2 py-0.5 rounded-md font-bold tracking-widest text-sm">
                        {currentRoom.roomId}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4 text-slate-950" />}
                      <span>{copiedCode ? 'Cod Copiat!' : 'Copiază Codul'}</span>
                    </button>
                  </div>
                </div>

                {/* Player Slots */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Array.from({ length: maxSlots }).map((_, slotIdx) => {
                    const player = currentRoom.players[slotIdx];
                    const isMe = slotIdx === mySeat;

                    return (
                      <div
                        key={slotIdx}
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          player
                            ? isMe
                              ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-400/40'
                              : 'bg-slate-900/80 border-emerald-800/80'
                            : 'bg-slate-950/40 border-dashed border-slate-800'
                        }`}
                      >
                        {player ? (
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{player.avatar}</span>
                            <div>
                              <div className="font-bold text-xs sm:text-sm text-slate-100 flex items-center gap-1.5">
                                <span>{player.name}</span>
                                {isMe && (
                                  <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded">
                                    Tu
                                  </span>
                                )}
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
                                Locul {slotIdx + 1}
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
                    onClick={handleLeaveRoom}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Părăsește Camera
                  </button>

                  <div className="flex items-center gap-2">
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
                        className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-950/50"
                      >
                        <Play className="w-4 h-4" />
                        <span>
                          {currentRoom.players.length < 3
                            ? `Pornește cu AI (${currentRoom.players.length}/${maxSlots})`
                            : 'Pornește Partida!'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
