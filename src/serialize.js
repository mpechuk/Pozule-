/*
 * serialize.js — turn a host's live Game into a plain snapshot for the wire, and
 * apply a received snapshot onto a guest's local Game in place.
 *
 * Only the host runs the engine; guests keep a Game object purely as a render
 * target and never call its mutators. So `apply` just overwrites the fields the
 * renderer reads, rebuilding real Player INSTANCES (so p.score()/p.lines() still
 * work) and re-pointing takeSet/pendingFloor at the snapshot's own token objects
 * (the renderer relies on reference equality for selected/active highlights).
 *
 * Clocks: revealAt/shuffleStart/passStart are performance.now() values whose
 * origin differs per machine, so we ship them as elapsed "ages" (now - t) and
 * the guest rebases them onto its own clock. The host still owns the real timer
 * transitions (finishShuffle/passTurn); guests only animate toward them.
 */
(function (P) {
  "use strict";

  var PROTOCOL = 1;

  function age(now, t) { return t ? Math.max(0, now - t) : 0; }

  function serialize(g) {
    var now = performance.now();
    return {
      v: PROTOCOL,
      variantId: P.variantId,
      phase: g.phase,
      message: g.message,
      current: g.current,
      startPlayer: g.startPlayer,
      round: g.round,
      dealerInCenter: g.dealerInCenter,
      endTriggered: g.endTriggered,
      finalNeed: g.finalNeed,
      finalDone: g.finalDone,
      factories: g.factories.map(function (f) {
        return { tokens: f.tokens, flipped: f.flipped, revealAtAge: age(now, f.revealAt) };
      }),
      center: g.center,
      revealed: g.revealed,
      takeSetIds: g.takeSet.map(function (t) { return t.id; }),
      held: g.held,
      activeHeld: g.activeHeld,
      pendingFloorId: g.pendingFloor ? g.pendingFloor.id : null,
      lastDealerReturn: g.lastDealerReturn,
      shuffleAge: age(now, g.shuffleStart),
      passAge: age(now, g.passStart),
      results: g.results || null,
      players: g.players.map(function (p) {
        return {
          id: p.id,
          name: p.name,
          gold: p.gold,
          controllerType: p.controller ? p.controller.type : "human",
          grid: p.grid,
          floor: p.floor,
        };
      }),
    };
  }

  // Mutate `g` (an existing Game) in place from snapshot `s`. Keeps the `g`
  // reference stable so main.js's getGame() and the render loop keep working.
  function apply(g, s) {
    var now = performance.now();
    g.phase = s.phase;
    g.message = s.message;
    g.current = s.current;
    g.startPlayer = s.startPlayer;
    g.round = s.round;
    g.dealerInCenter = s.dealerInCenter;
    g.endTriggered = s.endTriggered;
    g.finalNeed = s.finalNeed;
    g.finalDone = s.finalDone;

    g.factories = s.factories.map(function (f) {
      return { tokens: f.tokens, flipped: f.flipped, revealAt: now - f.revealAtAge };
    });
    g.center = s.center;
    g.revealed = s.revealed;
    g.held = s.held;
    g.activeHeld = s.activeHeld;

    // Re-point takeSet/pendingFloor at the snapshot's own token objects (by id)
    // so the renderer's reference-equality highlight checks light up correctly.
    var byId = {};
    (s.revealed || []).forEach(function (t) { if (t) byId[t.id] = t; });
    (s.held || []).forEach(function (t) { if (t) byId[t.id] = t; });
    g.takeSet = (s.takeSetIds || []).map(function (id) { return byId[id]; }).filter(Boolean);
    g.pendingFloor = s.pendingFloorId ? (byId[s.pendingFloorId] || null) : null;

    g.lastDealerReturn = s.lastDealerReturn;
    g.shuffleStart = now - s.shuffleAge;
    g.passStart = now - s.passAge;
    g.results = s.results;

    g.players = s.players.map(function (ps) {
      var ctrl = ps.controllerType === "ai" ? new P.AIController() : new P.HumanController();
      var p = new P.Player(ps.id, ps.name, ctrl);
      p.gold = ps.gold;
      p.grid = ps.grid;
      p.floor = ps.floor;
      return p;
    });
  }

  P.netstate = { PROTOCOL: PROTOCOL, serialize: serialize, apply: apply };
})(window.Pozule = window.Pozule || {});
