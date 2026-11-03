/**
 * Generates and downloads a complete standalone single-file HTML version of Romanian Whist
 * with zero dependencies, CSS and JavaScript fully bundled inline, playable on Android, iOS and Desktop offline.
 */

export function downloadStandaloneHtml() {
  const htmlContent = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Whist Românesc - Standalone</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #032014; color: #f1f5f9; display: flex; flex-direction: column; height: 100vh; width: 100vw; overflow: hidden; }
    .felt-table { background: radial-gradient(ellipse at 50% 45%, #0f683e 0%, #084929 55%, #022013 100%); box-shadow: inset 0 0 100px rgba(0,0,0,0.8); flex: 1; position: relative; display: flex; flex-direction: column; justify-content: space-between; padding: 10px; }
    .hud { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; background: rgba(2, 26, 16, 0.95); border-bottom: 1px solid rgba(245, 158, 11, 0.3); z-index: 20; }
    .badge { background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(245, 158, 11, 0.4); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; box-shadow: 0 2px 5px rgba(0,0,0,0.4); }
    .btn { background: #f59e0b; color: #0f172a; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer; transition: 0.15s; }
    .btn:hover { background: #fbbf24; }
    .btn-secondary { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; }
    .btn-secondary:hover { background: #334155; color: white; }
    .card { width: 50px; height: 76px; border-radius: 8px; background: white; color: #000; display: inline-flex; flex-direction: column; justify-content: space-between; padding: 4px; font-weight: 800; font-size: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); cursor: pointer; transition: transform 0.18s, box-shadow 0.18s; position: relative; border: 1px solid #cbd5e1; flex-shrink: 0; }
    .card.red { color: #dc2626; }
    .card.black { color: #000000; }
    .card-sym { font-size: 15px; font-weight: 900; line-height: 1; }
    .card-center-sym { font-size: 26px; line-height: 1; }
    .card.playable { border: 2px solid #f59e0b; box-shadow: 0 0 16px #f59e0b; transform: translateY(-4px); }
    .card.playable:hover { transform: translateY(-10px) scale(1.05); }
    .card.back { background: linear-gradient(135deg, #064e3b, #022c22); border: 1px solid #d97706; display: flex; align-items: center; justify-content: center; color: #f59e0b; font-size: 11px; }
    .center-table { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 220px; height: 220px; border-radius: 50%; border: 2px solid rgba(245, 158, 11, 0.4); display: flex; align-items: center; justify-content: center; background: rgba(3, 39, 21, 0.45); box-shadow: inset 0 0 40px rgba(0,0,0,0.7); }
    .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 12px; }
    .modal-box { background: linear-gradient(180deg, #0f172a 0%, #064e3b 100%); border: 2px solid #f59e0b; padding: 20px; border-radius: 16px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
    .score-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
    .score-table th, .score-table td { border: 1px solid #334155; padding: 4px; text-align: center; }
    .score-table th { background: rgba(0,0,0,0.5); color: #f59e0b; }
    @media (min-width: 640px) {
      .card { width: 64px; height: 92px; font-size: 15px; border-radius: 10px; padding: 6px; }
      .center-table { width: 300px; height: 300px; }
    }
  </style>
</head>
<body>
  <div class="hud">
    <div style="font-weight: 900; color: #f59e0b; font-size: 15px; letter-spacing: 0.5px;">WHIST ROMÂNESC</div>
    <div id="hudRound" class="badge">Runda 1/24 (1 c.)</div>
    <div id="hudTrump" class="badge" style="color: #fcd34d;">Atu: -</div>
    <div style="display: flex; gap: 6px;">
      <button class="btn btn-secondary" onclick="openScoreSheet()">Scor</button>
      <button class="btn btn-secondary" onclick="openRules()">Reguli</button>
      <button class="btn" onclick="newGame()">Joc Nou</button>
    </div>
  </div>

  <div class="felt-table" id="table">
    <div style="text-align: center;">
      <div class="badge" id="playerNorth">🦉 Elena (AI) | Lic: - | F: 0 | 0 pct</div>
      <div id="handNorth" style="display: flex; justify-content: center; gap: 4px; margin-top: 4px;"></div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; position: relative;">
      <div style="text-align: center; max-width: 120px;">
        <div class="badge" id="playerWest">🦊 Radu (AI)<br>Lic: - | F: 0<br>0 pct</div>
        <div id="handWest" style="margin-top: 4px;"></div>
      </div>

      <div class="center-table" id="centerArea">
        <div id="trickNorth" style="position: absolute; top: 12px;"></div>
        <div id="trickWest" style="position: absolute; left: 16px;"></div>
        <div id="trickEast" style="position: absolute; right: 16px;"></div>
        <div id="trickSouth" style="position: absolute; bottom: 12px;"></div>
        <div id="centerMsg" style="font-size: 12px; color: #fcd34d; text-align: center; padding: 8px;"></div>
      </div>

      <div style="text-align: center; max-width: 120px;">
        <div class="badge" id="playerEast">🐻 Mihai (AI)<br>Lic: - | F: 0<br>0 pct</div>
        <div id="handEast" style="margin-top: 4px;"></div>
      </div>
    </div>

    <div style="text-align: center;">
      <div class="badge" id="playerSouth" style="border-color: #f59e0b; background: rgba(15, 23, 42, 0.9);">
        😎 Tu | Lic: - | F: 0 | 0 pct
      </div>
      <div id="inspectBar" style="margin: 6px auto; padding: 6px 14px; background: rgba(15, 23, 42, 0.95); border: 2px solid #f59e0b; border-radius: 14px; display: none; align-items: center; justify-content: space-between; max-width: 420px; gap: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.6);">
        <span style="font-size: 11px; color: #fcd34d; font-weight: 600;" id="inspectTimerMsg">Analiză cărți (începe în 5s)</span>
        <button class="btn" onclick="startBiddingPhase()" id="inspectBtn">Sunt gata (5s)</button>
      </div>
      <div id="handSouth" style="display: flex; justify-content: center; margin-top: 6px; flex-wrap: wrap; gap: 6px;"></div>
      <div id="hintMsg" style="font-size: 11px; color: #fcd34d; margin-top: 4px;">Apasă pe o carte cu contur auriu pentru a juca.</div>
    </div>
  </div>

  <div id="recapModal" class="modal" style="display: none;">
    <div class="modal-box">
      <div style="font-size: 11px; font-weight: bold; color: #f59e0b; text-transform: uppercase;">Recapitulare Rundă</div>
      <h3 id="recapTitle" style="color: #fcd34d; margin: 4px 0 12px;">Sfârșit de Rundă</h3>
      <div id="recapBody" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; text-align: left; font-size: 12px;"></div>
      <div style="display: flex; gap: 8px; justify-content: center;">
        <button class="btn btn-secondary" onclick="openScoreSheet()">Vezi Foaia de Scor</button>
        <button class="btn" onclick="nextRoundAfterRecap()">Treci la Runda Următoare</button>
      </div>
    </div>
  </div>

  <div id="biddingModal" class="modal" style="display: none;">
    <div class="modal-box">
      <div style="font-size: 11px; font-weight: bold; color: #f59e0b; text-transform: uppercase;">Licitație Whist</div>
      <h3 id="bidTitle" style="color: #fcd34d; margin: 4px 0 10px;">Câte mâini crezi că iei?</h3>
      <p id="bidSubtitle" style="font-size: 12px; color: #cbd5e1; margin-bottom: 8px;"></p>
      <div id="biddingCardsPreview" style="display: flex; justify-content: center; gap: 4px; margin-bottom: 12px; overflow-x: auto; padding: 4px;"></div>
      <div id="bidButtons" style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 10px;"></div>
      <p id="bidWarning" style="font-size: 11px; color: #f87171;"></p>
    </div>
  </div>

  <div id="scoreModal" class="modal" style="display: none;">
    <div class="modal-box" style="max-width: 550px; max-height: 80vh; overflow-y: auto;">
      <h3 style="color: #f59e0b; margin-bottom: 8px;">Foaia de Scor (Whist)</h3>
      <table class="score-table">
        <thead>
          <tr>
            <th>Rundă</th>
            <th>Atu</th>
            <th>Tu</th>
            <th>Radu</th>
            <th>Elena</th>
            <th>Mihai</th>
          </tr>
        </thead>
        <tbody id="scoreTableBody"></tbody>
      </table>
      <button class="btn" style="margin-top: 14px;" onclick="closeScoreSheet()">Închide</button>
    </div>
  </div>

  <div id="rulesModal" class="modal" style="display: none;">
    <div class="modal-box" style="max-width: 500px; text-align: left; font-size: 12px; max-height: 80vh; overflow-y: auto;">
      <h3 style="color: #f59e0b; margin-bottom: 10px; text-align: center;">Regulament Whist Românesc</h3>
      <p style="margin-bottom: 8px;"><strong>1. Obiectiv:</strong> Faci EXACT numărul de mâini pe care le-ai licitat la începutul rundei (+5 pct + făcute dacă ghicești; - diferența dacă ratezi).</p>
      <p style="margin-bottom: 8px;"><strong>2. Regula Dealerului:</strong> Suma tuturor licitațiilor NU poate fi egală cu numărul de cărți din rundă! Ultimul la licitație (dealerul) are o opțiune blocată.</p>
      <p style="margin-bottom: 8px;"><strong>3. Mersul Cărților:</strong> Ești OBLIGAT să dai la culoarea de atac. Dacă nu ai culoarea, ești OBLIGAT să tai cu atu. Doar dacă nu ai nici culoare nici atu poți arunca orice carte.</p>
      <p style="margin-bottom: 8px;"><strong>4. Punctaj:</strong> Ghicit exact = +5 pct + mâini făcute. Ratat = -1 pct per mână diferență.</p>
      <div style="text-align: center; margin-top: 12px;">
        <button class="btn" onclick="closeRules()">Am înțeles</button>
      </div>
    </div>
  </div>

  <script>
    const SUITS = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
    const SYMBOLS = { SPADES: '♠', HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣' };
    const RANKS = { 7:'7', 8:'8', 9:'9', 10:'10', 11:'J', 12:'Q', 13:'K', 14:'A' };
    let hands = [[], [], [], []], bids = [null, null, null, null], tricksWon = [0, 0, 0, 0], scores = [0, 0, 0, 0];
    let rounds = [], currentRoundIdx = 0, dealer = 0, turn = 1, currentTrick = [], trumpSuit = null, trumpCard = null;
    let history = [];

    function buildRounds() {
      const arr = [];
      for(let i=0; i<4; i++) arr.push(1);
      for(let i=2; i<=7; i++) arr.push(i);
      for(let i=0; i<4; i++) arr.push(8);
      for(let i=7; i>=2; i--) arr.push(i);
      for(let i=0; i<4; i++) arr.push(1);
      return arr;
    }

    function newGame() {
      rounds = buildRounds();
      currentRoundIdx = 0;
      dealer = 0;
      scores = [0, 0, 0, 0];
      history = [];
      startRound();
    }

    function startRound() {
      const cardCount = rounds[currentRoundIdx];
      let deck = [];
      SUITS.forEach(s => { for(let r=7; r<=14; r++) deck.push({ suit: s, rank: r, id: s+r }); });
      deck.sort(() => Math.random() - 0.5);

      // 1. Pop trump card FIRST so it is physically excluded from player hands
      trumpCard = (cardCount < 8 && deck.length > 0) ? deck.pop() : null;
      trumpSuit = trumpCard ? trumpCard.suit : null;

      // 2. Deal hands to players
      hands = [[], [], [], []];
      for(let c=0; c<cardCount; c++) {
        for(let p=0; p<4; p++) hands[p].push(deck.pop());
      }
      hands[0].sort((a,b) => a.suit === b.suit ? b.rank - a.rank : a.suit.localeCompare(b.suit));

      bids = [null, null, null, null];
      tricksWon = [0, 0, 0, 0];
      currentTrick = [];
      dealer = currentRoundIdx % 4;
      turn = (dealer + 1) % 4;

      document.getElementById('hudRound').innerText = 'Runda ' + (currentRoundIdx + 1) + '/24 (' + cardCount + ' c.)';
      document.getElementById('hudTrump').innerText = trumpSuit ? 'Atu: ' + SYMBOLS[trumpSuit] : 'Fără Atu';
      document.getElementById('centerMsg').innerText = 'Analizează cărțile! Licitația începe în 5s.';
      document.getElementById('inspectBar').style.display = 'flex';

      let inspectCountdown = 5;
      const inspectBtn = document.getElementById('inspectBtn');
      if (inspectBtn) inspectBtn.innerText = 'Sunt gata (' + inspectCountdown + 's)';
      if (window._inspectTimer) clearInterval(window._inspectTimer);
      window._inspectTimer = setInterval(() => {
        inspectCountdown--;
        if (inspectBtn) inspectBtn.innerText = 'Sunt gata (' + inspectCountdown + 's)';
        if (inspectCountdown <= 0) {
          clearInterval(window._inspectTimer);
          startBiddingPhase();
        }
      }, 1000);

      clearTrickDisplay();
      updatePlayerBadges();
      renderHands();
    }

    function startBiddingPhase() {
      if (window._inspectTimer) clearInterval(window._inspectTimer);
      document.getElementById('inspectBar').style.display = 'none';
      document.getElementById('centerMsg').innerText = 'Se licitează...';
      runBidding();
    }

    function runBidding() {
      if (bids.every(b => b !== null)) {
        turn = (dealer + 1) % 4;
        document.getElementById('centerMsg').innerText = 'Începe runda!';
        renderHands();
        if (turn !== 0) setTimeout(aiPlayTurn, 700);
        return;
      }
      if (turn === 0) {
        showBiddingModal();
      } else {
        const count = rounds[currentRoundIdx];
        const sumOther = bids.reduce((acc, b) => acc + (b !== null ? b : 0), 0);
        let bid = Math.round(Math.random() * count * 0.4);
        if (turn === dealer && bid === (count - sumOther)) {
          bid = (bid + 1) <= count ? bid + 1 : 0;
        }
        bids[turn] = bid;
        turn = (turn + 1) % 4;
        updatePlayerBadges();
        setTimeout(runBidding, 400);
      }
    }

    function showBiddingModal() {
      const modal = document.getElementById('biddingModal');
      const box = document.getElementById('bidButtons');
      const preview = document.getElementById('biddingCardsPreview');
      const warn = document.getElementById('bidWarning');
      const count = rounds[currentRoundIdx];
      const sumOther = bids.reduce((acc, b) => acc + (b !== null ? b : 0), 0);
      const forbidden = dealer === 0 ? count - sumOther : -1;

      document.getElementById('bidSubtitle').innerText = 'Se joacă ' + count + ' cărți. Atu: ' + (trumpSuit ? SYMBOLS[trumpSuit] : 'Fără');
      warn.innerText = (forbidden >= 0 && forbidden <= count) ? 'Regula Whist (Ești Dealer): Nu poți licita ' + forbidden + '!' : '';
      box.innerHTML = '';
      preview.innerHTML = '';

      hands[0].forEach(card => {
        const isRed = card.suit === 'HEARTS' || card.suit === 'DIAMONDS';
        const cEl = document.createElement('div');
        cEl.className = 'card ' + (isRed ? 'red' : '');
        cEl.style.width = '36px';
        cEl.style.height = '50px';
        cEl.style.fontSize = '10px';
        cEl.innerHTML = '<div>' + RANKS[card.rank] + ' ' + SYMBOLS[card.suit] + '</div><div style="font-size:14px; align-self:center;">' + SYMBOLS[card.suit] + '</div>';
        preview.appendChild(cEl);
      });

      for(let i=0; i<=count; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.innerText = i;
        if (i === forbidden) {
          btn.disabled = true;
          btn.style.opacity = '0.3';
          btn.style.cursor = 'not-allowed';
        } else {
          btn.onclick = () => {
            bids[0] = i;
            modal.style.display = 'none';
            turn = 1;
            updatePlayerBadges();
            runBidding();
          };
        }
        box.appendChild(btn);
      }
      modal.style.display = 'flex';
    }

    function getLegalCards(hand, trick) {
      if (trick.length === 0) return [...hand];
      const leadSuit = trick[0].card.suit;
      const sameSuit = hand.filter(c => c.suit === leadSuit);
      if (sameSuit.length > 0) return sameSuit;
      if (trumpSuit) {
        const trumps = hand.filter(c => c.suit === trumpSuit);
        if (trumps.length > 0) return trumps;
      }
      return [...hand];
    }

    function renderHands() {
      const south = document.getElementById('handSouth');
      south.innerHTML = '';
      const legal = (turn === 0) ? getLegalCards(hands[0], currentTrick) : [];

      hands[0].forEach((card) => {
        const isPlayable = turn === 0 && legal.some(l => l.id === card.id);
        const el = document.createElement('div');
        const isRed = card.suit === 'HEARTS' || card.suit === 'DIAMONDS';
        el.className = 'card ' + (isRed ? 'red ' : 'black ') + (isPlayable ? 'playable' : '');
        el.innerHTML = '<div style="align-self: flex-start; line-height: 1;"><span style="font-size:12px;">' + RANKS[card.rank] + '</span><span class="card-sym"> ' + SYMBOLS[card.suit] + '</span></div><div class="card-center-sym" style="align-self: center;">' + SYMBOLS[card.suit] + '</div><div style="align-self: flex-end; transform: rotate(180deg); line-height: 1;"><span style="font-size:12px;">' + RANKS[card.rank] + '</span><span class="card-sym"> ' + SYMBOLS[card.suit] + '</span></div>';
        if (isPlayable) {
          el.onclick = () => playCard(0, card);
        }
        south.appendChild(el);
      });

      ['North', 'West', 'East'].forEach((pos, idx) => {
        const pId = idx === 0 ? 2 : idx === 1 ? 1 : 3;
        const cont = document.getElementById('hand' + pos);
        cont.innerHTML = '';
        hands[pId].forEach(() => {
          const b = document.createElement('div');
          b.className = 'card back';
          b.style.width = '24px';
          b.style.height = '36px';
          b.innerText = 'W';
          cont.appendChild(b);
        });
      });
    }

    function playCard(pId, card) {
      hands[pId] = hands[pId].filter(c => c.id !== card.id);
      currentTrick.push({ player: pId, card });
      renderTrickCard(pId, card);
      renderHands();

      if (currentTrick.length === 4) {
        setTimeout(evalTrick, 900);
      } else {
        turn = (pId + 1) % 4;
        updatePlayerBadges();
        if (turn !== 0) setTimeout(aiPlayTurn, 650);
      }
    }

    function aiPlayTurn() {
      if (currentTrick.length === 4) return;
      if (turn === 0) { renderHands(); return; }
      const legal = getLegalCards(hands[turn], currentTrick);
      const card = legal[0];
      playCard(turn, card);
    }

    function renderTrickCard(pId, card) {
      const posMap = { 0: 'trickSouth', 1: 'trickWest', 2: 'trickNorth', 3: 'trickEast' };
      const slot = document.getElementById(posMap[pId]);
      const isRed = card.suit === 'HEARTS' || card.suit === 'DIAMONDS';
      slot.innerHTML = '<div class="card ' + (isRed ? 'red' : '') + '"><div>' + RANKS[card.rank] + ' ' + SYMBOLS[card.suit] + '</div><div style="align-self: center;">' + SYMBOLS[card.suit] + '</div></div>';
    }

    function clearTrickDisplay() {
      ['trickNorth', 'trickWest', 'trickEast', 'trickSouth'].forEach(id => {
        document.getElementById(id).innerHTML = '';
      });
    }

    function evalTrick() {
      let winIdx = 0, best = currentTrick[0].card;
      for(let i=1; i<4; i++) {
        const c = currentTrick[i].card;
        if (trumpSuit && c.suit === trumpSuit && best.suit !== trumpSuit) { best = c; winIdx = i; }
        else if (c.suit === best.suit && c.rank > best.rank) { best = c; winIdx = i; }
      }
      const winner = currentTrick[winIdx].player;
      const names = ['Tu', 'Radu', 'Elena', 'Mihai'];
      tricksWon[winner]++;
      document.getElementById('centerMsg').innerText = names[winner] + ' a luat cupa!';
      updatePlayerBadges();

      setTimeout(() => {
        clearTrickDisplay();
        currentTrick = [];
        turn = winner;

        if (hands[0].length === 0) {
          endRound();
        } else {
          document.getElementById('centerMsg').innerText = '';
          renderHands();
          if (turn !== 0) setTimeout(aiPlayTurn, 600);
        }
      }, 1000);
    }

    function endRound() {
      const roundPts = [];
      const names = ['Tu', 'Radu (AI)', 'Elena (AI)', 'Mihai (AI)'];
      const recapBody = document.getElementById('recapBody');
      recapBody.innerHTML = '';

      for(let p=0; p<4; p++) {
        const pts = (bids[p] === tricksWon[p]) ? (5 + tricksWon[p]) : -Math.abs(bids[p] - tricksWon[p]);
        scores[p] += pts;
        roundPts.push(pts);

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.padding = '6px';
        row.style.borderBottom = '1px solid #334155';
        const made = bids[p] === tricksWon[p];
        row.innerHTML = '<span><strong>' + names[p] + '</strong> (Lic: ' + bids[p] + ' / F: ' + tricksWon[p] + ')</span>' +
          '<span style="color:' + (made ? '#34d399' : '#f87171') + '; font-weight:bold;">' + (pts >= 0 ? '+' : '') + pts + ' pct (Tot: ' + scores[p] + ')</span>';
        recapBody.appendChild(row);
      }

      history.push({ round: currentRoundIdx + 1, trump: trumpSuit, bids: [...bids], won: [...tricksWon], scores: [...scores] });
      updatePlayerBadges();

      document.getElementById('recapTitle').innerText = 'Runda ' + (currentRoundIdx + 1) + ' finalizată!';
      document.getElementById('recapModal').style.display = 'flex';
    }

    function nextRoundAfterRecap() {
      document.getElementById('recapModal').style.display = 'none';
      currentRoundIdx++;
      if (currentRoundIdx < rounds.length) {
        startRound();
      } else {
        alert('Partidă încheiată! Câștigătorul are ' + Math.max(...scores) + ' puncte.');
        newGame();
      }
    }

    function updatePlayerBadges() {
      const names = ['Tu', 'Radu (AI)', 'Elena (AI)', 'Mihai (AI)'];
      const pos = ['South', 'West', 'North', 'East'];
      for(let i=0; i<4; i++) {
        const b = (bids[i] !== null ? bids[i] : '-');
        const d = (dealer === i ? ' [Dealer]' : '');
        document.getElementById('player' + pos[i]).innerText = names[i] + d + ' | Lic: ' + b + ' | F: ' + tricksWon[i] + ' | ' + scores[i] + ' pct';
      }
    }

    function openScoreSheet() {
      const body = document.getElementById('scoreTableBody');
      body.innerHTML = '';
      history.forEach(h => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>R' + h.round + '</td><td>' + (h.trump ? SYMBOLS[h.trump] : '-') + '</td>' +
          '<td>' + h.bids[0] + '/' + h.won[0] + ' (' + h.scores[0] + ')</td>' +
          '<td>' + h.bids[1] + '/' + h.won[1] + ' (' + h.scores[1] + ')</td>' +
          '<td>' + h.bids[2] + '/' + h.won[2] + ' (' + h.scores[2] + ')</td>' +
          '<td>' + h.bids[3] + '/' + h.won[3] + ' (' + h.scores[3] + ')</td>';
        body.appendChild(tr);
      });
      document.getElementById('scoreModal').style.display = 'flex';
    }
    function closeScoreSheet() { document.getElementById('scoreModal').style.display = 'none'; }
    function openRules() { document.getElementById('rulesModal').style.display = 'flex'; }
    function closeRules() { document.getElementById('rulesModal').style.display = 'none'; }

    window.onload = newGame;
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'whist_romanesc.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
