import React from 'react';
import { SUIT_NAMES_RO, SUIT_SYMBOLS, Suit, Card } from '../game/rules.ts';
import { PlayingCard } from './PlayingCard.tsx';
import { sounds } from '../utils/audio.ts';
import { AlertCircle, Clock, Check } from 'lucide-react';

interface BiddingOverlayProps {
  cardCount: number;
  trumpSuit: Suit | null;
  dealerName: string;
  isUserDealer: boolean;
  forbiddenBid: number | null;
  bidsSummary: { name: string; bid: number | null }[];
  userHand?: Card[];
  onSelectBid: (bid: number) => void;
  isWaitingForTurn?: boolean;
  currentBidderName?: string;
  userHasBid?: boolean;
  userPlacedBid?: number | null;
}

export const BiddingOverlay: React.FC<BiddingOverlayProps> = ({
  cardCount,
  trumpSuit,
  dealerName,
  isUserDealer,
  forbiddenBid,
  bidsSummary,
  userHand = [],
  onSelectBid,
  isWaitingForTurn = false,
  currentBidderName = '',
  userHasBid = false,
  userPlacedBid = null,
}) => {
  const options = Array.from({ length: cardCount + 1 }, (_, i) => i);

  const handleBidClick = (val: number) => {
    if (isWaitingForTurn || userHasBid) return;
    if (val === forbiddenBid) {
      sounds.playForbidden();
      return;
    }
    sounds.playBid();
    onSelectBid(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 border-2 border-amber-500/70 rounded-3xl p-4 sm:p-6 max-w-xl w-full shadow-2xl text-slate-100 relative max-h-[92vh] flex flex-col overflow-y-auto">
        <div className="text-center mb-3">
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase mb-1.5 border ${
              !isWaitingForTurn && !userHasBid
                ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 animate-pulse'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {userHasBid
              ? 'Licitație Înregistrată'
              : isWaitingForTurn
              ? `Așteaptă... Licitează ${currentBidderName}`
              : '👉 Rândul Tău la Licitație!'}
          </span>

          <h2 className="text-xl sm:text-2xl font-bold font-cinzel text-amber-400">
            {userHasBid ? (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-6 h-6 text-emerald-400" />
                Ai licitat: {userPlacedBid} {userPlacedBid === 1 ? 'mână' : 'mâini'}
              </span>
            ) : isWaitingForTurn ? (
              `Se alege licitația (${currentBidderName})...`
            ) : (
              'Câte mâini crezi că iei?'
            )}
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            Se joacă <span className="font-bold text-white">{cardCount}</span>{' '}
            {cardCount === 1 ? 'carte' : 'cărți'}.
            {trumpSuit ? (
              <span className="ml-1">
                Atuul rundei:{' '}
                <span
                  className={`font-bold ${
                    trumpSuit === 'HEARTS' || trumpSuit === 'DIAMONDS'
                      ? 'text-red-400'
                      : 'text-amber-300'
                  }`}
                >
                  {SUIT_NAMES_RO[trumpSuit]} {SUIT_SYMBOLS[trumpSuit]}
                </span>
              </span>
            ) : (
              <span className="ml-1 font-semibold text-sky-300">Rundă fără Atu</span>
            )}
          </p>
        </div>

        {/* Display user's hand of cards directly here */}
        {userHand.length > 0 && (
          <div className="bg-slate-950/80 border border-emerald-900/60 rounded-2xl p-2.5 sm:p-3 mb-3 text-center">
            <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1.5">
              Cărțile tale în mână:
            </div>
            <div className="flex items-center justify-center -space-x-3 sm:-space-x-4 overflow-x-auto py-1">
              {userHand.map((card) => {
                const isTrump = trumpSuit && card.suit === trumpSuit;
                return (
                  <div key={card.id} className="relative group shrink-0">
                    <PlayingCard
                      card={card}
                      size="sm"
                      className={isTrump ? 'ring-2 ring-amber-400' : ''}
                    />
                    {isTrump && (
                      <span className="absolute -top-1.5 -right-1 bg-amber-500 text-slate-950 text-[8px] font-black px-1 rounded-full uppercase shadow">
                        Atu
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Other players' bids */}
        <div className="bg-slate-950/70 border border-emerald-900/60 rounded-xl p-3 mb-4">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Licitații până acum:</span>
            {isWaitingForTurn && (
              <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1 animate-pulse">
                <Clock className="w-3 h-3" />
                <span>Licitează {currentBidderName}...</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {bidsSummary.map((item, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-2 text-center transition-all ${
                  item.bid !== null
                    ? 'bg-slate-900/90 border-emerald-700/60'
                    : isWaitingForTurn && item.name === currentBidderName
                    ? 'bg-amber-950/60 border-amber-400 ring-1 ring-amber-400 animate-pulse'
                    : 'bg-slate-900/50 border-slate-800'
                }`}
              >
                <div className="text-xs text-slate-300 truncate font-semibold">{item.name}</div>
                <div className="text-sm sm:text-base font-bold text-amber-400 mt-0.5">
                  {item.bid !== null ? (
                    `${item.bid} ${item.bid === 1 ? 'mână' : 'mâini'}`
                  ) : isWaitingForTurn && item.name === currentBidderName ? (
                    <span className="text-xs text-amber-300">Alege...</span>
                  ) : (
                    '...'
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Waiting prompt if not user's turn */}
        {isWaitingForTurn && !userHasBid && (
          <div className="flex items-center justify-center gap-2 bg-amber-950/40 border border-amber-500/40 rounded-xl p-2.5 mb-3 text-xs text-amber-300 text-center animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>
              <strong>{currentBidderName}</strong> licitează acum. Când termină, vei putea alege numărul tău!
            </span>
          </div>
        )}

        {/* User has already bid waiting prompt */}
        {userHasBid && (
          <div className="flex items-center justify-center gap-2 bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-2.5 mb-3 text-xs text-emerald-300 text-center">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Licitația ta a fost înregistrată. Se așteaptă finalizarea rundei de licitație...</span>
          </div>
        )}

        {/* Dealer constraint warning */}
        {isUserDealer && forbiddenBid !== null && !isWaitingForTurn && !userHasBid && (
          <div className="flex items-start gap-2 bg-red-950/50 border border-red-500/50 rounded-xl p-2.5 mb-4 text-xs text-red-200 shadow-md">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-red-300">Regula Whist (Ești Dealer):</span> Suma licitațiilor
              nu are voie să fie egală cu numărul de cărți ({cardCount}). Opțiunea{' '}
              <span className="font-bold underline text-white text-sm bg-red-900/60 px-1.5 py-0.5 rounded">
                {forbiddenBid}
              </span>{' '}
              este interzisă!
            </div>
          </div>
        )}

        {/* Buttons grid */}
        <div className="relative">
          <div
            className={`flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-2 transition-opacity ${
              isWaitingForTurn || userHasBid ? 'opacity-40 pointer-events-none' : ''
            }`}
          >
            {options.map((val) => {
              const isForbidden = val === forbiddenBid && !isWaitingForTurn;
              const isSelected = userHasBid && userPlacedBid === val;
              return (
                <button
                  key={val}
                  type="button"
                  disabled={isForbidden || isWaitingForTurn || userHasBid}
                  onClick={() => handleBidClick(val)}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl font-cinzel text-lg sm:text-xl font-bold flex flex-col items-center justify-center transition-all duration-150 relative ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-300 shadow-lg'
                      : isForbidden
                      ? 'bg-slate-900/60 text-slate-600 border border-red-900/40 cursor-not-allowed line-through opacity-40'
                      : 'bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-95 text-slate-950 shadow-lg shadow-amber-950/50 cursor-pointer border border-amber-300'
                  }`}
                >
                  <span>{val}</span>
                  {isForbidden && (
                    <span className="text-[9px] text-red-400 font-sans font-semibold absolute -bottom-1">
                      Interzis
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-400 mt-2">
          {isUserDealer ? 'Tu ești Dealerul acestei runde' : `Dealer: ${dealerName}`}
        </div>
      </div>
    </div>
  );
};
