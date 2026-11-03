# Plan de Implementare: Cronometru 5 Secunde Licitație & Layout Aerisit și Predictiv

Acest plan rezolvă încărcarea vizuală a interfeței, optimizează experiența pentru telefon, tabletă și desktop, și introduce numărătoarea inversă de 5 secunde înainte de licitație cu opțiune de acțiune imediată sau pauză.

---

## 1. Cronometru de 5 Secunde la Licitație
- **Numărătoare Inversă Activă în Faza `'inspecting'`**:
  - După împărțirea cărților, se inițiază un cronometru de 5 secunde (`5 → 4 → 3 → 2 → 1 → 0`).
  - Butonul principal afișează dinamic: **„Sunt gata de licitație (X s)”** împreună cu un inel sau o bară de progres auriu-smarald.
  - Utilizatorul poate apăsa butonul oricând pentru a începe instantaneu licitația fără să aștepte.
  - **Opțiune de Pauză**: Un buton discret de pauză (⏸) permițând utilizatorului să oprească timpul dacă dorește o analiză mai îndelungată a cărților.
  - La atingerea valorii 0, jocul pornește automat faza de licitație (`handleStartBidding`).
  - Gestiune corectă a timerului în `useEffect` cu curățare la unmount sau la schimbarea fazei.

---

## 2. Simplificare și Aerisire Layout (Desktop, Tabletă, Mobil)
- **Bara Superioară (HUD) Ordonată și Neîncărcată**:
  - În loc de 7 butoane aglomerate pe ecranul mobil, grupăm interfața în:
    - **Informații esențiale (stânga)**: Runda curentă și insigna de Atu clară.
    - **Acțiuni primare (dreapta)**: Butonul rapid **„Scor”** (Trophy) și butonul **„Meniu”** (Dropdown / Drawer cu 3 linii / ⚙️).
  - **Meniu Derulant Secundar Compact**:
    - Centralizează accesul rapid la: *Colecția de Jokeri & Teme*, *Statistici & Realizări*, *Tutorial Interactiv*, *Regulament Oficial*, *Activare/Dezactivare Sunet* și *Joc Nou*.
    - Eliberează complet spațiul vertical și orizontal pe telefoane și tablete.
- **Poziționare Predictivă a Adversarilor AI**:
  - Distribuție echilibrată a adversarilor în partea superioară a mesei într-o formă aerisită, cu carduri unificate (avatar, nume, licitație și cupe câștigate).
  - Dimensiuni compactate pentru a nu sufoca spațiul central de joc.
- **Suprafața Centrală pentru Cupe**:
  - Centru oval/rotund stabil, redimensionat proporțional pe mobil (`max-w-[260px]` pe ecran îngust) pentru a nu intersecta mâna jucătorului.
  - Cărțile jucate în cupă sunt poziționate predictiv în funcție de direcția jucătorului care le-a pus.

---

## 3. Dispunere Ergonomică a Cărților din Mână pe Telefon
- **Rând Orizontal cu Derulare Fină**:
  - Cărțile jucătorului stau într-un rând orizontal cu `overflow-x-auto` și `hide-scrollbar`, centrate automat dacă încap toate pe ecran (runde mici) și scrollabile fluid prin atingere dacă runda are multe cărți (runde de 8).
  - Spațiere optimă (fără suprapunere excesivă care să ascundă simbolul culorii sau numărul cărții).
  - Feedback tactil imediat la atingere: ridicare vizuală (`-translate-y-3`) și strălucire aurie pentru cărțile legale de jucat.
- **Bara de Status a Jucătorului**:
  - Amplasată discret deasupra cărților: scor total, licitație curentă, cupe câștigate și indicator dacă utilizatorul este Dealer.

---

## 4. Etape de Implementare și Verificare
1. **Adăugare State Cronometru & Curățare**:
   - `countdown`, `isPaused`, `useEffect` cu `setInterval` în `src/App.tsx`.
2. **Creare Componentă `HeaderMenuDropdown.tsx` sau Meniu Compact Integrat**:
   - Meniu derulant mobil/desktop pentru acțiunile secundare.
3. **Refactorizare Layout Masă & Mână în `src/App.tsx` & `src/index.css`**:
   - Ajustare proporții responsive, eliminare elemente redundante, spațiere curată.
4. **Verificare și Validare**:
   - Rulare `npx tsx --test src/game/rules.test.ts` (asigurare că regulile rămân intacte).
   - Rulare `lint_applet` și `compile_applet`.
