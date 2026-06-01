/* ============================================================
   Lexika – drag.js
   Unified mouse + touch drag & drop for tiles
   ============================================================ */

'use strict';

(function() {

// ── Drag state ────────────────────────────────────────────────────────────────
let dragState = null;
/*
  dragState = {
    source:      'rack' | 'board',
    rackIndex:   number | null,
    boardRow:    number | null,
    boardCol:    number | null,
    letter:      string,
    value:       number,
    isJoker:     bool,
    ghost:       HTMLElement,
    sourceEl:    HTMLElement,
  }
*/

// ── Init (called after each rack render) ─────────────────────────────────────
function initDrag() {
    // Rack tiles
    const rackTiles = document.querySelectorAll('.tile-rack');
    rackTiles.forEach(function(el) {
        el.removeEventListener('mousedown',  onRackMouseDown);
        el.removeEventListener('touchstart', onRackTouchStart);
        el.addEventListener('mousedown',  onRackMouseDown,  { passive: false });
        el.addEventListener('touchstart', onRackTouchStart, { passive: false });
    });

    // Board new tiles (placed but not yet committed)
    rebindBoardNewTiles();
}
window.initDrag = initDrag;

function rebindBoardNewTiles() {
    document.querySelectorAll('.tile-new').forEach(function(el) {
        el.removeEventListener('mousedown',  onBoardTileMouseDown);
        el.removeEventListener('touchstart', onBoardTileTouchStart);
        el.addEventListener('mousedown',  onBoardTileMouseDown,  { passive: false });
        el.addEventListener('touchstart', onBoardTileTouchStart, { passive: false });
    });
}

// ── Mouse: rack tile ──────────────────────────────────────────────────────────
function onRackMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    startDragFromRack(el, e.clientX, e.clientY);
}

function onRackTouchStart(e) {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const el = e.currentTarget;
    const t  = e.touches[0];
    startDragFromRack(el, t.clientX, t.clientY);
}

function startDragFromRack(el, x, y) {
    const rackIndex = parseInt(el.dataset.rackIndex, 10);
    const isJoker   = el.dataset.isJoker === '1';
    const letter    = el.dataset.letter;
    const value     = parseInt(el.dataset.value, 10);

    // Check if tile is already placed on board
    if (typeof placedTiles !== 'undefined') {
        if (placedTiles.find(function(p) { return p.rackIndex === rackIndex; })) return;
    }

    const ghost = createGhost(letter, value, isJoker);
    positionGhost(ghost, x, y);
    document.body.appendChild(ghost);

    el.classList.add('dragging-source');

    dragState = {
        source:    'rack',
        rackIndex: rackIndex,
        boardRow:  null,
        boardCol:  null,
        letter:    letter,
        value:     value,
        isJoker:   isJoker,
        ghost:     ghost,
        sourceEl:  el,
    };

    attachDragListeners();
}

// ── Mouse: board new tile ─────────────────────────────────────────────────────
function onBoardTileMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    startDragFromBoard(el, e.clientX, e.clientY);
}

function onBoardTileTouchStart(e) {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const el = e.currentTarget;
    const t  = e.touches[0];
    startDragFromBoard(el, t.clientX, t.clientY);
}

function startDragFromBoard(el, x, y) {
    const row = parseInt(el.dataset.row, 10);
    const col = parseInt(el.dataset.col, 10);
    if (isNaN(row) || isNaN(col)) return;

    // Find in placedTiles
    if (typeof placedTiles === 'undefined') return;
    const pt = placedTiles.find(function(p) { return p.row === row && p.col === col; });
    if (!pt) return;

    const ghost = createGhost(pt.displayLetter || pt.letter, pt.value, pt.isJoker);
    positionGhost(ghost, x, y);
    document.body.appendChild(ghost);

    el.classList.add('dragging-source');

    dragState = {
        source:    'board',
        rackIndex: pt.rackIndex,
        boardRow:  row,
        boardCol:  col,
        letter:    pt.letter,
        value:     pt.value,
        isJoker:   pt.isJoker,
        displayLetter: pt.displayLetter,
        ghost:     ghost,
        sourceEl:  el,
    };

    attachDragListeners();
}

// ── Global drag move/end listeners ───────────────────────────────────────────
function attachDragListeners() {
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup',   onDragEnd);
    document.addEventListener('touchmove', onDragTouchMove, { passive: false });
    document.addEventListener('touchend',  onDragTouchEnd);
    document.addEventListener('touchcancel', onDragCancel);
}

function detachDragListeners() {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup',   onDragEnd);
    document.removeEventListener('touchmove', onDragTouchMove);
    document.removeEventListener('touchend',  onDragTouchEnd);
    document.removeEventListener('touchcancel', onDragCancel);
}

function onDragMove(e) {
    if (!dragState) return;
    clearDropHighlights();
    positionGhost(dragState.ghost, e.clientX, e.clientY);
    const target = findDropTarget(e.clientX, e.clientY);
    if (target) target.classList.add('drop-target');
}

function onDragTouchMove(e) {
    if (!dragState) return;
    e.preventDefault();
    const t = e.touches[0];
    clearDropHighlights();
    positionGhost(dragState.ghost, t.clientX, t.clientY);
    const target = findDropTarget(t.clientX, t.clientY);
    if (target) target.classList.add('drop-target');
}

function onDragEnd(e) {
    if (!dragState) return;
    clearDropHighlights();
    const target = findDropTarget(e.clientX, e.clientY);
    handleDrop(target);
}

function onDragTouchEnd(e) {
    if (!dragState) return;
    clearDropHighlights();
    const t = e.changedTouches[0];
    const target = findDropTarget(t.clientX, t.clientY);
    handleDrop(target);
}

function onDragCancel() {
    cleanupDrag();
}

// ── Drop handling ─────────────────────────────────────────────────────────────
function handleDrop(target) {
    if (!dragState) return;

    if (target && target.classList.contains('cell')) {
        // Dropping on a board cell
        const row = parseInt(target.dataset.row, 10);
        const col = parseInt(target.dataset.col, 10);

        if (dragState.source === 'rack') {
            // Rack -> Board
            dropRackToBoard(dragState.rackIndex, row, col);
        } else if (dragState.source === 'board') {
            // Board -> Board (move new tile to different cell)
            dropBoardToBoard(dragState.boardRow, dragState.boardCol, row, col);
        }

    } else if (target && (target.classList.contains('tile-rack') || target.classList.contains('tile-slot') || target.classList.contains('rack'))) {
        // Dropping back to rack
        if (dragState.source === 'board') {
            // Board -> Rack: return tile
            dropBoardToRack(dragState.boardRow, dragState.boardCol);
        } else if (dragState.source === 'rack') {
            // Rack -> Rack: reorder by insertion
            dropRackToRack(dragState.rackIndex, target);
        }
    } else {
        // Dropped outside a valid target — cancel (return to source)
        // For board tiles, no action needed (tile stays).
    }

    cleanupDrag();
}

function dropRackToBoard(rackIndex, row, col) {
    if (typeof placeTileOnBoard === 'function') {
        placeTileOnBoard(rackIndex, row, col);
    }
}

function dropBoardToBoard(fromRow, fromCol, toRow, toColl) {
    if (typeof placedTiles === 'undefined') return;
    const key = toRow + ',' + toColl;
    // Check dest is free
    if (typeof boardState !== 'undefined' && boardState[key]) return;
    if (placedTiles.find(function(p) { return p.row === toRow && p.col === toColl; })) return;

    const pt = placedTiles.find(function(p) { return p.row === fromRow && p.col === fromCol; });
    if (!pt) return;
    pt.row = toRow;
    pt.col = toColl;

    if (typeof renderBoard === 'function') renderBoard();
    if (typeof showPreviewScore === 'function') showPreviewScore();
    // Rebind new tile event listeners
    setTimeout(rebindBoardNewTiles, 50);
}

function dropRackToRack(fromIndex, targetEl) {
    if (typeof currentRack === 'undefined' || typeof placedTiles === 'undefined') return;
    // Ne pas réordonner si des tuiles sont déjà posées (rackIndex deviendrait invalide)
    if (placedTiles.length > 0) return;

    let toIndex = fromIndex;
    if (targetEl.classList.contains('tile-rack')) {
        toIndex = parseInt(targetEl.dataset.rackIndex, 10);
    } else if (targetEl.classList.contains('tile-slot')) {
        const m = targetEl.id.match(/rack-slot-(\d+)/);
        if (m) toIndex = parseInt(m[1], 10);
    } else if (targetEl.classList.contains('rack')) {
        toIndex = currentRack.length - 1;
    }

    if (isNaN(toIndex) || toIndex === fromIndex) return;
    toIndex = Math.max(0, Math.min(currentRack.length - 1, toIndex));

    const [tile] = currentRack.splice(fromIndex, 1);
    currentRack.splice(toIndex, 0, tile);

    if (typeof renderRack === 'function') renderRack();
}

function dropBoardToRack(row, col) {
    if (typeof removeTileFromBoard === 'function') {
        removeTileFromBoard(row, col);
    }
    if (typeof renderRack === 'function') renderRack();
}

// ── Find drop target at coordinates ──────────────────────────────────────────
function findDropTarget(x, y) {
    if (!dragState) return null;
    // Temporarily hide ghost to use elementFromPoint
    dragState.ghost.style.display = 'none';
    let el = document.elementFromPoint(x, y);
    dragState.ghost.style.display = '';

    if (!el) return null;

    // Walk up the DOM to find a cell or rack element
    let node = el;
    while (node && node !== document.body) {
        if (node.classList.contains('cell'))      return node;
        if (node.classList.contains('tile-rack')) return node;
        if (node.classList.contains('tile-slot')) return node;
        if (node.classList.contains('rack'))      return node;
        node = node.parentElement;
    }
    return null;
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
function cleanupDrag() {
    if (!dragState) return;
    if (dragState.ghost && dragState.ghost.parentNode) {
        dragState.ghost.parentNode.removeChild(dragState.ghost);
    }
    if (dragState.sourceEl) {
        dragState.sourceEl.classList.remove('dragging-source');
    }
    clearDropHighlights();
    detachDragListeners();
    dragState = null;
    // Rebind new board tiles after any drop
    setTimeout(rebindBoardNewTiles, 50);
}

// ── Ghost element ─────────────────────────────────────────────────────────────
function createGhost(letter, value, isJoker) {
    const div = document.createElement('div');
    div.className = 'drag-ghost';
    div.textContent = isJoker ? (letter || '?') : (letter || '?');
    const vSpan = document.createElement('span');
    vSpan.style.cssText = 'font-size:9px;position:absolute;bottom:2px;right:3px;color:#777;font-weight:700;';
    vSpan.textContent = value;
    div.appendChild(vSpan);
    return div;
}

function positionGhost(ghost, x, y) {
    ghost.style.left = x + 'px';
    ghost.style.top  = y + 'px';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function clearDropHighlights() {
    document.querySelectorAll('.drop-target').forEach(function(el) {
        el.classList.remove('drop-target');
    });
}

})(); // IIFE
