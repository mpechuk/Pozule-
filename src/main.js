/*
 * main.js — bootstrap: read the player count, build a Game, and run a
 * continuous render loop (so flip animations and live stats stay smooth).
 */
(function (P) {
  "use strict";

  var canvas, ctx, game = null;

  // Runtime mode of the active game:
  //   "local" — hotseat / AI on this screen (original behavior)
  //   "host"  — this client runs the engine and broadcasts to guests
  //   "guest" — render-only; sends intents to the host
  var mode = "local";

  // Setup-screen state. `setupOnline` toggles the Local vs Online section;
  // `onlineRole` is "host" | "guest" once chosen.
  var setupOnline = false;
  var onlineRole = null;

  // Seat configuration, one entry per seat. In local mode entries are
  // "human" | "ai"; in online host mode "local" | "online" | "ai".
  var seats = ["human", "ai"];

  // Host bookkeeping: which guest owns each online seat, and the name a guest
  // gave when joining (used until/while the game runs).
  var seatOwner = {};     // seat index -> guest peer id
  var onlineNames = {};   // seat index -> guest-supplied name
  var hostSeat = 0;       // the seat the host plays (its viewSeat)

  function el(id) { return document.getElementById(id); }
  function defaultSeat(i) {
    return setupOnline ? (i === 0 ? "local" : "online") : (i === 0 ? "human" : "ai");
  }

  // The player's chosen name (persisted), used for this client's own seat.
  function playerName() {
    var input = el("playerName");
    var v = input && input.value.trim();
    if (v) { try { localStorage.setItem("pozule.name", v); } catch (e) {} return v; }
    return "Player";
  }

  // Build a Game from a local seat config ("human" | "ai"). The first human seat
  // takes the player's chosen name; the rest get "Player N" / "AI N".
  function startGame(seatConfig) {
    var firstHuman = seatConfig.indexOf("human");
    var defs = seatConfig.map(function (kind, i) {
      if (kind === "ai") return { name: "AI " + (i + 1), controller: new P.AIController() };
      return {
        name: i === firstHuman ? playerName() : "Player " + (i + 1),
        controller: new P.HumanController(),
      };
    });
    mode = "local";
    game = new P.Game(defs);
    game.onChange = function () { /* render loop redraws every frame */ };
    showCanvas();
  }

  function showCanvas() {
    el("setup").style.display = "none";
    canvas.style.display = "block";
  }

  // Re-render the per-seat toggles to match `seats`. Local mode cycles
  // Human/AI; online host mode cycles Local/Online/AI.
  function renderSeatConfig() {
    var host = el("seatConfig");
    if (!host) return;
    host.innerHTML = "";
    seats.forEach(function (kind, i) {
      var row = document.createElement("div");
      row.className = "seat-row";

      var label = document.createElement("span");
      label.className = "seat-label";
      label.textContent = "Seat " + (i + 1);
      row.appendChild(label);

      var toggle = document.createElement("button");
      if (setupOnline) {
        var labels = { local: "You / Local", online: "Online", ai: "AI" };
        var next = { local: "online", online: "ai", ai: "local" };
        toggle.className = "seat-toggle " + kind;
        toggle.textContent = labels[kind] || kind;
        toggle.addEventListener("click", function () {
          seats[i] = next[seats[i]] || "local";
          renderSeatConfig();
        });
      } else {
        toggle.className = "seat-toggle " + (kind === "ai" ? "ai" : "human");
        toggle.textContent = kind === "ai" ? "AI" : "Human";
        toggle.addEventListener("click", function () {
          seats[i] = seats[i] === "ai" ? "human" : "ai";
          renderSeatConfig();
        });
      }
      row.appendChild(toggle);
      host.appendChild(row);
    });
  }

  // Resize the seat list to `count`, keeping existing choices and filling any
  // new seats with sensible defaults, then redraw the toggles.
  function setPlayerCount(count) {
    var next = [];
    for (var i = 0; i < count; i++) next.push(seats[i] || defaultSeat(i));
    seats = next;
    var buttons = document.querySelectorAll("[data-players]");
    Array.prototype.forEach.call(buttons, function (b) {
      b.classList.toggle("active", parseInt(b.getAttribute("data-players"), 10) === count);
    });
    renderSeatConfig();
  }

  function backToSetup() {
    game = null;
    mode = "local";
    P.net.close();
    seatOwner = {};
    onlineNames = {};
    canvas.style.display = "none";
    el("setup").style.display = "flex";
  }

  function loop() {
    if (game) {
      if (mode === "guest") {
        // Render-only: the host owns the engine, timers and AI.
        P.render.draw(ctx, game);
      } else {
        if (game.phase === "SHUFFLING" &&
            performance.now() - game.shuffleStart >= P.rules.SHUFFLE_MS) {
          game.finishShuffle();
        }
        if (game.phase === "PASS_TURN" &&
            performance.now() - game.passStart >= P.rules.PASS_MS) {
          game.passTurn();
        }
        // Drive any AI seat (drafting, placement, hand-offs). No-op on human turns.
        if (P.ai) P.ai.tick(game, performance.now());
        P.render.draw(ctx, game);
      }
    }
    requestAnimationFrame(loop);
  }

  // --- Online: host ----------------------------------------------------------

  // The lobby view of each seat, shared with guests so they see who's in.
  function lobbySeats() {
    return seats.map(function (kind, i) {
      var name = kind === "ai" ? "AI " + (i + 1)
        : kind === "online" ? (onlineNames[i] || "(open)")
        : (i === seats.indexOf("local") ? playerName() : "Player " + (i + 1));
      return { kind: kind, name: name, connected: kind !== "online" || !!seatOwner[i] };
    });
  }

  function renderHostLobby() {
    var host = el("lobbyHost");
    if (!host) return;
    host.innerHTML = lobbySeats().map(function (s, i) {
      return "<div class='lobby-row'>Seat " + (i + 1) + ": <b>" + s.name + "</b> (" +
        s.kind + (s.kind === "online" ? (s.connected ? " — joined" : " — waiting") : "") +
        ")</div>";
    }).join("");
  }

  function createRoom() {
    if (!P.net.available()) { el("roomCode").textContent = "unavailable offline"; return; }
    P.net.hostCreate({
      onReady: function (code) {
        el("roomCode").textContent = code;
        var url = location.origin + location.pathname +
          "?variant=" + P.variantId + "&room=" + code;
        el("copyLink").setAttribute("data-url", url);
      },
      onJoin: function (conn, hello) {
        var seat = -1;
        for (var i = 0; i < seats.length; i++) {
          if (seats[i] === "online" && !seatOwner[i]) { seat = i; break; }
        }
        if (seat >= 0) {
          seatOwner[seat] = conn.peer;
          onlineNames[seat] = hello.name || "Seat " + (seat + 1);
          if (game && game.players[seat]) {
            // A late joiner claims a seat that fell back to AI at start; hand it
            // back to the human now controlling it.
            game.players[seat].controller = new P.HumanController();
            game.players[seat].name = onlineNames[seat];
          }
        }
        P.net.assignSeat(conn, seat, lobbySeats());
        P.net.sendLobby(lobbySeats());
        renderHostLobby();
        if (game) P.net.broadcast(P.netstate.serialize(game)); // late joiner gets the board
      },
      onIntent: function (conn, msg) {
        if (!game || msg.seat !== game.current) return;       // not your turn
        if (seatOwner[msg.seat] !== conn.peer) return;        // not your seat
        P.intent.apply(game, msg.intent);                     // onChange -> broadcast
      },
      onLeave: function (conn) {
        Object.keys(seatOwner).forEach(function (seat) {
          if (seatOwner[seat] !== conn.peer) return;
          delete seatOwner[seat];
          if (game && game.players[seat]) {
            // Hand the abandoned seat to the AI so the game keeps moving.
            game.players[seat].controller = new P.AIController();
            game.players[seat].name = "AI " + (parseInt(seat, 10) + 1);
            game.message = "Seat " + (parseInt(seat, 10) + 1) +
              " disconnected — now played by AI.";
            P.net.broadcast(P.netstate.serialize(game));
          }
        });
        renderHostLobby();
        if (!game) P.net.sendLobby(lobbySeats());
      },
      onError: function (why) { el("roomCode").textContent = "error: " + why; },
    });
  }

  function startHostGame() {
    var firstLocal = seats.indexOf("local");
    if (firstLocal < 0) firstLocal = 0;
    hostSeat = firstLocal;
    var defs = seats.map(function (kind, i) {
      // Unclaimed online seats fall back to AI so no turn can stall.
      if (kind === "ai" || (kind === "online" && !seatOwner[i])) {
        return { name: "AI " + (i + 1), controller: new P.AIController() };
      }
      if (kind === "online") {
        return { name: onlineNames[i] || "Seat " + (i + 1), controller: new P.HumanController() };
      }
      return {
        name: i === firstLocal ? playerName() : "Player " + (i + 1),
        controller: new P.HumanController(),
      };
    });
    mode = "host";
    game = new P.Game(defs);
    game.viewSeat = hostSeat;
    game.onChange = function (g) { P.net.broadcast(P.netstate.serialize(g)); };
    showCanvas();
    P.net.broadcast(P.netstate.serialize(game)); // first state ends guests' lobby
  }

  // --- Online: guest ---------------------------------------------------------

  function gameFromSnapshot(s) {
    var defs = s.players.map(function (ps) {
      return {
        name: ps.name,
        controller: ps.controllerType === "ai" ? new P.AIController() : new P.HumanController(),
      };
    });
    var g = new P.Game(defs);
    P.netstate.apply(g, s);
    return g;
  }

  function onGuestState(snapshot) {
    if (!game) {
      game = gameFromSnapshot(snapshot);
      game.viewSeat = P.net.seat;
      showCanvas();
    } else {
      P.netstate.apply(game, snapshot);
    }
  }

  function renderGuestLobby(text) {
    var host = el("lobbyGuest");
    if (host) host.textContent = text;
  }

  function doJoin() {
    var code = (el("joinCode").value || "").trim().toUpperCase();
    if (!code) { renderGuestLobby("Enter a room code."); return; }
    if (!P.net.available()) { renderGuestLobby("Online play unavailable offline."); return; }
    mode = "guest";
    renderGuestLobby("Connecting…");
    P.net.guestJoin(code, {
      name: playerName(),
      onAssign: function (msg) {
        if (msg.seat < 0) renderGuestLobby("Room is full.");
        else renderGuestLobby("Joined as Seat " + (msg.seat + 1) + " — waiting for host to start…");
      },
      onLobby: function (msg) {
        var who = msg.seats.map(function (s, i) {
          return "Seat " + (i + 1) + ": " + s.name;
        }).join("  •  ");
        renderGuestLobby("In lobby — " + who);
      },
      onState: onGuestState,
      onError: function (why) { renderGuestLobby("Error: " + why); },
      onHostLeave: function () { renderGuestLobby("Host disconnected."); backToSetup(); },
    });
  }

  // --- Setup-screen mode switching ------------------------------------------

  function updateSetupUI() {
    var online = setupOnline;
    Array.prototype.forEach.call(document.querySelectorAll("[data-mode]"), function (b) {
      b.classList.toggle("active", (b.getAttribute("data-mode") === "online") === online);
    });
    el("onlineRolePanel").style.display = online ? "" : "none";
    Array.prototype.forEach.call(document.querySelectorAll("[data-role]"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-role") === onlineRole);
    });
    var showTable = !online || onlineRole === "host";
    el("tablePanel").style.display = showTable ? "" : "none";
    el("startBtn").style.display = showTable ? "" : "none";
    el("roomPanel").style.display = (online && onlineRole === "host") ? "" : "none";
    el("joinPanel").style.display = (online && onlineRole === "guest") ? "" : "none";
    var prompt = el("seatPrompt");
    if (prompt) prompt.textContent = online
      ? "Set each seat — tap to cycle Local / Online / AI:"
      : "Set each seat — tap to switch Human / AI:";
  }

  function setSetupOnline(on) {
    setupOnline = on;
    onlineRole = null;
    P.net.close();              // drop any half-open peer when switching modes
    seatOwner = {};
    onlineNames = {};
    // Rebuild seats in the new mode's vocabulary (human/ai vs local/online/ai).
    var n = seats.length;
    seats = [];
    for (var i = 0; i < n; i++) seats.push(defaultSeat(i));
    setPlayerCount(n);
    updateSetupUI();
  }

  function chooseRole(role) {
    onlineRole = role;
    P.net.close();              // reset any prior peer before (re)hosting/joining
    seatOwner = {};
    onlineNames = {};
    if (role === "host") { setPlayerCount(seats.length); createRoom(); }
    updateSetupUI();
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

    // Clicks become intents. Local/host apply to the engine directly (the host's
    // onChange then broadcasts); a guest ships them to the host. "New Game" and
    // tapping an opponent board are local-only UI actions.
    P.input.attach(
      canvas,
      function () { return game; },
      {
        newGame: backToSetup,
        spectate: function (id) { if (mode !== "local" && game) game.viewSeat = id; },
      },
      function () {
        return mode === "guest" ? function (intent) { P.net.sendIntent(intent); } : null;
      }
    );

    // Repaint the setup-screen scoring guide once tile artwork finishes loading.
    if (P.sprites && P.sprites.onLoad) P.sprites.onLoad(paintScoringSprites);

    applyVariant();

    var vbuttons = document.querySelectorAll("[data-variant]");
    Array.prototype.forEach.call(vbuttons, function (b) {
      b.addEventListener("click", function () {
        selectVariant(b.getAttribute("data-variant"));
      });
    });

    // Player-count buttons now just (re)size the seat list; the Start button
    // launches the configured table.
    var buttons = document.querySelectorAll("[data-players]");
    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener("click", function () {
        setPlayerCount(parseInt(b.getAttribute("data-players"), 10));
      });
    });
    var startBtn = document.getElementById("startBtn");
    if (startBtn) startBtn.addEventListener("click", function () {
      if (setupOnline && onlineRole === "host") startHostGame();
      else startGame(seats);
    });

    // Restore the last-used name.
    var nameInput = el("playerName");
    if (nameInput) {
      try { nameInput.value = localStorage.getItem("pozule.name") || ""; } catch (e) {}
    }

    // Local / Online mode toggle and Host / Join role buttons.
    Array.prototype.forEach.call(document.querySelectorAll("[data-mode]"), function (b) {
      b.addEventListener("click", function () {
        setSetupOnline(b.getAttribute("data-mode") === "online");
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-role]"), function (b) {
      b.addEventListener("click", function () { chooseRole(b.getAttribute("data-role")); });
    });
    var joinBtn = el("joinBtn");
    if (joinBtn) joinBtn.addEventListener("click", doJoin);
    var copyLink = el("copyLink");
    if (copyLink) copyLink.addEventListener("click", function () {
      var url = copyLink.getAttribute("data-url");
      if (!url) return;
      if (navigator.clipboard) navigator.clipboard.writeText(url);
      copyLink.textContent = "Copied!";
      setTimeout(function () { copyLink.textContent = "Copy invite link"; }, 1500);
    });

    // Hide the online controls entirely if PeerJS didn't load (offline / file://).
    if (!P.net.available()) {
      var onlineModeBtn = document.querySelector("[data-mode='online']");
      if (onlineModeBtn) onlineModeBtn.style.display = "none";
    }

    // Initialise the seat config to the default 2-seat table.
    setPlayerCount(seats.length);
    updateSetupUI();

    // Deep links. ?room= opens the Join flow (takes precedence). Otherwise
    // ?players= launches straight into a local game to show the feature off.
    try {
      var params = new URLSearchParams(window.location.search);
      var room = params.get("room");
      if (room && P.net.available()) {
        setSetupOnline(true);
        chooseRole("guest");
        el("joinCode").value = room.toUpperCase();
      } else {
        var players = parseInt(params.get("players"), 10);
        if (players >= 1 && players <= 4) {
          var quick = [];
          for (var i = 0; i < players; i++) quick.push(i === 0 ? "human" : "ai");
          startGame(quick);
        }
      }
    } catch (e) { /* ignore */ }

    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window.Pozule = window.Pozule || {});
