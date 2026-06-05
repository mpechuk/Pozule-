/*
 * player.js — Player state (grid, floor, gold) plus the controller seam.
 *
 * The Game only ever asks a player's `controller` to make decisions, so a
 * future AIController can drop in without touching the game loop. Today the
 * HumanController is event-driven (the engine waits for UI intents), so its
 * methods are placeholders; the AIController is a stub.
 */
(function (P) {
  "use strict";

  var R = P.rules;
  var poker = P.poker;

  function Player(id, name, controller) {
    this.id = id;
    this.name = name;
    this.controller = controller || new HumanController();
    // 5x5 grid of tokens (null = empty).
    this.grid = [];
    for (var r = 0; r < R.GRID_SIZE; r++) {
      this.grid.push(new Array(R.GRID_SIZE).fill(null));
    }
    this.floor = [];          // tokens (and possibly the dealer button)
    this.gold = R.STARTING_GOLD;
    this.isStartPlayer = false;
  }

  Player.prototype.emptyCells = function () {
    var n = 0;
    for (var r = 0; r < R.GRID_SIZE; r++) {
      for (var c = 0; c < R.GRID_SIZE; c++) {
        if (!this.grid[r][c]) n++;
      }
    }
    return n;
  };

  Player.prototype.gridFull = function () {
    return this.emptyCells() === 0;
  };

  Player.prototype.place = function (token, r, c) {
    if (this.grid[r][c]) return false;
    this.grid[r][c] = token;
    return true;
  };

  Player.prototype.floorIsFull = function () {
    return this.floor.length >= R.FLOOR_SLOTS;
  };

  Player.prototype.floorPenalty = function () {
    // Count occupied slots (cap at slot count; extras can't exist).
    return R.floorPenalty(Math.min(this.floor.length, R.FLOOR_SLOTS));
  };

  // The 12 scoring lines: 5 rows, 5 columns, 2 main diagonals.
  Player.prototype.lines = function () {
    var g = this.grid, n = R.GRID_SIZE, out = [], r, c, line;
    for (r = 0; r < n; r++) {
      line = [];
      for (c = 0; c < n; c++) line.push(g[r][c]);
      out.push({ name: "Row " + (r + 1), cells: line });
    }
    for (c = 0; c < n; c++) {
      line = [];
      for (r = 0; r < n; r++) line.push(g[r][c]);
      out.push({ name: "Col " + (c + 1), cells: line });
    }
    line = [];
    for (r = 0; r < n; r++) line.push(g[r][r]);
    out.push({ name: "Diag ↘", cells: line });
    line = [];
    for (r = 0; r < n; r++) line.push(g[r][n - 1 - r]);
    out.push({ name: "Diag ↙", cells: line });
    return out;
  };

  // Full breakdown used by the live score and the end-game panel.
  Player.prototype.score = function () {
    var lines = this.lines();
    var lineResults = lines.map(function (l) {
      var ev = poker.evaluateLine(l.cells.filter(Boolean));
      return { name: l.name, hand: ev.hand, points: ev.points };
    });
    var linePoints = lineResults.reduce(function (s, l) { return s + l.points; }, 0);
    var penalty = this.floorPenalty();
    return {
      lines: lineResults,
      linePoints: linePoints,
      penalty: penalty,
      gold: this.gold,
      total: linePoints + penalty + this.gold,
    };
  };

  // --- Controllers -----------------------------------------------------------

  function HumanController() { this.type = "human"; }
  // Human decisions arrive via UI intents in input.js; nothing to do here.
  HumanController.prototype.chooseDraft = function () { /* event-driven */ };
  HumanController.prototype.choosePlacement = function () { /* event-driven */ };

  // An AI seat is the same controller seam as a human one. The actual decisions
  // are driven from the render loop by P.ai (see ai.js), which reads the public
  // game state and calls the same engine methods a human's clicks would — so,
  // like HumanController, these methods are intentionally inert.
  function AIController() { this.type = "ai"; }
  AIController.prototype.chooseDraft = function () { /* driven by P.ai */ };
  AIController.prototype.choosePlacement = function () { /* driven by P.ai */ };

  P.Player = Player;
  P.HumanController = HumanController;
  P.AIController = AIController;
})(window.Pozule = window.Pozule || {});
