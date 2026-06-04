/*
 * sprites.js — optional bitmap tile faces for the mahjong ("ponds") variant.
 *
 * Instead of drawing a tile's rank/suit with canvas text (the default for every
 * variant), this module blits a hand-illustrated tile face from a sprite sheet.
 * Four suits are wired up:
 *
 *   dots  -> 6AC50434…png  (Dots / Circles 1-9, four colour variants each)
 *   chr   -> 6DC6A8E6…png  (Characters 1-9, four sea-creature variants each)
 *   bam   -> CB9AE6DD…png  (Bamboo 1-9 — bottom-left quadrant of the combined
 *                           four-suit sheet)
 *   honor -> CB9AE6DD…png  (Winds E/S/W/N + Dragons White/Green/Red — bottom-
 *                           right quadrant of the same combined sheet)
 *
 * The numbered suits are laid out as a 9-column (rank 1-9) × 4-row (decorative
 * variant) grid, described by `cols`/`rows`. The honors quadrant is a bespoke
 * layout (a dragon row above two wind rows), so it instead maps each rank to an
 * explicit `[x, y, w, h]` source rectangle via `tiles`. All rectangles were
 * measured from the artwork. Suits without a sheet (bonus) and the classic poker
 * deck fall back to the text faces in render.js automatically, because `draw()`
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

  var DOTS = "6AC50434-C16A-436E-B544-9E4476C6164F.png";
  var CHR = "6DC6A8E6-B0AE-4538-A2DE-01CED8D980BD.png";
  var COMBINED = "CB9AE6DD-66F6-45FE-B50B-0DEF3C6A82E2.png"; // bamboo + honors

  // Per-sheet geometry. Numbered suits use `cols`/`rows` (each an [offset, size]
  // pair); the honors suit uses `tiles` (rank -> [x, y, w, h]).
  var SHEETS = {
    dots: {
      src: DOTS,
      cols: [[58, 136], [205, 135], [350, 140], [500, 143], [653, 145],
             [809, 149], [969, 147], [1128, 159], [1297, 163]],
      rows: [[105, 205], [332, 212], [566, 205], [792, 193]],
    },
    chr: {
      src: CHR,
      cols: [[87, 143], [239, 144], [392, 143], [543, 146], [697, 144],
             [848, 147], [1005, 146], [1159, 144], [1311, 143]],
      rows: [[105, 205], [328, 211], [557, 210], [782, 200]],
    },
    // Bamboo lives in the bottom-left quadrant of the combined four-suit sheet.
    bam: {
      src: COMBINED,
      cols: [[29, 70], [103, 69], [176, 69], [248, 68], [319, 68],
             [390, 68], [461, 68], [531, 68], [603, 68]],
      rows: [[624, 103], [742, 106], [865, 106], [982, 105]],
    },
    // Honors live in the bottom-right quadrant: a row of dragons above two rows
    // of winds. Ranks match the deck spec in variant.js (winds E/S/W/N, dragons
    // Wh/Gr/Rd). Each rank points at one representative tile.
    honor: {
      src: COMBINED,
      tiles: {
        Rd: [712, 612, 96, 128],   // 中 — red dragon
        Gr: [815, 612, 95, 128],   // 發 — green dragon
        Wh: [918, 612, 95, 128],   // 白 — white dragon
        E:  [730, 750, 73, 125],   // 東 — east wind
        S:  [1053, 750, 74, 125],  // 南 — south wind
        W:  [730, 898, 73, 125],   // 西 — west wind
        N:  [1053, 898, 74, 125],  // 北 — north wind
      },
    },
  };

  // Listeners fired whenever a sheet finishes loading, so static screens (e.g.
  // the setup scoring guide) can repaint once the artwork is ready.
  var loadListeners = [];
  function onLoad(cb) { loadListeners.push(cb); }

  // Decode each distinct image once, sharing it across sheets that reuse a file
  // (bamboo and honors both come from the combined sheet). `loaded` flips true
  // when the bitmap is ready to blit.
  var IMAGES = {};
  Object.keys(SHEETS).forEach(function (key) {
    var s = SHEETS[key];
    var rec = IMAGES[s.src];
    if (!rec) {
      rec = IMAGES[s.src] = { loaded: false };
      if (typeof Image !== "undefined") { // browser only; tests stay font-only
        var img = new Image();
        img.onload = function () {
          rec.loaded = true;
          loadListeners.forEach(function (cb) { cb(); });
        };
        img.src = s.src;
        rec.img = img;
      }
    }
    s.image = rec;
  });

  // Rank "1".."9" -> column index 0..8 (only numbered suits have a grid).
  function rankIndex(rank) {
    var n = parseInt(rank, 10);
    return (n >= 1 && n <= 9) ? n - 1 : -1;
  }

  // A sprite face exists for this suit/rank (independent of load state).
  function has(suit, rank) {
    var s = SHEETS[suit];
    if (!ENABLED || !s) return false;
    return s.tiles ? Object.prototype.hasOwnProperty.call(s.tiles, rank)
                   : rankIndex(rank) >= 0;
  }

  // Pick one of N decorative variants. Keyed by a stable string (a tile's id) so
  // a given physical tile always shows the same face, while the board as a whole
  // still gets all the variants — purely cosmetic.
  function variantIndex(key, count) {
    var h = 0, str = "" + key;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % count;
  }

  // Resolve the [sx, sy, sw, sh] source rectangle for (sheet, rank), or null.
  function srcRect(sheet, rank, key) {
    if (sheet.tiles) {
      var t = sheet.tiles[rank];
      return t ? [t[0], t[1], t[2], t[3]] : null;
    }
    var ci = rankIndex(rank);
    if (ci < 0) return null;
    var ri = variantIndex(key != null ? key : rank, sheet.rows.length);
    var col = sheet.cols[ci], row = sheet.rows[ri];
    return [col[0], row[0], col[1], row[1]];
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
    if (!ENABLED || !sheet || !sheet.image.loaded) return false;
    var rect = srcRect(sheet, rank, opts.key);
    if (!rect) return false;
    var sx = rect[0], sy = rect[1], sw = rect[2], sh = rect[3];

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
    ctx.drawImage(sheet.image.img, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
    return true;
  }

  P.sprites = {
    has: has, draw: draw, onLoad: onLoad,
    enabled: function () { return ENABLED; },
  };
})(window.Pozule = window.Pozule || {});
