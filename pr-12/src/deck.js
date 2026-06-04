/*
 * deck.js — card/token model and the bag.
 * Attaches to the global `Pozule` namespace (classic script, no bundler).
 *
 * The suits, ranks, value ladder and bag composition all come from the active
 * variant's `deck` spec (see variant.js), so the same engine drives both the
 * classic poker deck and the mahjong "ponds" deck.
 */
(function (P) {
  "use strict";

  var spec = (P.variant && P.variant.deck) || {
    suits: [], ranks: [], values: {}, buildBag: function () { return []; },
  };

  var SUITS = spec.suits;
  var RANKS = spec.ranks;
  var VALUES = spec.values;

  var SUIT_BY_KEY = {};
  SUITS.forEach(function (s) { SUIT_BY_KEY[s.key] = s; });

  function rankValue(rank) {
    return VALUES[rank];
  }

  function suitInfo(key) {
    return SUIT_BY_KEY[key];
  }

  // A single drafted token (a tile carrying a rank and a suit).
  function makeToken(id, rank, suitKey) {
    return { id: id, rank: rank, suit: suitKey };
  }

  // The dealer/first-player button. Behaves like a token for floor placement
  // but carries no rank/suit and scores nothing on the grid.
  function makeDealerButton() {
    return { id: "dealer", dealer: true };
  }

  // The bag for the active variant. `decks` is a multiplier for variants that
  // stack standard decks (classic); fixed-size sets (ponds) ignore it.
  function makeBag(decks) {
    return spec.buildBag(makeToken, decks);
  }

  // In-place Fisher-Yates shuffle.
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  P.deck = {
    SUITS: SUITS,
    RANKS: RANKS,
    rankValue: rankValue,
    suitInfo: suitInfo,
    makeToken: makeToken,
    makeDealerButton: makeDealerButton,
    makeBag: makeBag,
    shuffle: shuffle,
  };
})(window.Pozule = window.Pozule || {});
