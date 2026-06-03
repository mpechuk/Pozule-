/*
 * game.js — the Pozule engine: rounds, turns, drafting, placement, gold and
 * scoring. Pure logic; it knows nothing about canvas or DOM. The renderer reads
 * the public state and the engine fires `onChange` after every mutation.
 *
 * Phases:
 *   SELECT_SOURCE  -> pick a factory flop or the center
 *   SELECT_RAINBOW -> toggle a rainbow take-set, then confirm
 *   PLACE          -> seat held tokens onto the grid or send them to the floor
 *   PAY_GOLD       -> confirm paying to clear a full floor slot
 *   GAME_OVER      -> final scores shown
 */
(function (P) {
  "use strict";

  var deck = P.deck;
  var R = P.rules;

  function Game(playerDefs) {
    this.players = playerDefs.map(function (d, i) {
      return new P.Player(i, d.name, d.controller);
    });
    this.onChange = null;       // set by main.js
    this.message = "";
    this.bag = deck.shuffle(deck.makeBag(R.BAG_DECKS));
    this.discard = [];
    this.factories = [];
    this.center = [];
    this.dealerInCenter = true;

    this.current = 0;
    this.startPlayer = 0;
    this.round = 1;

    this.endTriggered = false;
    this.finalNeed = 0;
    this.finalDone = 0;

    // Round-transition state.
    this.shuffleStart = 0;          // performance.now() when SHUFFLING began
    this.lastDealerReturn = null;   // { name, cost } shown during shuffle

    // Per-turn working state.
    this.phase = "SELECT_SOURCE";
    this.source = null;          // { type:"factory"|"center", index }
    this.revealed = [];          // tokens currently face up for drafting
    this.takeSet = [];           // chosen rainbow subset (ids -> tokens)
    this.held = [];              // tokens taken, awaiting placement
    this.activeHeld = 0;         // index of held token being placed
    this.pendingFloor = null;    // token awaiting PAY_GOLD confirmation

    this._refillFactories();
    this.message = this.players[this.current].name + ": pick a factory or the center.";
  }

  Game.prototype._notify = function () { if (this.onChange) this.onChange(this); };

  Game.prototype._draw = function () {
    if (this.bag.length === 0) {
      // Reshuffle the discard pile back into the bag (Azul rule).
      if (this.discard.length === 0) return null;
      this.bag = deck.shuffle(this.discard);
      this.discard = [];
    }
    return this.bag.pop();
  };

  Game.prototype._refillFactories = function () {
    var count = R.factoryCount(this.players.length);
    this.factories = [];
    for (var f = 0; f < count; f++) {
      var tokens = [];
      for (var i = 0; i < R.FLOP_SIZE; i++) {
        var t = this._draw();
        if (t) tokens.push(t);
      }
      this.factories.push({ tokens: tokens, flipped: false, revealAt: 0 });
    }
    this.center = [];
    this.dealerInCenter = true;
  };

  Game.prototype.tableEmpty = function () {
    var factoriesEmpty = this.factories.every(function (f) { return f.tokens.length === 0; });
    return factoriesEmpty && this.center.length === 0;
  };

  Game.prototype.currentPlayer = function () { return this.players[this.current]; };

  // --- Source selection ------------------------------------------------------

  Game.prototype.selectFactory = function (index) {
    if (this.phase !== "SELECT_SOURCE") return;
    var f = this.factories[index];
    if (!f || f.tokens.length === 0) return;
    f.flipped = true;
    f.revealAt = performance.now();
    this.source = { type: "factory", index: index };
    this.revealed = f.tokens.slice();
    this.takeSet = [];
    this.phase = "SELECT_RAINBOW";
    this.message = "Select a rainbow set (no shared rank or suit), then Take.";
    this._notify();
  };

  Game.prototype.selectCenter = function () {
    if (this.phase !== "SELECT_SOURCE") return;
    if (this.center.length === 0) return;
    this.source = { type: "center", index: -1 };
    this.revealed = this.center.slice();
    this.takeSet = [];
    this.phase = "SELECT_RAINBOW";
    this.message = "Select a rainbow set from the center, then Take.";
    this._notify();
  };

  // --- Rainbow selection -----------------------------------------------------

  Game.prototype.canToggle = function (token) {
    if (this._inTakeSet(token)) return true;            // can always deselect
    return R.canAddToSet(this.takeSet, token);          // else must be rainbow
  };

  Game.prototype._inTakeSet = function (token) {
    return this.takeSet.indexOf(token) !== -1;
  };

  Game.prototype.toggleToken = function (token) {
    if (this.phase !== "SELECT_RAINBOW") return;
    var idx = this.takeSet.indexOf(token);
    if (idx !== -1) {
      this.takeSet.splice(idx, 1);
    } else if (R.canAddToSet(this.takeSet, token)) {
      this.takeSet.push(token);
    } else {
      this.message = "That card shares a rank or suit with your set.";
      this._notify();
      return;
    }
    this._notify();
  };

  Game.prototype.cancelSelection = function () {
    if (this.phase !== "SELECT_RAINBOW") return;
    this.phase = "SELECT_SOURCE";
    this.source = null;
    this.revealed = [];
    this.takeSet = [];
    this.message = this.currentPlayer().name + ": pick a factory or the center.";
    this._notify();
  };

  Game.prototype.confirmTake = function () {
    if (this.phase !== "SELECT_RAINBOW") return;
    if (this.takeSet.length === 0) {
      this.message = "You must take at least one card.";
      this._notify();
      return;
    }
    var taken = this.takeSet.slice();
    var takenIds = {};
    taken.forEach(function (t) { takenIds[t.id] = true; });
    var leftovers = this.revealed.filter(function (t) { return !takenIds[t.id]; });

    if (this.source.type === "factory") {
      this.factories[this.source.index].tokens = [];
      // Leftovers spill into the center.
      this.center = this.center.concat(leftovers);
    } else {
      // From the center: leftovers stay; remove taken ones.
      this.center = leftovers;
      // First center-take of the round grabs the dealer button.
      if (this.dealerInCenter) {
        this.dealerInCenter = false;
        this.startPlayer = this.current;
        var p = this.currentPlayer();
        p.floor.push(deck.makeDealerButton());
        this.message = this.currentPlayer().name + " takes the dealer button.";
      }
    }

    this.held = taken;
    this.activeHeld = 0;
    this.revealed = [];
    this.takeSet = [];
    this.source = null;
    this.phase = "PLACE";
    this._placeMessage();
    this._notify();
  };

  // --- Placement -------------------------------------------------------------

  Game.prototype._placeMessage = function () {
    if (this.held.length === 0) { this.message = ""; return; }
    this.message = "Place cards on your grid, or send them to the floor (" +
      this.held.length + " left).";
  };

  Game.prototype.setActiveHeld = function (index) {
    if (this.phase !== "PLACE") return;
    if (index < 0 || index >= this.held.length) return;
    this.activeHeld = index;
    this._notify();
  };

  Game.prototype.placeOnGrid = function (r, c) {
    if (this.phase !== "PLACE" || this.held.length === 0) return;
    var p = this.currentPlayer();
    if (p.grid[r][c]) return;
    var token = this.held.splice(this.activeHeld, 1)[0];
    p.place(token, r, c);
    if (this.activeHeld >= this.held.length) this.activeHeld = Math.max(0, this.held.length - 1);
    this._afterPlacement();
  };

  // Try to floor the active held token. May require a gold payment.
  Game.prototype.sendToFloor = function () {
    if (this.phase !== "PLACE" || this.held.length === 0) return;
    var p = this.currentPlayer();
    var token = this.held[this.activeHeld];

    if (!p.floorIsFull()) {
      this.held.splice(this.activeHeld, 1);
      p.floor.push(token);
      if (this.activeHeld >= this.held.length) this.activeHeld = Math.max(0, this.held.length - 1);
      this._afterPlacement();
      return;
    }

    // Floor is full. Pay gold to clear the rightmost (most expensive) slot.
    var cost = R.clearCost(p.floor.length);
    if (p.gold >= cost) {
      this.pendingFloor = token;
      this.phase = "PAY_GOLD";
      this.message = "Floor is full. Pay " + cost + " gold to clear the bottom slot?";
      this._notify();
    } else if (p.emptyCells() > 0) {
      this.message = "Not enough gold (" + cost + "). Place this card on your grid.";
      this._notify();
    } else {
      // Grid full and can't pay: discard the card, penalty forgiven (rare).
      this.held.splice(this.activeHeld, 1);
      this.discard.push(token);
      if (this.activeHeld >= this.held.length) this.activeHeld = Math.max(0, this.held.length - 1);
      this.message = "No room and no gold — card discarded.";
      this._afterPlacement();
    }
  };

  Game.prototype.confirmPayGold = function () {
    if (this.phase !== "PAY_GOLD") return;
    var p = this.currentPlayer();
    var cost = R.clearCost(p.floor.length);
    p.gold -= cost;
    var cleared = p.floor.pop();        // rightmost slot, penalty forgiven
    this.discard.push(cleared);
    p.floor.push(this.pendingFloor);    // new card seats in the freed slot
    // Remove the floored card from held.
    var idx = this.held.indexOf(this.pendingFloor);
    if (idx !== -1) this.held.splice(idx, 1);
    if (this.activeHeld >= this.held.length) this.activeHeld = Math.max(0, this.held.length - 1);
    this.pendingFloor = null;
    this.phase = "PLACE";
    this._afterPlacement();
  };

  Game.prototype.cancelPayGold = function () {
    if (this.phase !== "PAY_GOLD") return;
    this.pendingFloor = null;
    this.phase = "PLACE";
    this._placeMessage();
    this._notify();
  };

  // After any held token is resolved, either continue placing or end the turn.
  Game.prototype._afterPlacement = function () {
    var p = this.currentPlayer();
    // Auto-finish: if the grid is full, leftover held cards must hit the floor.
    if (this.held.length > 0 && p.emptyCells() === 0 && this.phase === "PLACE") {
      // Force the next token to the floor (handles gold prompt itself).
      this._placeMessage();
      this._notify();
      return;
    }
    if (this.held.length === 0) {
      this._endTurn();
      return;
    }
    this._placeMessage();
    this._notify();
  };

  // --- Turn / round flow -----------------------------------------------------

  Game.prototype._endTurn = function () {
    var p = this.currentPlayer();

    if (!this.endTriggered && p.gridFull()) {
      this.endTriggered = true;
      this.finalNeed = this.players.length - 1; // others get one last turn
      this.finalDone = 0;
      this.message = p.name + " filled the grid! Everyone else gets one last turn.";
    } else if (this.endTriggered) {
      this.finalDone++;
    }

    this.current = (this.current + 1) % this.players.length;

    if (this.endTriggered && (this.finalDone >= this.finalNeed || this.tableEmpty())) {
      this._finalScoring();
      return;
    }

    if (!this.endTriggered && this.tableEmpty()) {
      this._startShuffle();
      return;
    }

    this.phase = "SELECT_SOURCE";
    if (!this.message) this.message = this.currentPlayer().name + ": pick a factory or the center.";
    else this.message += "  " + this.currentPlayer().name + "'s turn.";
    this._notify();
  };

  // The dealer button is returned to the center at the start of each new round:
  // its holder automatically pays gold equal to the floor slot it occupies, the
  // slot is freed, and that player will deal (go first) next round.
  Game.prototype._returnDealerButton = function () {
    this.lastDealerReturn = null;
    for (var i = 0; i < this.players.length; i++) {
      var pl = this.players[i];
      var idx = pl.floor.findIndex(function (t) { return t && t.dealer; });
      if (idx === -1) continue;
      var slot = Math.min(idx, R.FLOOR_SLOTS - 1);
      var cost = Math.abs(R.FLOOR_PENALTIES[slot]);
      pl.gold = Math.max(0, pl.gold - cost);
      pl.floor.splice(idx, 1);
      this.startPlayer = pl.id;            // dealer goes first next round
      this.lastDealerReturn = { name: pl.name, cost: cost };
      break;
    }
  };

  // Begin the between-rounds "shuffle": return the dealer button, then show the
  // shuffling animation. main.js calls finishShuffle() once SHUFFLE_MS elapses.
  Game.prototype._startShuffle = function () {
    this.round += 1;
    this._returnDealerButton();
    this.phase = "SHUFFLING";
    this.shuffleStart = performance.now();
    this.message = "Shuffling… Round " + this.round +
      (this.lastDealerReturn
        ? " (" + this.lastDealerReturn.name + " pays " + this.lastDealerReturn.cost +
          " gold to pass the button)"
        : "");
    this._notify();
  };

  Game.prototype.finishShuffle = function () {
    if (this.phase !== "SHUFFLING") return;
    this._refillFactories();             // also returns the button to the center
    this.current = this.startPlayer;
    this.phase = "SELECT_SOURCE";
    this.message = this.currentPlayer().name +
      " deals and goes first — pick a factory or the center.";
    this._notify();
  };

  Game.prototype._finalScoring = function () {
    this.phase = "GAME_OVER";
    var results = this.players.map(function (pl) {
      var s = pl.score();
      s.name = pl.name;
      s.id = pl.id;
      return s;
    });
    results.sort(function (a, b) { return b.total - a.total; });
    this.results = results;
    this.message = "Game over — " + results[0].name + " wins with " + results[0].total + "!";
    this._notify();
  };

  P.Game = Game;
})(window.Pozule = window.Pozule || {});
