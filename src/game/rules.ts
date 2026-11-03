export type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type GameModeType = 'standard';

export interface RoundConfig {
  roundIndex: number;
  cardCount: number;
  hasTrump: boolean;
  dealerIndex: number; // 0..(playerCount - 1)
}

export interface PlayerScoreEntry {
  bid: number;
  tricksWon: number;
  points: number;
  totalScore: number;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  SPADES: '♠',
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
};

export const SUIT_NAMES_RO: Record<Suit, string> = {
  SPADES: 'Pică (Inimă Neagră)',
  HEARTS: 'Cupă (Inimă Roșie)',
  DIAMONDS: 'Romb (Caro)',
  CLUBS: 'Treflă',
};

export const RANK_NAMES_RO: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

/**
 * Romanian Whist deck sizing:
 * Total cards in play = 8 * playerCount.
 * Each player contributes 8 cards from the deck (2 cards per suit per player).
 * Ranks are from (15 - 2 * playerCount) up to 14 (Ace).
 * - 3 players: 24 cards (ranks 9 to Ace: 6 per suit)
 * - 4 players: 32 cards (ranks 7 to Ace: 8 per suit)
 * - 5 players: 40 cards (ranks 5 to Ace: 10 per suit)
 * - 6 players: 48 cards (ranks 3 to Ace: 12 per suit)
 */
export function getMinRankForPlayerCount(playerCount: number = 4): Rank {
  const safeCount = Math.min(6, Math.max(3, playerCount));
  return (15 - 2 * safeCount) as Rank;
}

export function createDeck(playerCountOrMode: number | string = 4): Card[] {
  const playerCount = typeof playerCountOrMode === 'number' ? playerCountOrMode : 4;
  const minRank = getMinRankForPlayerCount(playerCount);
  const suits: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (let rank = minRank; rank <= 14; rank++) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank: rank as Rank,
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Standard Romanian Whist 1-8-1 rounds sequence for N players (3 to 6):
 * - N rounds with 1 card (dealer rotates through each player once)
 * - 6 ascending rounds: 2, 3, 4, 5, 6, 7 cards
 * - N rounds with 8 cards (dealer rotates through each player once; all cards dealt, so "Fără Atu")
 * - 6 descending rounds: 7, 6, 5, 4, 3, 2 cards
 * - N rounds with 1 card (dealer rotates through each player once)
 * Total rounds = 3 * N + 12:
 * - 3 players: 21 rounds
 * - 4 players: 24 rounds
 * - 5 players: 27 rounds
 * - 6 players: 30 rounds
 */
export function generateRounds(playerCount: number = 4): RoundConfig[] {
  const safeCount = Math.min(6, Math.max(3, playerCount));
  const counts: number[] = [];

  // N rounds of 1 card
  for (let i = 0; i < safeCount; i++) counts.push(1);
  // Ascending 2..7
  for (let c = 2; c <= 7; c++) counts.push(c);
  // N rounds of 8 cards
  for (let i = 0; i < safeCount; i++) counts.push(8);
  // Descending 7..2
  for (let c = 7; c >= 2; c--) counts.push(c);
  // N rounds of 1 card
  for (let i = 0; i < safeCount; i++) counts.push(1);

  const totalDeckSize = 8 * safeCount;

  return counts.map((cardCount, roundIndex) => {
    // In Romanian Whist: when 8 cards are dealt to all players,
    // cardCount * safeCount == totalDeckSize, so no card is left for trump (Fără atu).
    const allCardsDealt = cardCount * safeCount >= totalDeckSize;
    return {
      roundIndex,
      cardCount,
      hasTrump: !allCardsDealt,
      dealerIndex: roundIndex % safeCount,
    };
  });
}

/**
 * Romanian Whist dealer constraint:
 * The sum of all bids in a round cannot equal the total cards/tricks in that round.
 * Thus the last bidder (dealer) cannot bid a number that causes sum(bids) == totalCards.
 */
export function getForbiddenBid(
  bidsSoFar: (number | null)[],
  totalCards: number,
  dealerIndex: number,
  currentBidderIndex: number
): number | null {
  if (currentBidderIndex !== dealerIndex) {
    return null;
  }
  const sumOtherBids = bidsSoFar.reduce<number>((acc, b) => (b !== null ? acc + b : acc), 0);
  const forbidden = totalCards - sumOtherBids;
  if (forbidden >= 0 && forbidden <= totalCards) {
    return forbidden;
  }
  return null;
}

export function isBidLegal(
  bid: number,
  totalCards: number,
  bidsSoFar: (number | null)[],
  dealerIndex: number,
  currentBidderIndex: number
): boolean {
  if (bid < 0 || bid > totalCards) return false;
  const forbidden = getForbiddenBid(bidsSoFar, totalCards, dealerIndex, currentBidderIndex);
  return forbidden === null || bid !== forbidden;
}

/**
 * Romanian Whist rule for legal card plays:
 * 1. If first card of the trick: any card in hand is legal.
 * 2. If not first card:
 *    - Must follow suit led if player has any card of that suit.
 *    - If void in led suit:
 *      * If obligatoryTrump = true and round has trump and player has trump: MUST play trump.
 *      * Otherwise, can discard any card.
 */
export function getLegalCards(
  hand: Card[],
  trick: { playerId: number; card: Card }[],
  trumpSuit: Suit | null,
  obligatoryTrump: boolean = true
): Card[] {
  if (hand.length === 0) return [];
  if (trick.length === 0) return [...hand];

  const leadCard = trick[0].card;
  const leadSuit = leadCard.suit;

  const sameSuitCards = hand.filter((c) => c.suit === leadSuit);
  if (sameSuitCards.length > 0) {
    return sameSuitCards;
  }

  // Void in led suit: check trump obligation
  if (obligatoryTrump && trumpSuit) {
    const trumpCards = hand.filter((c) => c.suit === trumpSuit);
    if (trumpCards.length > 0) {
      return trumpCards;
    }
  }

  // Can play any card
  return [...hand];
}

export interface TrickWinnerEvaluation {
  winnerPlayerId: number;
  winningCard: Card;
  winningTrickIndex: number;
  leadCard: Card;
  reason: string;
}

/**
 * Accurately evaluate trick winner and provide human-readable explanation:
 * 1. Highest trump card wins.
 * 2. If no trump was played, highest card of the led suit wins.
 * 3. Cards of other non-trump suits cannot win.
 */
export function evaluateTrickWinner(
  trick: { playerId: number; card: Card }[],
  trumpSuit: Suit | null
): TrickWinnerEvaluation {
  if (trick.length === 0) {
    throw new Error('Trick is empty');
  }

  const leadCard = trick[0].card;
  const leadSuit = leadCard.suit;
  let bestIndex = 0;
  let bestCard = leadCard;
  let trumpFound = trumpSuit !== null && bestCard.suit === trumpSuit;

  for (let i = 1; i < trick.length; i++) {
    const currentCard = trick[i].card;
    const isCurrentTrump = trumpSuit !== null && currentCard.suit === trumpSuit;

    if (isCurrentTrump) {
      if (!trumpFound) {
        // First trump seen beats any non-trump lead
        trumpFound = true;
        bestCard = currentCard;
        bestIndex = i;
      } else if (currentCard.rank > bestCard.rank) {
        bestCard = currentCard;
        bestIndex = i;
      }
    } else if (!trumpFound && currentCard.suit === leadSuit) {
      if (currentCard.rank > bestCard.rank) {
        bestCard = currentCard;
        bestIndex = i;
      }
    }
  }

  const winningTrick = trick[bestIndex];
  const suitSymbol = SUIT_SYMBOLS[bestCard.suit];
  const rankStr = RANK_NAMES_RO[bestCard.rank];

  const reason = trumpFound
    ? `Atu cel mai mare: ${rankStr}${suitSymbol}`
    : `Cea mai mare carte din culoarea condusă (${SUIT_NAMES_RO[leadSuit]}): ${rankStr}${suitSymbol}`;

  return {
    winnerPlayerId: winningTrick.playerId,
    winningCard: bestCard,
    winningTrickIndex: bestIndex,
    leadCard,
    reason,
  };
}

/**
 * Determine trick winner player ID (helper)
 */
export function getTrickWinnerIndex(
  trick: { playerId: number; card: Card }[],
  trumpSuit: Suit | null
): number {
  if (trick.length === 0) return -1;
  return evaluateTrickWinner(trick, trumpSuit).winnerPlayerId;
}

/**
 * Calculate round points for Romanian Whist:
 * If bid is achieved: 5 + tricksWon
 * If bid missed: -|bid - tricksWon|
 */
export function calculateRoundPoints(bid: number, tricksWon: number): number {
  if (bid === tricksWon) {
    return 5 + tricksWon;
  }
  return -Math.abs(bid - tricksWon);
}

/**
 * AI Bidding Logic:
 * Plausible Romanian Whist bid estimation based on card power, trumps, and position.
 */
export function calculateAIBid(
  hand: Card[],
  trumpSuit: Suit | null,
  totalCards: number,
  bidsSoFar: (number | null)[],
  dealerIndex: number,
  myIndex: number
): number {
  let estimatedTricks = 0;

  for (const card of hand) {
    const isTrump = trumpSuit && card.suit === trumpSuit;
    if (isTrump) {
      if (card.rank >= 13) estimatedTricks += 1.0; // A, K
      else if (card.rank >= 11) estimatedTricks += 0.75; // Q, J
      else if (card.rank >= 9) estimatedTricks += 0.5;
      else estimatedTricks += 0.25;
    } else {
      if (card.rank === 14) estimatedTricks += 0.85; // Ace
      else if (card.rank === 13) estimatedTricks += 0.45; // King
      else if (card.rank === 12) estimatedTricks += 0.2; // Queen
    }
  }

  // Count void suits for trumping power (when hand size >= 4)
  if (trumpSuit && hand.length >= 4) {
    const suitCounts: Record<Suit, number> = {
      SPADES: 0,
      HEARTS: 0,
      DIAMONDS: 0,
      CLUBS: 0,
    };
    for (const card of hand) {
      suitCounts[card.suit]++;
    }
    const trumpCount = suitCounts[trumpSuit];
    let voids = 0;
    for (const suit of Object.keys(suitCounts) as Suit[]) {
      if (suit !== trumpSuit && suitCounts[suit] === 0) voids++;
    }
    if (voids > 0 && trumpCount >= 2) {
      estimatedTricks += Math.min(voids * 0.4, trumpCount * 0.3);
    }
  }

  let roundedBid = Math.round(estimatedTricks);
  roundedBid = Math.max(0, Math.min(totalCards, roundedBid));

  const forbidden = getForbiddenBid(bidsSoFar, totalCards, dealerIndex, myIndex);
  if (forbidden !== null && roundedBid === forbidden) {
    if (estimatedTricks > roundedBid && roundedBid + 1 <= totalCards) {
      roundedBid += 1;
    } else if (roundedBid - 1 >= 0) {
      roundedBid -= 1;
    } else {
      roundedBid = roundedBid + 1 <= totalCards ? roundedBid + 1 : 0;
    }
  }

  return roundedBid;
}

/**
 * AI Card Selection:
 * Goal: make exact bid!
 * If tricksWon < bid: try to win trick if likely.
 * If tricksWon === bid: try to duck (lose trick).
 */
export function selectAICard(
  legalCards: Card[],
  trick: { playerId: number; card: Card }[],
  trumpSuit: Suit | null,
  bid: number,
  tricksWon: number,
  _tricksRemaining: number
): Card {
  if (legalCards.length === 1) {
    return legalCards[0];
  }

  const needsTricks = tricksWon < bid;
  const alreadyMade = tricksWon === bid;

  // Helper: check if a card would currently win the trick
  const wouldWin = (card: Card) => {
    const tempTrick = [...trick, { playerId: 999, card }];
    const winnerId = getTrickWinnerIndex(tempTrick, trumpSuit);
    return winnerId === 999;
  };

  // Sort legal cards by power (ascending)
  const sortedByRankAsc = [...legalCards].sort((a, b) => {
    const aIsTrump = trumpSuit && a.suit === trumpSuit ? 100 : 0;
    const bIsTrump = trumpSuit && b.suit === trumpSuit ? 100 : 0;
    return a.rank + aIsTrump - (b.rank + bIsTrump);
  });

  if (alreadyMade) {
    // MUST DUCK: find lowest card that doesn't win
    const losingCards = sortedByRankAsc.filter((c) => !wouldWin(c));
    if (losingCards.length > 0) {
      return losingCards[losingCards.length - 1];
    }
    return sortedByRankAsc[0];
  }

  if (needsTricks) {
    const winningCards = sortedByRankAsc.filter((c) => wouldWin(c));
    if (winningCards.length > 0) {
      return winningCards[0];
    }
    return sortedByRankAsc[0];
  }

  return sortedByRankAsc[0];
}
