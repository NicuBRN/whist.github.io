import React from 'react';
import { Trophy, RotateCcw, FileText, Home } from 'lucide-react';
import { sounds } from '../utils/audio.ts';

interface GameOverModalProps {
  playerNames: string[];
  finalScores: number[];
  onPlayAgain: () => void;
  onOpenScoreTable: () => void;
  onBackToMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  playerNames,
  finalScores,
  onPlayAgain,
  onOpenScoreTable,
  onBackToMenu,
}) => {
  React.useEffect(() => {
    sounds.playVictory();
  }, []);

  const standings = playerNames
    .map((name, idx) => ({
      name,
      score: finalScores[idx],
      idx,
    }))
    .sort((a, b) => b.score - a.score);

  const winner = standings[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in zoom-in-95 duration-200">
      <div className="bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 border-2 border-amber-500/70 rounded-3xl max-w-lg w-full p-6 sm:p-8 text-center text-slate-100 shadow-2xl relative">
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mb-3 shadow-lg shadow-amber-500/30">
          <Trophy className="w-9 h-9 sm:w-11 sm:h-11 text-amber-400 animate-bounce" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black font-cinzel text-amber-400 mb-1">
          Partidă Încheiată!
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 mb-6">
          Câștigătorul meciului de Whist Românesc este{' '}
          <span className="font-bold text-amber-300">{winner.name}</span> cu{' '}
          <span className="font-bold text-white">{winner.score} puncte</span>!
        </p>

        {/* Podium list */}
        <div className="space-y-2 mb-6">
          {standings.map((player, rank) => (
            <div
              key={player.idx}
              className={`p-3 rounded-xl border flex items-center justify-between transition-transform ${
                rank === 0
                  ? 'bg-amber-950/60 border-amber-500/80 shadow-md text-amber-200 scale-102'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg w-7 text-center">
                  {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`}
                </span>
                <span className="font-bold text-sm sm:text-base">{player.name}</span>
              </div>
              <span className="font-cinzel font-black text-base sm:text-lg text-amber-300">
                {player.score > 0 ? `+${player.score}` : player.score} pct
              </span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-950/50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Joc Nou (Revanșă)</span>
          </button>

          <button
            type="button"
            onClick={onOpenScoreTable}
            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Foaia de Scor</span>
          </button>

          <button
            type="button"
            onClick={onBackToMenu}
            className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Meniu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
