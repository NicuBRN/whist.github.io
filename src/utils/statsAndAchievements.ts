export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  highestScore: number;
  totalTricksWon: number;
  totalBidsAttempted: number;
  totalBidsSuccessful: number;
  consecutiveBidsCurrent: number;
  consecutiveBidsBest: number;
  trumpsCutCount: number;
  unlockedAchievementIds: string[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'bidding' | 'tricks' | 'victories' | 'milestones';
  isUnlocked: boolean;
  unlockedAt?: number;
  progress?: number;
  target?: number;
}

const STATS_STORAGE_KEY = 'whist_romanesc_user_stats_v1';

export const INITIAL_ACHIEVEMENTS: Omit<Achievement, 'isUnlocked'>[] = [
  {
    id: 'first_win',
    title: 'Campionul Mesei',
    description: 'Câștigă prima ta partidă completă de Whist împotriva AI-ului.',
    icon: '👑',
    category: 'victories',
  },
  {
    id: 'bid_master',
    title: 'Maestru al Licitației',
    description: 'Realizează 5 licitații exacte consecutive într-o singură partidă.',
    icon: '🎯',
    category: 'bidding',
  },
  {
    id: 'perfect_victory',
    title: 'Victoria Perfectă',
    description: 'Câștigă un meci cu o acuratețe a licitațiilor de peste 75%.',
    icon: '💎',
    category: 'victories',
  },
  {
    id: 'zero_hero',
    title: 'Eroul lui Zero',
    description: 'Licitează 0 și fă 0 într-o rundă mare (cu 6 sau mai multe cărți).',
    icon: '🛡️',
    category: 'bidding',
  },
  {
    id: 'trump_slayer',
    title: 'Tăietor Nemilos',
    description: 'Câștigă 10 cupe tăind cu atu.',
    icon: '⚡',
    category: 'tricks',
    target: 10,
  },
  {
    id: 'veteran',
    title: 'Veteranul Postavului',
    description: 'Joacă 5 partide complete de Whist Românesc.',
    icon: '📜',
    category: 'milestones',
    target: 5,
  },
  {
    id: 'centurion',
    title: 'Centurionul Scorului',
    description: 'Obține un scor total de peste 100 de puncte într-o partidă.',
    icon: '🔥',
    category: 'milestones',
  },
  {
    id: 'dealer_discipline',
    title: 'Dealer de Fier',
    description: 'Câștigă o rundă făcând licitația exactă când ești Dealer (cu număr interzis).',
    icon: '⚖️',
    category: 'bidding',
  },
];

export class StatsManager {
  private static defaultStats: PlayerStats = {
    gamesPlayed: 0,
    gamesWon: 0,
    totalScore: 0,
    highestScore: 0,
    totalTricksWon: 0,
    totalBidsAttempted: 0,
    totalBidsSuccessful: 0,
    consecutiveBidsCurrent: 0,
    consecutiveBidsBest: 0,
    trumpsCutCount: 0,
    unlockedAchievementIds: [],
  };

  public static load(): PlayerStats {
    if (typeof window === 'undefined') return { ...StatsManager.defaultStats };
    try {
      const raw = localStorage.getItem(STATS_STORAGE_KEY);
      if (!raw) return { ...StatsManager.defaultStats };
      return { ...StatsManager.defaultStats, ...JSON.parse(raw) };
    } catch {
      return { ...StatsManager.defaultStats };
    }
  }

  public static save(stats: PlayerStats) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch {}
  }

  public static recordRound(
    stats: PlayerStats,
    userTricks: number,
    made: boolean,
    userTrumpCuts: number
  ): PlayerStats {
    const updated: PlayerStats = {
      ...stats,
      totalTricksWon: stats.totalTricksWon + userTricks,
      totalBidsAttempted: stats.totalBidsAttempted + 1,
      totalBidsSuccessful: stats.totalBidsSuccessful + (made ? 1 : 0),
      consecutiveBidsCurrent: made ? stats.consecutiveBidsCurrent + 1 : 0,
      consecutiveBidsBest: made
        ? Math.max(stats.consecutiveBidsBest, stats.consecutiveBidsCurrent + 1)
        : stats.consecutiveBidsBest,
      trumpsCutCount: stats.trumpsCutCount + userTrumpCuts,
    };
    StatsManager.save(updated);
    return updated;
  }

  public static recordGame(
    stats: PlayerStats,
    won: boolean,
    finalScore: number
  ): PlayerStats {
    const updated: PlayerStats = {
      ...stats,
      gamesPlayed: stats.gamesPlayed + 1,
      gamesWon: stats.gamesWon + (won ? 1 : 0),
      totalScore: stats.totalScore + finalScore,
      highestScore: Math.max(stats.highestScore, finalScore),
    };
    StatsManager.save(updated);
    return updated;
  }

  public static reset(): PlayerStats {
    const reset = { ...StatsManager.defaultStats };
    StatsManager.save(reset);
    return reset;
  }

  public static getAchievements(stats: PlayerStats): Achievement[] {
    return INITIAL_ACHIEVEMENTS.map((ach) => {
      const isUnlocked = stats.unlockedAchievementIds.includes(ach.id);
      let progress = 0;
      if (ach.id === 'trump_slayer') {
        progress = Math.min(stats.trumpsCutCount, ach.target || 10);
      } else if (ach.id === 'veteran') {
        progress = Math.min(stats.gamesPlayed, ach.target || 5);
      }
      return {
        ...ach,
        isUnlocked,
        progress: ach.target ? progress : undefined,
      };
    });
  }

  /**
   * Evaluates achievements and returns newly unlocked ones
   */
  public static checkNewAchievements(
    stats: PlayerStats,
    lastRound?: {
      userBid: number;
      userTricks: number;
      cardCount: number;
      isDealer: boolean;
      userTrumpCuts: number;
    },
    gameEnd?: {
      won: boolean;
      finalScore: number;
      userAccuracy: number;
    }
  ): { updatedStats: PlayerStats; newlyUnlocked: Achievement[] } {
    const updated = { ...stats };
    const newlyUnlockedIds: string[] = [];

    const unlock = (id: string) => {
      if (!updated.unlockedAchievementIds.includes(id)) {
        updated.unlockedAchievementIds.push(id);
        newlyUnlockedIds.push(id);
      }
    };

    if (lastRound) {
      if (lastRound.userBid === lastRound.userTricks) {
        if (lastRound.userBid === 0 && lastRound.cardCount >= 6) {
          unlock('zero_hero');
        }
        if (lastRound.isDealer) {
          unlock('dealer_discipline');
        }
      }
      if (updated.consecutiveBidsCurrent >= 5) {
        unlock('bid_master');
      }
      if (updated.trumpsCutCount >= 10) {
        unlock('trump_slayer');
      }
    }

    if (gameEnd) {
      if (gameEnd.won) {
        unlock('first_win');
        if (gameEnd.userAccuracy >= 75) {
          unlock('perfect_victory');
        }
      }
      if (gameEnd.finalScore >= 100) {
        unlock('centurion');
      }
      if (updated.gamesPlayed >= 5) {
        unlock('veteran');
      }
    }

    StatsManager.save(updated);

    const newlyUnlocked = INITIAL_ACHIEVEMENTS.filter((a) =>
      newlyUnlockedIds.includes(a.id)
    ).map((a) => ({ ...a, isUnlocked: true }));

    return { updatedStats: updated, newlyUnlocked };
  }
}
