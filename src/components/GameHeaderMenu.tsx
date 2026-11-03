/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Menu,
  X,
  Trophy,
  Sparkles,
  Award,
  GraduationCap,
  BookOpen,
  Volume2,
  VolumeX,
  RotateCcw,
  Download,
  Shield,
  Globe,
  LogOut,
} from 'lucide-react';

interface GameHeaderMenuProps {
  unlockedJokersCount: number;
  totalJokersCount: number;
  soundEnabled: boolean;
  isOnlineRoom?: boolean;
  onOpenMultiplayer?: () => void;
  onToggleSound: () => void;
  onOpenScore: () => void;
  onOpenJokers: () => void;
  onOpenStats: () => void;
  onOpenTutorial: () => void;
  onOpenRules: () => void;
  onRestartGame: () => void;
  onDownloadStandalone: () => void;
  onLeaveTable?: () => void;
}

export const GameHeaderMenu: React.FC<GameHeaderMenuProps> = ({
  unlockedJokersCount,
  totalJokersCount,
  soundEnabled,
  isOnlineRoom = false,
  onOpenMultiplayer,
  onToggleSound,
  onOpenScore,
  onOpenJokers,
  onOpenStats,
  onOpenTutorial,
  onOpenRules,
  onRestartGame,
  onDownloadStandalone,
  onLeaveTable,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleAction = (callback: () => void) => {
    callback();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger Button in Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Meniu Opțiuni Joc"
        className="px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-500/50 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
      >
        <Menu className="w-4 h-4 text-amber-400" />
        <span className="hidden sm:inline">Meniu</span>
        {unlockedJokersCount > 0 && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </button>

      {/* Dropdown Menu Modal / Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Card */}
          <div className="absolute right-0 top-10 sm:top-11 z-50 w-72 sm:w-80 bg-slate-950 border-2 border-amber-500/70 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-150 text-slate-100">
            {/* Menu Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950 border-b border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span className="font-cinzel font-bold text-sm text-amber-300">
                  Opțiuni Whist
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="p-2 space-y-1">
              {/* Jokers & Themes */}
              <button
                type="button"
                onClick={() => handleAction(onOpenJokers)}
                className="w-full px-3 py-2.5 rounded-xl bg-amber-950/30 hover:bg-amber-950/60 border border-amber-500/30 text-amber-200 text-xs sm:text-sm font-semibold flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Jokeri & Teme Masă</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {unlockedJokersCount}/{totalJokersCount}
                </span>
              </button>

              {/* Online Multiplayer Lobby */}
              {onOpenMultiplayer && (
                <button
                  type="button"
                  onClick={() => handleAction(onOpenMultiplayer)}
                  className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    isOnlineRoom
                      ? 'bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-200'
                      : 'hover:bg-slate-900 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span>{isOnlineRoom ? 'Masa Online Activă' : 'Camere Multiplayer'}</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Online
                  </span>
                </button>
              )}

              {/* Score Table */}
              <button
                type="button"
                onClick={() => handleAction(onOpenScore)}
                className="w-full px-3 py-2 rounded-xl hover:bg-slate-900 text-slate-200 text-xs sm:text-sm flex items-center gap-2.5 cursor-pointer transition-colors"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Foaia de Scor</span>
              </button>

              {/* Statistics & Achievements */}
              <button
                type="button"
                onClick={() => handleAction(onOpenStats)}
                className="w-full px-3 py-2 rounded-xl hover:bg-slate-900 text-slate-200 text-xs sm:text-sm flex items-center gap-2.5 cursor-pointer transition-colors"
              >
                <Award className="w-4 h-4 text-purple-400" />
                <span>Statistici & Realizări</span>
              </button>

              {/* Interactive Tutorial */}
              <button
                type="button"
                onClick={() => handleAction(onOpenTutorial)}
                className="w-full px-3 py-2 rounded-xl hover:bg-slate-900 text-slate-200 text-xs sm:text-sm flex items-center gap-2.5 cursor-pointer transition-colors"
              >
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                <span>Tutorial Interactiv</span>
              </button>

              {/* Official Rules */}
              <button
                type="button"
                onClick={() => handleAction(onOpenRules)}
                className="w-full px-3 py-2 rounded-xl hover:bg-slate-900 text-slate-200 text-xs sm:text-sm flex items-center gap-2.5 cursor-pointer transition-colors"
              >
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span>Regulament Oficial (1-8-1)</span>
              </button>

              {/* Sound Toggle */}
              <button
                type="button"
                onClick={onToggleSound}
                className="w-full px-3 py-2 rounded-xl hover:bg-slate-900 text-slate-200 text-xs sm:text-sm flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-amber-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                  <span>Efecte Sonore</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    soundEnabled
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {soundEnabled ? 'Pornite' : 'Oprite'}
                </span>
              </button>

              {/* Download Standalone */}
              <button
                type="button"
                onClick={() => handleAction(onDownloadStandalone)}
                className="w-full px-3 py-2 rounded-xl hover:bg-slate-900 text-emerald-300 text-xs sm:text-sm flex items-center gap-2.5 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Descarcă HTML Unic Offline</span>
              </button>

              {/* Restart Game */}
              <div className="pt-1 border-t border-slate-800 space-y-1">
                <button
                  type="button"
                  onClick={() => handleAction(onRestartGame)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs sm:text-sm font-semibold flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <span>Joc Nou (Reîncepe meciul)</span>
                </button>

                {onLeaveTable && (
                  <button
                    type="button"
                    onClick={() => handleAction(onLeaveTable)}
                    className="w-full px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/40 text-xs sm:text-sm font-semibold flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Părăsește Masa de Joc</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
