import React from 'react';
import { SUIT_SYMBOLS, Suit } from '../game/rules.ts';
import { X, Trophy } from 'lucide-react';

export interface RoundHistoryRecord {
  roundNumber: number;
  cardCount: number;
  trumpSuit: Suit | null;
  playerResults: {
    bid: number;
    tricksWon: number;
    points: number;
    runningTotal: number;
  }[];
}

interface ScoreTableModalProps {
  playerNames: string[];
  history: RoundHistoryRecord[];
  currentRoundIndex: number;
  totalRounds: number;
  onClose: () => void;
}

export const ScoreTableModal: React.FC<ScoreTableModalProps> = ({
  playerNames,
  history,
  currentRoundIndex,
  totalRounds,
  onClose,
}) => {
  // Compute current ranks
  const latestTotals = playerNames.map((_, pIdx) => {
    if (history.length === 0) return 0;
    return history[history.length - 1].playerResults[pIdx]?.runningTotal || 0;
  });

  const rankedIndices = playerNames
    .map((_, idx) => ({ idx, score: latestTotals[idx] }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 border border-amber-500/40 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-emerald-800/60 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-cinzel text-amber-400">
                Tabelul de Scor (Foaia de Whist)
              </h2>
              <p className="text-xs text-slate-400">
                Runda curentă: {Math.min(currentRoundIndex + 1, totalRounds)} din {totalRounds}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide tabel scor"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Standings Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4 bg-slate-950/40 border-b border-emerald-900/40">
          {rankedIndices.map(({ idx, score }, rank) => (
            <div
              key={idx}
              className={`p-2.5 rounded-xl border flex items-center justify-between ${
                rank === 0
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="font-bold text-xs w-5 text-center text-amber-400">
                  {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`}
                </span>
                <span className="text-xs sm:text-sm font-semibold truncate">
                  {playerNames[idx]}
                </span>
              </div>
              <span className="text-sm sm:text-base font-bold font-cinzel ml-2">
                {score > 0 ? `+${score}` : score} pct
              </span>
            </div>
          ))}
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-2 sm:p-4">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-emerald-800/60 text-slate-400 text-[11px] uppercase tracking-wider bg-slate-950/60 sticky top-0">
                <th className="p-2 sm:p-2.5 text-center w-16">Rundă</th>
                <th className="p-2 sm:p-2.5 text-center w-12">Atu</th>
                {playerNames.map((name, pIdx) => (
                  <th key={pIdx} className="p-2 sm:p-2.5 text-center border-l border-emerald-900/40">
                    <div className="font-bold text-slate-200 truncate max-w-[90px] mx-auto">{name}</div>
                    <div className="flex justify-center gap-1.5 text-[9px] text-slate-400 font-mono mt-0.5">
                      <span>L</span>
                      <span>F</span>
                      <span>Pct</span>
                      <span className="font-bold text-amber-300">Tot</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={2 + playerNames.length} className="text-center py-8 text-slate-400 italic">
                    Nicio rundă încheiată încă. Începe să joci pentru a înregistra scorurile!
                  </td>
                </tr>
              ) : (
                history.map((record, rIdx) => (
                  <tr
                    key={rIdx}
                    className={`border-b border-slate-800/60 transition-colors ${
                      rIdx % 2 === 0 ? 'bg-slate-900/30' : 'bg-transparent'
                    } hover:bg-emerald-950/40`}
                  >
                    <td className="p-2 text-center font-mono font-semibold text-slate-300">
                      R{record.roundNumber} ({record.cardCount})
                    </td>
                    <td className="p-2 text-center">
                      {record.trumpSuit ? (
                        <span
                          className={`font-bold ${
                            record.trumpSuit === 'HEARTS' || record.trumpSuit === 'DIAMONDS'
                              ? 'text-red-400'
                              : 'text-amber-300'
                          }`}
                        >
                          {SUIT_SYMBOLS[record.trumpSuit]}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">-</span>
                      )}
                    </td>
                    {record.playerResults.map((res, pIdx) => {
                      const made = res.bid === res.tricksWon;
                      return (
                        <td
                          key={pIdx}
                          className="p-1.5 sm:p-2 text-center border-l border-slate-800/60 font-mono"
                        >
                          <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                            <span className="text-slate-400 w-3">{res.bid}</span>
                            <span className="text-slate-300 w-3">{res.tricksWon}</span>
                            <span
                              className={`w-6 text-[11px] font-bold ${
                                made ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {res.points > 0 ? `+${res.points}` : res.points}
                            </span>
                            <span className="font-bold text-amber-300 w-7 text-right">
                              {res.runningTotal}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-t border-emerald-900/60 bg-slate-950/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
          <div className="flex items-center gap-3">
            <span><strong className="text-slate-200">L:</strong> Licitație</span>
            <span><strong className="text-slate-200">F:</strong> Mâini Făcute</span>
            <span><strong className="text-emerald-400">Pct:</strong> Puncte (+5+F sau -dif)</span>
            <span><strong className="text-amber-300">Tot:</strong> Total Cumulat</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer transition-colors"
          >
            Înapoi la Joc
          </button>
        </div>
      </div>
    </div>
  );
};
