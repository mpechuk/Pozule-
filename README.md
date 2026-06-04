# Pozule — Azul × Poker

A one-page canvas board game that mashes up the factory-drafting of **Azul**
with **poker** hand-building. Flip a poker-table *flop*, draft a "rainbow" set
of cards, and arrange them on your 5×5 grid to make the best poker hands across
every row, column and the two main diagonals.

No build step, no dependencies — just open `index.html`.

## How to run

- **Locally:** open `index.html` in any modern browser (works over `file://`;
  the scripts are plain `<script>` tags, not ES modules).
- **Live (GitHub Pages):** once Pages is enabled (see below), the game is served
  at `https://<owner>.github.io/<repo>/`.

## How to play

1. Choose **Local** or **Online** play, then **1–4 players**. Local is hotseat —
   players share the screen (set any seat to AI). Online lets people join from
   other computers (see **Online play** below).
2. On your turn, click a glowing **poker table** to flip its three face-down
   tokens (the **flop**), or click **the center** ("the muck").
3. **Draft a rainbow set:** select cards where **no two share a rank** and **no
   two share a suit** (you must take at least one). When you take from a table,
   the cards you leave behind spill into the center; when you take from the
   center, the rest stay there. The first player to take from the center each
   round grabs the **dealer button**, which sits on their floor for the round.
   At the start of the next round it is **automatically returned to the center**:
   the holder pays gold equal to the floor slot it occupied, the slot is freed,
   and that player **deals (goes first)** next round.
4. **Place** the cards you took onto empty cells of your **5×5 grid**, or **send
   them to the floor** (penalty line).
   - When your turn ends, a **"Pass turn"** prompt appears in the bar above your
     grid (without hiding any grid or score data) naming the next player so the
     device can change hands. Tap the button to continue, or it advances
     **automatically after 5 seconds**. (Solo play skips this.)
5. **Gold & the floor:** the floor has 7 slots with penalties
   `-10, -10, -20, -20, -20, -30, -30`. Each player starts with **1000 gold**.
   When the floor is full and you still want to floor a card, you **pay gold
   equal to the bottom slot's penalty** (e.g. 30) to clear it and drop the new
   card there. The floor never clears on its own — gold is the only release.
6. **Between rounds:** when the tables and center are empty, a short (~5s)
   **shuffling animation** plays, the dealer button returns to the center, and
   the tables are re-dealt.
7. **Game end:** triggered when any player **fills all 25 cells**. Everyone else
   gets **exactly one more turn** (skipped if the table is empty).

## Online play (cross-computer)

Players on different computers can share a table over a peer-to-peer WebRTC
connection (via [PeerJS](https://peerjs.com/)) — no server to run, the site
stays a static page.

- **Set your name** at the top of the setup screen, then pick **Online**.
- **Host:** choose **Host a game**, set how many seats and mark each as **Local**
  (you, on this screen), **Online** (a remote player) or **AI**. A **room code**
  and a **Copy invite link** button appear. Share either; when players have
  joined, press **Start game**. The host runs the authoritative game and the
  others sync to it.
- **Join:** choose **Join a game** and enter the room code (or just open the host's
  invite link, which pre-fills it), then wait in the lobby until the host starts.
- Each player sees **their own board** in focus and **everyone else's grids** live
  alongside; tap an opponent's mini board to view it full-size. You can only act on
  your own turn.
- Both sides must be on the **same variant** — the invite link carries it. Any
  online seat nobody claims (or that disconnects mid-game) is played by the AI so
  the game never stalls. If the host leaves, guests are returned to the setup
  screen.

Online play needs an internet connection (to reach the PeerJS broker and for
WebRTC). Local hotseat/AI play still works fully offline, including over
`file://`.

## Scoring (at game end)

Each of the 12 lines (5 rows + 5 columns + 2 diagonals) scores the **best poker
hand currently present**:

| Hand | Pts | | Hand | Pts |
|---|---|---|---|---|
| Five of a Kind | 600 | | Straight | 125 |
| Royal Flush | 500 | | Three of a Kind | 75 |
| Straight Flush | 375 | | Two Pair | 50 |
| Four of a Kind | 250 | | One Pair | 25 |
| Full House | 200 | | High Card | 0 |
| Flush | 150 | | | |

Five of a Kind (five matching ranks) is reachable because the bag stacks four
standard decks, so a rank can repeat across the suits and decks of a single line.
Flush, Straight, Straight Flush and Royal Flush require a full 5-card line; the
pair family scores on partial lines too.

While you play, the current player's grid shows a small **transient score badge**
next to every row, column and diagonal that has a non-zero score, so you can see
each line's best combo paying off as you place cards (rows badge to the right,
columns to the top, and the two diagonals at the upper corners marked ↘ / ↙).

**Final score = Σ line points − floor penalties + remaining gold.** Highest wins.

## Variants

The setup screen offers a **variant** chooser, and the active variant is
encoded in the URL so you can deep-link straight into one:

- `index.html` or `index.html?variant=classic` — the default Azul × Poker game.
- `index.html?variant=ponds` — the **Ponds** variant.
- Adding `&players=2` (1–4) starts that variant immediately, skipping the setup
  screen (e.g. `index.html?variant=ponds&players=2`).

When a specific variant is pinned via `?variant=`, the setup screen hides its
variant chooser — the choice has already been made, so only the player-count
picker is shown.

### Ponds (mahjong deck)

Same rules and board, but the four 52-card decks are replaced by a **full
144-tile mahjong deck**, and the dispensers ("fabrics") are styled as ponds.
Each tile maps to a rank/suit so the same line combos apply:

| Tiles | `suit` | value(s) |
|---|---|---|
| Dots / Bamboo / Characters 1–9 (×4 each) | dots / bam / chr | 1–9 |
| Winds East, South, West, North (×4) | honor | 10–13 |
| Dragons White, Green, Red (×4) | honor | 14–16 |
| Flowers (4) — all match one another | bonus | (match only) |
| Seasons (4) — all match one another | bonus | (match only) |

Because honors continue the value ladder and share the `honor` suit, runs and
suited combos span the whole deck (e.g. East-South-West-North-White is a suited
run that tops the chart — the "Grand Run"). The combos scored per line are: One
Pair, Two Pair, Three of a Kind, Four of a Kind, Full House (three + a pair),
Run (five in sequence), Suited (five of one suit), Suited Run, the Grand Run, and
Five of a Kind (five matching tiles, the top combo) — using the same point values
as the classic table above. In this mahjong variant the currency is themed as
**pearls** rather than gold.

#### Illustrated tile faces

The dots (circles), characters, bamboo and honor suits render with hand-
illustrated **sprite tile faces** instead of the text/symbol faces used
elsewhere. The faces are sliced on the fly from the sprite sheets —
`6AC50434-…png` (dots 1–9), `6DC6A8E6-…png` (characters 1–9), and the combined
`CB9AE6DD-…png`, whose quadrants supply bamboo 1–9 and the honors (winds
East/South/West/North + dragons White/Green/Red). The numbered suits are 9×4
grids of rank × decorative variant; the honors quadrant is a bespoke layout, so
each rank maps to an explicit source rectangle. `src/sprites.js` owns this
geometry and a `draw()` that blits the right cell into a card; the bonus
(flower/season) tiles and the classic poker deck fall back to the text faces
automatically, and so does everything while the artwork is still loading. Set
`ENABLED = false` in `src/sprites.js` to force the text faces everywhere.

## Deployment & PR previews

Hosting is GitHub Pages, served from the **`gh-pages` branch** (the site is
static, so there's no build step — files are copied as-is). All asset paths are
relative, so the game runs correctly under any Pages sub-path, including the
per-PR preview folders.

- **Production** — `.github/workflows/deploy.yml` runs on pushes to `main` and
  publishes the site to the **root** of `gh-pages`. It uses
  `clean-exclude: pr-*/` so live PR previews are never wiped by a production
  deploy.
- **PR previews** — `.github/workflows/preview.yml` runs on pull requests. On
  open/update it deploys that PR to `gh-pages/pr-<number>/` and posts (then
  keeps updating) a comment with the preview URL
  `https://<owner>.github.io/<repo>/pr-<number>/`. When the PR is **closed or
  merged**, it deletes the `pr-<number>/` folder from `gh-pages`.

### One-time setup

Under **Settings → Pages → Source**, choose **"Deploy from a branch"** and set
**Branch: `gh-pages` / `/ (root)`**. The `gh-pages` branch is created
automatically the first time `deploy.yml` runs. The default `GITHUB_TOKEN`
provides the `contents: write` / `pull-requests: write` permissions the
workflows need — no extra secrets required.

## Project layout

```
index.html              # page shell + setup screen, loads the scripts
styles.css              # setup screen + canvas styling
src/variant.js          # variant select (?variant=): deck spec, theme, labels
src/deck.js             # cards, suits/ranks, the bag, shuffle (built per variant)
src/sprites.js          # optional bitmap tile faces (mahjong dots & characters)
src/poker.js            # pure poker-hand evaluation for a line
src/rules.js            # constants + draft/floor/gold rule helpers
src/player.js           # Player state + controller seam (Human now, AI later)
src/game.js             # engine: rounds, turns, drafting, placement, scoring
src/intent.js           # serializable action format + dispatcher (shared by input & net)
src/serialize.js        # snapshot a Game for the wire / apply one to a local Game
src/render.js           # canvas drawing + hitbox generation
src/input.js            # clicks -> game intents (applied locally or sent to the host)
src/net.js              # PeerJS host/guest transport for online play
src/main.js             # bootstrap + render loop + setup screen (local & online)
tests/poker.test.html   # open in a browser to run the classic logic tests
tests/ponds.test.html   # open in a browser to run the ponds (mahjong) tests
```

## Tests

Open `tests/poker.test.html` in a browser; it asserts poker evaluation, rainbow
rules, and floor/gold math, printing pass/fail counts. `tests/ponds.test.html`
does the same for the mahjong deck (composition, value ladder, combos, and the
flower/season matching rule).

## Extending with AI players

The engine only ever makes decisions through a player's `controller`
(`chooseDraft` / `choosePlacement` in `src/player.js`). `HumanController` is
event-driven; an `AIController` stub is in place. Implementing those two methods
(and a small driver that calls them on an AI player's turn) adds bots without
touching the game loop.
