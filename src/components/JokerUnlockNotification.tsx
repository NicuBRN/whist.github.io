/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Trophy, ArrowRight } from 'lucide-react';
import { JokerBonus } from '../utils/jokersAndThemes.ts';

interface JokerUnlockNotificationProps {
  joker: JokerBonus;
  onOpenJokersModal: () => void;
  onDismiss: () => void;
}

export const JokerUnlockNotification: React.FC<JokerUnlockNotificationProps> = ({
  joker,
  onOpenJokersModal,
  onDismiss,
}) => {
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-in slide-in-from-bottom-6 fade-in duration-300">
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950 via-slate-900 to-emerald-950 border-2 border-amber-400 shadow-2xl shadow-amber-500/30 text-white flex items-center gap-3.5">
        <div className="w-12 h-14 rounded-xl bg-amber-500/20 border border-amber-400/80 flex items-center justify-center text-3xl shrink-0 animate-bounce">
          {joker.avatarIcon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Joker Nou Deblocat!</span>
          </div>
          <h4 className="font-bold text-base text-amber-200 truncate">
            {joker.name}
          </h4>
          <p className="text-xs text-slate-300 truncate">
            Recompensă: {joker.rewardName}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenJokersModal}
            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer shadow transition-all active:scale-95"
          >
            <span>Vezi</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] text-slate-400 hover:text-slate-200 text-center cursor-pointer"
          >
            Închide
          </button>
        </div>
      </div>
    </div>
  );
};
