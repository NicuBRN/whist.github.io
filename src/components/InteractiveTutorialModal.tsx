import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, HelpCircle, Sparkles } from 'lucide-react';
import { Card, Suit, SUIT_NAMES_RO, SUIT_SYMBOLS } from '../game/rules.ts';
import { PlayingCard } from './PlayingCard.tsx';
import { sounds } from '../utils/audio.ts';

interface InteractiveTutorialModalProps {
  onClose: () => void;
}

export const InteractiveTutorialModal: React.FC<InteractiveTutorialModalProps> = ({ onClose }) => {
  const [step, setStep] = useState<number>(1);
  const totalSteps = 6;

  // Step 3 interactive state (Bidding)
  const [testBid, setTestBid] = useState<number | null>(null);
  const [bidFeedback, setBidFeedback] = useState<string>('');

  // Step 4 interactive state (Must follow suit puzzle)
  const [puzzlePlayedCard, setPuzzlePlayedCard] = useState<string | null>(null);
  const [puzzleFeedback, setPuzzleFeedback] = useState<string>('');
  const [puzzleSolved, setPuzzleSolved] = useState<boolean>(false);

  // Step 6 interactive state (Score calculator)
  const [calcBid, setCalcBid] = useState<number>(2);
  const [calcTricks, setCalcTricks] = useState<number>(2);

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
      sounds.playDeal();
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Step 3 action
  const handleTryBid = (val: number) => {
    // In our scenario: Total cards = 3. Other bids: 1, 0, 1 (Sum = 2).
    // Dealer is user! Forbidden bid is 3 - 2 = 1.
    if (val === 1) {
      sounds.playForbidden();
      setTestBid(1);
      setBidFeedback('❌ INTERZIS! Suma ar fi 1 + 0 + 1 + 1 = 3 (egal cu numărul de cărți). Dealerul nu are voie să aleagă 1!');
    } else {
      sounds.playBid();
      setTestBid(val);
      setBidFeedback(`✅ CORECT! Ai licitat ${val}. Suma totală a licitațiilor este diferită de 3, respectând regula oficială de Whist.`);
    }
  };

  // Step 4 puzzle cards
  const puzzleLeadCard: Card = { id: 'p-lead', suit: 'HEARTS', rank: 9 };
  const puzzleHand: Card[] = [
    { id: 'p-h1', suit: 'HEARTS', rank: 11 },   // Valet de cupă (LEGAL)
    { id: 'p-h2', suit: 'SPADES', rank: 14 },   // As de pică / Atu (ILEGAL - are cupă)
    { id: 'p-h3', suit: 'CLUBS', rank: 8 },     // 8 de treflă (ILEGAL - are cupă)
  ];

  const handlePuzzleCardClick = (card: Card) => {
    if (card.suit === 'HEARTS') {
      sounds.playTrickWin();
      setPuzzlePlayedCard(card.id);
      setPuzzleSolved(true);
      setPuzzleFeedback('🎉 Excelent! Ai servit culoarea cerută (Cupă ♥). Aceasta este singura mutare legală când ai carte de acea culoare!');
    } else {
      sounds.playForbidden();
      setPuzzlePlayedCard(card.id);
      setPuzzleSolved(false);
      setPuzzleFeedback('⚠️ Ilegal! Adversarul a jucat Cupă ♥, iar tu ai Valetul de Cupă în mână. La Whist ești OBLIGAT să dai la culoare dacă o deții!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 border-2 border-amber-500/70 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-emerald-800/60 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg sm:text-xl font-bold font-cinzel text-amber-400">
              Tutorial Interactiv: Cum se joacă Whist Românesc
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide tutorial"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Pills */}
        <div className="px-5 py-2.5 bg-slate-950/50 border-b border-emerald-900/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setStep(idx)}
                className={`w-7 h-7 rounded-full font-bold flex items-center justify-center transition-all cursor-pointer ${
                  step === idx
                    ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                    : idx < step
                    ? 'bg-emerald-800/70 text-emerald-200'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {idx}
              </button>
            ))}
          </div>
          <span className="font-semibold text-slate-400 text-xs">
            Pasul {step} din {totalSteps}
          </span>
        </div>

        {/* Step Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* PASUL 1: Împărțirea & Structura */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-300 font-cinzel font-bold text-base">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-400 flex items-center justify-center text-xs">1</span>
                Împărțirea Cărților & Schema Rundelor (1-8-1)
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Whistul românesc se joacă în <strong>3 până la 6 jucători</strong> independenți (fără partener). Fiecare jucător aduce în joc exact <strong>8 cărți</strong> din pachet (24 cărți la 3 jucători, 32 la 4, 40 la 5 și 48 la 6). Jocul urmează schema clasică 1-8-1:
              </p>

              <div className="bg-slate-950/70 border border-emerald-900/60 rounded-xl p-3 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-300 border-b border-slate-800 pb-2">
                  <span className="font-bold text-amber-300">1. Debut (N runde):</span>
                  <span>Câte <strong>1 carte</strong> (fiecare jucător e dealer o dată: 3..6 runde)</span>
                </div>
                <div className="flex items-center justify-between text-slate-300 border-b border-slate-800 pb-2">
                  <span className="font-bold text-amber-300">2. Urcare (6 runde):</span>
                  <span>Runde crescătoare: <strong>2, 3, 4, 5, 6, 7 cărți</strong></span>
                </div>
                <div className="flex items-center justify-between text-slate-300 border-b border-slate-800 pb-2">
                  <span className="font-bold text-amber-300">3. Vârf (N runde):</span>
                  <span>Runde de <strong>8 cărți</strong> (toate cărțile distribuite, fără atu)</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-bold text-amber-300">4. Coborâre:</span>
                  <span>Runde de la <strong>7 până la 2</strong>, apoi <strong>N runde finale de 1 carte</strong></span>
                </div>
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-200">
                💡 <strong>Important:</strong> Obiectivul tău nu este să iei cât mai multe cărți, ci să ghicești cu precizie matematică exact câte vei lua!
              </div>
            </div>
          )}

          {/* PASUL 2: Stabilirea Atuului */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-300 font-cinzel font-bold text-base">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-400 flex items-center justify-center text-xs">2</span>
                Stabilirea Atuului (Cartea Mesei este Scoasă din Joc)
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                După împărțirea cărților jucătorilor, următoarea carte din pachet este întoarsă cu fața în sus pe masă. Culoarea acesteia devine <strong>ATUUL</strong> rundei respective.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 bg-slate-950/70 border border-emerald-900/60 rounded-2xl">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold text-amber-400 mb-1">Cartea de Atu a Mesei</span>
                  <PlayingCard card={{ id: 'trump-demo', suit: 'SPADES', rank: 14 }} size="md" className="ring-2 ring-amber-400" />
                  <span className="text-xs font-bold text-amber-300 mt-1">Pică ♠ (Atu)</span>
                </div>
                <div className="text-xs text-slate-300 max-w-xs space-y-1.5">
                  <p className="font-bold text-amber-200">🛡️ Carte scoasă din joc:</p>
                  <p>Această carte fizică (Asul de Pică din exemplu) aparține mesei și <strong>nu se află în mâna niciunui jucător</strong>.</p>
                  <p className="text-sky-300 mt-1">📌 În rundele de 8 cărți (sau 13 cărți), unde toate cărțile sunt împărțite, se joacă <strong>FĂRĂ ATU</strong>.</p>
                </div>
              </div>
            </div>
          )}

          {/* PASUL 3: Licitația & Dealerul */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-300 font-cinzel font-bold text-base">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-400 flex items-center justify-center text-xs">3</span>
                Licitația & Regula de Aur a Dealerului
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Fiecare jucător declară câte mâini (cupe) crede că va câștiga (între 0 și numărul de cărți din rundă). Ultimul la licitație este întotdeauna <strong>Dealerul</strong>.
              </p>

              {/* Interactive Bidding Sandbox */}
              <div className="p-4 bg-slate-950/80 border-2 border-amber-500/50 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-amber-300 text-center">
                  🎮 Încearcă tu! Se joacă o rundă de 3 cărți. Tu ești Dealerul (ultimul).
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-900 rounded-lg">Radu: <strong>1</strong></div>
                  <div className="p-2 bg-slate-900 rounded-lg">Elena: <strong>0</strong></div>
                  <div className="p-2 bg-slate-900 rounded-lg">Mihai: <strong>1</strong></div>
                </div>
                <div className="text-center text-xs text-slate-400 font-mono">
                  Suma altor jucători = 1 + 0 + 1 = <strong>2</strong>
                </div>

                <div className="text-center">
                  <div className="text-xs font-semibold text-slate-300 mb-2">Alege licitația ta:</div>
                  <div className="flex justify-center gap-2">
                    {[0, 1, 2, 3].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleTryBid(val)}
                        className={`w-11 h-11 rounded-xl font-bold font-cinzel text-base cursor-pointer transition-all ${
                          testBid === val
                            ? val === 1
                              ? 'bg-red-600 text-white ring-2 ring-red-400'
                              : 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300'
                            : val === 1
                            ? 'bg-slate-800 text-red-400 line-through border border-red-500/40 hover:bg-slate-700'
                            : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {bidFeedback && (
                  <div className={`p-2.5 rounded-xl text-xs ${testBid === 1 ? 'bg-red-950/60 text-red-200 border border-red-500/40' : 'bg-emerald-950/60 text-emerald-200 border border-emerald-500/40'}`}>
                    {bidFeedback}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PASUL 4: Obligația Culorii (Puzzle) */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-300 font-cinzel font-bold text-base">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-400 flex items-center justify-center text-xs">4</span>
                Cum se joacă o Cupă: Obligația Culorii
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Prima carte jucată dictează <strong>culoarea de atac</strong>. Dacă ai în mână cel puțin o carte de acea culoare, <strong>ești OBLIGAT să o joci</strong>!
              </p>

              {/* Mini Puzzle */}
              <div className="p-4 bg-slate-950/80 border-2 border-amber-500/50 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-amber-300 text-center">
                  🎮 Puzzle: Adversarul a atacat cu Cupă ♥. Ce carte ai voie să joci?
                </div>

                <div className="flex justify-center items-center gap-6 my-2">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block mb-1">Cartea de atac:</span>
                    <PlayingCard card={puzzleLeadCard} size="sm" />
                  </div>
                  <span className="text-xl font-bold text-amber-400">➡️</span>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block mb-1">Cărțile tale (Apasă una):</span>
                    <div className="flex gap-2">
                      {puzzleHand.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handlePuzzleCardClick(c)}
                          className="cursor-pointer transition-transform hover:-translate-y-1"
                        >
                          <PlayingCard card={c} size="sm" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {puzzleFeedback && (
                  <div className={`p-2.5 rounded-xl text-xs ${puzzleSolved ? 'bg-emerald-950/60 text-emerald-200 border border-emerald-500/40' : 'bg-rose-950/60 text-rose-200 border border-rose-500/40'}`}>
                    {puzzleFeedback}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PASUL 5: Tăierea cu Atu & Câștigarea Cupei */}
          {step === 5 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-300 font-cinzel font-bold text-base">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-400 flex items-center justify-center text-xs">5</span>
                Tăierea cu Atu & Câștigarea Cupei
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Dacă <strong>NU ai culoarea cerută</strong>, ești <strong>OBLIGAT să tai cu Atu</strong> (dacă deții vreun atu în mână). Doar dacă nu ai nici culoare nici atu poți arunca orice carte.
              </p>

              <div className="bg-slate-950/70 border border-emerald-900/60 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="font-bold text-amber-300">Cine câștigă cupa?</div>
                <ul className="list-disc list-inside space-y-1 text-slate-300 ml-1">
                  <li><strong>Dacă s-au jucat atuuri:</strong> Cel mai mare atu jucat câștigă cupa (chiar dacă este un 7 de atu, bate orice As de altă culoare!).</li>
                  <li><strong>Dacă nu s-a jucat niciun atu:</strong> Câștigă cea mai mare carte din culoarea primului atac (7, 8, 9, 10, J, Q, K, A).</li>
                  <li>Câștigătorul cupei începe următoarea mână!</li>
                </ul>
              </div>
            </div>
          )}

          {/* PASUL 6: Calculul Punctajului */}
          {step === 6 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-300 font-cinzel font-bold text-base">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-400 flex items-center justify-center text-xs">6</span>
                Calculul Punctajului Oficial (+5+F sau -Diferență)
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                După fiecare rundă, scorul se calculează în funcție de precizia licitației:
              </p>

              {/* Interactive Score Sandbox */}
              <div className="p-4 bg-slate-950/80 border-2 border-amber-500/50 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-amber-300 text-center">
                  🎮 Simulator de Punctaj: Testează diverse combinații
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Cât ai licitat (L):</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[0, 1, 2, 3, 4].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setCalcBid(v)}
                          className={`w-8 h-8 rounded-lg font-bold text-xs cursor-pointer ${calcBid === v ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-300' : 'bg-slate-800 text-slate-300'}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Câte mâini ai făcut (F):</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[0, 1, 2, 3, 4].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setCalcTricks(v)}
                          className={`w-8 h-8 rounded-lg font-bold text-xs cursor-pointer ${calcTricks === v ? 'bg-emerald-500 text-slate-950 font-black ring-2 ring-emerald-300' : 'bg-slate-800 text-slate-300'}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Result calculation display */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-300">
                      {calcBid === calcTricks ? '🎉 Licitație Reușită!' : '❌ Licitație Ratată!'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {calcBid === calcTricks ? `Formulă: +5 + ${calcTricks} mâini făcute` : `Formulă: -|${calcBid} - ${calcTricks}| diferență`}
                    </div>
                  </div>
                  <div className={`text-xl font-bold font-cinzel ${calcBid === calcTricks ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {calcBid === calcTricks ? `+${5 + calcTricks} pct` : `-${Math.abs(calcBid - calcTricks)} pct`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-emerald-900/60 bg-slate-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrev}
            disabled={step === 1}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              step === 1 ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Înapoi</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-950/50 transition-all active:scale-95"
          >
            <span>{step === totalSteps ? 'Finalizează Tutorialul' : 'Următorul Pas'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
