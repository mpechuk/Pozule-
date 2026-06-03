/*
 * deck.js — card/token model and the bag.
 * Attaches to the global `Pozule` namespace (classic script, no bundler).
 */
(function (P) {
  "use strict";

  // Suits. `color` drives the red/black rendering of poker pips.
  var SUITS = [
    { key: "S", name: "Spades", symbol: "♠", color: "#1a1a1a" },
    { key: "H", name: "Hearts", symbol: "♥", color: "#c01b1b" },
    { key: "D", name: "Diamonds", symbol: "♦", color: "#c01b1b" },
    { key: "C", name: "Clubs", symbol: "♣", color: "#1a1a1a" },
  ];

  // Ranks low -> high. Value = index + 2, so A == 14.
  var RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

  var SUIT_BY_KEY = {};
  SUITS.forEach(function (s) { SUIT_BY_KEY[s.key] = s; });

  function rankValue(rank) {
    return RANKS.indexOf(rank) + 2;
  }

  function suitInfo(key) {
    return SUIT_BY_KEY[key];
  }

  // A single drafted token (a poker card on a tile).
  function makeToken(id, rank, suitKey) {
    return { id: id, rank: rank, suit: suitKey };
  }

  // The dealer/first-player button. Behaves like a token for floor placement
  // but carries no rank/suit and scores nothing on the grid.
  function makeDealerButton() {
    return { id: "dealer", dealer: true };
  }

  // A bag built from `decks` copies of a standard 52-card deck.
  function makeBag(decks) {
    var bag = [];
    var n = 0;
    for (var d = 0; d < decks; d++) {
      for (var s = 0; s < SUITS.length; s++) {
        for (var r = 0; r < RANKS.length; r++) {
          bag.push(makeToken("t" + n++, RANKS[r], SUITS[s].key));
        }
      }
    }
    return bag;
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
