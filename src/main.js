/*
 * main.js — bootstrap: read the player count, build a Game, and run a
 * continuous render loop (so flip animations and live stats stay smooth).
 */
(function (P) {
  "use strict";

  var canvas, ctx, game = null;

  function startGame(numPlayers) {
    var defs = [];
    for (var i = 0; i < numPlayers; i++) {
      defs.push({ name: "Player " + (i + 1), controller: new P.HumanController() });
    }
    game = new P.Game(defs);
    game.onChange = function () { /* render loop redraws every frame */ };
    document.getElementById("setup").style.display = "none";
    canvas.style.display = "block";
  }

  function backToSetup() {
    game = null;
    canvas.style.display = "none";
    document.getElementById("setup").style.display = "flex";
  }

  function loop() {
    if (game) {
      if (game.phase === "SHUFFLING" &&
          performance.now() - game.shuffleStart >= P.rules.SHUFFLE_MS) {
        game.finishShuffle();
      }
      if (game.phase === "PASS_TURN" &&
          performance.now() - game.passStart >= P.rules.PASS_MS) {
        game.passTurn();
      }
      P.render.draw(ctx, game);
    }
    requestAnimationFrame(loop);
  }

  // Reflect the active variant (chosen from the ?variant= URL param) into the
  // setup screen copy, document title and theme.
  function applyVariant() {
    var dom = P.variant.dom;
    document.title = dom.title;
    var titleEl = document.getElementById("setupTitle");
    var tagEl = document.getElementById("setupTag");
    var howEl = document.getElementById("setupHow");
    // Variants may supply a bitmap logo (dom.logo) to show in place of the
    // text wordmark; fall back to the plain title when none is provided.
    if (titleEl) {
      if (dom.logo) {
        titleEl.textContent = "";
        var logo = document.createElement("img");
        logo.className = "setup-logo";
        logo.src = dom.logo;
        logo.alt = dom.h1;
        // If the artwork is missing/fails to decode, fall back to the wordmark
        // so the opening screen never renders without a title.
        logo.onerror = function () { titleEl.textContent = dom.h1; };
        titleEl.appendChild(logo);
      } else {
        titleEl.textContent = dom.h1;
      }
    }
    if (tagEl) tagEl.innerHTML = dom.tag;
    if (howEl) howEl.innerHTML = dom.how;

    var card = document.getElementById("setupCard");
    if (card) card.classList.toggle("ponds", !!dom.ponds);

    // When the variant is pinned via the ?variant= URL param, hide the variant
    // selector entirely — the choice has already been made for the player.
    var selector = document.getElementById("variantSelector");
    if (selector) selector.style.display = P.variantFromUrl ? "none" : "";

    // Highlight the active variant button.
    var vbuttons = document.querySelectorAll("[data-variant]");
    Array.prototype.forEach.call(vbuttons, function (b) {
      b.classList.toggle("active", b.getAttribute("data-variant") === P.variantId);
    });

    buildScoringGuide();
  }

  // Render the illustrated scoring guide for the active variant: one row per
  // combo (best -> worst) showing an example five-card line and the points it
  // scores. The point value is computed by running the example through the real
  // evaluator, so the guide can never disagree with how the engine scores.
  function buildScoringGuide() {
    var host = document.getElementById("scoringGuide");
    if (!host) return;
    var examples = (P.variant && P.variant.scoring) || [];
    if (!examples.length) { host.innerHTML = ""; return; }

    var rows = examples.map(function (ex) {
      var tokens = ex.cards.map(function (c) {
        return P.deck.makeToken("ex", c[0], c[1]);
      });
      var points = P.poker.evaluateLine(tokens).points;
      var cards = ex.cards.map(function (c, ci) {
        var rank = c[0], suit = c[1];
        // When the active variant has a bitmap face for this tile, draw it onto
        // a little canvas so the guide matches the in-game tiles; paintScoring-
        // Sprites() fills these in (and again once the artwork finishes loading).
        if (P.sprites && P.sprites.has(suit, rank)) {
          return '<canvas class="mini-card sprite-card" ' +
            'data-suit="' + suit + '" data-rank="' + rank + '" ' +
            'data-key="' + suit + rank + ci + '"></canvas>';
        }
        var info = P.deck.suitInfo(suit) || { symbol: "?", color: "#333" };
        return '<span class="mini-card" style="color:' + info.color + '">' +
          '<span class="mc-rank">' + rank + '</span>' +
          '<span class="mc-suit">' + info.symbol + '</span></span>';
      }).join("");
      return '<div class="score-row">' +
        '<div class="score-cards">' + cards + '</div>' +
        '<div class="score-meta">' +
        '<span class="score-name">' + ex.name + '</span>' +
        '<span class="score-pts">' + points + '</span>' +
        '</div></div>';
    }).join("");

    host.innerHTML =
      '<p class="choose">Scoring — each line scores its best combo:</p>' +
      '<div class="score-rows">' + rows + '</div>';

    paintScoringSprites();
  }

  // Paint every sprite-backed mini-card in the scoring guide. Safe to call
  // repeatedly: it no-ops for cards whose sheet hasn't loaded yet, and is
  // re-run via P.sprites.onLoad when the artwork arrives. The canvas backing
  // store is sized to the element's CSS box × devicePixelRatio so the tiles
  // stay crisp at the larger mobile sizes and on high-DPI screens.
  function paintScoringSprites() {
    if (!P.sprites) return;
    var dpr = window.devicePixelRatio || 1;
    var cards = document.querySelectorAll("canvas.sprite-card");
    Array.prototype.forEach.call(cards, function (cv) {
      var w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return; // not laid out yet
      var bw = Math.round(w * dpr), bh = Math.round(h * dpr);
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      var cx = cv.getContext("2d");
      cx.clearRect(0, 0, cv.width, cv.height);
      P.sprites.draw(cx, cv.getAttribute("data-suit"), cv.getAttribute("data-rank"),
        0, 0, cv.width, cv.height,
        { key: cv.getAttribute("data-key"), radius: cv.width * 0.12 });
    });
  }

  // Switching variants reloads the page with the new ?variant= param, so the
  // deck (built at load time) is rebuilt correctly for the chosen variant.
  function selectVariant(id) {
    if (id === P.variantId) return;
    var params = new URLSearchParams(window.location.search);
    params.set("variant", id);
    window.location.search = params.toString();
  }

  function init() {
    canvas = document.getElementById("board");
    canvas.width = P.render.W;
    canvas.height = P.render.H;
    ctx = canvas.getContext("2d");

    P.input.attach(canvas, function () { return game; }, backToSetup);

    // Repaint the setup-screen scoring guide once tile artwork finishes loading.
    if (P.sprites && P.sprites.onLoad) P.sprites.onLoad(paintScoringSprites);

    applyVariant();

    var vbuttons = document.querySelectorAll("[data-variant]");
    Array.prototype.forEach.call(vbuttons, function (b) {
      b.addEventListener("click", function () {
        selectVariant(b.getAttribute("data-variant"));
      });
    });

    var buttons = document.querySelectorAll("[data-players]");
    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener("click", function () {
        startGame(parseInt(b.getAttribute("data-players"), 10));
      });
    });

    // Optional deep link: ?variant=ponds&players=2 launches straight into a game.
    try {
      var players = parseInt(new URLSearchParams(window.location.search).get("players"), 10);
      if (players >= 1 && players <= 4) startGame(players);
    } catch (e) { /* ignore */ }

    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window.Pozule = window.Pozule || {});
