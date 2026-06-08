/* ============================================================
   Lexika – game.js
   Complete game logic (polling, rendering, scoring, actions)
   ============================================================ */

'use strict';

// ── State ────────────────────────────────────────────────────────────────────
let boardState   = {};  // "row,col" -> {letter, value, isJoker, isNew}
let placedTiles  = [];  // [{rackIndex, row, col, letter, value, isJoker, displayLetter}]
let currentRack  = [];  // [{letter, value, isJoker}]
let bagCount     = 0;
let isMyTurn     = false;
let gameStatus   = '';
let pollInterval = null;
let jokerPending = null; // {rackIndex, row, col, value}
let isFirstMove  = true;
let lastMoveId        = null; // id du dernier coup connu, pour éviter de re-render si rien n'a changé
let currentTurnUserId = 0;   // uid du joueur dont c'est le tour
let lastOpponentMove  = null; // dernier coup adverse pour affichage dans la zone de score
let movesHistory      = [];  // historique complet des coups (mis à jour au poll)

// ── Init ─────────────────────────────────────────────────────────────────────
function initGame(state) {
    gameStatus        = state.status;
    isMyTurn          = state.isMyTurn;
    bagCount          = state.bagCount;
    currentRack       = state.myRack || [];
    currentTurnUserId = state.currentTurn || 0;
    lastOpponentMove  = state.lastOpponentMove || null;

    // Load board from server state
    boardState = {};
    const rawBoard = state.board || {};
    for (const [key, tile] of Object.entries(rawBoard)) {
        boardState[key] = {
            letter:   tile.letter,
            value:    tile.value,
            isJoker:  tile.is_joker || false,
            isNew:    false,
        };
    }
    isFirstMove = Object.keys(boardState).length === 0;

    renderBoard();
    renderRack();
    renderScores(state);
    updateBagCount(bagCount);
    updateTurnUI();
    showPreviewScore(); // affiche le dernier coup adverse si c'est notre tour

    if (gameStatus === 'finished') {
        showGameOver(state);
        return;
    }

    // Start polling when not my turn
    startPolling();
}

// ── Polling ──────────────────────────────────────────────────────────────────
function startPolling() {
    stopPolling();
    if (gameStatus === 'finished') return;
    pollInterval = setInterval(pollGameState, 3000);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

function pollGameState() {
    if (isMyTurn) return; // no need to poll when it's my turn

    ajaxPost('api.php?action=poll', { game_id: GAME_ID }, function(data) {
        if (!data.success) return;

        const prevTurn    = isMyTurn;
        const newCurrent  = parseInt(data.current_turn, 10);
        isMyTurn          = (newCurrent === MY_USER_ID);
        gameStatus        = data.status;
        bagCount          = data.bag_count;
        currentTurnUserId = newCurrent;

        const newMoveId = data.last_move ? data.last_move.id : null;
        if (newMoveId !== lastMoveId) {
            lastMoveId = newMoveId;

            // Reload board uniquement si un nouveau coup a été joué
            boardState = {};
            const rawBoard = data.board || {};
            for (const [key, tile] of Object.entries(rawBoard)) {
                boardState[key] = {
                    letter:  tile.letter,
                    value:   tile.value,
                    isJoker: tile.is_joker || false,
                    isNew:   false,
                };
            }
            isFirstMove = Object.keys(boardState).length === 0 && placedTiles.length === 0;

            renderBoard();
        }

        renderScores(data);
        updateBagCount(bagCount);

        if (gameStatus === 'finished') {
            stopPolling();
            updateTurnUI();
            showGameOver(data);
            return;
        }

        if (data.last_opponent_move !== undefined) {
            lastOpponentMove = data.last_opponent_move;
        }
        if (data.moves_history !== undefined) {
            movesHistory = data.moves_history;
        }

        if (!prevTurn && isMyTurn) {
            // Tour changé : currentRack est déjà à jour via sendPlay (data.new_rack).
            // Ne pas l'écraser depuis le poll pour ne pas perdre l'ordre local.
            placedTiles = [];

            if (!window.isRackDragging) renderRack();
            updateTurnUI();
            showPreviewScore(); // affiche le dernier coup adverse
            showNotification('C\'est ton tour !', 'success');
            stopPolling();
        } else {
            updateTurnUI();
        }
    });
}

// ── Board rendering ──────────────────────────────────────────────────────────
function renderBoard() {
    // Build placed tile lookup
    const placedMap = {};
    for (const pt of placedTiles) {
        placedMap[pt.row + ',' + pt.col] = pt;
    }

    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            const key  = r + ',' + c;
            const cell = document.getElementById('cell-' + r + '-' + c);
            if (!cell) continue;

            // Clear existing tile (keep bonus label)
            const existingTile = cell.querySelector('.tile');
            if (existingTile) existingTile.remove();

            // Show bonus label if no tile present
            let bonusLabel = cell.querySelector('.bonus-label');

            if (boardState[key]) {
                // Committed tile
                const t = boardState[key];
                if (bonusLabel) bonusLabel.style.display = 'none';
                cell.appendChild(makeTileEl(t.letter, t.value, false, t.isJoker));
            } else if (placedMap[key]) {
                // Newly placed tile (not yet committed)
                const pt = placedMap[key];
                if (bonusLabel) bonusLabel.style.display = 'none';
                const tEl = makeTileEl(pt.displayLetter || pt.letter, pt.value, true, pt.isJoker);
                tEl.dataset.row = r;
                tEl.dataset.col = c;
                cell.appendChild(tEl);
            } else {
                if (bonusLabel) bonusLabel.style.display = '';
            }
        }
    }
}

function makeTileEl(letter, value, isNew, isJoker) {
    const div = document.createElement('div');
    div.className = 'tile' + (isNew ? ' tile-new' : ' tile-placed') + (isJoker ? ' tile-joker' : '');
    const lSpan = document.createElement('span');
    lSpan.className = 'tile-letter';
    lSpan.textContent = letter || '?';
    const vSpan = document.createElement('span');
    vSpan.className = 'tile-value';
    vSpan.textContent = value;
    div.appendChild(lSpan);
    div.appendChild(vSpan);
    return div;
}

// ── Rack rendering ────────────────────────────────────────────────────────────
function renderRack() {
    const rack = document.getElementById('rack');
    if (!rack) return;
    rack.innerHTML = '';

    // Indices des tuiles actuellement posées sur le plateau
    const placedIndices = new Set(placedTiles.map(function(p) { return p.rackIndex; }));

    for (let i = 0; i < 7; i++) {
        // Tuile disponible ET non posée sur le plateau
        if (i < currentRack.length && !placedIndices.has(i)) {
            const tile = currentRack[i];
            const div  = document.createElement('div');
            div.className          = 'tile tile-rack';
            div.id                 = 'rack-tile-' + i;
            div.dataset.rackIndex  = i;
            div.dataset.letter     = tile.letter || '';
            div.dataset.value      = tile.value;
            div.dataset.isJoker    = tile.isJoker || tile.is_joker ? '1' : '0';
            div.draggable          = false; // handled by drag.js

            const lSpan = document.createElement('span');
            lSpan.className = 'tile-letter';
            lSpan.textContent = (tile.isJoker || tile.is_joker) ? '?' : (tile.letter || '?');

            const vSpan = document.createElement('span');
            vSpan.className = 'tile-value';
            vSpan.textContent = tile.value;

            div.appendChild(lSpan);
            div.appendChild(vSpan);
            rack.appendChild(div);
        } else {
            // Slot vide : tuile absente ou déjà posée sur le plateau
            const slot = document.createElement('div');
            slot.className = 'tile-slot';
            slot.id        = 'rack-slot-' + i;
            rack.appendChild(slot);
        }
    }

    if (typeof initDrag === 'function') initDrag();
}

// ── Score rendering ──────────────────────────────────────────────────────────
function renderScores(state) {
    const scores = state.scores || {};
    for (const [uid, info] of Object.entries(scores)) {
        const p = (uid == state.p1?.id || uid == INITIAL_STATE.p1?.id) ? 'p1' : 'p2';
        const el = document.getElementById('pts-' + p);
        if (el) el.textContent = info.score;
    }
    // Also try direct p1/p2 objects
    if (state.p1) {
        const el = document.getElementById('pts-p1');
        if (el) el.textContent = state.p1.score;
    }
    if (state.p2) {
        const el = document.getElementById('pts-p2');
        if (el) el.textContent = state.p2.score;
    }
}

function updateBagCount(n) {
    const el = document.getElementById('bag-count-display');
    if (el) el.textContent = n;
}

function updateTurnUI() {
    const btnPlay   = document.getElementById('btn-play');
    const btnBurger = document.getElementById('btn-burger');

    if (!isMyTurn) {
        if (btnPlay) btnPlay.disabled = true;
    }
    if (btnBurger) btnBurger.disabled = false;

    // Point clignotant : actif sur le joueur dont c'est le tour
    const dotP1 = document.getElementById('dot-p1');
    const dotP2 = document.getElementById('dot-p2');
    const p1Uid = parseInt((document.getElementById('score-p1') || {}).dataset?.uid || 0, 10);
    if (dotP1) dotP1.style.display = (currentTurnUserId === p1Uid) ? 'inline-block' : 'none';
    if (dotP2) dotP2.style.display = (currentTurnUserId !== p1Uid) ? 'inline-block' : 'none';
}

// ── Shuffle rack ──────────────────────────────────────────────────────────────
function shuffleRack() {
    if (placedTiles.length > 0) recallTiles();
    for (let i = currentRack.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentRack[i], currentRack[j]] = [currentRack[j], currentRack[i]];
    }
    renderRack();
}

// ── Burger menu ───────────────────────────────────────────────────────────────
function openBurgerMenu() {
    document.getElementById('burger-menu').style.display = 'flex';
}

function closeBurgerMenu() {
    document.getElementById('burger-menu').style.display = 'none';
}

// ── Tile placement ────────────────────────────────────────────────────────────
function placeTileOnBoard(rackIndex, row, col) {
    const key  = row + ',' + col;
    // Already occupied by committed tile?
    if (boardState[key]) return false;
    // Already has placed tile there?
    if (placedTiles.find(p => p.row === row && p.col === col)) return false;

    const tile = currentRack[rackIndex];
    if (!tile) return false;

    // Check if tile is already placed
    if (placedTiles.find(p => p.rackIndex === rackIndex)) return false;

    if (tile.isJoker || tile.is_joker) {
        // Show joker modal before actually placing
        jokerPending = { rackIndex, row, col, value: tile.value };
        showJokerModal();
        return true;
    }

    const placement = {
        rackIndex:   rackIndex,
        row:         row,
        col:         col,
        letter:      tile.letter,
        value:       tile.value,
        isJoker:     false,
        displayLetter: tile.letter,
    };
    placedTiles.push(placement);
    renderBoard();
    renderRack();
    showPreviewScore();
    return true;
}

function removeTileFromBoard(row, col) {
    const idx = placedTiles.findIndex(p => p.row === row && p.col === col);
    if (idx === -1) return;
    placedTiles.splice(idx, 1);
    renderBoard();
    showPreviewScore();
}

// ── Client-side placement validation ─────────────────────────────────────────
function validatePlacement() {
    if (placedTiles.length === 0) {
        return { valid: false, error: 'Aucune tuile posée.' };
    }

    const rows = placedTiles.map(p => p.row);
    const cols = placedTiles.map(p => p.col);
    const minRow = Math.min(...rows), maxRow = Math.max(...rows);
    const minCol = Math.min(...cols), maxCol = Math.max(...cols);

    const sameRow = (minRow === maxRow);
    const sameCol = (minCol === maxCol);

    if (placedTiles.length > 1 && !sameRow && !sameCol) {
        return { valid: false, error: 'Les tuiles doivent être sur la même ligne ou colonne.' };
    }

    const horizontal = (placedTiles.length === 1) ? true : sameRow;

    // Check for gaps
    if (placedTiles.length > 1) {
        if (horizontal) {
            for (let c = minCol; c <= maxCol; c++) {
                const key = minRow + ',' + c;
                const hasTile = boardState[key] || placedTiles.find(p => p.row === minRow && p.col === c);
                if (!hasTile) return { valid: false, error: 'Il y a un trou dans la ligne.' };
            }
        } else {
            for (let r = minRow; r <= maxRow; r++) {
                const key = r + ',' + minCol;
                const hasTile = boardState[key] || placedTiles.find(p => p.row === r && p.col === minCol);
                if (!hasTile) return { valid: false, error: 'Il y a un trou dans la colonne.' };
            }
        }
    }

    // Single tile: figure out direction from context
    // First move must cover center
    const isFirst = isFirstMove && Object.keys(boardState).length === 0;
    if (isFirst) {
        const hasCenter = placedTiles.find(p => p.row === 7 && p.col === 7);
        if (!hasCenter) {
            return { valid: false, error: 'Le premier mot doit passer par la case centrale.' };
        }
    } else {
        // Must be adjacent to at least one existing tile
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        let adjacent = false;
        for (const pt of placedTiles) {
            for (const [dr, dc] of dirs) {
                const nkey = (pt.row+dr) + ',' + (pt.col+dc);
                if (boardState[nkey]) { adjacent = true; break; }
            }
            if (adjacent) break;
        }
        if (!adjacent) {
            return { valid: false, error: 'Le mot doit être adjacent à une tuile existante.' };
        }
    }

    return { valid: true, horizontal, error: '' };
}

// ── Word extraction (for preview) ────────────────────────────────────────────
function getFormedWords(horizontal) {
    const merged = Object.assign({}, boardState);
    for (const pt of placedTiles) {
        merged[pt.row + ',' + pt.col] = {
            letter: pt.displayLetter || pt.letter,
            value:  pt.value,
            isJoker: pt.isJoker,
            isNew:  true,
        };
    }

    const newKeys = new Set(placedTiles.map(p => p.row + ',' + p.col));

    function extractWord(startR, startC, horiz) {
        let r = startR, c = startC;
        if (horiz) { while (merged[(r) + ',' + (c-1)]) c--; }
        else        { while (merged[(r-1) + ',' + (c)]) r--; }
        const tiles = [];
        let word = '';
        while (merged[r + ',' + c]) {
            const t = merged[r + ',' + c];
            tiles.push({ row: r, col: c, tile: t });
            word += t.letter;
            if (horiz) c++; else r++;
        }
        if (word.length < 2) return null;
        return { word, tiles };
    }

    const words = [];
    // Main word
    const anchor = placedTiles[0];
    const main = extractWord(anchor.row, anchor.col, horizontal);
    if (main) words.push(main);
    // Cross words
    for (const pt of placedTiles) {
        const cross = extractWord(pt.row, pt.col, !horizontal);
        if (cross) words.push(cross);
    }
    return words;
}

// ── Score calculation (client-side preview) ──────────────────────────────────
function calculateScore(words) {
    const newKeys = new Set(placedTiles.map(p => p.row + ',' + p.col));
    let total = 0;

    for (const w of words) {
        let letterSum = 0;
        let wordMult  = 1;
        for (const { row, col, tile } of w.tiles) {
            const key  = row + ',' + col;
            let lv     = parseInt(tile.value, 10) || 0;
            const isNew = newKeys.has(key);
            if (isNew && BONUS_SQUARES[key]) {
                const b = BONUS_SQUARES[key];
                if (b === '2L') lv *= 2;
                else if (b === '3L') lv *= 3;
                else if (b === '2M') wordMult *= 2;
                else if (b === '3M') wordMult *= 3;
            }
            letterSum += lv;
        }
        total += letterSum * wordMult;
    }
    if (placedTiles.length === 7) total += 50;
    return total;
}

// ── Opponent move formatting ──────────────────────────────────────────────────
function formatOppMove(move) {
    if (!move) return '';
    const name = move.prenom || 'Adversaire';
    if (move.type === 'play') {
        const word  = (move.word  || '').toUpperCase();
        const score = move.score || 0;
        return name + ' a joué ' + word + ' pour ' + score + ' pts';
    }
    if (move.type === 'pass') {
        return name + ' a passé son tour';
    }
    if (move.type === 'exchange') {
        const count = move.count || 0;
        return name + ' a changé ' + count + ' lettre' + (count > 1 ? 's' : '');
    }
    return '';
}

// ── Preview score ────────────────────────────────────────────────────────────
let _previewDebounce = null;

function showPreviewScore() {
    const previewArea  = document.getElementById('preview-area');
    const previewScore = document.getElementById('preview-score');
    const previewWords = document.getElementById('preview-words');
    const btnPlay      = document.getElementById('btn-play');
    const btnRecall    = document.getElementById('btn-recall');

    if (placedTiles.length === 0) {
        clearTimeout(_previewDebounce);
        if (isMyTurn && lastOpponentMove) {
            // Afficher le dernier coup adverse
            const msg = formatOppMove(lastOpponentMove);
            if (previewArea) {
                previewArea.style.display = 'flex';
                // Hide normal score elements, show opp message
                const lbl = previewArea.querySelector('.preview-label');
                if (lbl) lbl.style.display = 'none';
                if (previewScore) previewScore.style.display = 'none';
                if (previewWords) { previewWords.style.display = 'none'; }
                let oppMsg = document.getElementById('opp-move-msg');
                if (!oppMsg) {
                    oppMsg = document.createElement('span');
                    oppMsg.id = 'opp-move-msg';
                    oppMsg.className = 'opp-move-msg';
                    previewArea.appendChild(oppMsg);
                }
                oppMsg.textContent = msg;
                oppMsg.style.display = '';
            }
        } else {
            if (previewArea) previewArea.style.display = 'none';
        }
        if (btnPlay)   btnPlay.disabled   = true;
        if (btnRecall) btnRecall.disabled = true;
        return;
    }

    // Tuiles posées : cacher le message adverse, montrer le score normal
    const lbl = previewArea ? previewArea.querySelector('.preview-label') : null;
    if (lbl) lbl.style.display = '';
    if (previewScore) previewScore.style.display = '';
    if (previewWords) previewWords.style.display = '';
    const oppMsgEl = document.getElementById('opp-move-msg');
    if (oppMsgEl) oppMsgEl.style.display = 'none';

    if (previewArea)  previewArea.style.display = 'flex';
    if (btnRecall) btnRecall.disabled = false;

    const placement = validatePlacement();
    if (!placement.valid) {
        if (previewScore) {
            previewScore.textContent = '?';
            previewScore.classList.add('invalid');
        }
        if (previewWords) previewWords.textContent = placement.error;
        if (btnPlay) btnPlay.disabled = true;
        document.querySelectorAll('.tile-valid').forEach(el => {
            el.classList.remove('tile-valid');
            el.classList.add('tile-new');
        });
        clearTimeout(_previewDebounce);
        return;
    }

    // Geometry OK — call server for full dictionary validation
    clearTimeout(_previewDebounce);
    _previewDebounce = setTimeout(function() {
        const tiles = placedTiles.map(pt => ({
            row:      pt.row,
            col:      pt.col,
            letter:   pt.displayLetter || pt.letter,
            value:    pt.value,
            is_joker: pt.isJoker || false,
        }));

        ajaxPost('api.php?action=validate', {
            game_id: GAME_ID,
            tiles:   JSON.stringify(tiles),
        }, function(data) {
            if (!data.success) return;

            if (previewScore) {
                previewScore.textContent = data.valid ? (data.score + ' pts') : '?';
                previewScore.classList.toggle('invalid', !data.valid);
            }
            if (previewWords) {
                if (data.valid) {
                    previewWords.textContent = (data.words || []).map(w => w.toUpperCase()).join(', ');
                } else {
                    previewWords.textContent = data.error || '';
                }
            }
            if (btnPlay) btnPlay.disabled = !(isMyTurn && data.valid);

            if (data.valid) {
                document.querySelectorAll('.tile-new').forEach(el => {
                    el.classList.remove('tile-new');
                    el.classList.add('tile-valid');
                });
            } else {
                document.querySelectorAll('.tile-valid').forEach(el => {
                    el.classList.remove('tile-valid');
                    el.classList.add('tile-new');
                });
            }
        });
    }, 300);
}

// ── Send play ────────────────────────────────────────────────────────────────
function sendPlay() {
    if (!isMyTurn || placedTiles.length === 0) return;

    const placement = validatePlacement();
    if (!placement.valid) {
        showNotification(placement.error, 'error');
        return;
    }

    const tiles = placedTiles.map(pt => ({
        row:           pt.row,
        col:           pt.col,
        letter:        pt.displayLetter || pt.letter,
        value:         pt.value,
        is_joker:      pt.isJoker || false,
        source_letter: pt.isJoker ? '' : pt.letter,
    }));

    ajaxPost('api.php?action=play', {
        game_id: GAME_ID,
        tiles:   JSON.stringify(tiles),
    }, function(data) {
        if (!data.success) {
            showNotification(data.error || 'Coup invalide', 'error');
            return;
        }

        // Update local state
        currentRack = data.new_rack || [];
        bagCount    = data.bag_count;
        isMyTurn    = false;
        placedTiles = [];
        isFirstMove = false;

        // Apply played tiles to boardState
        for (const t of tiles) {
            boardState[t.row + ',' + t.col] = {
                letter:  t.letter,
                value:   t.value,
                isJoker: t.is_joker,
                isNew:   false,
            };
        }

        updateBagCount(bagCount);
        renderBoard();
        renderRack();
        updateTurnUI();

        document.getElementById('preview-area').style.display = 'none';
        document.getElementById('btn-play').disabled   = true;
        document.getElementById('btn-recall').disabled = true;

        showNotification('+' + data.score + ' pts ! (' + (data.words || []).join(', ') + ')', 'success');

        if (data.is_bingo) {
            showLexikaModal();
        }

        if (data.game_over) {
            setTimeout(() => pollGameState(), 600);
        } else {
            startPolling();
        }
    });
}

// ── Recall tiles ─────────────────────────────────────────────────────────────
function recallTiles() {
    placedTiles = [];
    renderBoard();
    renderRack();
    showPreviewScore();
}

// ── Exchange ──────────────────────────────────────────────────────────────────
function openExchangeModal() {
    const container = document.getElementById('exchange-rack');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < currentRack.length; i++) {
        const tile = currentRack[i];
        const div  = document.createElement('div');
        div.className     = 'exchange-tile';
        div.dataset.index = i;
        div.textContent   = tile.isJoker || tile.is_joker ? '?' : tile.letter;
        const vSpan = document.createElement('span');
        vSpan.className = 'tile-value';
        vSpan.textContent = tile.value;
        div.appendChild(vSpan);
        div.onclick = function() { div.classList.toggle('selected'); };
        container.appendChild(div);
    }

    document.getElementById('exchange-modal').style.display = 'flex';
}

function closeExchangeModal() {
    document.getElementById('exchange-modal').style.display = 'none';
}

function sendExchange() {
    const selected = Array.from(
        document.querySelectorAll('.exchange-tile.selected')
    ).map(el => parseInt(el.dataset.index, 10));

    if (selected.length === 0) {
        showNotification('Sélectionnez au moins une tuile.', 'error');
        return;
    }

    closeExchangeModal();

    ajaxPost('api.php?action=exchange', {
        game_id:      GAME_ID,
        tile_indices: JSON.stringify(selected),
    }, function(data) {
        if (!data.success) {
            showNotification(data.error || 'Erreur', 'error');
            return;
        }
        currentRack = data.new_rack || [];
        bagCount    = data.bag_count;
        isMyTurn    = false;
        placedTiles = [];

        updateBagCount(bagCount);
        renderRack();
        updateTurnUI();
        showNotification('Tuiles échangées.', 'info');
        startPolling();
    });
}

// ── Pass ──────────────────────────────────────────────────────────────────────
function sendPass() {
    if (!confirm('Passer votre tour ?')) return;

    ajaxPost('api.php?action=pass', { game_id: GAME_ID }, function(data) {
        if (!data.success) {
            showNotification(data.error || 'Erreur', 'error');
            return;
        }
        isMyTurn    = false;
        placedTiles = [];
        renderBoard();
        updateTurnUI();
        showNotification('Tour passé.', 'info');

        if (data.game_over) {
            setTimeout(() => pollGameState(), 600);
        } else {
            startPolling();
        }
    });
}

// ── Abandon ──────────────────────────────────────────────────────────────────
function sendAbandon() {
    if (!confirm('Abandonner la partie ? Votre adversaire sera déclaré vainqueur.')) return;

    ajaxPost('api.php?action=abandon', { game_id: GAME_ID }, function(data) {
        if (!data.success) {
            showNotification(data.error || 'Erreur', 'error');
            return;
        }
        isMyTurn   = false;
        gameStatus = 'finished';
        stopPolling();
        showGameOver({ winner_id: data.winner_id, status: 'finished' });
    });
}

// ── Joker modal ──────────────────────────────────────────────────────────────
function showJokerModal() {
    document.getElementById('joker-modal').style.display = 'flex';
}

function selectJokerLetter(letter) {
    document.getElementById('joker-modal').style.display = 'none';

    if (!jokerPending) return;

    const placement = {
        rackIndex:    jokerPending.rackIndex,
        row:          jokerPending.row,
        col:          jokerPending.col,
        letter:       '',
        value:        0,
        isJoker:      true,
        displayLetter: letter,
    };
    placedTiles.push(placement);
    jokerPending = null;
    renderBoard();
    renderRack();
    showPreviewScore();
}

function cancelJoker() {
    document.getElementById('joker-modal').style.display = 'none';
    jokerPending = null;
}

// ── Lexika modal ─────────────────────────────────────────────────────────────
let _lexikaAutoClose = null;

function showLexikaModal() {
    const modal = document.getElementById('lexika-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    clearTimeout(_lexikaAutoClose);
    _lexikaAutoClose = setTimeout(closeLexikaModal, 3000);
}

function closeLexikaModal() {
    clearTimeout(_lexikaAutoClose);
    const modal = document.getElementById('lexika-modal');
    if (modal) modal.style.display = 'none';
}

// ── Game over modal ──────────────────────────────────────────────────────────
function showGameOver(state) {
    stopPolling();
    const modal = document.getElementById('gameover-modal');
    const title = document.getElementById('gameover-title');
    const body  = document.getElementById('gameover-body');
    if (!modal) return;

    const winnerId = parseInt(state.winner_id, 10);
    if (winnerId === MY_USER_ID) {
        title.textContent = 'Victoire !';
        if (lastOpponentMove && lastOpponentMove.type === 'abandon') {
            const oppName = lastOpponentMove.prenom || 'Votre adversaire';
            body.textContent = oppName + ' a abandonné la partie.';
        } else {
            body.textContent = 'Félicitations, vous avez gagné la partie.';
        }
    } else if (winnerId) {
        title.textContent = 'Défaite';
        body.textContent  = 'Votre adversaire a remporté la partie.';
    } else {
        title.textContent = 'Partie terminée';
        body.textContent  = 'La partie est terminée.';
    }
    modal.style.display = 'flex';

}

// ── Toast notifications ──────────────────────────────────────────────────────
function showNotification(msg, type) {
    type = type || 'info';
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function() { toast.remove(); }, 350);
    }, 3000);
}

// ── AJAX helper ──────────────────────────────────────────────────────────────
function ajaxPost(url, data, callback) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(data)) {
        body.append(k, v);
    }

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    })
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(err) {
        console.error('AJAX error:', err);
    });
}

// ── History modal ────────────────────────────────────────────────────────────
function openHistoryModal() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!movesHistory || movesHistory.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.textContent = 'Aucun coup joué.';
        td.style.textAlign = 'center';
        td.style.color = '#888';
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        movesHistory.forEach(function(mv, i) {
            const tr = document.createElement('tr');
            if (i % 2 === 1) tr.className = 'history-row-odd';

            let moveText = '';
            if      (mv.move_type === 'play')     moveText = (mv.word || '').toUpperCase();
            else if (mv.move_type === 'pass')     moveText = 'Passe';
            else if (mv.move_type === 'exchange') moveText = 'Échange ' + (mv.exchange_count || '?') + ' lettre' + ((mv.exchange_count || 0) > 1 ? 's' : '');
            else if (mv.move_type === 'abandon')  moveText = 'Abandon';

            const pts = mv.move_type === 'play' ? '+' + mv.score : '—';

            [mv.move_number, mv.prenom, moveText, pts, mv.score_p1_after, mv.score_p2_after].forEach(function(val) {
                const td = document.createElement('td');
                td.textContent = val;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    document.getElementById('history-modal').style.display = 'flex';
}

function closeHistoryModal() {
    document.getElementById('history-modal').style.display = 'none';
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    initGame(INITIAL_STATE);
});
