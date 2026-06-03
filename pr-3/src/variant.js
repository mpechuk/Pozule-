/*
 * variant.js — selects the active game variant from the `?variant=` URL param
 * and exposes its deck spec, theme and labels on the global `Pozule` namespace.
 *
 * IMPORTANT: this must load BEFORE deck.js, poker.js, game.js and render.js,
 * because those modules capture `P.deck` / `P.rules` at load time and the deck
 * is built from the chosen variant's `deck` spec.
 */
(function (P) {
  "use strict";

  // ---- Classic: four standard 52-card decks (Azul × Poker) -----------------

  var CLASSIC_SUITS = [
    { key: "S", name: "Spades", symbol: "♠", color: "#1a1a1a" },
    { key: "H", name: "Hearts", symbol: "♥", color: "#c01b1b" },
    { key: "D", name: "Diamonds", symbol: "♦", color: "#c01b1b" },
    { key: "C", name: "Clubs", symbol: "♣", color: "#1a1a1a" },
  ];
  var CLASSIC_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  var CLASSIC_VALUES = {};
  CLASSIC_RANKS.forEach(function (r, i) { CLASSIC_VALUES[r] = i + 2; });

  var classic = {
    id: "classic",
    deck: {
      suits: CLASSIC_SUITS,
      ranks: CLASSIC_RANKS,
      values: CLASSIC_VALUES,
      // `decks` copies of a standard 52-card deck.
      buildBag: function (makeToken, decks) {
        var bag = [], n = 0;
        for (var d = 0; d < decks; d++) {
          for (var s = 0; s < CLASSIC_SUITS.length; s++) {
            for (var r = 0; r < CLASSIC_RANKS.length; r++) {
              bag.push(makeToken("t" + n++, CLASSIC_RANKS[r], CLASSIC_SUITS[s].key));
            }
          }
        }
        return bag;
      },
    },
    theme: {
      bgTop: "#0d3022", bgBottom: "#082016",
      factoryFill: "#2f7d4f", factoryEmpty: "#21402f", factoryStroke: "#6b4a23",
      centerFill: "#243a2c",
      cardBackFill: "#7a1020", cardBackInk: "#f0d68a", cardBackSymbol: "♠",
    },
    labels: {
      title: "POZULE",
      subtitle: "Azul × Poker",
      factoryLabel: "Table",
      centerLabel: "The Muck (center)",
      sourcePrompt: "choose a glowing table or the center.",
      draftPrompt: "Choose your rainbow set:",
      placePrompt: "Holding — click the grid to place, or send to floor:",
      shuffleTitle: "Shuffling the deck…",
    },
    dom: {
      title: "Pozule — Azul × Poker",
      h1: "POZULE",
      ponds: false,
      tag: 'A mash-up of <strong>Azul</strong> and <strong>poker</strong>.',
      how:
        "Flip a poker-table <em>flop</em>, draft a rainbow set (no shared rank " +
        "or suit), and build poker hands across the rows, columns and diagonals " +
        "of your 5×5 grid. Overflow lands on the floor; pay gold to keep playing.",
    },
  };

  // ---- Ponds: a full mahjong deck (no poker) -------------------------------
  //
  // Tile -> rank/suit/value mapping (continuous value ladder so every combo
  // stays reachable):
  //   Dots/Bamboo/Characters 1-9 .. values 1-9, suits dots/bam/chr
  //   Winds  E,S,W,N ............ values 10-13, suit honor
  //   Dragons Wh,Gr,Rd .......... values 14-16, suit honor
  //   Flowers (4) ............... all rank "Fl", value 17, suit bonus (match)
  //   Seasons (4) ............... all rank "Se", value 18, suit bonus (match)

  var PONDS_SUITS = [
    { key: "dots", name: "Dots", symbol: "●", color: "#10527a" },
    { key: "bam", name: "Bamboo", symbol: "竹", color: "#1f7a3d" },
    { key: "chr", name: "Characters", symbol: "萬", color: "#a4232b" },
    { key: "honor", name: "Honors", symbol: "中", color: "#7a4ea0" },
    { key: "bonus", name: "Bonus", symbol: "花", color: "#b8791f" },
  ];

  // Display labels are short so they fit on a tile face.
  var PONDS_VALUES = {
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
    "E": 10, "S": 11, "W": 12, "N": 13, // winds
    "Wh": 14, "Gr": 15, "Rd": 16,       // dragons
    "Fl": 17, "Se": 18,                  // flowers, seasons (match-only)
  };
  var PONDS_RANKS = Object.keys(PONDS_VALUES);

  var ponds = {
    id: "ponds",
    deck: {
      suits: PONDS_SUITS,
      ranks: PONDS_RANKS,
      values: PONDS_VALUES,
      // A full 144-tile mahjong set. The `decks` argument is ignored.
      buildBag: function (makeToken) {
        var bag = [], n = 0;
        var numberSuits = ["dots", "bam", "chr"];
        for (var s = 0; s < numberSuits.length; s++) {
          for (var num = 1; num <= 9; num++) {
            for (var c = 0; c < 4; c++) {
              bag.push(makeToken("t" + n++, "" + num, numberSuits[s]));
            }
          }
        }
        var winds = ["E", "S", "W", "N"];
        for (var w = 0; w < winds.length; w++) {
          for (var wc = 0; wc < 4; wc++) bag.push(makeToken("t" + n++, winds[w], "honor"));
        }
        var dragons = ["Wh", "Gr", "Rd"];
        for (var d = 0; d < dragons.length; d++) {
          for (var dc = 0; dc < 4; dc++) bag.push(makeToken("t" + n++, dragons[d], "honor"));
        }
        // Four distinct flowers and four distinct seasons, one of each, but all
        // flowers share rank "Fl" and all seasons share rank "Se" (matches).
        for (var f = 0; f < 4; f++) bag.push(makeToken("t" + n++, "Fl", "bonus"));
        for (var se = 0; se < 4; se++) bag.push(makeToken("t" + n++, "Se", "bonus"));
        return bag;
      },
    },
    theme: {
      bgTop: "#0d3a4a", bgBottom: "#06181f",
      factoryFill: "#2f86b0", factoryEmpty: "#1d4250", factoryStroke: "#3f6f55",
      centerFill: "#1d4250",
      cardBackFill: "#13506e", cardBackInk: "#bfe6f0", cardBackSymbol: "花",
    },
    labels: {
      title: "POZULE",
      subtitle: "Ponds",
      factoryLabel: "Pond",
      centerLabel: "The Pool",
      sourcePrompt: "choose a glowing pond or the pool.",
      draftPrompt: "Choose your set (no two share a kind or a suit):",
      placePrompt: "Holding — click the grid to place, or send to floor:",
      shuffleTitle: "Stirring the waters…",
    },
    dom: {
      title: "Pozule — Ponds",
      h1: "POZULE",
      ponds: true,
      tag: "A tile-matching variant played across <strong>ponds</strong>.",
      how:
        "Stir a <em>pond</em>, draft a set where no two tiles share a kind or a " +
        "suit, and build matching combos across the rows, columns and diagonals " +
        "of your 5×5 grid. Overflow lands on the floor; pay gold to keep playing." +
        "<br><br><strong>Combos (best present in each line scores):</strong><br>" +
        "Grand Run (100) · Suited Run, five in sequence of one suit (75) · " +
        "Four of a Kind (50) · Full House, three + a pair (40) · " +
        "Suited, five of one suit (30) · Run, five in sequence (25) · " +
        "Three of a Kind (15) · Two Pair (10) · One Pair (5).<br>" +
        "Flowers all match one another; seasons all match one another.",
    },
  };

  var VARIANTS = { classic: classic, ponds: ponds };

  function readVariantId() {
    try {
      var params = new URLSearchParams(window.location.search);
      var id = params.get("variant");
      if (id && VARIANTS[id]) return id;
    } catch (e) { /* older browsers / file:// quirks */ }
    return "classic";
  }

  P.VARIANTS = VARIANTS;
  P.variantId = readVariantId();
  P.variant = VARIANTS[P.variantId];
})(window.Pozule = window.Pozule || {});
