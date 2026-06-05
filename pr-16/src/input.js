/*
 * input.js — translates canvas clicks into high-level game intents using the
 * hitboxes recorded by the renderer.
 *
 * A click is turned into a plain intent (see intent.js) and handed to a sink.
 * Locally (and on the host) the sink applies the intent straight to the engine;
 * a guest's sink ships it to the host instead. With no sink configured it falls
 * back to applying locally, so single-machine play needs no extra wiring.
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

  // Map a renderer hitbox to a serializable intent. Returns null for hits with
  // no game action (they may still be handled specially, e.g. "newGame" and
  // "opponent" which are caught before this in attach()).
  function intentFromHit(h) {
    switch (h.type) {
      case "button":
        switch (h.action) {
          case "take": return { type: "confirmTake" };
          case "cancelSelection": return { type: "cancelSelection" };
          case "floor": return { type: "sendToFloor" };
          case "payYes": return { type: "confirmPayGold" };
          case "payNo": return { type: "cancelPayGold" };
          case "passTurn": return { type: "passTurn" };
        }
        return null;
      case "factory": return { type: "selectFactory", index: h.index };
      case "center": return { type: "selectCenter" };
      case "revealToken": return { type: "toggleToken", tokenId: h.token.id };
      case "heldToken": return { type: "setActiveHeld", index: h.index };
      case "gridCell": return { type: "placeOnGrid", r: h.r, c: h.c };
    }
    return null;
  }

  // onLocal: optional handler for purely-local UI hits that aren't engine
  // intents — { newGame(), spectate(id) }. getSink: optional () => fn(intent);
  // when absent intents are applied to the local game directly.
  function attach(canvas, getGame, onLocal, getSink) {
    onLocal = onLocal || {};
    canvas.addEventListener("click", function (evt) {
      var game = getGame();
      if (!game) return;
      var pt = toCanvasCoords(canvas, evt);
      var world = P.render.screenToWorld(pt.x, pt.y);
      var h = hitAt(P.render.getHits(), pt, world);
      if (!h) return;

      // Local-only UI hits (never sent over the wire).
      if (h.type === "button" && h.action === "newGame") {
        if (onLocal.newGame) onLocal.newGame();
        return;
      }
      if (h.type === "opponent") {
        if (onLocal.spectate) onLocal.spectate(h.id);
        return;
      }

      var intent = intentFromHit(h);
      if (!intent) return;
      var sink = getSink && getSink();
      if (sink) sink(intent);
      else P.intent.apply(game, intent);
    });
  }

  P.input = { attach: attach, intentFromHit: intentFromHit };
})(window.Pozule = window.Pozule || {});
