(function (global) {
  'use strict';

  var COLS = 10;
  var ROWS = 20;
  var CELL = 30;
  var LIMIT = 20;
  var TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  var SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
  };
  var COLORS = ['#06140d', '#8ce8ce', '#649f96', '#bbd875', '#e1e8a0', '#79da91', '#adcbbb', '#64ba71'];

  // dt is in seconds. The host owns the animation loop and pursuit behavior.
  global.createNightArcade = function (options) {
    options = options || {};
    var opened = false;
    var elapsed = 0;
    var timedOut = false;
    var notifyingTimeout = false;
    var score = 0;
    var lines = 0;
    var gameOver = false;
    var board = [];
    var piece = null;
    var bag = [];
    var dropElapsed = 0;
    var previousFocus = null;
    var controls = [];

    function element(tag, className, text, parent) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      if (parent) parent.appendChild(node);
      return node;
    }

    var overlay = element('div', 'night-arcade-overlay');
    overlay.id = 'night-arcade';
    overlay.hidden = true;
    overlay.tabIndex = -1;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'night-arcade-title');
    var style = element('style', '', undefined, overlay);
    style.textContent = [
      '#night-arcade[hidden]{display:none!important}',
      '#night-arcade{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(0,9,5,.92);color:#b3edbb;font:14px/1.5 monospace;overflow:auto;overscroll-behavior:contain}',
      '#night-arcade *{box-sizing:border-box}',
      '#night-arcade .na-case{width:min(600px,100%);max-height:100%;overflow:auto;padding:18px;border:1px solid #43865a;border-radius:12px;background:#07170f;box-shadow:0 0 42px #285c3b55,inset 0 0 35px #000}',
      '#night-arcade h2{margin:0;color:#cbffd2;font-size:21px;letter-spacing:3px}',
      '#night-arcade .na-warning{margin:5px 0 12px;color:#d6dd91}',
      '#night-arcade .na-layout{display:flex;gap:18px;align-items:flex-start;justify-content:center}',
      '#night-arcade .na-screen{position:relative;flex-shrink:0;width:min(300px,48vw,calc((100dvh - 190px)/2));min-width:120px;border:2px solid #325e42;border-radius:5px;overflow:hidden;box-shadow:0 0 18px #63ac7330}',
      '#night-arcade canvas{display:block;width:100%;height:auto;image-rendering:pixelated}',
      '#night-arcade .na-screen:after{content:"";pointer-events:none;position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0,transparent 2px,#00150840 3px,#00150840 4px)}',
      '#night-arcade .na-side{flex:1;min-width:108px;max-width:220px}',
      '#night-arcade .na-stat{padding:8px 0;border-bottom:1px solid #24432e;font-size:14px;font-variant-numeric:tabular-nums}',
      '#night-arcade .na-state{min-height:50px;padding:10px 0;color:#d6dd91}',
      '#night-arcade .na-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}',
      '#night-arcade button{min-height:42px;padding:8px 5px;border:1px solid #477a53;border-radius:4px;background:#122e1c;color:#c9f6d1;font:inherit;cursor:pointer;touch-action:manipulation}',
      '#night-arcade button:hover:not(:disabled){background:#235135}',
      '#night-arcade button:focus-visible{outline:2px solid #c9f6d1;outline-offset:2px}',
      '#night-arcade button:disabled{opacity:.35;cursor:not-allowed}',
      '#night-arcade .na-wide{grid-column:1/-1}',
      '#night-arcade .na-actions{display:grid;gap:8px;margin-top:14px}',
      '#night-arcade .na-help{margin:12px 0 0;color:#83b38d;font-size:12px}',
      '@media(max-width:390px){#night-arcade .na-case{padding:10px}#night-arcade .na-layout{gap:10px}#night-arcade h2{font-size:18px}}'
    ].join('\n');
    var cabinet = element('section', 'na-case', undefined, overlay);
    var title = element('h2', '', 'NIGHT SHIFT / 方块机', cabinet);
    title.id = 'night-arcade-title';
    element('p', 'na-warning', '20秒内回岗位！超过20秒将触发语音追捕。', cabinet);
    var layout = element('div', 'na-layout', undefined, cabinet);
    var screen = element('div', 'na-screen', undefined, layout);
    var canvas = element('canvas', '', undefined, screen);
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;
    canvas.setAttribute('aria-label', '10列20行俄罗斯方块游戏画面');
    var ctx = canvas.getContext('2d');
    var side = element('div', 'na-side', undefined, layout);
    var timeLabel = element('div', 'na-stat', '', side);
    var scoreLabel = element('div', 'na-stat', '', side);
    var linesLabel = element('div', 'na-stat', '', side);
    var stateLabel = element('div', 'na-state', '', side);
    stateLabel.setAttribute('role', 'status');
    var pad = element('div', 'na-pad', undefined, side);

    function button(parent, text, action, wide, playingOnly) {
      var node = element('button', wide ? 'na-wide' : '', text, parent);
      node.type = 'button';
      node.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (!inputAllowed() || (playingOnly && gameOver)) return;
        action();
        refresh();
      });
      controls.push({ node: node, playingOnly: playingOnly });
      return node;
    }

    button(pad, '左移', function () { move(-1); }, false, true);
    button(pad, '旋转', rotate, false, true);
    button(pad, '右移', function () { move(1); }, false, true);
    button(pad, '下移', softDrop, true, true);
    button(pad, '硬降 / SPACE', hardDrop, true, true);
    var actions = element('div', 'na-actions', undefined, side);
    button(actions, '重新开始', resetGame, false, false);
    button(actions, '离开机台 / ESC', close, false, false);
    element('p', 'na-help', '方向键：左右 / 下移 / 上旋转；空格硬降；Esc离开。重开或游戏结束均不会重置本次计时。', cabinet);

    // Keep screen controls from becoming world mouse/fire interactions.
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'].forEach(function (type) {
      overlay.addEventListener(type, function (event) {
        event.stopPropagation();
        if (type === 'contextmenu') event.preventDefault();
      });
    });
    (document.body || document.documentElement).appendChild(overlay);

    function inputAllowed() {
      return opened && (typeof options.canInput !== 'function' || !!options.canInput());
    }

    function copyMatrix(matrix) {
      return matrix.map(function (row) { return row.slice(); });
    }

    function resetGame() {
      board = Array.from({ length: ROWS }, function () { return Array(COLS).fill(0); });
      score = 0;
      lines = 0;
      gameOver = false;
      bag = [];
      dropElapsed = 0;
      spawn();
      // Deliberately leave elapsed and timedOut alone on a restart.
    }

    function spawn() {
      if (!bag.length) {
        bag = TYPES.slice();
        for (var i = bag.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var swap = bag[i];
          bag[i] = bag[j];
          bag[j] = swap;
        }
      }
      var type = bag.pop();
      var matrix = copyMatrix(SHAPES[type]);
      piece = { type: type, x: Math.floor((COLS - matrix.length) / 2), y: 0, matrix: matrix };
      if (!fits(matrix, piece.x, piece.y)) {
        gameOver = true;
        piece = null;
      }
    }

    function fits(matrix, x, y) {
      for (var row = 0; row < matrix.length; row++) {
        for (var col = 0; col < matrix[row].length; col++) {
          if (!matrix[row][col]) continue;
          var bx = x + col;
          var by = y + row;
          if (bx < 0 || bx >= COLS || by >= ROWS) return false;
          if (by >= 0 && board[by][bx]) return false;
        }
      }
      return true;
    }

    function move(dx) {
      if (!piece || gameOver) return;
      if (fits(piece.matrix, piece.x + dx, piece.y)) piece.x += dx;
    }

    function rotate() {
      if (!piece || gameOver || piece.type === 'O') return;
      var matrix = piece.matrix;
      var rotated = matrix.map(function (row, y) {
        return row.map(function (_, x) { return matrix[matrix.length - 1 - x][y]; });
      });
      // Simple horizontal wall kicks, then floor kicks; never accept overlap.
      var kicks = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [0, -2]];
      for (var i = 0; i < kicks.length; i++) {
        var x = piece.x + kicks[i][0];
        var y = piece.y + kicks[i][1];
        if (fits(rotated, x, y)) {
          piece.matrix = rotated;
          piece.x = x;
          piece.y = y;
          return;
        }
      }
    }

    function lock() {
      var aboveBoard = false;
      var color = TYPES.indexOf(piece.type) + 1;
      piece.matrix.forEach(function (row, y) {
        row.forEach(function (value, x) {
          if (!value) return;
          if (piece.y + y < 0) aboveBoard = true;
          else board[piece.y + y][piece.x + x] = color;
        });
      });
      if (aboveBoard) {
        gameOver = true;
        piece = null;
        return;
      }
      var cleared = 0;
      for (var y = ROWS - 1; y >= 0;) {
        if (board[y].every(function (value) { return value !== 0; })) {
          board.splice(y, 1);
          board.unshift(Array(COLS).fill(0));
          cleared++;
        } else y--;
      }
      score += [0, 100, 300, 500, 800][cleared] * (1 + Math.floor(lines / 10));
      lines += cleared;
      spawn();
    }

    function fall() {
      if (!piece || gameOver) return false;
      if (fits(piece.matrix, piece.x, piece.y + 1)) {
        piece.y++;
        return true;
      }
      lock();
      return false;
    }

    function softDrop() {
      if (fall()) score++;
      else dropElapsed = 0;
    }

    function hardDrop() {
      if (!piece || gameOver) return;
      while (fits(piece.matrix, piece.x, piece.y + 1)) {
        piece.y++;
        score += 2;
      }
      lock();
      dropElapsed = 0;
    }

    function formTarget(event) {
      // Include shadow-DOM form controls, but do not exempt arcade buttons.
      var path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
      return path.some(function (target) {
        return target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      });
    }

    function keyCode(event) {
      if (event.code) return event.code;
      var key = event.key || '';
      if (/^[wasdeg]$/i.test(key)) return 'Key' + key.toUpperCase();
      return key === ' ' || key === 'Spacebar' ? 'Space' : key;
    }

    function onKey(event) {
      if (!opened || formTarget(event)) return;
      var code = keyCode(event);
      var escape = code === 'Escape';
      var blocked = /^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|KeyW|KeyA|KeyS|KeyD|Space|KeyE|KeyG)$/.test(code);
      if (!blocked && !escape) return;
      var allowed = inputAllowed();
      // A paused host may use Escape to resume; do not close the arcade then.
      if (escape && !allowed) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!allowed || event.type !== 'keydown') return;
      if (escape) {
        close();
        return;
      }
      if (gameOver) return;
      switch (code) {
        case 'ArrowLeft': move(-1); break;
        case 'ArrowRight': move(1); break;
        case 'ArrowDown': softDrop(); break;
        case 'ArrowUp': if (!event.repeat) rotate(); break;
        case 'Space': if (!event.repeat) hardDrop(); break;
        // WASD/E/G are consumed, not passed to the world.
        default: return;
      }
      refresh();
    }

    function open() {
      // Repeated open calls cannot renew an already-running session.
      if (opened || notifyingTimeout) return;
      elapsed = 0;
      timedOut = false;
      resetGame();
      previousFocus = document.activeElement;
      opened = true;
      overlay.hidden = false;
      global.addEventListener('keydown', onKey, true);
      global.addEventListener('keyup', onKey, true);
      overlay.focus({ preventScroll: true });
      refresh();
    }

    function close() {
      if (!opened) return;
      opened = false;
      overlay.hidden = true;
      global.removeEventListener('keydown', onKey, true);
      global.removeEventListener('keyup', onKey, true);
      if (overlay.contains(document.activeElement) && previousFocus && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
      previousFocus = null;
      refresh();
      if (typeof options.onClose === 'function') options.onClose();
    }

    function update(dt) {
      if (!opened) return;
      if (!inputAllowed()) {
        refresh(false);
        return;
      }
      if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) {
        refresh(true);
        return;
      }
      elapsed += dt;
      // This check intentionally runs even after top-out, and uses strict >.
      if (elapsed > LIMIT && !timedOut) {
        timedOut = true;
        notifyingTimeout = true;
        try {
          try {
            close();
          } finally {
            // onClose errors must not swallow pursuit notification.
            if (typeof options.onTimeout === 'function') options.onTimeout();
          }
        } finally {
          notifyingTimeout = false;
        }
        return;
      }
      if (!gameOver) {
        dropElapsed += dt;
        var interval = Math.max(0.1, 0.72 - Math.floor(lines / 10) * 0.065);
        while (!gameOver && dropElapsed >= interval) {
          dropElapsed -= interval;
          fall();
          interval = Math.max(0.1, 0.72 - Math.floor(lines / 10) * 0.065);
        }
      }
      refresh(true);
    }

    function drawCell(x, y, color, ghost) {
      if (y < 0) return;
      var px = x * CELL;
      var py = y * CELL;
      if (ghost) {
        ctx.strokeStyle = '#467b55';
        ctx.strokeRect(px + 4, py + 4, CELL - 8, CELL - 8);
        return;
      }
      ctx.fillStyle = COLORS[color];
      ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
      ctx.fillStyle = '#ebffdf55';
      ctx.fillRect(px + 3, py + 3, CELL - 6, 3);
      ctx.fillStyle = '#001d1480';
      ctx.fillRect(px + 3, py + CELL - 6, CELL - 6, 3);
    }

    function draw(allowed) {
      if (!ctx) return;
      ctx.fillStyle = COLORS[0];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#11291c';
      ctx.lineWidth = 1;
      for (var x = 0; x <= COLS; x++) {
        ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke();
      }
      for (var y = 0; y <= ROWS; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke();
      }
      board.forEach(function (row, by) {
        row.forEach(function (value, bx) { if (value) drawCell(bx, by, value, false); });
      });
      if (piece) {
        var ghostY = piece.y;
        while (fits(piece.matrix, piece.x, ghostY + 1)) ghostY++;
        var color = TYPES.indexOf(piece.type) + 1;
        piece.matrix.forEach(function (row, py) {
          row.forEach(function (value, px) {
            if (!value) return;
            drawCell(piece.x + px, ghostY + py, color, true);
            drawCell(piece.x + px, piece.y + py, color, false);
          });
        });
      }
      if (!opened || !allowed || gameOver) {
        ctx.fillStyle = '#001007dc';
        ctx.fillRect(0, 225, canvas.width, 145);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#c8f4c7';
        ctx.font = 'bold 25px monospace';
        ctx.fillText(!opened ? (timedOut ? 'TIME OVER' : 'NIGHT ARCADE') : (!allowed ? 'PAUSED' : 'GAME OVER'), canvas.width / 2, 266);
        ctx.font = '15px monospace';
        ctx.fillText(opened ? '游玩 ' + elapsed.toFixed(1) + ' 秒 / 20 秒' : '20秒内回岗位', canvas.width / 2, 306);
        ctx.fillText(opened && gameOver ? '计时仍在继续，请离开机台' : (timedOut ? '立即返回工位！' : '方向键 + SPACE'), canvas.width / 2, 342);
      }
      // Scanlines also belong to the texture, not just the DOM decoration.
      ctx.fillStyle = '#00110820';
      for (var sy = 0; sy < canvas.height; sy += 4) ctx.fillRect(0, sy, canvas.width, 1);
    }

    function refresh(allowed) {
      if (allowed === undefined) allowed = inputAllowed();
      timeLabel.textContent = '游玩 ' + elapsed.toFixed(1) + ' / 20 秒';
      scoreLabel.textContent = '积分 ' + score;
      linesLabel.textContent = '消行 ' + lines;
      stateLabel.textContent = !opened ? (timedOut ? '已超时，立即回工位！' : '机台待机') : (!allowed ? '已暂停，计时冻结' : (gameOver ? '游戏结束，计时继续！' : '20秒内记得回岗位'));
      controls.forEach(function (control) {
        control.node.disabled = !allowed || (control.playingOnly && gameOver);
      });
      draw(allowed);
    }

    function status() {
      // Snapshots must not let callers accidentally mutate the live board.
      return {
        open: opened,
        elapsed: elapsed,
        timedOut: timedOut,
        score: score,
        lines: lines,
        gameOver: gameOver,
        board: copyMatrix(board),
        piece: piece ? { type: piece.type, x: piece.x, y: piece.y, matrix: copyMatrix(piece.matrix) } : null
      };
    }

    resetGame();
    refresh(false);
    return {
      open: open,
      close: close,
      update: update,
      isOpen: function () { return opened; },
      status: status,
      textureCanvas: canvas
    };
  };
})(window);
