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
    if (titleEl) titleEl.textContent = dom.h1;
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
