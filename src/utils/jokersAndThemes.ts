/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlayerStats } from './statsAndAchievements.ts';

export interface JokerBonus {
  id: string;
  name: string;
  title: string;
  description: string;
  unlockRequirement: string;
  avatarIcon: string;
  accentColor: string;
  rewardType: 'cardBack' | 'tableTheme' | 'avatarGlow';
  rewardId: string;
  rewardName: string;
  isUnlocked: (stats: PlayerStats) => boolean;
}

export interface CardBackSkin {
  id: string;
  name: string;
  description: string;
  requiredJokerId?: string;
  previewGradient: string;
  borderAccent: string;
  pattern: 'filigree' | 'harlequin' | 'gold' | 'midnight';
}

export interface TableTheme {
  id: string;
  name: string;
  description: string;
  requiredJokerId?: string;
  bgGradient: string;
  feltBorder: string;
  innerGlow: string;
  accentHighlight: string;
}

export const JOKERS_LIST: JokerBonus[] = [
  {
    id: 'joker_emerald',
    name: 'Jokerul de Smarald',
    title: 'Suveranul Clubului',
    description: 'Spiritul protector al mesei de Whist. Îți aduce noroc și eleganță la fiecare rundă.',
    unlockRequirement: 'Câștigă cel puțin o partidă completă.',
    avatarIcon: '🃏',
    accentColor: 'from-emerald-500 to-teal-400 text-emerald-300',
    rewardType: 'tableTheme',
    rewardId: 'theme_emerald_club',
    rewardName: 'Postav Smarald de Club',
    isUnlocked: (stats: PlayerStats) => stats.gamesWon >= 1,
  },
  {
    id: 'joker_gold',
    name: 'Jokerul de Aur',
    title: 'Harlequinul Licitațiilor',
    description: 'Stăpânul calculelor precise. Atinge armonia perfectă între cărțile din mână și numărul licitat.',
    unlockRequirement: 'Realizează 5 licitații exacte consecutive (record de serie).',
    avatarIcon: '✨',
    accentColor: 'from-amber-400 to-yellow-500 text-amber-300',
    rewardType: 'cardBack',
    rewardId: 'cardback_gold_imperial',
    rewardName: 'Spate Cărți: Aur Imperial',
    isUnlocked: (stats: PlayerStats) => stats.consecutiveBidsBest >= 5,
  },
  {
    id: 'joker_royal',
    name: 'Jokerul Regal',
    title: 'Bufonul Curții Regale',
    description: 'Un veteran care a văzut sute de cupe și a învins cei mai abili adversari virtuali.',
    unlockRequirement: 'Joacă cel puțin 3 partide complete de Whist.',
    avatarIcon: '👑',
    accentColor: 'from-purple-500 to-indigo-500 text-purple-300',
    rewardType: 'cardBack',
    rewardId: 'cardback_royal_damask',
    rewardName: 'Spate Cărți: Damasc Regal',
    isUnlocked: (stats: PlayerStats) => stats.gamesPlayed >= 3,
  },
  {
    id: 'joker_blade',
    name: 'Jokerul Tăietor',
    title: 'Vânătorul de Atuuri',
    description: 'Expert în răsturnări spectaculoase de situație prin tăierea culorilor conducătoare cu atuul.',
    unlockRequirement: 'Câștigă 10 cupe tăind cu carte de atu.',
    avatarIcon: '⚡',
    accentColor: 'from-red-500 to-rose-400 text-rose-300',
    rewardType: 'tableTheme',
    rewardId: 'theme_ruby_lounge',
    rewardName: 'Postav Rubin Regal',
    isUnlocked: (stats: PlayerStats) => stats.trumpsCutCount >= 10,
  },
  {
    id: 'joker_zero',
    name: 'Jokerul Iluzionist',
    title: 'Marele Maestru al lui Zero',
    description: 'Arta de a nu lua nicio cupă chiar și atunci când mâna pare periculoasă.',
    unlockRequirement: 'Deblochează realizarea „Eroul lui Zero” (fă 0 într-o rundă de 6+ cărți).',
    avatarIcon: '🎭',
    accentColor: 'from-cyan-400 to-blue-500 text-cyan-300',
    rewardType: 'cardBack',
    rewardId: 'cardback_midnight',
    rewardName: 'Spate Cărți: Miezul Nopții',
    isUnlocked: (stats: PlayerStats) => stats.unlockedAchievementIds.includes('zero_hero'),
  },
  {
    id: 'joker_diamond',
    name: 'Jokerul de Diamant',
    title: 'Centurionul Postavului',
    description: 'Legenda supremă a Whist-ului românesc. Acumulat doar de jucătorii de elită.',
    unlockRequirement: 'Obține un scor de peste 80 de puncte într-o partidă.',
    avatarIcon: '💎',
    accentColor: 'from-sky-300 to-amber-200 text-amber-200',
    rewardType: 'tableTheme',
    rewardId: 'theme_casino_noir',
    rewardName: 'Postav Noapte la Cazino',
    isUnlocked: (stats: PlayerStats) => stats.highestScore >= 80,
  },
];

export const CARD_BACK_SKINS: CardBackSkin[] = [
  {
    id: 'cardback_classic_emerald',
    name: 'Clasic Smarald',
    description: 'Modelul oficial tradițional din postav verde cu filigran auriu.',
    previewGradient: 'from-emerald-950 via-slate-900 to-emerald-900',
    borderAccent: 'border-amber-500/50',
    pattern: 'filigree',
  },
  {
    id: 'cardback_gold_imperial',
    name: 'Aur Imperial',
    description: 'Model rezervat marilor strategi de licitație, bordat cu aur cald.',
    requiredJokerId: 'joker_gold',
    previewGradient: 'from-amber-950 via-yellow-900 to-amber-900',
    borderAccent: 'border-yellow-400',
    pattern: 'gold',
  },
  {
    id: 'cardback_royal_damask',
    name: 'Damasc Regal',
    description: 'Model aristocratic de curte imperială în tonuri de purpură nobilă.',
    requiredJokerId: 'joker_royal',
    previewGradient: 'from-purple-950 via-indigo-950 to-slate-950',
    borderAccent: 'border-purple-400/70',
    pattern: 'harlequin',
  },
  {
    id: 'cardback_midnight',
    name: 'Miezul Nopții',
    description: 'Model de camuflaj nocturn cu steluțe aurite și contur argintiu.',
    requiredJokerId: 'joker_zero',
    previewGradient: 'from-slate-950 via-blue-950 to-slate-900',
    borderAccent: 'border-cyan-400/60',
    pattern: 'midnight',
  },
];

export const TABLE_THEMES: TableTheme[] = [
  {
    id: 'theme_emerald_club',
    name: 'Club Smarald (Clasic)',
    description: 'Postav clasic verde smarald profund cu margini aurite și lemn nobil.',
    bgGradient: 'radial-gradient(ellipse at center, #0f683e 0%, #084929 55%, #032715 100%)',
    feltBorder: 'border-amber-500/50 shadow-[inset_0_0_90px_rgba(0,0,0,0.85)]',
    innerGlow: 'rgba(16,185,129,0.15)',
    accentHighlight: '#10b981',
  },
  {
    id: 'theme_ruby_lounge',
    name: 'Rubin Regal',
    description: 'Ambianță selectă de salon vienez cu postav roșu rubiniu cald.',
    requiredJokerId: 'joker_blade',
    bgGradient: 'radial-gradient(ellipse at center, #7a1528 0%, #520b18 55%, #250208 100%)',
    feltBorder: 'border-amber-400/60 shadow-[inset_0_0_90px_rgba(0,0,0,0.85)]',
    innerGlow: 'rgba(244,63,94,0.15)',
    accentHighlight: '#f43f5e',
  },
  {
    id: 'theme_casino_noir',
    name: 'Noapte la Cazino',
    description: 'Stil modern minimalist de club exclusivist nocturn cu fetru antracit.',
    requiredJokerId: 'joker_diamond',
    bgGradient: 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 55%, #020617 100%)',
    feltBorder: 'border-cyan-500/40 shadow-[inset_0_0_90px_rgba(0,0,0,0.9)]',
    innerGlow: 'rgba(56,189,248,0.15)',
    accentHighlight: '#38bdf8',
  },
];

const CUSTOMIZATION_STORAGE_KEY = 'whist_romanesc_customization_v1';

export interface UserCustomization {
  selectedCardBack: string;
  selectedTableTheme: string;
  seenJokerIds: string[];
}

export const CustomizationManager = {
  load(): UserCustomization {
    try {
      const raw = localStorage.getItem(CUSTOMIZATION_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Fallback
    }
    return {
      selectedCardBack: 'cardback_classic_emerald',
      selectedTableTheme: 'theme_emerald_club',
      seenJokerIds: [],
    };
  },

  save(data: UserCustomization): void {
    try {
      localStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore
    }
  },

  getUnlockedJokers(stats: PlayerStats): JokerBonus[] {
    return JOKERS_LIST.filter((joker) => joker.isUnlocked(stats));
  },

  getNewlyUnlockedJokers(stats: PlayerStats, currentCustom: UserCustomization): JokerBonus[] {
    const unlocked = this.getUnlockedJokers(stats);
    return unlocked.filter((j) => !currentCustom.seenJokerIds.includes(j.id));
  },

  markJokerSeen(jokerId: string, custom: UserCustomization): UserCustomization {
    if (custom.seenJokerIds.includes(jokerId)) return custom;
    const updated = {
      ...custom,
      seenJokerIds: [...custom.seenJokerIds, jokerId],
    };
    this.save(updated);
    return updated;
  },
};
