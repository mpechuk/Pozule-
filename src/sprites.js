/*
 * sprites.js — optional bitmap tile faces for the mahjong ("ponds") variant.
 *
 * Instead of drawing a tile's rank/suit with canvas text (the default for every
 * variant), this module blits a hand-illustrated tile face from a sprite sheet.
 * Two sheets are wired up:
 *
 *   dots  -> 6AC50434…png  (Dots / Circles 1-9, four colour variants each)
 *   chr   -> 6DC6A8E6…png  (Characters 1-9, four sea-creature variants each)
 *   bam   -> CB9AE6DD…png  (Bamboo 1-9, four variants — bottom-left quadrant of
 *                           the combined four-suit sheet)
 *
 * Each sheet is a 9-column (rank 1-9) × 4-row (decorative variant) grid with a
 * title banner up top. The per-tile source rectangles below were measured from
 * the artwork. Suits without a sheet (honors, bonus) and the classic poker deck
 * fall back to the text faces in render.js automatically, because `draw()`
 * reports back whether it actually rendered anything.
 *
 * Images load asynchronously; until a sheet is ready `draw()` returns false so
 * the caller keeps using the text face. The render loop redraws every frame, so
 * faces swap to sprites the moment the artwork finishes decoding.
 */
(function (P) {
  "use strict";

  // Master switch — flip to false to force the text faces everywhere.
  var ENABLED = true;

  // Per-sheet geometry. `cols`/`rows` are [offset, size] pairs in source pixels.
  var SHEETS = {
    dots: {
      src: "6AC50434-C16A-436E-B544-9E4476C6164F.png",
      cols: [[58, 136], [205, 135], [350, 140], [500, 143], [653, 145],
             [809, 149], [969, 147], [1128, 159], [1297, 163]],
      rows: [[105, 205], [332, 212], [566, 205], [792, 193]],
    },
    chr: {
      src: "6DC6A8E6-B0AE-4538-A2DE-01CED8D980BD.png",
      cols: [[87, 143], [239, 144], [392, 143], [543, 146], [697, 144],
             [848, 147], [1005, 146], [1159, 144], [1311, 143]],
      rows: [[105, 205], [328, 211], [557, 210], [782, 200]],
    },
    // Bamboo lives in the bottom-left quadrant of the combined four-suit sheet,
    // so its source rectangles are offset into that quadrant.
    bam: {
      src: "CB9AE6DD-66F6-45FE-B50B-0DEF3C6A82E2.png",
      cols: [[29, 70], [103, 69], [176, 69], [248, 68], [319, 68],
             [390, 68], [461, 68], [531, 68], [603, 68]],
      rows: [[624, 103], [742, 106], [865, 106], [982, 105]],
    },
  };

  // Kick off image decoding once. `loaded` gates drawing per sheet.
  Object.keys(SHEETS).forEach(function (key) {
    var s = SHEETS[key];
    if (typeof Image === "undefined") return; // non-browser (tests) — stay font-only
    var img = new Image();
    img.onload = function () { s.loaded = true; };
    img.src = s.src;
    s.img = img;
  });

  // Rank "1".."9" -> column index 0..8 (only numbered suits have sprites).
  function rankIndex(rank) {
    var n = parseInt(rank, 10);
    return (n >= 1 && n <= 9) ? n - 1 : -1;
  }

  // A sprite face exists for this suit/rank (independent of load state).
  function has(suit, rank) {
    return ENABLED && !!SHEETS[suit] && rankIndex(rank) >= 0;
  }

  // Pick one of the four decorative variants. Keyed by a stable string (a tile's
  // id) so a given physical tile always shows the same face, while the board as
  // a whole still gets all four variants — purely cosmetic.
  function variantRow(key, rowCount) {
    var h = 0, str = "" + key;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % rowCount;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Draw the sprite face for (suit, rank) into the card rect (x,y,w,h). Returns
  // true if it drew, false if no sprite is available yet (caller draws text).
  // opts: { key: stable id for variant choice, dim: bool, radius: corner radius }
  function draw(ctx, suit, rank, x, y, w, h, opts) {
    opts = opts || {};
    var sheet = SHEETS[suit];
    if (!ENABLED || !sheet || !sheet.loaded) return false;
    var ci = rankIndex(rank);
    if (ci < 0) return false;

    var ri = variantRow(opts.key != null ? opts.key : rank, sheet.rows.length);
    var col = sheet.cols[ci], row = sheet.rows[ri];
    var sx = col[0], sw = col[1], sy = row[0], sh = row[1];

    // Fit the portrait tile inside the (often squarer) card, preserving aspect
    // so it never looks stretched; the card's own fill shows through any letter-
    // boxing. A small inset keeps the card border/selection ring visible.
    var inset = Math.max(1, Math.round(Math.min(w, h) * 0.04));
    var bw = w - inset * 2, bh = h - inset * 2;
    if (bw <= 0 || bh <= 0) return false;
    var scale = Math.min(bw / sw, bh / sh);
    var dw = sw * scale, dh = sh * scale;
    var dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;

    ctx.save();
    // Clip to the rounded card so the sprite corners stay tucked inside it.
    roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, opts.radius != null ? opts.radius : 5);
    ctx.clip();
    if (opts.dim) ctx.globalAlpha = 0.5;
    ctx.drawImage(sheet.img, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
    return true;
  }

  P.sprites = { has: has, draw: draw, enabled: function () { return ENABLED; } };
})(window.Pozule = window.Pozule || {});
