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

  // Host bookkeeping. Seats are owned by a stable client id (not the per-session
  // PeerJS peer id) so a guest that drops and rejoins reclaims the same seat and
  // keeps playing. `seatClient` survives a disconnect on purpose; `connectedClients`
  // tracks who is live right now (value is the current connection).
  var seatClient = {};        // seat index -> stable client id
  var connectedClients = {};  // client id -> live connection
  var onlineNames = {};       // seat index -> guest-supplied name
  var hostSeat = 0;           // the seat the host plays (its viewSeat)

  // Guest reconnect state.
  var joinAttempts = 0;
  var MAX_RECONNECT = 6;

  // Names handed to AI seats, picked at random (and kept distinct within a game).
  var AI_NAMES = [
    "Ace", "Bluff", "Calliope", "Domino", "Echo", "Fox", "Goldie", "Hazard",
    "Indigo", "Joker", "Koi", "Lucky", "Maverick", "Nova", "Oracle", "Pip",
    "Quasar", "Rook", "Sphinx", "Tiko", "Umbra", "Viper", "Wager", "Xeno",
    "Yara", "Zephyr",
  ];
  function randomAiName(used) {
    var pool = AI_NAMES.filter(function (n) { return used.indexOf(n) === -1; });
    if (!pool.length) return "AI " + (used.length + 1);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function el(id) { return document.getElementById(id); }

  // A stable per-browser id, persisted so reconnects are recognized. Seeded with
  // some client-specific data for flavor; the persisted random part is what
  // actually guarantees stability across reloads/reconnects.
  function clientId() {
    try {
      var saved = localStorage.getItem("pozule.clientId");
      if (saved) return saved;
    } catch (e) {}
    var seed = (navigator.userAgent || "") + "|" + (navigator.language || "") + "|" +
      (window.screen ? window.screen.width + "x" + window.screen.height : "");
    var h = 0;
    for (var i = 0; i < seed.length; i++) { h = (h * 31 + seed.charCodeAt(i)) | 0; }
    var id = "c-" + (h >>> 0).toString(36) + "-" +
      Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem("pozule.clientId", id); } catch (e) {}
    return id;
  }
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
    var used = [];
    var defs = seatConfig.map(function (kind, i) {
      var name;
      if (kind === "ai") {
        name = randomAiName(used); used.push(name);
        return { name: name, controller: new P.AIController() };
      }
      name = i === firstHuman ? playerName() : "Player " + (i + 1);
      used.push(name);
      return { name: name, controller: new P.HumanController() };
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
    joinAttempts = 0;
    P.net.close();
    seatClient = {};
    connectedClients = {};
    onlineNames = {};
    canvas.style.display = "none";
    el("setup").style.display = "flex";
  }

  // Online: keep every client's main board focused on the active player, so the
  // spotlight follows the turn automatically (the finishing player's board stays
  // up through the PASS_TURN hand-off, then snaps to whoever plays next). A
  // manual spectate (tapping an opponent) holds only until the turn moves on,
  // when we snap back to the new current player. Local hotseat already follows
  // current via viewSeat === null, so it's left untouched.
  function followCurrentSeat(g) {
    if (mode === "local") return;
    if (g._followedSeat !== g.current) {
      g._followedSeat = g.current;
      g.viewSeat = g.current;
    }
  }

  function loop() {
    if (game) {
      if (mode === "guest") {
        // Render-only: the host owns the engine, timers and AI.
        followCurrentSeat(game);
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
        followCurrentSeat(game);
        P.render.draw(ctx, game);
      }
    }
    requestAnimationFrame(loop);
  }

  // --- Online: host ----------------------------------------------------------

  // The lobby view of each seat, shared with guests so they see who's in.
  function lobbySeats() {
    return seats.map(function (kind, i) {
      var name = kind === "ai" ? "AI"
        : kind === "online" ? (onlineNames[i] || "(open)")
        : (i === seats.indexOf("local") ? playerName() : "Player " + (i + 1));
      var connected = kind !== "online" ||
        !!(seatClient[i] && connectedClients[seatClient[i]]);
      return { kind: kind, name: name, connected: connected };
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
        var cid = hello.clientId || conn.peer;   // fall back to peer id if absent
        conn.__clientId = cid;
        connectedClients[cid] = conn;

        // Reclaim: a returning client gets its old seat back. Otherwise take the
        // lowest still-unclaimed online seat.
        var seat = -1;
        for (var i = 0; i < seats.length; i++) {
          if (seats[i] === "online" && seatClient[i] === cid) { seat = i; break; }
        }
        if (seat < 0) {
          for (var j = 0; j < seats.length; j++) {
            if (seats[j] === "online" && !seatClient[j]) { seat = j; break; }
          }
        }
        if (seat >= 0) {
          seatClient[seat] = cid;
          onlineNames[seat] = hello.name || onlineNames[seat] || "Seat " + (seat + 1);
          if (game && game.players[seat]) {
            // (Re)claim a seat that fell back to AI at start or while away —
            // hand control back to the human and restore their name.
            game.players[seat].controller = new P.HumanController();
            game.players[seat].name = onlineNames[seat];
            game.message = onlineNames[seat] + " joined seat " + (seat + 1) + ".";
          }
        }
        P.net.assignSeat(conn, seat, lobbySeats());
        P.net.sendLobby(lobbySeats());
        renderHostLobby();
        setHostNotice("");   // a seat just filled; clear any "waiting" message
        if (game) P.net.broadcast(P.netstate.serialize(game)); // (re)joiner gets the board
      },
      onIntent: function (conn, msg) {
        if (!game || msg.seat !== game.current) return;          // not your turn
        if (seatClient[msg.seat] !== conn.__clientId) return;    // not your seat
        P.intent.apply(game, msg.intent);                        // onChange -> broadcast
      },
      onLeave: function (conn) {
        var cid = conn.__clientId;
        // Ignore a stale close if the client already reconnected on a new conn.
        if (!cid || connectedClients[cid] !== conn) return;
        delete connectedClients[cid];
        // Keep the seatClient mapping so a reconnect reclaims the seat; meanwhile
        // hand it to the AI (keeping the player's name) so the game keeps moving.
        Object.keys(seatClient).forEach(function (seat) {
          if (seatClient[seat] !== cid) return;
          if (game && game.players[seat]) {
            game.players[seat].controller = new P.AIController();
            game.message = (onlineNames[seat] || "Seat " + (parseInt(seat, 10) + 1)) +
              " disconnected — AI is filling in (they can rejoin to continue).";
            P.net.broadcast(P.netstate.serialize(game));
          }
        });
        renderHostLobby();
        if (!game) P.net.sendLobby(lobbySeats());
      },
      onError: function (why) { el("roomCode").textContent = "error: " + why; },
    });
  }

  // Show a transient message in the host's room panel (e.g. why Start is blocked).
  function setHostNotice(text) {
    var n = el("hostNotice");
    if (n) n.textContent = text || "";
  }

  function startHostGame() {
    // The host must occupy a local seat, and every online seat must have a
    // connected player — otherwise a bot would silently take a human's place.
    var firstLocal = seats.indexOf("local");
    if (firstLocal < 0) {
      setHostNotice("Set one seat to “You / Local” so you have a place at the table.");
      return;
    }
    var waiting = [];
    seats.forEach(function (kind, i) {
      if (kind === "online" && !(seatClient[i] && connectedClients[seatClient[i]])) {
        waiting.push(i + 1);
      }
    });
    if (waiting.length) {
      setHostNotice("Waiting for a player to join seat " + waiting.join(", ") +
        " — share the room code, or set the seat to AI to play with a bot.");
      return;
    }
    setHostNotice("");

    hostSeat = firstLocal;
    var used = [];
    var defs = seats.map(function (kind, i) {
      var name;
      // Online seats are always the human who joined them (validated above);
      // only seats the host explicitly set to AI get a bot.
      if (kind === "ai") {
        name = randomAiName(used); used.push(name);
        return { name: name, controller: new P.AIController() };
      }
      if (kind === "online") {
        name = onlineNames[i] || "Seat " + (i + 1); used.push(name);
        return { name: name, controller: new P.HumanController() };
      }
      name = i === firstLocal ? playerName() : "Player " + (i + 1); used.push(name);
      return { name: name, controller: new P.HumanController() };
    });
    mode = "host";
    game = new P.Game(defs);
    game.viewSeat = hostSeat;       // starting focus; the loop then follows the turn
    game.controlSeat = hostSeat;    // the host may only ever act for its own seat
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
      game.viewSeat = P.net.seat;       // starting focus; the loop then follows the turn
      game.controlSeat = P.net.seat;    // a guest may only ever act for its own seat
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
    joinAttempts = 0;
    connectAsGuest(code);
  }

  // A dropped connection isn't game over: reconnect with the same stable client
  // id (the host hands our seat back) up to a few times, then give up.
  function handleGuestDrop(code) {
    if (mode !== "guest") return;
    if (joinAttempts < MAX_RECONNECT) {
      joinAttempts++;
      renderGuestLobby("Connection lost — reconnecting (" + joinAttempts + "/" + MAX_RECONNECT + ")…");
      setTimeout(function () { if (mode === "guest") connectAsGuest(code); }, 700 * joinAttempts);
    } else {
      renderGuestLobby("Could not reconnect — host unavailable.");
      backToSetup();
    }
  }

  function connectAsGuest(code) {
    mode = "guest";
    P.net.close();
    renderGuestLobby(joinAttempts ? "Reconnecting…" : "Connecting…");
    P.net.guestJoin(code, {
      name: playerName(),
      clientId: clientId(),
      onAssign: function (msg) {
        joinAttempts = 0;   // a fresh assignment means we're back in
        if (msg.seat < 0) renderGuestLobby("Room is full.");
        else renderGuestLobby("Joined as Seat " + (msg.seat + 1) + " — waiting for host to start…");
      },
      onLobby: function (msg) {
        var who = msg.seats.map(function (s, i) {
          return "Seat " + (i + 1) + ": " + s.name;
        }).join("  •  ");
        renderGuestLobby("In lobby — " + who);
      },
      onState: function (snapshot) { joinAttempts = 0; onGuestState(snapshot); },
      onError: function (why) {
        // Variant/version mismatches are fatal; anything else is treated as a
        // transient drop worth retrying.
        if (why === "variant-mismatch" || why === "version-mismatch") {
          renderGuestLobby("Error: " + why); backToSetup();
        } else {
          handleGuestDrop(code);
        }
      },
      onHostLeave: function () { handleGuestDrop(code); },
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
    seatClient = {};
    connectedClients = {};
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
    seatClient = {};
    connectedClients = {};
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
