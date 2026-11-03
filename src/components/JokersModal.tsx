/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Sparkles, Check, Lock, ShieldCheck, Palette, Layers } from 'lucide-react';
import { PlayerStats } from '../utils/statsAndAchievements.ts';
import {
  JOKERS_LIST,
  CARD_BACK_SKINS,
  TABLE_THEMES,
  UserCustomization,
  JokerBonus,
} from '../utils/jokersAndThemes.ts';

interface JokersModalProps {
  stats: PlayerStats;
  customization: UserCustomization;
  onUpdateCustomization: (updated: UserCustomization) => void;
  onClose: () => void;
}

export const JokersModal: React.FC<JokersModalProps> = ({
  stats,
  customization,
  onUpdateCustomization,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'jokers' | 'cardBacks' | 'themes'>('jokers');

  const unlockedJokers = JOKERS_LIST.filter((j) => j.isUnlocked(stats));
  const unlockedJokerIds = new Set(unlockedJokers.map((j) => j.id));

  const handleSelectCardBack = (skinId: string, requiredJokerId?: string) => {
    if (requiredJokerId && !unlockedJokerIds.has(requiredJokerId)) return;
    onUpdateCustomization({
      ...customization,
      selectedCardBack: skinId,
    });
  };

  const handleSelectTableTheme = (themeId: string, requiredJokerId?: string) => {
    if (requiredJokerId && !unlockedJokerIds.has(requiredJokerId)) return;
    onUpdateCustomization({
      ...customization,
      selectedTableTheme: themeId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 border-2 border-amber-500/80 rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-amber-500/30 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-cinzel text-amber-400 leading-tight">
                Colecția de Jokeri & Teme
              </h2>
              <p className="text-[11px] sm:text-xs text-emerald-300/80">
                Bonusuri cosmetice deblocate prin realizări • Reguli 100% oficiale
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide fereastra de jokeri"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-emerald-900/60 bg-slate-950/70 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('jokers')}
            className={`flex-1 py-2.5 sm:py-3 font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'jokers'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🃏 Jokeri</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
              {unlockedJokers.length}/{JOKERS_LIST.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cardBacks')}
            className={`flex-1 py-2.5 sm:py-3 font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'cardBacks'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Spate Cărți</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('themes')}
            className={`flex-1 py-2.5 sm:py-3 font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'themes'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Teme Masă</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-3 sm:space-y-4">
          {/* TAB 1: JOKERS */}
          {activeTab === 'jokers' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 text-amber-200/90 text-xs sm:text-sm flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  Jokerii sunt cărți speciale de glorie obținute prin performanță. Ei <strong>nu alterează parcursul rundelor</strong> sau numărul de cărți distribuite, ci îți conferă prestigiu și deblochează elemente vizuale rare pentru masa ta de joc.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {JOKERS_LIST.map((joker) => {
                  const unlocked = joker.isUnlocked(stats);
                  return (
                    <div
                      key={joker.id}
                      className={`relative p-3 rounded-2xl border transition-all ${
                        unlocked
                          ? 'bg-slate-900/90 border-amber-500/50 shadow-md shadow-amber-500/10'
                          : 'bg-slate-950/60 border-slate-800 opacity-70'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-12 h-14 rounded-xl flex items-center justify-center text-2xl border shadow-inner shrink-0 ${
                            unlocked
                              ? 'bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border-amber-400/60 text-amber-300'
                              : 'bg-slate-800/80 border-slate-700 text-slate-500'
                          }`}
                        >
                          {unlocked ? joker.avatarIcon : <Lock className="w-5 h-5 text-slate-500" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="font-bold text-sm text-slate-100 truncate">
                              {joker.name}
                            </h3>
                            {unlocked ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                Deblocat
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                                Blocat
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-amber-300/90 font-medium">
                            {joker.title}
                          </p>
                          <p className="text-[11px] text-slate-300/80 mt-1 line-clamp-2">
                            {joker.description}
                          </p>
                          <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                            <span className="truncate pr-1">Cerință: {joker.unlockRequirement}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CARD BACKS */}
          {activeTab === 'cardBacks' && (
            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-slate-300">
                Alege modelul grafic afișat pe spatele cărților împărțite la masă:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CARD_BACK_SKINS.map((skin) => {
                  const isUnlocked = !skin.requiredJokerId || unlockedJokerIds.has(skin.requiredJokerId);
                  const isSelected = customization.selectedCardBack === skin.id;
                  const reqJoker = skin.requiredJokerId
                    ? JOKERS_LIST.find((j) => j.id === skin.requiredJokerId)
                    : null;

                  return (
                    <div
                      key={skin.id}
                      onClick={() => handleSelectCardBack(skin.id, skin.requiredJokerId)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                        isSelected
                          ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/50 shadow-lg'
                          : isUnlocked
                          ? 'bg-slate-900/80 border-slate-700 hover:border-amber-500/40'
                          : 'bg-slate-950/50 border-slate-800/80 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {/* Mini card back representation */}
                      <div
                        className={`w-11 h-16 rounded-md bg-gradient-to-br ${skin.previewGradient} border ${skin.borderAccent} flex items-center justify-center shrink-0 shadow-md relative overflow-hidden`}
                      >
                        <div className="w-7 h-11 border border-amber-400/30 rounded-xs flex items-center justify-center">
                          <span className="text-[10px] text-amber-300/80 font-cinzel font-black">W</span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-100 truncate">
                            {skin.name}
                          </h4>
                          {isSelected && (
                            <span className="p-1 rounded-full bg-amber-400 text-slate-950">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300/80 mt-0.5 line-clamp-2">
                          {skin.description}
                        </p>
                        {!isUnlocked && reqJoker && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300">
                            <Lock className="w-3 h-3" />
                            <span>Necesită: {reqJoker.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TABLE THEMES */}
          {activeTab === 'themes' && (
            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-slate-300">
                Alege stilul și textura postavului pentru masa de joc:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TABLE_THEMES.map((theme) => {
                  const isUnlocked = !theme.requiredJokerId || unlockedJokerIds.has(theme.requiredJokerId);
                  const isSelected = customization.selectedTableTheme === theme.id;
                  const reqJoker = theme.requiredJokerId
                    ? JOKERS_LIST.find((j) => j.id === theme.requiredJokerId)
                    : null;

                  return (
                    <div
                      key={theme.id}
                      onClick={() => handleSelectTableTheme(theme.id, theme.requiredJokerId)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                        isSelected
                          ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/50 shadow-lg'
                          : isUnlocked
                          ? 'bg-slate-900/80 border-slate-700 hover:border-amber-500/40'
                          : 'bg-slate-950/50 border-slate-800/80 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {/* Swatch */}
                      <div
                        style={{ background: theme.bgGradient }}
                        className="w-12 h-12 rounded-xl border border-amber-400/50 shadow-inner flex items-center justify-center shrink-0"
                      >
                        <div
                          style={{ borderColor: theme.accentHighlight }}
                          className="w-6 h-6 rounded-full border-2 opacity-80"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-100 truncate">
                            {theme.name}
                          </h4>
                          {isSelected && (
                            <span className="p-1 rounded-full bg-amber-400 text-slate-950">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300/80 mt-0.5 line-clamp-2">
                          {theme.description}
                        </p>
                        {!isUnlocked && reqJoker && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300">
                            <Lock className="w-3 h-3" />
                            <span>Necesită: {reqJoker.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-emerald-900/40 bg-slate-950/80 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Deblochează toți cei 6 Jokeri pentru prestigiul suprem de Whist.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer shadow-md transition-all active:scale-95"
          >
            Gata
          </button>
        </div>
      </div>
    </div>
  );
};
