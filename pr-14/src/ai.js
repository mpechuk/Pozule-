/*
 * ai.js — computer players.
 *
 * The engine (game.js) is event-driven: a turn is just a sequence of method
 * calls (selectFactory, toggleToken, confirmTake, placeOnGrid, ...) that a
 * human triggers via clicks (input.js). An AI seat is driven exactly the same
 * way — by calling those same mutators — only from a timed driver in the render
 * loop instead of from the mouse. So no engine logic changes are needed here.
 *
 * `P.ai.tick(game, now)` is called every frame by main.js. It performs at most
 * one atomic action per STEP_MS so AI turns are watchable (and an all-AI table
 * plays out like a replay you can follow).
 *
 * Strategy is a greedy heuristic that reuses the real poker evaluator
 * (poker.evaluateLine) and rainbow rules (rules.canAddToSet): draft and place
 * tiles to maximize the sum of poker-hand points across the 12 scoring lines.
 */
(function (P) {
  "use strict";

  var R = P.rules;
  var poker = P.poker;

  var STEP_MS = 500;       // delay between an AI's atomic actions (watchable)
  var PASS_STEP_MS = 700;  // delay before an AI auto-confirms a hand-off
  // Tiny tie-breaker that nudges the AI to actually take/place a tile when two
  // options score the same poker points (e.g. lone high cards). Small enough
  // that it never overrides a real scoring difference.
  var FILL_EPS = 1e-3;

  // --- Scoring helpers (operate on a plain 5x5 grid of tokens/null) ----------

  // Total poker points across the 12 scoring lines (5 rows, 5 cols, 2 diags).
  // evaluateLine ignores nulls and the dealer button, so raw lines are fine.
  function boardScore(grid) {
    var n = R.GRID_SIZE, total = 0, r, c, line;
    for (r = 0; r < n; r++) {
      line = [];
      for (c = 0; c < n; c++) line.push(grid[r][c]);
      total += poker.evaluateLine(line).points;
    }
    for (c = 0; c < n; c++) {
      line = [];
      for (r = 0; r < n; r++) line.push(grid[r][c]);
      total += poker.evaluateLine(line).points;
    }
    line = [];
    for (r = 0; r < n; r++) line.push(grid[r][r]);
    total += poker.evaluateLine(line).points;
    line = [];
    for (r = 0; r < n; r++) line.push(grid[r][n - 1 - r]);
    total += poker.evaluateLine(line).points;
    return total;
  }

  function copyGrid(grid) {
    return grid.map(function (row) { return row.slice(); });
  }

  // Greedily seat `tokens` (in order) onto a copy of `grid`, each into the empty
  // cell that maximizes boardScore. Adding a card to a <=5-cell line can never
  // lower its best hand, so every grid placement is a non-negative move — we
  // only "overflow" once the grid is full. Returns the resulting board score and
  // how many tokens didn't fit (would be forced to the floor).
  function greedyPlace(grid, tokens) {
    var g = copyGrid(grid), n = R.GRID_SIZE, overflow = 0;
    tokens.forEach(function (tok) {
      var bestR = -1, bestC = -1, bestS = -Infinity, r, c;
      for (r = 0; r < n; r++) {
        for (c = 0; c < n; c++) {
          if (g[r][c]) continue;
          g[r][c] = tok;
          var s = boardScore(g);
          g[r][c] = null;
          if (s > bestS) { bestS = s; bestR = r; bestC = c; }
        }
      }
      if (bestR < 0) overflow++;          // grid full
      else g[bestR][bestC] = tok;
    });
    return { score: boardScore(g), overflow: overflow };
  }

  // --- Draft planning --------------------------------------------------------

  // Greedily build the best rainbow take-set from `tokens` for the given grid.
  // Returns { set, net } where net = simulated board-score gain, minus the floor
  // penalty for any cards that would overflow, plus a tiny fill bonus.
  function chooseTakeSet(grid, tokens) {
    var base = boardScore(grid);
    var set = [], curNet = 0;
    for (;;) {
      var best = null, bestNet = curNet;
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (set.indexOf(t) !== -1) continue;
        if (!R.canAddToSet(set, t)) continue;
        var cand = set.concat([t]);
        var gp = greedyPlace(grid, cand);
        var placed = cand.length - gp.overflow;
        // floorPenalty(overflow) is <= 0; FILL_EPS*placed breaks exact ties.
        var net = (gp.score - base) + R.floorPenalty(gp.overflow) + FILL_EPS * placed;
        if (net > bestNet + 1e-9) { bestNet = net; best = t; }
      }
      if (!best) break;
      set.push(best);
      curNet = bestNet;
    }
    return { set: set, net: curNet };
  }

  // Decide which source to draft from and which tokens to take. Considers every
  // non-empty factory and the center; picks the highest-net take-set, breaking
  // ties toward factories (taking from the center first also grabs the dealer
  // button, which lands on the floor as a penalty).
  function planDraft(game) {
    var grid = game.currentPlayer().grid;
    var best = null;

    game.factories.forEach(function (f, idx) {
      if (!f.tokens.length) return;
      var plan = chooseTakeSet(grid, f.tokens);
      if (!best || plan.net > best.net) {
        best = { type: "factory", index: idx, set: plan.set, net: plan.net };
      }
    });

    if (game.center.length) {
      var cplan = chooseTakeSet(grid, game.center);
      // Strict ">" keeps the factory on ties.
      if (!best || cplan.net > best.net) {
        best = { type: "center", index: -1, set: cplan.set, net: cplan.net };
      }
    }
    return best;
  }

  // --- Placement -------------------------------------------------------------

  // Pick the held token and empty cell that maximize boardScore on the real
  // grid. Returns { held, r, c } or null if the grid is full.
  function planPlacement(game) {
    var grid = game.currentPlayer().grid, held = game.held;
    var n = R.GRID_SIZE, best = null, bestS = -Infinity;
    for (var hi = 0; hi < held.length; hi++) {
      var tok = held[hi];
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (grid[r][c]) continue;
          grid[r][c] = tok;
          var s = boardScore(grid);
          grid[r][c] = null;
          if (s > bestS) { bestS = s; best = { held: hi, r: r, c: c }; }
        }
      }
    }
    return best;
  }

  // --- Driver: perform one atomic action for the current AI seat -------------

  function step(game) {
    switch (game.phase) {
      case "SELECT_SOURCE": {
        var plan = planDraft(game);
        if (!plan) return; // nothing to take (shouldn't happen mid-round)
        game._aiTakeIds = plan.set.map(function (t) { return t.id; });
        if (plan.type === "factory") game.selectFactory(plan.index);
        else game.selectCenter();
        break;
      }

      case "SELECT_RAINBOW": {
        var want = game._aiTakeIds;
        // Recover the plan if it went missing (e.g. unexpected re-entry).
        if (!want || !want.length) {
          want = chooseTakeSet(game.currentPlayer().grid, game.revealed)
            .set.map(function (t) { return t.id; });
          game._aiTakeIds = want;
        }
        var pending = null;
        for (var i = 0; i < game.revealed.length; i++) {
          var tok = game.revealed[i];
          if (want.indexOf(tok.id) !== -1 && game.takeSet.indexOf(tok) === -1) {
            pending = tok; break;
          }
        }
        if (pending) game.toggleToken(pending);
        else if (game.takeSet.length) game.confirmTake();
        else game.cancelSelection(); // empty plan: back out and re-pick
        break;
      }

      case "PLACE": {
        if (game.currentPlayer().emptyCells() > 0) {
          var pp = planPlacement(game);
          if (pp) {
            game.setActiveHeld(pp.held);
            game.placeOnGrid(pp.r, pp.c);
          } else {
            game.sendToFloor();
          }
        } else {
          // Grid full: leftover cards are forced to the floor (engine routes a
          // full floor through PAY_GOLD as needed).
          game.sendToFloor();
        }
        break;
      }

      case "PAY_GOLD":
        // Affordability was already checked by the engine before entering this
        // phase, so confirming always makes progress.
        game.confirmPayGold();
        break;
    }
  }

  // Called every frame from main.js's loop.
  function tick(game, now) {
    if (!game) return;

    // Hotseat hand-off: only auto-advance when the NEXT player is also an AI so
    // AI->AI turns don't stall on the 5s pass screen. A human-next hand-off
    // keeps the normal tap / auto-advance behavior (handled in main.js).
    if (game.phase === "PASS_TURN") {
      if (game.nextPlayer().controller.type === "ai" &&
          now - (game._aiLast || 0) >= PASS_STEP_MS) {
        game._aiLast = now;
        game.passTurn();
      }
      return;
    }

    var cur = game.currentPlayer();
    if (!cur || !cur.controller || cur.controller.type !== "ai") return;

    var actable = game.phase === "SELECT_SOURCE" || game.phase === "SELECT_RAINBOW" ||
      game.phase === "PLACE" || game.phase === "PAY_GOLD";
    if (!actable) return;

    if (now - (game._aiLast || 0) < STEP_MS) return;
    game._aiLast = now;
    step(game);
  }

  P.ai = {
    STEP_MS: STEP_MS,
    tick: tick,
    // exposed for tests / debugging
    boardScore: boardScore,
    greedyPlace: greedyPlace,
    chooseTakeSet: chooseTakeSet,
    planDraft: planDraft,
    planPlacement: planPlacement,
  };
})(window.Pozule = window.Pozule || {});
