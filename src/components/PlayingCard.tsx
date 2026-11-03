import React from 'react';
import { Card, Suit, SUIT_SYMBOLS, RANK_NAMES_RO } from '../game/rules.ts';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  skinId?: string;
  isPlayable?: boolean;
  isSelected?: boolean;
  isWinningCard?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  rotation?: number;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  faceDown = false,
  skinId = 'cardback_classic_emerald',
  isPlayable = false,
  isSelected = false,
  isWinningCard = false,
  onClick,
  className = '',
  size = 'md',
  rotation = 0,
}) => {
  // Caro (DIAMONDS) & Inimă Roșie (HEARTS) must be pure bright red
  // Inimă Neagră (SPADES) & Treflă (CLUBS) must be pure black
  const isRed = card?.suit === 'HEARTS' || card?.suit === 'DIAMONDS';

  const sizeClasses = {
    sm: 'w-10 h-15 sm:w-12 sm:h-17 text-[11px] sm:text-xs rounded-md',
    md: 'w-13 h-19 sm:w-16 sm:h-24 md:w-20 md:h-28 text-xs sm:text-sm md:text-base rounded-lg',
    lg: 'w-18 h-26 sm:w-22 sm:h-32 md:w-26 md:h-38 text-base sm:text-lg rounded-xl',
  }[size];

  const cornerSuitSizeClasses = {
    sm: 'text-xs sm:text-sm leading-none font-black',
    md: 'text-sm sm:text-base md:text-lg leading-none font-black',
    lg: 'text-lg sm:text-xl md:text-2xl leading-none font-black',
  }[size];

  const centerIconSizeClasses = {
    sm: 'text-xl sm:text-2xl',
    md: 'text-2xl sm:text-3xl md:text-4xl',
    lg: 'text-4xl sm:text-5xl md:text-6xl',
  }[size];

  const style: React.CSSProperties = {
    transform: `rotate(${rotation}deg) ${isSelected ? 'translateY(-14px)' : ''}`,
    transition: 'transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.18s ease',
  };

  if (faceDown || !card) {
    let bgGradient = 'from-emerald-950 via-slate-900 to-emerald-900';
    let borderClass = 'border-amber-500/50';
    let emblemColor = 'text-amber-400/80';
    let emblemIcon = 'W';

    if (skinId === 'cardback_gold_imperial') {
      bgGradient = 'from-amber-950 via-yellow-900 to-amber-900';
      borderClass = 'border-yellow-400 shadow-amber-500/30';
      emblemColor = 'text-yellow-300';
      emblemIcon = '👑';
    } else if (skinId === 'cardback_royal_damask') {
      bgGradient = 'from-purple-950 via-indigo-950 to-slate-950';
      borderClass = 'border-purple-400/80';
      emblemColor = 'text-purple-300';
      emblemIcon = '⚜️';
    } else if (skinId === 'cardback_midnight') {
      bgGradient = 'from-slate-950 via-blue-950 to-slate-900';
      borderClass = 'border-cyan-400/70';
      emblemColor = 'text-cyan-300';
      emblemIcon = '✨';
    }

    return (
      <div
        style={style}
        className={`relative select-none border bg-gradient-to-br ${bgGradient} ${borderClass} p-0.5 sm:p-1 card-shadow flex items-center justify-center shrink-0 ${sizeClasses} ${className}`}
      >
        <div className="w-full h-full border border-amber-400/30 rounded flex items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08)_0,_transparent_70%)]">
          <div className="w-3/4 h-3/4 border border-dashed border-amber-400/30 rounded-xs flex items-center justify-center">
            <span className={`${emblemColor} text-xs sm:text-sm font-serif font-black`}>
              {emblemIcon}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const symbol = SUIT_SYMBOLS[card.suit];
  const rankStr = RANK_NAMES_RO[card.rank];

  return (
    <button
      type="button"
      onClick={isPlayable && onClick ? onClick : undefined}
      disabled={!isPlayable && !!onClick}
      style={style}
      aria-label={`${rankStr} de ${card.suit}`}
      className={`relative select-none card-shadow bg-white font-black flex flex-col justify-between p-1 sm:p-1.5 shrink-0 border transition-all duration-150 cursor-pointer ${
        isRed ? 'text-red-600' : 'text-black'
      } ${
        isWinningCard
          ? 'ring-3 sm:ring-4 ring-amber-400 border-amber-400 shadow-xl shadow-amber-500/60 scale-105 z-10 animate-pulse'
          : isPlayable
          ? 'border-amber-400 card-playable-glow hover:-translate-y-2 hover:scale-105 active:scale-95'
          : 'border-slate-300 opacity-90'
      } ${
        !isPlayable && onClick ? 'cursor-not-allowed opacity-45 grayscale-20' : ''
      } ${sizeClasses} ${className}`}
    >
      {/* Top Left corner index: Rank and larger Suit Icon */}
      <div className="flex flex-col items-center leading-none text-left self-start">
        <span className="font-extrabold tracking-tighter text-[11px] sm:text-xs md:text-sm leading-none">
          {rankStr}
        </span>
        <span className={`${cornerSuitSizeClasses} mt-0.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]`}>
          {symbol}
        </span>
      </div>

      {/* Center artwork / emblem */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {card.rank >= 11 ? (
          <div className="flex flex-col items-center justify-center">
            <span className="text-lg sm:text-xl md:text-2xl font-serif font-black leading-none drop-shadow-xs">
              {rankStr}
            </span>
            <span className={`${cornerSuitSizeClasses} mt-0.5`}>{symbol}</span>
          </div>
        ) : (
          <span className={`${centerIconSizeClasses} leading-none drop-shadow-xs opacity-90`}>
            {symbol}
          </span>
        )}
      </div>

      {/* Bottom Right corner index (inverted) */}
      <div className="flex flex-col items-center leading-none rotate-180 self-end">
        <span className="font-extrabold tracking-tighter text-[11px] sm:text-xs md:text-sm leading-none">
          {rankStr}
        </span>
        <span className={`${cornerSuitSizeClasses} mt-0.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]`}>
          {symbol}
        </span>
      </div>

      {/* Winning trick marker */}
      {isWinningCard && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-black text-[8px] sm:text-[9px] px-1.5 sm:px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider flex items-center gap-0.5 whitespace-nowrap z-20">
          <span>👑</span>
          <span>Câștigă</span>
        </div>
      )}
    </button>
  );
};
