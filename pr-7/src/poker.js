/*
 * poker.js — pure poker-hand evaluation for a single grid line.
 * A "line" is 0..5 tokens (a row, column, or main diagonal).
 */
(function (P) {
  "use strict";

  var rankValue = P.deck.rankValue;

  // Hand name -> point value. Higher is better; also used for tie-break order.
  var HAND_POINTS = {
    "Royal Flush": 100,
    "Straight Flush": 75,
    "Four of a Kind": 50,
    "Full House": 40,
    "Flush": 30,
    "Straight": 25,
    "Three of a Kind": 15,
    "Two Pair": 10,
    "One Pair": 5,
    "High Card": 0,
    "Empty": 0,
  };

  // Detect a straight from exactly 5 distinct rank values. Handles the wheel
  // (A-2-3-4-5). Returns true/false.
  function isStraight(values) {
    if (values.length !== 5) return false;
    var uniq = {};
    for (var i = 0; i < values.length; i++) {
      if (uniq[values[i]]) return false; // duplicate rank -> not a straight
      uniq[values[i]] = true;
    }
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    // Wheel: A(14),2,3,4,5
    if (sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 4 &&
        sorted[3] === 5 && sorted[4] === 14) {
      return true;
    }
    return sorted[4] - sorted[0] === 4;
  }

  /*
   * Evaluate the best poker hand present in a line.
   * `cards` is an array of tokens (real cards only; dealer button excluded by
   * the caller). Length 0..5. Flush/Straight/Straight Flush/Royal require all
   * five cells filled; the made-pair family scores on partial lines too.
   */
  function evaluateLine(cards) {
    cards = (cards || []).filter(function (c) { return c && !c.dealer; });
    if (cards.length === 0) return { hand: "Empty", points: 0 };

    var full = cards.length === 5;
    var values = cards.map(function (c) { return rankValue(c.rank); });

    // Rank multiplicity counts, sorted descending (e.g. [3,2] for a full house).
    var byRank = {};
    values.forEach(function (v) { byRank[v] = (byRank[v] || 0) + 1; });
    var counts = Object.keys(byRank).map(function (k) { return byRank[k]; })
      .sort(function (a, b) { return b - a; });

    var flush = full && cards.every(function (c) { return c.suit === cards[0].suit; });
    var straight = full && isStraight(values);

    var hand;
    if (flush && straight) {
      // Royal when the straight tops out at Ace high (10-J-Q-K-A).
      var max = Math.max.apply(null, values);
      var hasTen = values.indexOf(10) !== -1;
      hand = (max === 14 && hasTen) ? "Royal Flush" : "Straight Flush";
    } else if (counts[0] === 4) {
      hand = "Four of a Kind";
    } else if (counts[0] === 3 && counts[1] === 2) {
      hand = "Full House";
    } else if (flush) {
      hand = "Flush";
    } else if (straight) {
      hand = "Straight";
    } else if (counts[0] === 3) {
      hand = "Three of a Kind";
    } else if (counts[0] === 2 && counts[1] === 2) {
      hand = "Two Pair";
    } else if (counts[0] === 2) {
      hand = "One Pair";
    } else {
      hand = "High Card";
    }

    return { hand: hand, points: HAND_POINTS[hand] };
  }

  P.poker = {
    HAND_POINTS: HAND_POINTS,
    isStraight: isStraight,
    evaluateLine: evaluateLine,
  };
})(window.Pozule = window.Pozule || {});
