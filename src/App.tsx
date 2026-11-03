/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  getMinRankForPlayerCount,
  SUIT_SYMBOLS,
  SUIT_NAMES_RO,
  RANK_NAMES_RO,
} from './game/rules.ts';
import { sounds } from './utils/audio.ts';
import { RoomSyncState } from './utils/multiplayer.ts';
import { downloadStandaloneHtml } from './utils/exportStandalone.ts';

// Components
import { PlayingCard } from './components/PlayingCard.tsx';
import { BiddingOverlay } from './components/BiddingOverlay.tsx';
import { ScoreTableModal, RoundHistoryRecord } from './components/ScoreTableModal.tsx';
import { RulesModal } from './components/RulesModal.tsx';
import { MultiplayerLobbyModal } from './components/MultiplayerLobbyModal.tsx';
import { GameOverModal } from './components/GameOverModal.tsx';
import { RoundRecapModal, PlayerRoundResult } from './components/RoundRecapModal.tsx';
import { InteractiveTutorialModal } from './components/InteractiveTutorialModal.tsx';
import { StatsModal } from './components/StatsModal.tsx';
import { StatsManager, PlayerStats, Achievement } from './utils/statsAndAchievements.ts';
import { JokersModal } from './components/JokersModal.tsx';
import { JokerUnlockNotification } from './components/JokerUnlockNotification.tsx';
import { GameHeaderMenu } from './components/GameHeaderMenu.tsx';
import {
  CustomizationManager,
  UserCustomization,
  JokerBonus,
  JOKERS_LIST,
} from './utils/jokersAndThemes.ts';

// Icons
import {
  Trophy,
  BookOpen,
  Volume2,
  VolumeX,
  RotateCcw,
  Users,
  Download,
  Play,
  Pause,
  Clock,
  Shield,
  Sparkles,
  Eye,
  CheckCircle,
  GraduationCap,
  Award,
} from 'lucide-react';

interface PlayerState {
  id: number;
  name: string;
  avatar: string;
  isAi: boolean;
  score: number;
  bid: number | null;
  tricksWon: number;
}

interface PlayedCard {
  playerId: number;
  card: Card;
  playerName: string;
}

interface TrickWinnerBannerState {
  winnerName: string;
  reason: string;
  winningCard: Card;
}

const DEFAULT_AI_PROFILES = [
  { name: 'Radu (AI)', avatar: '🦊' },
  { name: 'Elena (AI)', avatar: '🦉' },
  { name: 'Mihai (AI)', avatar: '🐻' },
  { name: 'Andrei (AI)', avatar: '🦁' },
  { name: 'Ioana (AI)', avatar: '🐺' },
];

export default function App() {
  // Game Screen State: 'title' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState<'title' | 'playing' | 'gameover'>('title');

  // Player count selection: 3, 4, 5, 6 (default 4)
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [userName, setUserName] = useState<string>('Tu');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Modals
  const [showScoreModal, setShowScoreModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showLobbyModal, setShowLobbyModal] = useState<boolean>(false);
  const [showTutorialModal, setShowTutorialModal] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showJokersModal, setShowJokersModal] = useState<boolean>(false);

  // Customization & Jokers Collection
  const [customization, setCustomization] = useState<UserCustomization>(() =>
    CustomizationManager.load()
  );
  const [newJokerUnlocked, setNewJokerUnlocked] = useState<JokerBonus | null>(null);

  // Career Statistics & Achievements
  const [stats, setStats] = useState<PlayerStats>(() => StatsManager.load());
  const [achievementToast, setAchievementToast] = useState<Achievement | null>(null);
  const [userTrumpCutsThisRound, setUserTrumpCutsThisRound] = useState<number>(0);

  // Players
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const playersRef = useRef<PlayerState[]>([]);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Round Management
  const [rounds, setRounds] = useState<RoundConfig[]>([]);
  const [currentRoundIdx, setCurrentRoundIdx] = useState<number>(0);
  const [history, setHistory] = useState<RoundHistoryRecord[]>([]);
  const [tricksCompletedInRound, setTricksCompletedInRound] = useState<number>(0);
  const tricksCompletedInRoundRef = useRef<number>(0);

  // Hands & Trump
  const [hands, setHands] = useState<Card[][]>([]);
  const handsRef = useRef<Card[][]>([]);
  useEffect(() => {
    handsRef.current = hands;
  }, [hands]);
  const [trumpCard, setTrumpCard] = useState<Card | null>(null);
  const [trumpSuit, setTrumpSuit] = useState<Suit | null>(null);

  // Round Phase: 'dealing' | 'inspecting' | 'bidding' | 'playing' | 'trick_eval' | 'round_recap'
  const [roundPhase, setRoundPhase] = useState<
    'dealing' | 'inspecting' | 'bidding' | 'playing' | 'trick_eval' | 'round_recap'
  >('dealing');
  const [currentTurn, setCurrentTurn] = useState<number>(0);
  const [currentTrick, setCurrentTrick] = useState<PlayedCard[]>([]);
  const [winningCardId, setWinningCardId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Bun venit la Whist Românesc!');
  const [trickWinnerBanner, setTrickWinnerBanner] = useState<TrickWinnerBannerState | null>(null);
  const [recapResults, setRecapResults] = useState<PlayerRoundResult[] | null>(null);

  // Countdown Timer for inspecting phase (5 seconds)
  const [countdown, setCountdown] = useState<number>(5);
  const [isCountdownPaused, setIsCountdownPaused] = useState<boolean>(false);

  // Card play countdown timer (7 seconds for human turn)
  const [turnCountdown, setTurnCountdown] = useState<number>(7);
  const [turnAutoPlayedCard, setTurnAutoPlayedCard] = useState<Card | null>(null);

  // Sync state to body dataset for ultra-mode compliance
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Check ?autostart=1 query parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        startGame();
      }
    }
  }, []);

  // Update sound engine
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.setEnabled(next);
  };

  // Helper to build initial players for N players
  const buildPlayersList = (count: number, customUserName: string): PlayerState[] => {
    const list: PlayerState[] = [
      {
        id: 0,
        name: customUserName.trim() || 'Tu',
        avatar: '😎',
        isAi: false,
        score: 0,
        bid: null,
        tricksWon: 0,
      },
    ];

    for (let i = 1; i < count; i++) {
      const profile = DEFAULT_AI_PROFILES[i - 1] || { name: `AI ${i}`, avatar: '🤖' };
      list.push({
        id: i,
        name: profile.name,
        avatar: profile.avatar,
        isAi: true,
        score: 0,
        bid: null,
        tricksWon: 0,
      });
    }

    return list;
  };

  // Start / Restart Game
  const startGame = useCallback(
    (customCount?: number) => {
      const count = customCount || playerCount;
      const generated = generateRounds(count);
      setRounds(generated);
      setCurrentRoundIdx(0);
      setHistory([]);

      const initialPlayers = buildPlayersList(count, userName);
      playersRef.current = initialPlayers;
      setPlayers(initialPlayers);
      setTricksCompletedInRound(0);
      tricksCompletedInRoundRef.current = 0;
      setGameState('playing');
      setTrickWinnerBanner(null);
      setWinningCardId(null);
      setRecapResults(null);

      // Start Round 0
      initRound(0, generated, initialPlayers, count);
    },
    [playerCount, userName]
  );

  // Start a Room game
  const handleStartRoomGame = (room: RoomSyncState) => {
    setShowLobbyModal(false);
    const count = Math.min(6, Math.max(3, room.players.length || 4));
    setPlayerCount(count);

    const mappedPlayers: PlayerState[] = room.players.slice(0, count).map((p, idx) => ({
      id: idx,
      name: p.name,
      avatar: p.avatar,
      isAi: p.isAi,
      score: 0,
      bid: null,
      tricksWon: 0,
    }));

    playersRef.current = mappedPlayers;
    setPlayers(mappedPlayers);
    setTricksCompletedInRound(0);
    tricksCompletedInRoundRef.current = 0;
    const generated = generateRounds(count);
    setRounds(generated);
    setCurrentRoundIdx(0);
    setHistory([]);
    setGameState('playing');
    setRecapResults(null);
    setWinningCardId(null);
    initRound(0, generated, mappedPlayers, count);
  };

  // Initialize a new round
  const initRound = (
    roundIdx: number,
    roundList: RoundConfig[],
    currentPlayers: PlayerState[],
    count: number
  ) => {
    if (roundIdx >= roundList.length) {
      setGameState('gameover');
      return;
    }

    const round = roundList[roundIdx];
    const deck = shuffleDeck(createDeck(count));
    const newHands: Card[][] = Array.from({ length: count }, () => []);

    // 1. Extract Trump card FIRST from the deck so it is set aside and out of play!
    // No player can ever receive this card in their hand.
    let revealedTrump: Card | null = null;
    let revealedTrumpSuit: Suit | null = null;
    if (round.hasTrump && deck.length > 0) {
      revealedTrump = deck.pop() || null;
      revealedTrumpSuit = revealedTrump?.suit || null;
    }

    // 2. Deal cards from the remaining deck to all players
    for (let c = 0; c < round.cardCount; c++) {
      for (let p = 0; p < count; p++) {
        const card = deck.pop();
        if (card) newHands[p].push(card);
      }
    }

    // Sort human hand by suit and rank for clean UX
    newHands[0].sort((a, b) => {
      if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
      return b.rank - a.rank;
    });

    handsRef.current = newHands;
    setHands(newHands);
    setTrumpCard(revealedTrump);
    setTrumpSuit(revealedTrumpSuit);
    setUserTrumpCutsThisRound(0);

    // Reset trick counter for this round
    setTricksCompletedInRound(0);
    tricksCompletedInRoundRef.current = 0;

    // Reset round players state (bids to null, tricksWon to 0)
    const baseList = playersRef.current.length > 0 ? playersRef.current : currentPlayers;
    const resetPlayers = baseList.map((p) => ({
      ...p,
      bid: null,
      tricksWon: 0,
    }));
    playersRef.current = resetPlayers;
    setPlayers(resetPlayers);

    setCurrentTrick([]);
    setTrickWinnerBanner(null);
    setWinningCardId(null);
    setRecapResults(null);

    // Enter inspecting phase: 5-second countdown to bidding
    setCountdown(5);
    setIsCountdownPaused(false);
    setRoundPhase('inspecting');
    sounds.playDeal();
    setStatusMessage(
      `Runda ${roundIdx + 1} (${round.cardCount} ${
        round.cardCount === 1 ? 'carte' : 'cărți'
      }). Analizează cărțile! Licitația începe în 5 secunde.`
    );
  };

  // Called when user clicks "Sunt gata de licitație" or when the 5s timer expires
  const handleStartBidding = useCallback(() => {
    if (roundPhase !== 'inspecting') return;
    setCountdown(0);
    sounds.playBid();
    setRoundPhase('bidding');

    const round = rounds[currentRoundIdx];
    if (!round) return;
    const firstBidder = (round.dealerIndex + 1) % playerCount;
    setCurrentTurn(firstBidder);
    const livePlayers = playersRef.current.length > 0 ? playersRef.current : players;
    const firstBidderName = livePlayers[firstBidder]?.name || 'Jucător';
    if (firstBidder === 0) {
      setStatusMessage('Este rândul tău să licitezi primul!');
    } else {
      setStatusMessage(
        `Se licitează pentru Runda ${currentRoundIdx + 1}! Începe ${firstBidderName}.`
      );
    }
  }, [roundPhase, rounds, currentRoundIdx, playerCount, players]);

  // 5-second countdown timer for inspecting phase
  useEffect(() => {
    if (gameState !== 'playing' || roundPhase !== 'inspecting' || isCountdownPaused) {
      return;
    }

    if (countdown <= 0) {
      handleStartBidding();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleStartBidding();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, roundPhase, isCountdownPaused, countdown, handleStartBidding]);

  // AI Bidding Turn automation
  useEffect(() => {
    if (gameState !== 'playing' || roundPhase !== 'bidding') return;
    if (rounds.length === 0 || currentRoundIdx >= rounds.length) return;

    const round = rounds[currentRoundIdx];
    const livePlayers = playersRef.current.length > 0 ? playersRef.current : players;
    const currentPlayer = livePlayers[currentTurn];

    if (currentPlayer && currentPlayer.isAi) {
      const timer = setTimeout(() => {
        const currentHands = handsRef.current.length > 0 ? handsRef.current : hands;
        const currentLivePlayers = playersRef.current.length > 0 ? playersRef.current : players;
        const bidsSoFar = currentLivePlayers.map((p) => p.bid);
        const aiBid = calculateAIBid(
          currentHands[currentTurn] || [],
          trumpSuit,
          round.cardCount,
          bidsSoFar,
          round.dealerIndex,
          currentTurn
        );

        handleBidPlaced(currentTurn, aiBid);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [gameState, roundPhase, currentTurn, players, rounds, currentRoundIdx, hands, trumpSuit]);

  // Handle a bid placed by either User or AI
  const handleBidPlaced = (playerIdx: number, bid: number) => {
    const currentList = playersRef.current.length > 0 ? playersRef.current : players;
    const updatedPlayers = currentList.map((p) =>
      p.id === playerIdx ? { ...p, bid } : p
    );
    playersRef.current = updatedPlayers;
    setPlayers(updatedPlayers);

    const round = rounds[currentRoundIdx];
    const allBidsPlaced =
      updatedPlayers.length === playerCount &&
      updatedPlayers.every((p) => p.bid !== null);

    if (allBidsPlaced) {
      // Bidding complete! The trick play starts from the player left of dealer
      const firstPlayerToPlay = (round.dealerIndex + 1) % playerCount;
      setRoundPhase('playing');
      setCurrentTurn(firstPlayerToPlay);
      if (firstPlayerToPlay === 0) {
        setTurnCountdown(7);
      }
      const starterName = updatedPlayers[firstPlayerToPlay]?.name || 'Jucător';
      setStatusMessage(
        `Licitații încheiate. ${starterName} începe prima cupă!`
      );
    } else {
      // Advance to next bidder clockwise
      const nextBidder = (playerIdx + 1) % playerCount;
      setCurrentTurn(nextBidder);
      const nextBidderName = updatedPlayers[nextBidder]?.name || 'Jucător';
      if (nextBidder === 0) {
        setStatusMessage('Este rândul tău să licitezi!');
      } else {
        setStatusMessage(`Licitează ${nextBidderName}...`);
      }
    }
  };

  // AI Card Play automation
  useEffect(() => {
    if (gameState !== 'playing' || roundPhase !== 'playing') return;
    if (currentTrick.length === playerCount) return;

    const currentPlayer = players[currentTurn];
    if (currentPlayer && currentPlayer.isAi) {
      const timer = setTimeout(() => {
        executeAiCardPlay(currentTurn);
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [gameState, roundPhase, currentTurn, currentTrick, players, playerCount]);

  // Execute AI card play
  const executeAiCardPlay = (playerIdx: number) => {
    const currentHands = handsRef.current.length > 0 ? handsRef.current : hands;
    const aiHand = currentHands[playerIdx];
    if (!aiHand || aiHand.length === 0) return;

    const currentPlayers = playersRef.current.length > 0 ? playersRef.current : players;
    const trickForRules = currentTrick.map((t) => ({ playerId: t.playerId, card: t.card }));
    const legalCards = getLegalCards(aiHand, trickForRules, trumpSuit, true);

    const chosenCard = selectAICard(
      legalCards,
      trickForRules,
      trumpSuit,
      currentPlayers[playerIdx]?.bid ?? 0,
      currentPlayers[playerIdx]?.tricksWon ?? 0,
      aiHand.length
    );

    handlePlayCard(playerIdx, chosenCard);
  };

  // Human card play countdown timer (7 seconds to play card)
  useEffect(() => {
    if (gameState !== 'playing' || roundPhase !== 'playing' || currentTurn !== 0) {
      return;
    }

    if (turnCountdown <= 0) {
      // Auto-play first legal card in order
      const userHand = handsRef.current[0] || hands[0] || [];
      const trickForRules = currentTrick.map((t) => ({ playerId: t.playerId, card: t.card }));
      const legalCards = getLegalCards(userHand, trickForRules, trumpSuit, true);
      if (legalCards.length > 0) {
        const cardToPlay = legalCards[0];
        setTurnAutoPlayedCard(cardToPlay);
        setTimeout(() => setTurnAutoPlayedCard(null), 3000);
        setStatusMessage(
          `⏱️ Timpul a expirat (7s)! A fost jucată automat prima carte: ${RANK_NAMES_RO[cardToPlay.rank]} de ${SUIT_NAMES_RO[cardToPlay.suit]}.`
        );
        handlePlayCard(0, cardToPlay);
      }
      return;
    }

    const timer = setInterval(() => {
      setTurnCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, roundPhase, currentTurn, turnCountdown, currentTrick, trumpSuit, hands]);

  // Handle Human Card Click
  const handleUserCardClick = (card: Card) => {
    if (roundPhase !== 'playing' || currentTurn !== 0) return;

    const userHand = hands[0];
    const trickForRules = currentTrick.map((t) => ({ playerId: t.playerId, card: t.card }));
    const legalCards = getLegalCards(userHand, trickForRules, trumpSuit, true);

    const isLegal = legalCards.some((c) => c.id === card.id);
    if (!isLegal) {
      sounds.playForbidden();
      setStatusMessage('Trebuie să dai la culoare sau să tai cu atu!');
      return;
    }

    setTurnCountdown(7);
    handlePlayCard(0, card);
  };

  // Core play card handler
  const handlePlayCard = (playerIdx: number, card: Card) => {
    sounds.playCardPlay();

    // Remove from hand
    setHands((prev) => {
      const updated = [...prev];
      updated[playerIdx] = updated[playerIdx].filter((c) => c.id !== card.id);
      handsRef.current = updated;
      return updated;
    });

    // Track human player trump cuts for stats and achievements
    if (
      playerIdx === 0 &&
      trumpSuit &&
      card.suit === trumpSuit &&
      currentTrick.length > 0 &&
      currentTrick[0].card.suit !== trumpSuit
    ) {
      setUserTrumpCutsThisRound((prev) => prev + 1);
    }

    const currentPlayersList = playersRef.current.length > 0 ? playersRef.current : players;
    const playerName = currentPlayersList[playerIdx]?.name || `Jucător ${playerIdx + 1}`;

    const newTrick = [
      ...currentTrick,
      {
        playerId: playerIdx,
        card,
        playerName,
      },
    ];
    setCurrentTrick(newTrick);

    if (newTrick.length === playerCount) {
      // Trick is full! Evaluate winner with explicit reason
      setRoundPhase('trick_eval');
      const trickForRules = newTrick.map((t) => ({ playerId: t.playerId, card: t.card }));
      const evalResult = evaluateTrickWinner(trickForRules, trumpSuit);
      const winnerId = evalResult.winnerPlayerId;
      const winnerName = currentPlayersList[winnerId]?.name || `Jucător ${winnerId + 1}`;

      sounds.playTrickWin();
      setWinningCardId(evalResult.winningCard.id);
      setTrickWinnerBanner({
        winnerName,
        reason: evalResult.reason,
        winningCard: evalResult.winningCard,
      });
      setStatusMessage(`${winnerName} a câștigat mâna! (${evalResult.reason})`);

      // Update trick count immediately in ref and state
      const nextCompletedTricks = tricksCompletedInRoundRef.current + 1;
      tricksCompletedInRoundRef.current = nextCompletedTricks;
      setTricksCompletedInRound(nextCompletedTricks);

      const latestPlayersWithWin = (playersRef.current.length > 0 ? playersRef.current : players).map((p) =>
        p.id === winnerId ? { ...p, tricksWon: p.tricksWon + 1 } : p
      );
      playersRef.current = latestPlayersWithWin;
      setPlayers(latestPlayersWithWin);

      // Check if round is over using total tricks played vs round card count
      const round = rounds[currentRoundIdx];
      const isRoundOver = nextCompletedTricks >= round.cardCount;

      // Clear trick after visual celebration pause (1800ms to clearly see who won and why)
      setTimeout(() => {
        setCurrentTrick([]);
        setTrickWinnerBanner(null);
        setWinningCardId(null);

        if (isRoundOver) {
          finalizeRound(latestPlayersWithWin);
        } else {
          setRoundPhase('playing');
          setCurrentTurn(winnerId); // Winner of previous trick leads next!
          if (winnerId === 0) {
            setTurnCountdown(7);
          }
          setStatusMessage(`${winnerName} începe următoarea cupă.`);
        }
      }, 1800);
    } else {
      // Next player's turn
      const nextTurn = (playerIdx + 1) % playerCount;
      setCurrentTurn(nextTurn);
      if (nextTurn === 0) {
        setTurnCountdown(7);
      }
      const nextPlayerName = currentPlayersList[nextTurn]?.name || `Jucător ${nextTurn + 1}`;
      setStatusMessage(`Rândul lui ${nextPlayerName}...`);
    }
  };

  // Finalize round and compute scores
  const finalizeRound = (latestPlayers: PlayerState[]) => {
    const round = rounds[currentRoundIdx];

    // Compute round points and prepare recap records using latestPlayers directly
    const recapList: PlayerRoundResult[] = latestPlayers.map((p) => {
      const pts = calculateRoundPoints(p.bid ?? 0, p.tricksWon);
      return {
        playerId: p.id,
        name: p.name,
        avatar: p.avatar,
        isAi: p.isAi,
        bid: p.bid ?? 0,
        tricksWon: p.tricksWon,
        pointsGained: pts,
        previousScore: p.score,
        newTotalScore: p.score + pts,
      };
    });

    const updatedPlayers = latestPlayers.map((p, idx) => ({
      ...p,
      score: recapList[idx].newTotalScore,
    }));

    playersRef.current = updatedPlayers;
    setPlayers(updatedPlayers);

    // Save to history record
    const historyEntry: RoundHistoryRecord = {
      roundNumber: currentRoundIdx + 1,
      cardCount: round.cardCount,
      trumpSuit,
      playerResults: updatedPlayers.map((p, idx) => ({
        bid: recapList[idx].bid,
        tricksWon: recapList[idx].tricksWon,
        points: recapList[idx].pointsGained,
        runningTotal: p.score,
      })),
    };

    setHistory((prev) => [...prev, historyEntry]);
    setRecapResults(recapList);
    setRoundPhase('round_recap');

    const userResult = recapList[0];
    const userMade = userResult.bid === userResult.tricksWon;
    const isUserDealer = round.dealerIndex === 0;

    // Record round statistics
    const recordedStats = StatsManager.recordRound(
      stats,
      userResult.tricksWon,
      userMade,
      userTrumpCutsThisRound
    );

    // Evaluate achievements
    const { updatedStats: checkedStats, newlyUnlocked } = StatsManager.checkNewAchievements(
      recordedStats,
      {
        userBid: userResult.bid,
        userTricks: userResult.tricksWon,
        cardCount: round.cardCount,
        isDealer: isUserDealer,
        userTrumpCuts: userTrumpCutsThisRound,
      }
    );

    setStats(checkedStats);

    if (newlyUnlocked.length > 0) {
      sounds.playVictory();
      setAchievementToast(newlyUnlocked[0]);
      setTimeout(() => setAchievementToast(null), 4000);
    }

    // Check if new Jokers were unlocked
    const newJokersAfterRound = CustomizationManager.getNewlyUnlockedJokers(
      checkedStats,
      customization
    );
    if (newJokersAfterRound.length > 0) {
      sounds.playVictory();
      setNewJokerUnlocked(newJokersAfterRound[0]);
      const updatedCust = CustomizationManager.markJokerSeen(
        newJokersAfterRound[0].id,
        customization
      );
      setCustomization(updatedCust);
    }

    setStatusMessage(
      `Runda ${currentRoundIdx + 1} s-a încheiat! ${
        userMade
          ? 'Excelent! Ai realizat licitația (+5 puncte).'
          : 'Ai ratat licitația!'
      }`
    );
  };

  // User manually proceeds to next round from the recap modal
  const handleProceedToNextRound = () => {
    setRecapResults(null);
    const nextRoundIdx = currentRoundIdx + 1;
    if (nextRoundIdx < rounds.length) {
      setCurrentRoundIdx(nextRoundIdx);
      initRound(nextRoundIdx, rounds, players, playerCount);
    } else {
      // Finalize full game stats and check game-end achievements
      const userScore = players[0].score;
      const allScores = players.map((p) => p.score);
      const maxScore = Math.max(...allScores);
      const isWinner =
        userScore === maxScore && allScores.filter((s) => s === maxScore).length === 1;
      const userAccuracy =
        stats.totalBidsAttempted > 0
          ? Math.round((stats.totalBidsSuccessful / stats.totalBidsAttempted) * 100)
          : 0;

      const recordedGameStats = StatsManager.recordGame(stats, isWinner, userScore);
      const { updatedStats: checkedStats, newlyUnlocked } = StatsManager.checkNewAchievements(
        recordedGameStats,
        undefined,
        {
          won: isWinner,
          finalScore: userScore,
          userAccuracy,
        }
      );

      setStats(checkedStats);
      if (newlyUnlocked.length > 0) {
        sounds.playVictory();
        setAchievementToast(newlyUnlocked[0]);
        setTimeout(() => setAchievementToast(null), 4000);
      }

      // Check for newly unlocked Jokers at game end
      const newJokersAtEnd = CustomizationManager.getNewlyUnlockedJokers(
        checkedStats,
        customization
      );
      if (newJokersAtEnd.length > 0) {
        sounds.playVictory();
        setNewJokerUnlocked(newJokersAtEnd[0]);
        const updatedCust = CustomizationManager.markJokerSeen(
          newJokersAtEnd[0].id,
          customization
        );
        setCustomization(updatedCust);
      }

      setGameState('gameover');
    }
  };

  // Calculate legal cards for human player
  const humanLegalCards =
    roundPhase === 'playing' && currentTurn === 0
      ? getLegalCards(
          hands[0] || [],
          currentTrick.map((t) => ({ playerId: t.playerId, card: t.card })),
          trumpSuit,
          true
        )
      : [];

  // Current round config
  const currentRound = rounds[currentRoundIdx];

  // Forbidden bid for human user if dealer
  const livePlayersForForbidden = playersRef.current.length > 0 ? playersRef.current : players;
  const userForbiddenBid =
    roundPhase === 'bidding' && currentRound && currentRound.dealerIndex === 0
      ? getForbiddenBid(
          livePlayersForForbidden.map((p) => p.bid),
          currentRound.cardCount,
          currentRound.dealerIndex,
          0
        )
      : null;

  // Deck size and min rank description for selected player count
  const minRank = getMinRankForPlayerCount(playerCount);
  const totalDeckCards = playerCount * 8;
  const minRankStr = RANK_NAMES_RO[minRank];

  const tableFeltClass =
    customization.selectedTableTheme === 'theme_ruby_lounge'
      ? 'felt-table-ruby'
      : customization.selectedTableTheme === 'theme_casino_noir'
      ? 'felt-table-noir'
      : 'felt-table-emerald';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* ========================================================
          TITLE SCREEN
          ======================================================== */}
      {gameState === 'title' && (
        <div className={`relative flex-1 flex flex-col items-center justify-between p-3 sm:p-6 overflow-y-auto ${tableFeltClass}`}>
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.12)_0,_transparent_60%)]" />

          {/* Header lockup */}
          <div className="z-10 text-center max-w-xl mx-auto mt-2 sm:mt-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Standard Românesc 1-8-1</span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 drop-shadow-md">
              WHIST ROMÂNESC
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-300 mt-1 font-medium">
              3-6 Jucători · Pachet Adaptiv (8 cărți/jucător) · Reguli Oficiale Wikipedia
            </p>
          </div>

          {/* Center decorative card fan */}
          <div className="z-10 my-3 flex items-center justify-center -space-x-8 sm:-space-x-12 scale-90 sm:scale-100">
            <PlayingCard
              card={{ id: 'demo1', suit: 'SPADES', rank: 14 }}
              rotation={-18}
              size="md"
            />
            <PlayingCard
              card={{ id: 'demo2', suit: 'HEARTS', rank: 13 }}
              rotation={-6}
              size="md"
            />
            <PlayingCard
              card={{ id: 'demo3', suit: 'DIAMONDS', rank: 12 }}
              rotation={6}
              size="md"
            />
            <PlayingCard
              card={{ id: 'demo4', suit: 'CLUBS', rank: 11 }}
              rotation={18}
              size="md"
            />
          </div>

          {/* Configuration Card */}
          <div className="z-10 bg-slate-900/90 border border-amber-500/50 rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl backdrop-blur-xs space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Numele Tău:
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                maxLength={16}
                placeholder="Tu"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-semibold focus:outline-hidden focus:border-amber-400"
              />
            </div>

            {/* Player Count Selection (3 to 6 players) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Număr Jucători:</span>
                </label>
                <span className="text-[11px] font-mono font-bold text-emerald-400">
                  {totalDeckCards} cărți ({minRankStr}..A) · {3 * playerCount + 12} runde
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[3, 4, 5, 6].map((count) => {
                  const isSelected = playerCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setPlayerCount(count)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md shadow-amber-500/30 scale-102 ring-2 ring-amber-400'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      <span className="text-sm sm:text-base font-black">{count}</span>
                      <span className="text-[10px] opacity-80">Jucători</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic explanation badge */}
              <div className="mt-2 p-2 bg-slate-950/80 border border-emerald-900/60 rounded-xl text-[11px] text-slate-300 flex items-center justify-between">
                <div>
                  <span className="font-bold text-amber-400">Pachet Oficial: </span>
                  <span>{playerCount} jucători × 8 = {totalDeckCards} cărți</span>
                </div>
                <div className="text-[10px] text-emerald-300 font-mono">
                  {playerCount === 4 ? 'Clasic (Recomandat)' : `${playerCount} individual`}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                data-start="true"
                onClick={() => startGame()}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm sm:text-base rounded-xl shadow-lg shadow-amber-950/60 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>Joacă Acum (vs {playerCount - 1} AI)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLobbyModal(true)}
                className="w-full py-2 bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-xs sm:text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-colors"
              >
                <Users className="w-4 h-4 text-amber-400" />
                <span>Camere Multiplayer cu Parolă</span>
              </button>

              <button
                type="button"
                onClick={() => setShowJokersModal(true)}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 hover:from-amber-900/90 hover:to-amber-900/90 text-amber-300 border border-amber-500/60 font-bold text-xs sm:text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
              >
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Colecția de Jokeri & Teme Masă</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {CustomizationManager.getUnlockedJokers(stats).length}/6 Deblocați
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowTutorialModal(true)}
                  className="py-2.5 px-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 font-bold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                >
                  <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">Tutorial Interactiv</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStatsModal(true)}
                  className="py-2.5 px-2 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-600/50 font-bold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Award className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="truncate">Statistici & Realizări</span>
                </button>
              </div>
            </div>

            {/* Extra utility row */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="text-slate-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Regulament Oficial</span>
              </button>

              <button
                type="button"
                onClick={downloadStandaloneHtml}
                className="text-slate-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer"
                title="Descarcă jocul ca fișier unic HTML offline"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-semibold">HTML Unic Offline</span>
              </button>
            </div>
          </div>

          {/* Footer note */}
          <div className="z-10 text-center text-[11px] text-slate-400 pb-1">
            Format Standard Românesc 1-8-1 · Exact Bidding · 3-6 Jucători
          </div>
        </div>
      )}

      {/* ========================================================
          PLAYING SCREEN (2D GAME TABLE & HUD)
          ======================================================== */}
      {gameState === 'playing' && (
        <div className={`relative flex-1 flex flex-col justify-between ${tableFeltClass} overflow-hidden`}>
          {/* Top HUD Bar */}
          <header className="z-20 px-2 sm:px-6 py-1.5 sm:py-2 bg-slate-950/90 border-b border-amber-500/30 flex items-center justify-between text-xs sm:text-sm backdrop-blur-md">
            {/* Round info */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
              <span className="font-cinzel font-bold text-amber-400 hidden md:inline tracking-wider">
                WHIST ROMÂNESC
              </span>
              <div className="bg-emerald-950/90 border border-emerald-600/70 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg font-mono font-bold text-emerald-200 text-[11px] sm:text-xs shadow-xs">
                Runda {currentRoundIdx + 1}/{rounds.length} ({currentRound?.cardCount}{' '}
                {currentRound?.cardCount === 1 ? 'carte' : 'cărți'})
              </div>
              {/* Trump badge */}
              <div className="bg-slate-900/90 border border-amber-500/30 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg flex items-center gap-1 text-[11px] sm:text-xs shadow-xs">
                <span className="text-slate-400 text-[10px] sm:text-[11px]">Atu:</span>
                {trumpSuit ? (
                  <span
                    className={`font-black ${
                      trumpSuit === 'HEARTS' || trumpSuit === 'DIAMONDS'
                        ? 'text-red-500'
                        : 'text-amber-300'
                    }`}
                  >
                    {SUIT_SYMBOLS[trumpSuit]} {SUIT_NAMES_RO[trumpSuit]}
                  </span>
                ) : (
                  <span className="text-sky-300 font-bold">Fără Atu</span>
                )}
              </div>

              {/* Player count & deck info */}
              <div className="hidden lg:flex items-center text-[10px] sm:text-[11px] text-slate-400 font-mono bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
                {playerCount} Jucători ({totalDeckCards} cărți)
              </div>
            </div>

            {/* Clean, Predictive Utility Bar */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowScoreModal(true)}
                className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                title="Foaia de Scor"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Scor</span>
              </button>

              <GameHeaderMenu
                unlockedJokersCount={CustomizationManager.getUnlockedJokers(stats).length}
                totalJokersCount={JOKERS_LIST.length}
                soundEnabled={soundEnabled}
                onToggleSound={toggleSound}
                onOpenScore={() => setShowScoreModal(true)}
                onOpenJokers={() => setShowJokersModal(true)}
                onOpenStats={() => setShowStatsModal(true)}
                onOpenTutorial={() => setShowTutorialModal(true)}
                onOpenRules={() => setShowRulesModal(true)}
                onRestartGame={() => startGame()}
                onDownloadStandalone={downloadStandaloneHtml}
              />
            </div>
          </header>

          {/* Opponents Seats Area (Adaptive 3 to 6 players perimeter) */}
          <div className="z-10 px-2 sm:px-4 pt-1 sm:pt-2 flex flex-wrap items-center justify-around gap-2 max-w-5xl mx-auto w-full">
            {players.slice(1).map((p) => {
              const pIdx = p.id;
              const isCurrentTurn = currentTurn === pIdx;
              const isDealer = currentRound?.dealerIndex === pIdx;
              const pHand = hands[pIdx] || [];

              return (
                <div
                  key={pIdx}
                  className={`flex flex-col items-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border backdrop-blur-xs transition-all ${
                    isCurrentTurn
                      ? 'bg-amber-950/80 border-amber-400 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50 scale-102'
                      : 'bg-slate-950/70 border-emerald-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl">{p.avatar}</span>
                    <div className="text-left">
                      <div className="font-bold text-xs text-slate-100 flex items-center gap-1">
                        <span className="truncate max-w-[85px] sm:max-w-[110px]">{p.name}</span>
                        {isDealer && (
                          <span className="text-[9px] bg-amber-500 text-slate-950 px-1 py-0.2 rounded font-black shrink-0">
                            D
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-xs text-slate-300 flex items-center gap-1.5 font-mono">
                        <span className="text-amber-300 font-bold">{p.score} pct</span>
                        <span>•</span>
                        <span>
                          Lic: <strong>{p.bid !== null ? p.bid : '-'}</strong> | F:{' '}
                          <strong className="text-emerald-400">{p.tricksWon}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Face down mini cards indicators */}
                  <div className="flex justify-center -space-x-5 mt-1 scale-70 origin-top">
                    {pHand.slice(0, 6).map((_, i) => (
                      <PlayingCard
                        key={i}
                        faceDown
                        size="sm"
                        skinId={customization.selectedCardBack}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table Center Trick Play Surface */}
          <div className="z-10 flex-1 flex items-center justify-center relative p-1 sm:p-2 min-h-0">
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full border-2 border-amber-500/40 bg-emerald-950/40 flex items-center justify-center shadow-inner">
              {/* Center Felt Mark / Crest */}
              <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                <Shield className="w-28 h-28 sm:w-36 sm:h-36 text-amber-300" />
              </div>

              {/* Trump Card Indicator in Center-Left */}
              {trumpCard && (
                <div className="absolute left-1.5 sm:left-4 top-1.5 sm:top-4 flex flex-col items-center z-10 scale-90 sm:scale-100">
                  <div className="text-[9px] font-bold text-amber-300 uppercase tracking-widest mb-0.5">
                    Atu
                  </div>
                  <PlayingCard
                    card={trumpCard}
                    size="sm"
                    className="shadow-lg ring-2 ring-amber-400/50"
                  />
                  <span className="mt-1 px-1.5 py-0.5 bg-black/85 text-amber-300 text-[8px] font-mono rounded border border-amber-500/40 tracking-wider shadow">
                    Scos din joc
                  </span>
                </div>
              )}

              {/* Cards in the Current Trick */}
              <div className="relative flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 p-2 sm:p-4 z-20 max-w-[260px] sm:max-w-[340px]">
                {currentTrick.map((item) => {
                  const isWinning = winningCardId === item.card.id;
                  return (
                    <div
                      key={item.playerId}
                      className="flex flex-col items-center animate-in zoom-in-90 duration-150 relative"
                    >
                      <PlayingCard
                        card={item.card}
                        size="md"
                        isWinningCard={isWinning}
                      />
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-200 mt-0.5 bg-black/60 px-1.5 rounded-full border border-slate-700 shadow">
                        {item.playerId === 0 ? 'Tu' : item.playerName.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Prominent Trick Winner Announcement Banner */}
              {trickWinnerBanner ? (
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-40 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 p-3 sm:p-4 rounded-2xl shadow-2xl border-2 border-amber-300 text-center animate-in zoom-in-95 duration-200">
                  <div className="text-xs sm:text-sm font-extrabold uppercase tracking-widest flex items-center justify-center gap-1 text-slate-950/80">
                    <span>🏆 Câștigător Cupă</span>
                  </div>
                  <div className="text-base sm:text-lg md:text-xl font-black font-cinzel text-slate-950 mt-0.5">
                    {trickWinnerBanner.winnerName}
                  </div>
                  <div className="text-[11px] sm:text-xs font-bold text-slate-900 mt-1 bg-amber-400/40 py-1 px-2.5 rounded-lg border border-amber-600/30 inline-block">
                    {trickWinnerBanner.reason}
                  </div>
                </div>
              ) : (
                currentTrick.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center text-xs text-amber-200/70 px-4 max-w-[200px] font-medium">
                      {statusMessage}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* South Player Area (Human User Hand & Status) */}
          <div className="z-20 pb-2 sm:pb-4 px-2 flex flex-col items-center">
            {/* User Info Bar */}
            <div
              className={`mb-1.5 px-4 py-1.5 rounded-full border flex items-center gap-3 backdrop-blur-xs transition-all ${
                currentTurn === 0 && roundPhase === 'playing'
                  ? 'bg-amber-950/85 border-amber-400 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-950/80 border-emerald-900/60'
              }`}
            >
              <span className="text-lg">{players[0]?.avatar || '😎'}</span>
              <span className="font-bold text-xs sm:text-sm text-slate-100">
                {players[0]?.name || 'Tu'}
              </span>
              {currentRound?.dealerIndex === 0 && (
                <span className="text-[9px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-black">
                  Tu ești Dealer
                </span>
              )}
              <div className="text-xs text-amber-300 font-bold font-mono">
                {players[0]?.score > 0 ? `+${players[0]?.score}` : players[0]?.score ?? 0} pct
              </div>
              <div className="text-xs text-slate-300 border-l border-slate-700 pl-2">
                Licitație:{' '}
                <strong className="text-amber-400">
                  {players[0]?.bid !== null ? players[0]?.bid : '-'}
                </strong>{' '}
                | Făcute:{' '}
                <strong className="text-emerald-400">{players[0]?.tricksWon ?? 0}</strong>
              </div>
            </div>

            {/* Hand Cards Tray */}
            {/* Hand Cards Tray */}
            <div className="w-full max-w-4xl flex items-center justify-center overflow-x-auto py-1.5 px-3 hide-scrollbar touch-pan-x">
              <div className="flex justify-center -space-x-1.5 sm:-space-x-3 md:-space-x-4 pb-1">
                {(hands[0] || []).map((card) => {
                  const isPlayable =
                    roundPhase === 'playing' &&
                    currentTurn === 0 &&
                    humanLegalCards.some((c) => c.id === card.id);

                  return (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      skinId={customization.selectedCardBack}
                      isPlayable={isPlayable}
                      onClick={() => handleUserCardClick(card)}
                      size="md"
                    />
                  );
                })}
              </div>
            </div>

            {/* Inspection phase prompt with 5-second countdown & pause */}
            {roundPhase === 'inspecting' && (
              <div className="z-30 my-1 sm:my-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-950/95 via-emerald-950/95 to-amber-950/95 border-2 border-amber-400 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-2.5 max-w-lg w-full animate-in zoom-in-95">
                <div className="flex items-center gap-2">
                  <div className="relative w-8 h-8 rounded-full border-2 border-amber-400/80 bg-slate-950 flex items-center justify-center shrink-0">
                    <Clock
                      className={`w-4 h-4 text-amber-400 ${
                        !isCountdownPaused ? 'animate-spin' : ''
                      }`}
                      style={{ animationDuration: '8s' }}
                    />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-amber-300">
                      Runda {currentRoundIdx + 1}: {currentRound?.cardCount}{' '}
                      {currentRound?.cardCount === 1 ? 'carte' : 'cărți'}
                      {trumpSuit
                        ? ` • Atu: ${SUIT_SYMBOLS[trumpSuit]} ${SUIT_NAMES_RO[trumpSuit]}`
                        : ' • Fără Atu'}
                    </div>
                    <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
                      <span className="font-semibold text-amber-200">
                        {isCountdownPaused
                          ? 'Pauză activată (Timp nelimitat)'
                          : `Licitația începe în ${countdown}s`}
                      </span>
                      <span>•</span>
                      <span>
                        {currentRound?.dealerIndex === 0
                          ? 'Ești Dealer'
                          : `Dealer: ${players[currentRound?.dealerIndex ?? 0]?.name}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCountdownPaused(!isCountdownPaused)}
                    title={
                      isCountdownPaused
                        ? 'Reia numărătoarea automată'
                        : 'Oprește timpul pentru a-ți analiza cărțile'
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/50 cursor-pointer transition-colors flex items-center gap-1 text-xs font-semibold"
                  >
                    {isCountdownPaused ? (
                      <>
                        <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                        <span>Reia</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pauză</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    data-start="true"
                    onClick={handleStartBidding}
                    className="px-3.5 py-1.5 sm:py-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-xl text-xs sm:text-sm cursor-pointer shadow-md shadow-amber-950/60 flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4 text-slate-950" />
                    <span>Sunt gata ({countdown}s)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Prompt clue */}
            {roundPhase === 'playing' && currentTurn === 0 && (
              <div className="text-[11px] font-semibold text-amber-300 mt-1 animate-pulse">
                👉 Este rândul tău! Apasă pe o carte evidențiată pentru a o juca.
              </div>
            )}
          </div>

          {/* Bidding Overlay Modal (Active during entire bidding phase) */}
          {roundPhase === 'bidding' && currentRound && (
            <BiddingOverlay
              cardCount={currentRound.cardCount}
              trumpSuit={trumpSuit}
              dealerName={(playersRef.current.length > 0 ? playersRef.current : players)[currentRound.dealerIndex]?.name || ''}
              isUserDealer={currentRound.dealerIndex === 0}
              forbiddenBid={userForbiddenBid}
              bidsSummary={(playersRef.current.length > 0 ? playersRef.current : players).map((p) => ({
                name: p.name,
                bid: p.bid,
              }))}
              userHand={hands[0] || []}
              onSelectBid={(val) => handleBidPlaced(0, val)}
              isWaitingForTurn={currentTurn !== 0}
              currentBidderName={(playersRef.current.length > 0 ? playersRef.current : players)[currentTurn]?.name || ''}
              userHasBid={(playersRef.current.length > 0 ? playersRef.current : players)[0]?.bid !== null}
              userPlacedBid={(playersRef.current.length > 0 ? playersRef.current : players)[0]?.bid}
            />
          )}

          {/* Round Recap Modal (Dedicated animated window for scoring review) */}
          {roundPhase === 'round_recap' && recapResults && currentRound && (
            <RoundRecapModal
              roundNumber={currentRoundIdx + 1}
              totalRounds={rounds.length}
              cardCount={currentRound.cardCount}
              trumpSuit={trumpSuit}
              results={recapResults}
              onNextRound={handleProceedToNextRound}
              onOpenScoreTable={() => setShowScoreModal(true)}
            />
          )}
        </div>
      )}

      {/* ========================================================
          GAME OVER MODAL
          ======================================================== */}
      {gameState === 'gameover' && (
        <GameOverModal
          playerNames={players.map((p) => p.name)}
          finalScores={players.map((p) => p.score)}
          onPlayAgain={() => startGame()}
          onOpenScoreTable={() => setShowScoreModal(true)}
          onBackToMenu={() => setGameState('title')}
        />
      )}

      {/* Score Table Sheet Modal */}
      {showScoreModal && (
        <ScoreTableModal
          playerNames={players.map((p) => p.name)}
          history={history}
          currentRoundIndex={currentRoundIdx}
          totalRounds={rounds.length}
          onClose={() => setShowScoreModal(false)}
        />
      )}

      {/* Rules Modal */}
      {showRulesModal && <RulesModal onClose={() => setShowRulesModal(false)} />}

      {/* Interactive Tutorial Modal */}
      {showTutorialModal && (
        <InteractiveTutorialModal onClose={() => setShowTutorialModal(false)} />
      )}

      {/* Stats and Achievements Modal */}
      {showStatsModal && (
        <StatsModal
          stats={stats}
          onClose={() => setShowStatsModal(false)}
          onOpenJokers={() => setShowJokersModal(true)}
          onResetStats={() => {
            const reset = StatsManager.reset();
            setStats(reset);
          }}
        />
      )}

      {/* Multiplayer Lobby Modal */}
      {showLobbyModal && (
        <MultiplayerLobbyModal
          currentUserId="human-0"
          currentUserName={userName}
          onStartRoomGame={handleStartRoomGame}
          onClose={() => setShowLobbyModal(false)}
        />
      )}

      {/* Jokers & Customization Modal */}
      {showJokersModal && (
        <JokersModal
          stats={stats}
          customization={customization}
          onUpdateCustomization={(updated) => {
            setCustomization(updated);
            CustomizationManager.save(updated);
          }}
          onClose={() => setShowJokersModal(false)}
        />
      )}

      {/* Floating Joker Unlock Toast */}
      {newJokerUnlocked && (
        <JokerUnlockNotification
          joker={newJokerUnlocked}
          onOpenJokersModal={() => {
            setNewJokerUnlocked(null);
            setShowJokersModal(true);
          }}
          onDismiss={() => setNewJokerUnlocked(null)}
        />
      )}

      {/* Floating Achievement Unlock Notification */}
      {achievementToast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-4 fade-in duration-300 flex items-center gap-3 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-amber-200 border-2 border-amber-400/80 px-4 py-3 rounded-2xl shadow-2xl shadow-amber-500/30 max-w-sm pointer-events-auto">
          <span className="text-3xl filter drop-shadow">{achievementToast.icon}</span>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-amber-400 font-extrabold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Realizare Deblocată!</span>
            </div>
            <div className="text-sm font-bold text-white leading-tight">
              {achievementToast.title}
            </div>
            <div className="text-[11px] text-slate-300 line-clamp-1">
              {achievementToast.description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
