/*
 * render.js — draws the whole board to a canvas and records hitboxes for input.
 * Fixed internal resolution (W x H); input.js maps client coords into it.
 */
(function (P) {
  "use strict";

  var deck = P.deck;
  var R = P.rules;
  var poker = P.poker;

  var W = 1280, H = 860;
  var hits = [];

  function reset() { hits = []; }
  function push(h) { hits.push(h); }
  function getHits() { return hits; }

  function roundRect(ctx, x, y, w, h, r) {
    if (w <= 0 || h <= 0) { ctx.beginPath(); return; } // nothing to draw
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCardBack(ctx, x, y, w, h) {
    ctx.save();
    roundRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = "#7a1020";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#f0d68a";
    ctx.stroke();
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 4);
    ctx.strokeStyle = "rgba(240,214,138,0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(240,214,138,0.65)";
    ctx.font = "bold " + Math.floor(h * 0.4) + "px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♠", x + w / 2, y + h / 2);
    ctx.restore();
  }

  function drawCard(ctx, x, y, w, h, token, opts) {
    opts = opts || {};
    if (token && token.dealer) { drawDealer(ctx, x, y, w, h); return; }
    ctx.save();
    roundRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = opts.dim ? "#e9e6dc" : "#fbfaf5";
    ctx.fill();
    ctx.lineWidth = opts.selected ? 3 : 1.5;
    ctx.strokeStyle = opts.selected ? "#f0c040" : (opts.active ? "#3da5ff" : "#8a8576");
    ctx.stroke();
    if (token) {
      var s = deck.suitInfo(token.suit);
      var col = opts.dim ? "rgba(0,0,0,0.35)" : s.color;
      ctx.fillStyle = col;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = "bold " + Math.floor(h * 0.22) + "px Georgia, serif";
      ctx.fillText(token.rank, x + 5, y + 4);
      ctx.font = Math.floor(h * 0.2) + "px Georgia, serif";
      ctx.fillText(s.symbol, x + 5, y + 4 + h * 0.22);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold " + Math.floor(h * 0.42) + "px Georgia, serif";
      ctx.fillText(s.symbol, x + w / 2, y + h / 2 + h * 0.04);
    }
    ctx.restore();
  }

  function drawDealer(ctx, x, y, w, h) {
    ctx.save();
    var cx = x + w / 2, cy = y + h / 2, rad = Math.min(w, h) / 2 - 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = "#f4f0e2";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#caa23a";
    ctx.stroke();
    ctx.fillStyle = "#9a7b1e";
    ctx.font = "bold " + Math.floor(rad * 0.9) + "px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("D", cx, cy + 1);
    ctx.restore();
  }

  function drawButton(ctx, x, y, w, h, label, action, opts) {
    opts = opts || {};
    ctx.save();
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = opts.disabled ? "#5a5a5a" : (opts.primary ? "#1f7a3d" : "#2b2b33");
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = opts.primary ? "#3fd170" : "#777";
    ctx.stroke();
    ctx.fillStyle = opts.disabled ? "#aaa" : "#f4f4ee";
    ctx.font = "bold 18px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.restore();
    if (!opts.disabled && action) push({ type: "button", action: action, x: x, y: y, w: w, h: h });
  }

  function text(ctx, str, x, y, font, color, align) {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(str, x, y);
  }

  // --- Factories + center ----------------------------------------------------

  function drawFactories(ctx, g) {
    var region = { x: 20, y: 52, w: 880, h: 300 };
    var count = g.factories.length;
    var cols = Math.min(5, count);
    var rows = Math.ceil(count / cols);
    var cw = region.w / cols, ch = region.h / rows;
    var now = performance.now();

    for (var i = 0; i < count; i++) {
      var f = g.factories[i];
      var col = i % cols, row = Math.floor(i / cols);
      var cx = region.x + col * cw + cw / 2;
      var cy = region.y + row * ch + ch / 2;
      var rx = Math.min(cw * 0.46, ch * 0.62);
      var ry = Math.min(rx * 0.66, ch * 0.46);

      // Poker-table felt.
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      var selectable = g.phase === "SELECT_SOURCE" && f.tokens.length > 0;
      ctx.fillStyle = f.tokens.length === 0 ? "#21402f" : "#2f7d4f";
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = selectable ? "#f0c040" : "#6b4a23";
      ctx.stroke();
      ctx.restore();

      // Flop tokens.
      var n = f.tokens.length;
      var tw = 40, th = 56, gap = 7;
      var totalW = n * tw + (n - 1) * gap;
      var startX = cx - totalW / 2;
      var ty = cy - th / 2;
      var flipT = f.flipped ? Math.min(1, (now - f.revealAt) / 250) : 0;
      for (var k = 0; k < n; k++) {
        var tx = startX + k * (tw + gap);
        if (!f.flipped) {
          drawCardBack(ctx, tx, ty, tw, th);
        } else {
          // Simple flip: squash horizontally through the midpoint.
          var scale = Math.abs(flipT - 0.5) * 2;
          var ww = Math.max(2, tw * scale);
          if (flipT < 0.5) drawCardBack(ctx, tx + (tw - ww) / 2, ty, ww, th);
          else drawCard(ctx, tx + (tw - ww) / 2, ty, ww, th, f.tokens[k]);
        }
      }

      if (selectable) {
        push({ type: "factory", index: i, x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 });
      }

      text(ctx, "Table " + (i + 1), cx, cy + ry + 14, "13px Georgia, serif",
        "rgba(255,255,255,0.6)", "center");
    }
  }

  function drawCenter(ctx, g) {
    var x = 920, y = 52, w = 340, h = 300;
    ctx.save();
    roundRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = "#243a2c";
    ctx.fill();
    ctx.lineWidth = 4;
    var selectable = g.phase === "SELECT_SOURCE" && g.center.length > 0;
    ctx.strokeStyle = selectable ? "#f0c040" : "#6b4a23";
    ctx.stroke();
    ctx.restore();
    text(ctx, "The Muck (center)", x + w / 2, y + 22, "bold 15px Georgia, serif",
      "rgba(255,255,255,0.75)", "center");

    if (g.dealerInCenter) drawDealer(ctx, x + w - 44, y + 12, 30, 30);

    var tw = 40, th = 56, gap = 6, perRow = Math.floor((w - 20) / (tw + gap));
    for (var i = 0; i < g.center.length; i++) {
      var col = i % perRow, row = Math.floor(i / perRow);
      var tx = x + 12 + col * (tw + gap);
      var ty = y + 40 + row * (th + gap);
      drawCard(ctx, tx, ty, tw, th, g.center[i]);
    }
    if (g.center.length === 0) {
      text(ctx, "(empty)", x + w / 2, y + h / 2, "16px Georgia, serif",
        "rgba(255,255,255,0.4)", "center");
    }
    if (selectable) push({ type: "center", x: x, y: y, w: w, h: h });
  }

  // --- Drafting / placement tray --------------------------------------------

  function drawTray(ctx, g) {
    var x = 20, y = 364, w = 1240, h = 120;
    ctx.save();
    roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fill();
    ctx.restore();

    if (g.phase === "SELECT_RAINBOW") {
      text(ctx, "Choose your rainbow set:", x + 16, y + 26, "bold 16px Georgia, serif", "#f0e9d2");
      var tw = 52, th = 74, gap = 12, sx = x + 20, sy = y + 34;
      for (var i = 0; i < g.revealed.length; i++) {
        var t = g.revealed[i];
        var tx = sx + i * (tw + gap);
        var sel = g.takeSet.indexOf(t) !== -1;
        var allowed = sel || R.canAddToSet(g.takeSet, t);
        drawCard(ctx, tx, sy, tw, th, t, { selected: sel, dim: !allowed && !sel });
        push({ type: "revealToken", token: t, x: tx, y: sy, w: tw, h: th });
      }
      drawButton(ctx, x + w - 360, y + 40, 150, 44, "Take (" + g.takeSet.length + ")",
        "take", { primary: true, disabled: g.takeSet.length === 0 });
      drawButton(ctx, x + w - 190, y + 40, 150, 44, "Cancel", "cancelSelection", {});
    } else if (g.phase === "PLACE" || g.phase === "PAY_GOLD") {
      text(ctx, "Holding — click the grid to place, or send to floor:",
        x + 16, y + 26, "bold 16px Georgia, serif", "#f0e9d2");
      var hw = 52, hh = 74, hgap = 12, hsx = x + 20, hsy = y + 34;
      for (var j = 0; j < g.held.length; j++) {
        var hx = hsx + j * (hw + hgap);
        drawCard(ctx, hx, hsy, hw, hh, g.held[j], { active: j === g.activeHeld });
        push({ type: "heldToken", index: j, x: hx, y: hsy, w: hw, h: hh });
      }
      if (g.held.length > 0) {
        drawButton(ctx, x + w - 220, y + 40, 200, 44, "Send to Floor", "floor", {});
      }
    } else {
      text(ctx, g.currentPlayer().name + ": choose a glowing table or the center.",
        x + 16, y + h / 2 + 6, "italic 18px Georgia, serif", "rgba(255,255,255,0.8)");
    }
  }

  // --- Player boards ---------------------------------------------------------

  function drawGrid(ctx, player, x, y, cell, interactive, g) {
    var n = R.GRID_SIZE;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var gx = x + c * cell, gy = y + r * cell;
        ctx.save();
        roundRect(ctx, gx + 2, gy + 2, cell - 4, cell - 4, 5);
        var onDiag = (r === c) || (r === n - 1 - c);
        ctx.fillStyle = onDiag ? "rgba(240,192,64,0.10)" : "rgba(255,255,255,0.05)";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.stroke();
        ctx.restore();
        var tok = player.grid[r][c];
        if (tok) {
          drawCard(ctx, gx + 4, gy + 4, cell - 8, cell - 8, tok);
        } else if (interactive && (g.phase === "PLACE")) {
          push({ type: "gridCell", r: r, c: c, x: gx, y: gy, w: cell, h: cell });
        }
      }
    }
  }

  function drawFloor(ctx, player, x, y, slot) {
    text(ctx, "Penalty line", x, y - 6, "13px Georgia, serif", "rgba(255,255,255,0.7)");
    for (var i = 0; i < R.FLOOR_SLOTS; i++) {
      var sx = x + i * (slot + 6);
      ctx.save();
      roundRect(ctx, sx, y, slot, slot, 5);
      ctx.fillStyle = "rgba(120,20,20,0.25)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.stroke();
      ctx.restore();
      text(ctx, "" + R.FLOOR_PENALTIES[i], sx + slot / 2, y + slot + 13,
        "11px Georgia, serif", "rgba(255,180,180,0.8)", "center");
      if (player.floor[i]) {
        drawCard(ctx, sx + 3, y + 3, slot - 6, slot - 6, player.floor[i]);
      }
    }
  }

  function drawCurrentBoard(ctx, g) {
    var p = g.currentPlayer();
    var x = 30, y = 502, cell = 52;
    text(ctx, "▸ " + p.name, x, y - 12, "bold 20px Georgia, serif", "#f0c040");
    drawGrid(ctx, p, x, y, cell, true, g);

    var floorX = x, floorY = y + cell * R.GRID_SIZE + 24;
    drawFloor(ctx, p, floorX, floorY, 32);

    // Live stats panel.
    var px = x + cell * R.GRID_SIZE + 30, py = y + 6;
    var s = p.score();
    text(ctx, "Gold: " + p.gold, px, py, "bold 20px Georgia, serif", "#f0d24a");
    text(ctx, "Lines: " + s.linePoints + "   Penalty: " + s.penalty,
      px, py + 28, "16px Georgia, serif", "#e8e8e0");
    text(ctx, "Projected total: " + s.total, px, py + 52, "bold 18px Georgia, serif", "#9fe0a8");

    // Made hands so far.
    var made = s.lines.filter(function (l) { return l.points > 0; });
    text(ctx, "Made hands:", px, py + 88, "bold 15px Georgia, serif", "#cfcabb");
    if (made.length === 0) {
      text(ctx, "  — none yet —", px, py + 110, "14px Georgia, serif", "rgba(255,255,255,0.5)");
    }
    for (var i = 0; i < made.length && i < 8; i++) {
      text(ctx, made[i].name + ": " + made[i].hand + " (+" + made[i].points + ")",
        px, py + 110 + i * 20, "14px Georgia, serif", "#dfe7d6");
    }
  }

  function drawOpponents(ctx, g) {
    var others = g.players.filter(function (pl) { return pl.id !== g.current; });
    var x = 760, y = 506, cell = 17, gap = 18;
    var perRow = 2;
    for (var idx = 0; idx < others.length; idx++) {
      var p = others[idx];
      var col = idx % perRow, row = Math.floor(idx / perRow);
      var ox = x + col * 260;
      var oy = y + row * 170;
      text(ctx, p.name, ox, oy - 6, "bold 15px Georgia, serif", "#d8d4c4");
      var s = p.score();
      text(ctx, "G:" + p.gold + "  T:" + s.total, ox + 100, oy - 6,
        "13px Georgia, serif", "#bdb9aa");
      // mini grid
      for (var r = 0; r < R.GRID_SIZE; r++) {
        for (var c = 0; c < R.GRID_SIZE; c++) {
          var gx = ox + c * cell, gy = oy + r * cell;
          ctx.save();
          roundRect(ctx, gx, gy, cell - 2, cell - 2, 2);
          var tok = p.grid[r][c];
          ctx.fillStyle = tok ? "#fbfaf5" : "rgba(255,255,255,0.06)";
          ctx.fill();
          ctx.restore();
          if (tok) {
            var si = deck.suitInfo(tok.suit);
            text(ctx, tok.rank, gx + (cell - 2) / 2, gy + (cell - 2) / 2 + 4,
              "9px Georgia, serif", si.color, "center");
          }
        }
      }
      text(ctx, "floor " + p.floor.length + "/" + R.FLOOR_SLOTS,
        ox, oy + cell * R.GRID_SIZE + 14, "12px Georgia, serif", "rgba(255,180,180,0.8)");
    }
  }

  // --- Modals ----------------------------------------------------------------

  function drawPayGold(ctx, g) {
    var p = g.currentPlayer();
    var cost = R.clearCost(p.floor.length);
    var w = 460, h = 200, x = (W - w) / 2, y = (H - h) / 2;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);
    roundRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = "#1c2a20";
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#f0c040"; ctx.stroke();
    ctx.restore();
    text(ctx, "Floor is full!", x + w / 2, y + 46, "bold 24px Georgia, serif", "#f0c040", "center");
    text(ctx, "Pay " + cost + " gold to clear the bottom slot and",
      x + w / 2, y + 84, "16px Georgia, serif", "#e8e8e0", "center");
    text(ctx, "drop this card there? (you have " + p.gold + ")",
      x + w / 2, y + 108, "16px Georgia, serif", "#e8e8e0", "center");
    drawButton(ctx, x + 40, y + 132, 170, 46, "Pay " + cost, "payYes", { primary: true });
    drawButton(ctx, x + w - 210, y + 132, 170, 46, "Cancel", "payNo", {});
  }

  function drawGameOver(ctx, g) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    var w = 720, h = 560, x = (W - w) / 2, y = (H - h) / 2;
    roundRect(ctx, x, y, w, h, 16);
    ctx.fillStyle = "#15211a"; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "#f0c040"; ctx.stroke();
    text(ctx, "🏆 " + g.results[0].name + " wins!", x + w / 2, y + 50,
      "bold 30px Georgia, serif", "#f0c040", "center");

    var ry = y + 96;
    for (var i = 0; i < g.results.length; i++) {
      var res = g.results[i];
      text(ctx, (i + 1) + ". " + res.name, x + 40, ry, "bold 20px Georgia, serif", "#f4f0e2");
      text(ctx, "lines " + res.linePoints + "   penalty " + res.penalty +
        "   gold " + res.gold + "   =  " + res.total,
        x + 200, ry, "18px Georgia, serif", "#cfe6cf");
      ry += 30;
      var made = res.lines.filter(function (l) { return l.points > 0; })
        .map(function (l) { return l.hand; });
      text(ctx, made.length ? made.join(", ") : "no scoring hands",
        x + 60, ry, "13px Georgia, serif", "rgba(255,255,255,0.55)");
      ry += 30;
    }
    drawButton(ctx, x + w / 2 - 110, y + h - 70, 220, 50, "New Game", "newGame",
      { primary: true });
  }

  function drawShuffling(ctx, g) {
    var now = performance.now();
    var elapsed = now - g.shuffleStart;
    var progress = Math.max(0, Math.min(1, elapsed / R.SHUFFLE_MS));

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    var w = 560, h = 320, x = (W - w) / 2, y = (H - h) / 2;
    roundRect(ctx, x, y, w, h, 16);
    ctx.fillStyle = "#15211a"; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "#f0c040"; ctx.stroke();

    text(ctx, "Shuffling the deck…", x + w / 2, y + 52,
      "bold 28px Georgia, serif", "#f0c040", "center");
    text(ctx, "Round " + g.round, x + w / 2, y + 84,
      "20px Georgia, serif", "#e8e8e0", "center");

    // Riffle animation: card backs arc from a left stack to a right stack.
    var cx = x + w / 2, cy = y + 168;
    var leftX = cx - 130, rightX = cx + 130, deckY = cy, tw = 46, th = 64;
    drawCardBack(ctx, leftX - tw / 2, deckY - th / 2 + 6, tw, th);
    drawCardBack(ctx, rightX - tw / 2, deckY - th / 2 + 6, tw, th);
    for (var k = 0; k < 10; k++) {
      var t = ((now / 700) + k * 0.13) % 1;
      var fx = leftX + (rightX - leftX) * t;
      var fy = deckY - Math.sin(t * Math.PI) * 78;
      var rot = (t - 0.5) * 0.5;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(rot);
      drawCardBack(ctx, -tw / 2, -th / 2, tw, th);
      ctx.restore();
    }

    if (g.lastDealerReturn) {
      text(ctx, g.lastDealerReturn.name + " pays " + g.lastDealerReturn.cost +
        " gold — dealer button returns to the center.",
        x + w / 2, y + h - 56, "15px Georgia, serif", "#f0d24a", "center");
    }

    // Progress bar.
    var bw = w - 120, bx = x + 60, by = y + h - 34;
    roundRect(ctx, bx, by, bw, 12, 6);
    ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fill();
    roundRect(ctx, bx, by, bw * progress, 12, 6);
    ctx.fillStyle = "#3fd170"; ctx.fill();
  }

  // --- Main draw -------------------------------------------------------------

  function draw(ctx, g) {
    reset();
    // Background felt.
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0d3022");
    grad.addColorStop(1, "#082016");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    text(ctx, "POZULE", 24, 36, "bold 30px Georgia, serif", "#f0c040");
    text(ctx, "Azul × Poker", 190, 36, "italic 18px Georgia, serif", "rgba(255,255,255,0.6)");
    text(ctx, g.message || "", 360, 36, "16px Georgia, serif", "#eef0e6");

    drawFactories(ctx, g);
    drawCenter(ctx, g);
    drawTray(ctx, g);
    drawCurrentBoard(ctx, g);
    drawOpponents(ctx, g);

    if (g.phase === "SHUFFLING") drawShuffling(ctx, g);
    if (g.phase === "PAY_GOLD") drawPayGold(ctx, g);
    if (g.phase === "GAME_OVER") drawGameOver(ctx, g);
  }

  P.render = { W: W, H: H, draw: draw, getHits: getHits };
})(window.Pozule = window.Pozule || {});
