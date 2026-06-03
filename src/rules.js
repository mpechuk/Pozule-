/*
 * rules.js — game constants and rule helpers shared by the engine and tests.
 */
(function (P) {
  "use strict";

  // Azul floor penalties, multiplied by 10 per the design.
  var FLOOR_PENALTIES = [-10, -10, -20, -20, -20, -30, -30];
  var FLOOR_SLOTS = FLOOR_PENALTIES.length;

  var STARTING_GOLD = 1000;
  var GRID_SIZE = 5;
  var FLOP_SIZE = 3;
  var BAG_DECKS = 4;

  // Azul scaling: 2*players + 1 factories (solo uses 5).
  function factoryCount(players) {
    return players <= 1 ? 5 : 2 * players + 1;
  }

  // A valid draft is a "rainbow": no two tokens share a rank, and no two share
  // a suit. The dealer button is ignored for this check.
  function isRainbowSet(tokens) {
    var ranks = {}, suits = {};
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.dealer) continue;
      if (ranks[t.rank] || suits[t.suit]) return false;
      ranks[t.rank] = true;
      suits[t.suit] = true;
    }
    return true;
  }

  // Can `token` join the current take-set without clashing on rank or suit?
  function canAddToSet(set, token) {
    if (token.dealer) return false;
    for (var i = 0; i < set.length; i++) {
      if (set[i].rank === token.rank || set[i].suit === token.suit) return false;
    }
    return true;
  }

  // Gold cost to clear a full floor: the penalty of the rightmost filled slot.
  function clearCost(filledCount) {
    if (filledCount <= 0) return 0;
    return Math.abs(FLOOR_PENALTIES[filledCount - 1]);
  }

  // Total penalty for a floor holding `filledCount` tokens.
  function floorPenalty(filledCount) {
    var sum = 0;
    for (var i = 0; i < filledCount && i < FLOOR_SLOTS; i++) {
      sum += FLOOR_PENALTIES[i];
    }
    return sum;
  }

  P.rules = {
    FLOOR_PENALTIES: FLOOR_PENALTIES,
    FLOOR_SLOTS: FLOOR_SLOTS,
    STARTING_GOLD: STARTING_GOLD,
    GRID_SIZE: GRID_SIZE,
    FLOP_SIZE: FLOP_SIZE,
    BAG_DECKS: BAG_DECKS,
    factoryCount: factoryCount,
    isRainbowSet: isRainbowSet,
    canAddToSet: canAddToSet,
    clearCost: clearCost,
    floorPenalty: floorPenalty,
  };
})(window.Pozule = window.Pozule || {});
