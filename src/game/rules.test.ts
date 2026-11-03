import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeck,
  shuffleDeck,
  generateRounds,
  getForbiddenBid,
  isBidLegal,
  getLegalCards,
  getTrickWinnerIndex,
  evaluateTrickWinner,
  calculateRoundPoints,
  calculateAIBid,
  selectAICard,
  getMinRankForPlayerCount,
  Card,
} from './rules.ts';

test('Deck sizes and min ranks for 3, 4, 5, 6 players (8 cards per player)', () => {
  // 3 players: 24 cards (ranks 9 to Ace: 6 ranks * 4 suits = 24)
  assert.equal(getMinRankForPlayerCount(3), 9);
  const deck3 = createDeck(3);
  assert.equal(deck3.length, 24);
  assert.equal(Math.min(...deck3.map((c) => c.rank)), 9);

  // 4 players: 32 cards (ranks 7 to Ace: 8 ranks * 4 suits = 32)
  assert.equal(getMinRankForPlayerCount(4), 7);
  const deck4 = createDeck(4);
  assert.equal(deck4.length, 32);
  assert.equal(Math.min(...deck4.map((c) => c.rank)), 7);

  // 5 players: 40 cards (ranks 5 to Ace: 10 ranks * 4 suits = 40)
  assert.equal(getMinRankForPlayerCount(5), 5);
  const deck5 = createDeck(5);
  assert.equal(deck5.length, 40);
  assert.equal(Math.min(...deck5.map((c) => c.rank)), 5);

  // 6 players: 48 cards (ranks 3 to Ace: 12 ranks * 4 suits = 48)
  assert.equal(getMinRankForPlayerCount(6), 3);
  const deck6 = createDeck(6);
  assert.equal(deck6.length, 48);
  assert.equal(Math.min(...deck6.map((c) => c.rank)), 3);
});

test('generateRounds produces exactly (3N + 12) rounds in standard 1-8-1 sequence', () => {
  // 3 players: 3*3 + 12 = 21 rounds
  const rounds3 = generateRounds(3);
  assert.equal(rounds3.length, 21);
  assert.deepEqual(rounds3.slice(0, 3).map((r) => r.cardCount), [1, 1, 1]);
  assert.deepEqual(rounds3.slice(3, 9).map((r) => r.cardCount), [2, 3, 4, 5, 6, 7]);
  assert.deepEqual(rounds3.slice(9, 12).map((r) => r.cardCount), [8, 8, 8]);
  assert.equal(rounds3[9].hasTrump, false); // 8 cards * 3 players = 24 (all cards dealt)

  // 4 players: 4*3 + 12 = 24 rounds
  const rounds4 = generateRounds(4);
  assert.equal(rounds4.length, 24);
  assert.deepEqual(rounds4.slice(0, 4).map((r) => r.cardCount), [1, 1, 1, 1]);
  assert.deepEqual(rounds4.slice(10, 14).map((r) => r.cardCount), [8, 8, 8, 8]);
  assert.equal(rounds4[10].hasTrump, false);

  // 5 players: 5*3 + 12 = 27 rounds
  const rounds5 = generateRounds(5);
  assert.equal(rounds5.length, 27);

  // 6 players: 6*3 + 12 = 30 rounds
  const rounds6 = generateRounds(6);
  assert.equal(rounds6.length, 30);
});

test('Dealer constraint forbids sum(bids) == totalCards', () => {
  const bidsSoFar = [1, 2, 0, null]; // sum is 3
  const totalCards = 4;
  const forbidden = getForbiddenBid(bidsSoFar, totalCards, 3, 3);
  assert.equal(forbidden, 1); // 4 - 3 = 1 is forbidden

  assert.equal(isBidLegal(1, totalCards, bidsSoFar, 3, 3), false);
  assert.equal(isBidLegal(0, totalCards, bidsSoFar, 3, 3), true);
  assert.equal(isBidLegal(2, totalCards, bidsSoFar, 3, 3), true);

  // Non-dealer is never constrained
  assert.equal(getForbiddenBid([1, null, null, null], totalCards, 3, 1), null);
});

test('Legal cards: must follow led suit if held', () => {
  const hand: Card[] = [
    { id: '1', suit: 'HEARTS', rank: 10 },
    { id: '2', suit: 'HEARTS', rank: 14 },
    { id: '3', suit: 'SPADES', rank: 9 },
  ];
  const trick = [
    { playerId: 0, card: { id: 'lead', suit: 'HEARTS' as const, rank: 8 as const } },
  ];
  const legal = getLegalCards(hand, trick, 'SPADES');
  assert.equal(legal.length, 2);
  assert.ok(legal.every((c) => c.suit === 'HEARTS'));
});

test('Legal cards: void in led suit requires trumping if trump available', () => {
  const hand: Card[] = [
    { id: '1', suit: 'CLUBS', rank: 10 },
    { id: '2', suit: 'SPADES', rank: 14 }, // SPADES is trump
  ];
  const trick = [
    { playerId: 0, card: { id: 'lead', suit: 'HEARTS' as const, rank: 12 as const } },
  ];
  const legal = getLegalCards(hand, trick, 'SPADES', true);
  assert.equal(legal.length, 1);
  assert.equal(legal[0].suit, 'SPADES');
});

test('evaluateTrickWinner: calculates winner and reason correctly', () => {
  // Scenario 1: Trump beats high led suit
  const trickWithTrump = [
    { playerId: 0, card: { id: '1', suit: 'HEARTS' as const, rank: 14 as const } }, // Lead Ace Hearts
    { playerId: 1, card: { id: '2', suit: 'SPADES' as const, rank: 8 as const } },  // 8 Spades (Trump!)
    { playerId: 2, card: { id: '3', suit: 'HEARTS' as const, rank: 10 as const } },
    { playerId: 3, card: { id: '4', suit: 'CLUBS' as const, rank: 14 as const } },  // Discard
  ];
  const eval1 = evaluateTrickWinner(trickWithTrump, 'SPADES');
  assert.equal(eval1.winnerPlayerId, 1);
  assert.equal(eval1.winningCard.id, '2');
  assert.ok(eval1.reason.includes('Atu'));

  // Scenario 2: Highest led suit wins when no trump
  const trickNoTrump = [
    { playerId: 0, card: { id: '1', suit: 'CLUBS' as const, rank: 9 as const } },
    { playerId: 1, card: { id: '2', suit: 'CLUBS' as const, rank: 14 as const } }, // Ace Clubs
    { playerId: 2, card: { id: '3', suit: 'CLUBS' as const, rank: 11 as const } },
    { playerId: 3, card: { id: '4', suit: 'DIAMONDS' as const, rank: 14 as const } }, // Ace Diamonds discard
  ];
  const eval2 = evaluateTrickWinner(trickNoTrump, 'SPADES');
  assert.equal(eval2.winnerPlayerId, 1);
  assert.equal(eval2.winningCard.rank, 14);
  assert.ok(eval2.reason.includes('culoarea condusă'));
});

test('Trump card exclusion: trump card is popped first and never in any player hand', () => {
  const playerCount = 4;
  const deck = createDeck(playerCount);
  const trump = deck.pop();
  assert.ok(trump);

  const hands: Card[][] = [[], [], [], []];
  for (let c = 0; c < 4; c++) {
    for (let p = 0; p < playerCount; p++) {
      const card = deck.pop();
      if (card) hands[p].push(card);
    }
  }

  for (let p = 0; p < playerCount; p++) {
    const hasTrump = hands[p].some((c) => c.id === trump.id);
    assert.equal(hasTrump, false);
  }
});

test('calculateRoundPoints: accurate scoring according to Romanian Whist rules', () => {
  // Bid achieved: 5 + tricksWon points
  assert.equal(calculateRoundPoints(0, 0), 5); // Bid 0, made 0 -> 5 + 0 = 5
  assert.equal(calculateRoundPoints(1, 1), 6); // Bid 1, made 1 -> 5 + 1 = 6
  assert.equal(calculateRoundPoints(2, 2), 7); // Bid 2, made 2 -> 5 + 2 = 7
  assert.equal(calculateRoundPoints(8, 8), 13); // Bid 8, made 8 -> 5 + 8 = 13

  // Bid missed: -|bid - tricksWon| points
  assert.equal(calculateRoundPoints(1, 0), -1); // Bid 1, made 0 -> -|1-0| = -1
  assert.equal(calculateRoundPoints(0, 1), -1); // Bid 0, made 1 -> -|0-1| = -1
  assert.equal(calculateRoundPoints(3, 1), -2); // Bid 3, made 1 -> -|3-1| = -2
  assert.equal(calculateRoundPoints(2, 5), -3); // Bid 2, made 5 -> -|2-5| = -3
});
