# Plan de Implementare: Multiplayer în Timp Real prin Firebase Firestore (Optimizat pentru Vercel)

Acest plan rezolvă eroarea de conexiune la server întâmpinată pe Vercel prin migrarea de la un server local Node.js/WebSocket (incompatibil cu arhitectura serverless Vercel) la **Firebase Firestore în timp real**.

---

## 1. De ce apare „eroare de conexiune la server” pe Vercel?
- **Arhitectura Vercel**: Vercel găzduiește aplicațiile Vite/React ca fișiere statice sau funcții Serverless efemere.
- **Limitare**: Un proces continuu de tip `node server.ts` cu conexiuni persistente `WebSocket` (`/ws`) și stocare în memorie sau fișiere locale (`/tmp`) **nu poate rula pe Vercel**.
- **Soluția**: Folosirea **Firebase Firestore** direct din browser cu listeneri în timp real (`onSnapshot`). Nu mai este nevoie de niciun server extern; jocul rulează direct pe Vercel pe orice telefon, tabletă sau PC de pe internet.

---

## 2. Arhitectura de Date în Firestore

### Colecția `rooms/{roomId}`
Fiecare masă de joc este un document în Firestore:
- `roomId`: Codul unic (ex: `WHIST-7879`).
- `roomName`: Numele mesei (ex: `Masa Prietenilor`).
- `hasPassword`: Boolean (opțional dacă e protejată cu parolă).
- `password`: Parola hash/text (opțională).
- `hostId`: ID-ul utilizatorului care a creat masa.
- `maxPlayers`: Numărul de locuri (3–6 jucători).
- `status`: `'lobby' | 'playing' | 'round_recap' | 'game_over'`.
- `players`: Listă cu jucătorii de la masă (`id`, `name`, `avatar`, `isAi`, `seatIndex`, `isReady`, `score`, `bid`, `tricksWon`).
- `phase`: Faza curentă (`'dealing' | 'inspecting' | 'bidding' | 'playing' | 'trick_eval' | 'round_recap'`).
- `currentTurn`: Indexul locului jucătorului la rând.
- `currentRoundIdx`: Indexul rundei curente.
- `trumpCard` & `trumpSuit`: Cartea și culoarea de atu.
- `currentTrick`: Cărțile jucate în cupa curentă.
- `winningCardId` & `trickWinnerBanner`: Datele evaluării cupei.
- `history`: Istoricul punctajelor pentru foaia de scor.
- `updatedAt`: Timestamp pentru sortare și curățare automată a camerelor vechi.

### Securitatea Cărților din Mână (Private Hands)
- Cărțile din mâna fiecărui jucător sunt stocate fie criptate/private în subcolecția `rooms/{roomId}/hands/{seatIndex}` sau structurate astfel încât ceilalți jucători să nu poată vedea cărțile oponenților în consolă.

---

## 3. Sincronizare în Timp Real (`multiplayerService`)
- Înlocuirea `fetch('/api/rooms/...')` și `new WebSocket(...)` cu:
  - `onSnapshot(doc(db, 'rooms', roomId), ...)`: Notifică instantaneu interfața React la fiecare mutare (licitație, carte jucată, jucător adăugat, start joc).
  - `onSnapshot(query(collection(db, 'rooms'), where('status', '==', 'lobby'), limit(25)), ...)`: Actualizează automat lista de mese disponibile în tab-ul „Camere Active”.
- **Automatizare AI de către Gazdă (Host)**: Când este rândul unui robot AI (`player.isAi === true`), clientul gazdă evaluează cartea/licitația conform regulamentului oficial Whist și actualizează documentul Firestore, sincronizând toți jucătorii simultan.

---

## 4. Etape de Execuție

1. **Inițiere Firebase Setup**:
   - Deschidere flux interactiv de acord Firebase în AI Studio.
   - Verificare termeni și provizionare automată a instanței Firestore.
2. **Generare Reguli de Securitate (`firestore.rules`)**:
   - Permisiuni de citire/scriere pentru camerele active și desfășurarea jocului de Whist.
   - Implementare `DeployRules` pentru activarea regulilor în cloud.
3. **Refactorizare `src/utils/multiplayer.ts`**:
   - Integrare Firebase SDK (`firebase/firestore`).
   - Implementare `createRoom`, `joinRoom`, `findAndJoinRoom`, `addAi`, `toggleReady`, `startRoomGame`, `placeBid`, `playCard`, `nextRound`, `leaveRoom`.
   - Păstrare fallback local pentru deconectări accidentale de rețea.
4. **Actualizare UI `MultiplayerLobbyModal.tsx`**:
   - Căutare și alăturare instantanee după cod (`WHIST-XXXX`).
   - Afișare stare conexiune cloud și listă de mese active sincronizate în timp real.
5. **Verificare și Build Static pentru Vercel**:
   - Validare cu `lint_applet` și `compile_applet`.
   - Testare creare masă, intrare cu cod de pe alt dispozitiv și joc complet de Whist.
