/*
 * net.js — cross-computer transport over PeerJS/WebRTC.
 *
 * Host-authoritative: the host runs the only Game and broadcasts state; guests
 * send intents. This module owns the PeerJS connection lifecycle, the short
 * room code, and the tiny JSON message protocol. It knows nothing about game
 * rules — main.js wires the callbacks to the engine.
 *
 * Messages (all carry `v` for a version check):
 *   hello  guest->host  { type:"hello",  v, name }
 *   assign host->guest  { type:"assign", v, seat, variantId, players }
 *   lobby  host->guests { type:"lobby",  v, seats:[{kind,name,connected}] }
 *   state  host->guests { type:"state",  v, snapshot }
 *   intent guest->host  { type:"intent", v, seat, intent }
 *
 * Requires the global `Peer` from the PeerJS CDN. If it's absent (offline /
 * file://), online mode is simply unavailable and local play is unaffected.
 */
(function (P) {
  "use strict";

  var V = (P.netstate && P.netstate.PROTOCOL) || 1;
  var ID_PREFIX = "pozule-";
  var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no easily-confused chars

  var peer = null;        // the PeerJS Peer
  var hostConn = null;    // guest: the connection to the host
  var conns = [];         // host: open guest connections
  var role = null;        // "host" | "guest" | null
  var mySeat = null;      // guest: assigned seat index

  function available() { return typeof window.Peer === "function"; }

  function randomCode(n) {
    var s = "";
    for (var i = 0; i < n; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return s;
  }

  function send(conn, msg) {
    try { if (conn && conn.open) conn.send(msg); } catch (e) { /* dropped */ }
  }

  // --- Host -----------------------------------------------------------------

  // cb: { onReady(code), onJoin(conn, hello), onIntent(conn, msg), onLeave(conn) }
  function hostCreate(cb) {
    if (!available()) { if (cb.onError) cb.onError("PeerJS unavailable"); return; }
    role = "host";
    conns = [];
    var code = randomCode(5);
    peer = new window.Peer(ID_PREFIX + code);

    peer.on("open", function () { if (cb.onReady) cb.onReady(code); });
    peer.on("error", function (err) {
      // A code collision is rare but possible; retry with a fresh code.
      if (err && err.type === "unavailable-id") {
        try { peer.destroy(); } catch (e) { /* ignore */ }
        hostCreate(cb);
        return;
      }
      if (cb.onError) cb.onError(err && err.type ? err.type : String(err));
    });

    peer.on("connection", function (conn) {
      conn.on("open", function () { conns.push(conn); });
      conn.on("data", function (msg) {
        if (!msg || msg.v !== V) return;
        if (msg.type === "hello") { if (cb.onJoin) cb.onJoin(conn, msg); }
        else if (msg.type === "intent") { if (cb.onIntent) cb.onIntent(conn, msg); }
      });
      conn.on("close", function () {
        conns = conns.filter(function (c) { return c !== conn; });
        if (cb.onLeave) cb.onLeave(conn);
      });
    });
  }

  function assignSeat(conn, seat, players) {
    send(conn, { type: "assign", v: V, seat: seat, variantId: P.variantId, players: players });
  }

  function sendLobby(seats) {
    var msg = { type: "lobby", v: V, seats: seats };
    conns.forEach(function (c) { send(c, msg); });
  }

  function broadcast(snapshot) {
    var msg = { type: "state", v: V, snapshot: snapshot };
    conns.forEach(function (c) { send(c, msg); });
  }

  // --- Guest ----------------------------------------------------------------

  // cb: { name, clientId, onAssign(msg), onLobby(msg), onState(snapshot),
  //       onError(why), onHostLeave() }
  function guestJoin(code, cb) {
    if (!available()) { if (cb.onError) cb.onError("PeerJS unavailable"); return; }
    role = "guest";
    peer = new window.Peer();

    peer.on("error", function (err) {
      if (cb.onError) cb.onError(err && err.type ? err.type : String(err));
    });

    peer.on("open", function () {
      hostConn = peer.connect(ID_PREFIX + code.toUpperCase(), { reliable: true });

      hostConn.on("open", function () {
        // A stable clientId lets the host recognize us on reconnect and hand
        // back the same seat instead of treating us as a brand-new player.
        send(hostConn, { type: "hello", v: V, name: cb.name || "Player", clientId: cb.clientId });
      });
      hostConn.on("data", function (msg) {
        if (!msg) return;
        if (msg.v !== V) { if (cb.onError) cb.onError("version-mismatch"); return; }
        if (msg.type === "assign") {
          if (msg.variantId !== P.variantId) { if (cb.onError) cb.onError("variant-mismatch"); return; }
          mySeat = msg.seat;
          if (cb.onAssign) cb.onAssign(msg);
        } else if (msg.type === "lobby") {
          if (cb.onLobby) cb.onLobby(msg);
        } else if (msg.type === "state") {
          if (cb.onState) cb.onState(msg.snapshot);
        }
      });
      hostConn.on("close", function () { if (cb.onHostLeave) cb.onHostLeave(); });
      hostConn.on("error", function () { if (cb.onHostLeave) cb.onHostLeave(); });
    });
  }

  function sendIntent(intent) {
    send(hostConn, { type: "intent", v: V, seat: mySeat, intent: intent });
  }

  function close() {
    try { if (peer) peer.destroy(); } catch (e) { /* ignore */ }
    peer = null; hostConn = null; conns = []; role = null; mySeat = null;
  }

  P.net = {
    available: available,
    hostCreate: hostCreate,
    assignSeat: assignSeat,
    sendLobby: sendLobby,
    broadcast: broadcast,
    guestJoin: guestJoin,
    sendIntent: sendIntent,
    close: close,
    get role() { return role; },
    get seat() { return mySeat; },
    get conns() { return conns; },
  };
})(window.Pozule = window.Pozule || {});
