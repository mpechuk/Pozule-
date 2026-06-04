/*
 * intent.js — a JSON-safe description of a single player action, plus the one
 * dispatcher that applies it to the engine.
 *
 * Local play used to call game methods straight from a click (input.js). For
 * cross-computer play a guest can't reach the host's Game object, so every
 * action is expressed as a plain `{ type, ... }` intent carrying only ids and
 * indices (never object references). The host receives the intent, resolves any
 * token id back to its own live token, and calls the same engine method a
 * click would — so the engine is unchanged and stays the single source of truth.
 */
(function (P) {
  "use strict";

  // Apply an intent to a Game. Token ids are resolved against game.revealed,
  // which holds exactly the draftable tokens while toggleToken is valid
  // (SELECT_RAINBOW). Unknown / stale intents are ignored, matching the way the
  // engine already no-ops calls made in the wrong phase.
  function apply(game, intent) {
    if (!game || !intent) return;
    switch (intent.type) {
      case "selectFactory": game.selectFactory(intent.index); break;
      case "selectCenter":  game.selectCenter(); break;
      case "toggleToken": {
        var tok = game.revealed.filter(Boolean).find(function (t) {
          return t.id === intent.tokenId;
        });
        if (tok) game.toggleToken(tok);
        break;
      }
      case "cancelSelection": game.cancelSelection(); break;
      case "confirmTake":     game.confirmTake(); break;
      case "setActiveHeld":   game.setActiveHeld(intent.index); break;
      case "placeOnGrid":     game.placeOnGrid(intent.r, intent.c); break;
      case "sendToFloor":     game.sendToFloor(); break;
      case "confirmPayGold":  game.confirmPayGold(); break;
      case "cancelPayGold":   game.cancelPayGold(); break;
      case "passTurn":        game.passTurn(); break;
    }
  }

  P.intent = { apply: apply };
})(window.Pozule = window.Pozule || {});
