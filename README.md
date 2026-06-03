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

1. Choose **1–4 players** (hotseat — players share the screen).
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

## Scoring (at game end)

Each of the 12 lines (5 rows + 5 columns + 2 diagonals) scores the **best poker
hand currently present**:

| Hand | Pts | | Hand | Pts |
|---|---|---|---|---|
| Royal Flush | 100 | | Straight | 25 |
| Straight Flush | 75 | | Three of a Kind | 15 |
| Four of a Kind | 50 | | Two Pair | 10 |
| Full House | 40 | | One Pair | 5 |
| Flush | 30 | | High Card | 0 |

Flush, Straight, Straight Flush and Royal Flush require a full 5-card line; the
pair family scores on partial lines too.

**Final score = Σ line points − floor penalties + remaining gold.** Highest wins.

## Variants

The setup screen offers a **variant** chooser, and the active variant is
encoded in the URL so you can deep-link straight into one:

- `index.html` or `index.html?variant=classic` — the default Azul × Poker game.
- `index.html?variant=ponds` — the **Ponds** variant.
- Adding `&players=2` (1–4) starts that variant immediately, skipping the setup
  screen (e.g. `index.html?variant=ponds&players=2`).

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
Run (five in sequence), Suited (five of one suit), Suited Run, and the Grand
Run — using the same point values as the classic table above.

## Enabling GitHub Pages

The repo ships a deploy workflow at `.github/workflows/pages.yml`. It runs on
pushes to `main` (and the development branch) and **enables Pages automatically**
on its first successful run (`configure-pages` with `enablement: true`), so no
manual Settings toggle is normally required.

If your org disallows Actions from enabling Pages, turn it on once under
**Settings → Pages → Source = GitHub Actions**.

All asset paths are relative, so the game works correctly under the
`/<repo>/` Pages sub-path.

## Project layout

```
index.html              # page shell + setup screen, loads the scripts
styles.css              # setup screen + canvas styling
src/variant.js          # variant select (?variant=): deck spec, theme, labels
src/deck.js             # cards, suits/ranks, the bag, shuffle (built per variant)
src/poker.js            # pure poker-hand evaluation for a line
src/rules.js            # constants + draft/floor/gold rule helpers
src/player.js           # Player state + controller seam (Human now, AI later)
src/game.js             # engine: rounds, turns, drafting, placement, scoring
src/render.js           # canvas drawing + hitbox generation
src/input.js            # clicks -> game intents
src/main.js             # bootstrap + render loop
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
