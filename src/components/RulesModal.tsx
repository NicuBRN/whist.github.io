import React from 'react';
import { X, BookOpen, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

interface RulesModalProps {
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 border border-amber-500/50 rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-emerald-800/60 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg sm:text-xl font-bold font-cinzel text-amber-400">
              Regulament Whist Românesc
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide regulament"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <section className="bg-slate-950/60 border border-emerald-900/60 rounded-xl p-4">
            <h3 className="text-amber-300 font-bold font-cinzel text-sm sm:text-base mb-1.5 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" /> Obiectivul Jocului
            </h3>
            <p>
              Whistul românesc este un joc individual de levate (mâini / cupe). Spre deosebire de alte jocuri unde vrei să iei cât mai multe cărți, la Whist scopul principal este să faci <strong>EXACT numărul de mâini pe care le-ai licitat</strong> la începutul fiecărei runde. Niciuna în plus, niciuna în minus!
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-amber-300 font-bold font-cinzel text-sm sm:text-base">
              Structura Rundelor (Formatul 1-8-1)
            </h3>
            <p>
              Whistul românesc se joacă în <strong>3 până la 6 jucători</strong>. Din pachetul standard se folosesc exact <strong>8 cărți pentru fiecare jucător</strong> (24 cărți la 3 jucători, 32 la 4, 40 la 5 și 48 la 6). Meciul are 3N + 12 runde (21 la 3 jucători, 24 la 4 jucători, 27 la 5 jucători, 30 la 6 jucători):
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 ml-1">
              <li><strong>N runde de 1 carte</strong> (fiecare jucător este împărțitor / dealer o dată)</li>
              <li>6 runde crescătoare: <strong>2, 3, 4, 5, 6, 7 cărți</strong></li>
              <li><strong>N runde de 8 cărți</strong> (toate cărțile sunt distribuite jucătorilor, se joacă <em>fără atu</em>)</li>
              <li>6 runde descrescătoare: <strong>7, 6, 5, 4, 3, 2 cărți</strong></li>
              <li><strong>N runde finale de 1 carte</strong></li>
            </ul>
          </section>

          <section className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4">
            <h3 className="text-amber-400 font-bold font-cinzel text-sm sm:text-base mb-1.5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Regula de Aur a Licitației (Dealerul)
            </h3>
            <p>
              Licitația începe de la jucătorul din stânga dealerului și continuă în sens orar. Ultimul jucător la licitație este întotdeauna <strong>dealerul</strong>.
            </p>
            <p className="mt-2 text-amber-200">
              <strong>Interdicție:</strong> Suma tuturor licitațiilor jucătorilor <em>nu are voie să fie egală</em> cu numărul de cărți din acea rundă! Prin urmare, dealerul are un număr interzis pe care nu-l poate alege, asigurând că cel puțin un jucător va greși licitația.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-amber-300 font-bold font-cinzel text-sm sm:text-base">
              Regulile de Joc ale Cărților
            </h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Obligația culorii:</strong> Ești obligat să dai la culoarea primei cărți jucate în cupă, dacă ai această culoare în mână.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Obligația tăierii cu atu:</strong> Dacă nu ai culoarea cerută, ești <em>obligat să tai cu atu</em> (dacă deții atuuri).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Aruncarea:</strong> Doar dacă nu ai nici culoarea cerută și niciun atu, poți arunca orice altă carte din mână.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Câștigarea cupei:</strong> Cupa este câștigată de cel mai mare atu jucat. Dacă nu s-a jucat niciun atu, câștigă cea mai mare carte din culoarea de atac (2..10, J, Q, K, A).</span>
              </li>
            </ul>
          </section>

          <section className="bg-slate-950/60 border border-emerald-900/60 rounded-xl p-4 space-y-2">
            <h3 className="text-amber-300 font-bold font-cinzel text-sm sm:text-base">
              Calculul Punctajului Oficial
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-2.5">
                <div className="font-bold text-emerald-300 mb-1">Dacă ai făcut exact licitația:</div>
                <div className="text-emerald-100 font-mono text-sm">+5 puncte + Mâini Făcute</div>
                <div className="text-slate-400 mt-1">Ex: Licitezi 0 și faci 0 = +5 pct. Licitezi 3 și faci 3 = +8 pct.</div>
              </div>
              <div className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-2.5">
                <div className="font-bold text-rose-300 mb-1">Dacă ai greșit licitația:</div>
                <div className="text-rose-100 font-mono text-sm">-1 pct × Diferența absolută</div>
                <div className="text-slate-400 mt-1">Ex: Licitezi 2 și faci 0 = -2 pct. Licitezi 1 și faci 3 = -2 pct.</div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-emerald-900/60 bg-slate-950/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-lg shadow-amber-950/50 transition-all"
          >
            Am înțeles, la joc!
          </button>
        </div>
      </div>
    </div>
  );
};
