import React from 'react';
import { Trophy, CheckCircle2, XCircle, ArrowRight, FileText } from 'lucide-react';
import { SUIT_NAMES_RO, SUIT_SYMBOLS, Suit } from '../game/rules.ts';
import { sounds } from '../utils/audio.ts';

export interface PlayerRoundResult {
  playerId: number;
  name: string;
  avatar: string;
  isAi: boolean;
  bid: number;
  tricksWon: number;
  pointsGained: number;
  previousScore: number;
  newTotalScore: number;
}

interface RoundRecapModalProps {
  roundNumber: number;
  totalRounds: number;
  cardCount: number;
  trumpSuit: Suit | null;
  results: PlayerRoundResult[];
  onNextRound: () => void;
  onOpenScoreTable: () => void;
}

export const RoundRecapModal: React.FC<RoundRecapModalProps> = ({
  roundNumber,
  totalRounds,
  cardCount,
  trumpSuit,
  results,
  onNextRound,
  onOpenScoreTable,
}) => {
  const isUserSuccess = results[0]?.bid === results[0]?.tricksWon;

  React.useEffect(() => {
    if (isUserSuccess) {
      sounds.playTrickWin();
    } else {
      sounds.playForbidden();
    }
  }, [isUserSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 border-2 border-amber-500/60 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="text-center mb-4 border-b border-emerald-900/60 pb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Recapitulare Punctaj</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-cinzel text-amber-400">
            Runda {roundNumber} din {totalRounds} încheiată!
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            S-au jucat <span className="font-bold text-white">{cardCount}</span> {cardCount === 1 ? 'carte' : 'cărți'}.{' '}
            {trumpSuit ? (
              <span>
                Atu: <strong className="text-amber-300">{SUIT_NAMES_RO[trumpSuit]} {SUIT_SYMBOLS[trumpSuit]}</strong>
              </span>
            ) : (
              <span className="text-sky-300 font-semibold">Fără Atu</span>
            )}
          </p>
        </div>

        {/* Players results breakdown */}
        <div className="space-y-2.5 mb-5 flex-1">
          {results.map((player) => {
            const made = player.bid === player.tricksWon;
            return (
              <div
                key={player.playerId}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  player.playerId === 0
                    ? made
                      ? 'bg-emerald-950/60 border-emerald-500/70 shadow-md ring-1 ring-emerald-500/40'
                      : 'bg-rose-950/50 border-rose-500/60 ring-1 ring-rose-500/30'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                {/* Player identity & bid info */}
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{player.avatar}</span>
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-100 flex items-center gap-1.5">
                      <span>{player.name}</span>
                      {player.playerId === 0 && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-sans">
                          Tu
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                      <span>Licitație: <strong className="text-slate-200">{player.bid}</strong></span>
                      <span>•</span>
                      <span>Făcute: <strong className="text-slate-200">{player.tricksWon}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Score change and new total */}
                <div className="text-right flex flex-col items-end">
                  <div className="flex items-center gap-1.5">
                    {made ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        +{player.pointsGained} pct
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        {player.pointsGained} pct
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono font-bold text-amber-300 mt-1">
                    Total: {player.newTotalScore > 0 ? `+${player.newTotalScore}` : player.newTotalScore} pct
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-emerald-900/60">
          <button
            type="button"
            onClick={onOpenScoreTable}
            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Foaia de Scor</span>
          </button>

          <button
            type="button"
            data-start="true"
            onClick={onNextRound}
            className="flex-1 py-3 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-950/50 transition-all active:scale-98"
          >
            <span>{roundNumber < totalRounds ? `Treci la Runda ${roundNumber + 1}` : 'Vezi Rezultatul Final'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
