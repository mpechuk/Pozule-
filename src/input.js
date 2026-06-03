/*
 * input.js — translates canvas clicks into high-level game intents using the
 * hitboxes recorded by the renderer.
 */
(function (P) {
  "use strict";

  function inside(h, p) {
    return p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h;
  }

  // Screen-space hits (header/modals) test against raw canvas coords; world-space
  // hits (the board scene, drawn through the camera) test against coords mapped
  // back through the camera transform.
  function hitAt(hits, screenPt, worldPt) {
    // Iterate in reverse so modal/overlay hitboxes (drawn last) win.
    for (var i = hits.length - 1; i >= 0; i--) {
      var h = hits[i];
      if (inside(h, h.screen ? screenPt : worldPt)) return h;
    }
    return null;
  }

  function toCanvasCoords(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    var sx = P.render.W / rect.width;
    var sy = P.render.H / rect.height;
    return { x: (evt.clientX - rect.left) * sx, y: (evt.clientY - rect.top) * sy };
  }

  function handleButton(game, action, onNewGame) {
    switch (action) {
      case "take": game.confirmTake(); break;
      case "cancelSelection": game.cancelSelection(); break;
      case "floor": game.sendToFloor(); break;
      case "payYes": game.confirmPayGold(); break;
      case "payNo": game.cancelPayGold(); break;
      case "newGame": if (onNewGame) onNewGame(); break;
    }
  }

  function attach(canvas, getGame, onNewGame) {
    canvas.addEventListener("click", function (evt) {
      var game = getGame();
      if (!game) return;
      var pt = toCanvasCoords(canvas, evt);
      var world = P.render.screenToWorld(pt.x, pt.y);
      var h = hitAt(P.render.getHits(), pt, world);
      if (!h) return;
      switch (h.type) {
        case "button": handleButton(game, h.action, onNewGame); break;
        case "factory": game.selectFactory(h.index); break;
        case "center": game.selectCenter(); break;
        case "revealToken": game.toggleToken(h.token); break;
        case "heldToken": game.setActiveHeld(h.index); break;
        case "gridCell": game.placeOnGrid(h.r, h.c); break;
      }
    });
  }

  P.input = { attach: attach };
})(window.Pozule = window.Pozule || {});
