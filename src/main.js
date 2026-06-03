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

  function init() {
    canvas = document.getElementById("board");
    canvas.width = P.render.W;
    canvas.height = P.render.H;
    ctx = canvas.getContext("2d");

    P.input.attach(canvas, function () { return game; }, backToSetup);

    var buttons = document.querySelectorAll("[data-players]");
    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener("click", function () {
        startGame(parseInt(b.getAttribute("data-players"), 10));
      });
    });

    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window.Pozule = window.Pozule || {});
