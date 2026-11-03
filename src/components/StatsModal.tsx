import React, { useState } from 'react';
import { X, Trophy, Award, Target, Flame, CheckCircle2, Lock, Sparkles } from 'lucide-react';
import { PlayerStats, StatsManager, Achievement } from '../utils/statsAndAchievements.ts';

interface StatsModalProps {
  stats: PlayerStats;
  onClose: () => void;
  onResetStats?: () => void;
  onOpenJokers?: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  stats,
  onClose,
  onResetStats,
  onOpenJokers,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'achievements'>('stats');
  const achievements = StatsManager.getAchievements(stats);

  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  const avgScore = stats.gamesPlayed > 0 ? Math.round(stats.totalScore / stats.gamesPlayed) : 0;
  const bidAccuracy = stats.totalBidsAttempted > 0 ? Math.round((stats.totalBidsSuccessful / stats.totalBidsAttempted) * 100) : 0;
  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 border-2 border-amber-500/70 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-emerald-800/60 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg sm:text-xl font-bold font-cinzel text-amber-400">
              Statistici & Realizări Whist
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onOpenJokers && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenJokers();
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Deschide Colecția de Jokeri & Teme"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Colecția de</span> Jokeri
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Închide statistici"
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-emerald-900/60 bg-slate-950/60">
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'stats'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Statistici de Joc
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('achievements')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'achievements'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Realizări & Trofee</span>
            <span className="px-2 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full text-[10px]">
              {unlockedCount}/{achievements.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {activeTab === 'stats' ? (
            <div className="space-y-4">
              {/* Primary Highlights Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-950/70 border border-emerald-900/60 rounded-xl text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Partide Jucate</span>
                  <div className="text-xl sm:text-2xl font-bold font-cinzel text-amber-400 mt-0.5">
                    {stats.gamesPlayed}
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-emerald-900/60 rounded-xl text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Victorii vs AI</span>
                  <div className="text-xl sm:text-2xl font-bold font-cinzel text-emerald-400 mt-0.5">
                    {stats.gamesWon} ({winRate}%)
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-emerald-900/60 rounded-xl text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Scor Mediu</span>
                  <div className="text-xl sm:text-2xl font-bold font-cinzel text-amber-300 mt-0.5">
                    {avgScore} pct
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-emerald-900/60 rounded-xl text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Scor Record</span>
                  <div className="text-xl sm:text-2xl font-bold font-cinzel text-amber-400 mt-0.5">
                    {stats.highestScore} pct
                  </div>
                </div>
              </div>

              {/* Detailed Metrics */}
              <div className="bg-slate-950/80 border border-emerald-900/60 rounded-2xl p-4 space-y-3 text-xs sm:text-sm">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-300">Total Cupe (Mâini) Câștigate:</span>
                  <span className="font-bold font-mono text-amber-300">{stats.totalTricksWon} cupe</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-300">Acuratețe Licitație (Ghicite exact):</span>
                  <span className="font-bold font-mono text-emerald-400">
                    {stats.totalBidsSuccessful} din {stats.totalBidsAttempted} ({bidAccuracy}%)
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-300">Serie Record de Licitații Consecutive:</span>
                  <span className="font-bold font-mono text-amber-400">
                    {stats.consecutiveBidsBest} la rând 🔥
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Cupe Câștigate prin Tăiere cu Atu:</span>
                  <span className="font-bold font-mono text-sky-300">{stats.trumpsCutCount}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {achievements.map((ach) => (
                <div
                  key={ach.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                    ach.isUnlocked
                      ? 'bg-amber-950/30 border-amber-500/60 shadow-md ring-1 ring-amber-400/30'
                      : 'bg-slate-950/40 border-slate-800/80 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{ach.icon}</span>
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-100 flex items-center gap-2">
                        <span>{ach.title}</span>
                        {ach.isUnlocked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Deblocat
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                            <Lock className="w-2.5 h-2.5" /> Blocat
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{ach.description}</p>
                      {ach.target && !ach.isUnlocked && (
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${Math.min(100, ((ach.progress || 0) / ach.target) * 100)}%` }}
                            />
                          </div>
                          <span>{ach.progress || 0}/{ach.target}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-emerald-900/60 bg-slate-950/80 flex items-center justify-between">
          {onResetStats ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Ești sigur că vrei să resetezi statisticile și realizările?')) {
                  onResetStats();
                }
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer underline"
            >
              Resetează Statisticile
            </button>
          ) : <div />}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-md transition-colors"
          >
            Închide
          </button>
        </div>
      </div>
    </div>
  );
};
