# Architecture

`随手無常記` is a dependency-free browser game built with HTML, CSS, JavaScript modules, DOM UI,
and Canvas 2D. The architecture keeps rules in `src/core`, browser coordination in `src/main.js`
and `src/ui`, and drawing in `src/renderers`.

The central rule is that game outcomes are committed in core state before their animations play.
Renderers may read state, but they must not decide damage, healing, Guard, rewards, generation, or
run progression.

## Entry Point And Runtime Loop

`index.html` defines four visible layers:

- the cover screen
- the upcoming-block strip and game canvas
- the round/stats side panel
- a DOM layer for effects that travel between the board and stats

It loads `src/main.js`, which owns the browser runtime:

- creates and replaces the current game object
- runs the `requestAnimationFrame` loop
- maintains normal- and monster-drop clocks
- updates encounters, board transitions, and UI effects
- maps core state into the DOM stats and upcoming strip
- passes immutable-by-convention state to the canvas renderer
- coordinates the cover fade, initial ready delay, pause fade, and resume delay
- wires keyboard, pointer, swipe, canvas, and mobile pause controls

Normal blocks fall on an 800 ms clock. Monster blocks use an independent 115 ms clock. Movement is
drawn between logical cells, but collision and locking use the discrete board state. While paused,
in the merchant, resolving an encounter, or showing an ending, the relevant clocks stop.

The cover fades for 900 ms. The game is then created and rendered, followed by a 1.3 second ready
interval before input and falling begin. Resuming from pause holds the visible board for 360 ms.

## Shared Game State

`createGame()` in `src/core/game.js` creates the single mutable game object. Its main fields are:

- board dimensions and the normal/monster lane split
- the settled 6 × 9 board
- active normal and monster pieces
- lazily generated run rounds and the current round index
- player health, maximum health, Sword bonus, treasure, Guard, pending Curses, and blessings
- completed encounter count, which selects the difficulty phase
- encounter, merchant, pause, loss, and completion state
- encounter and settling gates
- canvas effects, DOM UI effects, gravity animations, and exit animations

The runtime is effectively a small phase machine:

```text
cover -> ready -> falling -> settling -> encounter -> settling
                                  |                    |
                                  +------ merchant <---+

Any active run may enter pause. Falling can end in loss or completion.
```

`game.js` owns transitions between these phases. `encounterOrchestrator.js` owns only the internal
steps of an encounter and reports when it is finished.

## Core Modules

### `src/core/config.js`

The balance and timing surface. It contains board dimensions, clock durations, run length,
generation curves, difficulty phases, starting stats, combat values, reward chances, caps, and
merchant costs. New tunable numbers belong here rather than inside rule or renderer modules.

Some retained constants represent disabled or superseded prototypes. A constant is not proof that a
mechanism is active; follow its call site and feature flag.

### `src/core/game.js`

The run orchestrator. It:

- creates a run and spawns rounds
- moves, rotates, drops, locks, and settles pieces
- advances normal and monster lanes independently
- detects spawn collisions and a full normal bottom row
- pairs `機` with `斬` on settled rows
- starts and finishes encounters
- advances board-removal, damage-reveal, curse-reveal, hit, exit, and gravity animations
- opens, applies, skips, and closes merchant visits
- applies purchase-time blessings
- pauses, completes, or ends a run

### `src/core/runOrchestrator.js`

Creates rounds lazily. It generates enough future rounds to start the next round or fill the preview
without consuming previewed blocks. Difficulty is based on completed encounters, not round number.
The module owns:

- phase selection
- monster-count curves
- monster-tier curves
- phase-based monster value bonuses
- weighted normal-block selection
- percentage-table validation

The current formulas and tuning order are documented in [Balancing](./balancing.md).

### `src/core/encounterOrchestrator.js`

Builds the bottom-row encounter snapshot and resolves three ordered groups: support, Slash, then
monsters. It owns:

- support effects and their state changes
- aggregate ordinary Slash damage and instant Slash kills
- damage carry-over between current bottom-row monsters
- monster targeting and attacks
- Guard absorption
- pending-Curse attachment and Cursed Monster rewards
- optional `奪` rolls behind its feature flag
- encounter effect creation and cleanup

Support events and monster events use left-to-right order. The Slash group removes all current Slash
blocks together, resolves instant kills, then applies pooled ordinary damage.

### `src/core/combatRules.js`

The shared source for displayed and resolved Slash values. It combines intrinsic damage, local
encounter bonuses, and the bounded Sword blessing bonus. It also exposes encounter-event helpers.
Renderer damage labels must continue to use this module.

### `src/core/board.js`

Pure grid geometry:

- creates the board
- detects a full normal bottom row
- checks collisions
- shifts and rotates pieces
- settles full boards or selected columns
- calculates the direct landing position
- calculates the post-settle ghost position, including lower gaps

### `src/core/pieces.js`

Turns block templates into active pieces. The two normal blocks begin as one player-controlled piece.
Monster blocks fall independently; a single monster chooses one of the two monster columns.

### `src/core/blockTypes.js`

The block catalogue: labels, English development names, lanes, and base values. `劍` remains in the
catalogue for compatibility but has zero normal-generation weight.

### `src/core/merchant.js`

Defines blessing metadata, chooses three random offers, creates merchant state, checks opening and
skip conditions, and wraps selection. `game.js` owns purchases because they affect player and run
state.

### `src/core/effects.js` and `src/core/uiEffects.js`

Small lifetime stores for presentation data. Canvas effects cover board-local visuals such as Slash
paths. UI effects cover traveling glyphs, stat expansion, and shake state. They describe effects
that visualize already-applied rules.

## Input And DOM UI

### `src/ui/input.js`

Maps keyboard input by mode and handles touch swipes. It receives accessors and callbacks rather
than importing browser state from `main.js`. Merchant input overrides normal-play input.

### `src/ui/chineseNumbers.js`

Formats numeric UI values as Chinese text, including zero as `無`.

### DOM responsibilities in `src/main.js`

The side panel is DOM-based rather than canvas-based. `main.js` renders:

- encounter count
- health dots and circular Guard marks
- rolling treasure text
- stacked lasting-blessing tags
- pending-Curse count
- six upcoming blocks
- glyphs traveling from board cells to stats, or from the Curse tag to a monster

Treasure rewards from a Cursed Monster are committed immediately but temporarily withheld from the
display total until their traveling glyphs arrive.

## Rendering

### `src/renderers/canvasRenderer.js`

Draws the paper background, corner-mark grid, settled blocks, active pieces, post-settle landing
ghost, encounter gate, damage values, animations, lane separation, and pause/end overlays. It also:

- keeps Canvas resolution aligned with CSS size and device pixel ratio
- interpolates visual falling without changing logical positions
- fades the landing ghost as the active piece approaches it
- shows Slash paths, monster hit shake, damage reveal, and slain marks
- morphs a cursed monster into its cursed glyph after the Curse arrives
- dims the board during pause while leaving its state visible

The pause bookmark uses the Zhaohua font. Ending labels and gameplay glyphs use Huiwen-Fangsong.

### `src/renderers/merchantRenderer.js`

Replaces the board view with the vertical merchant composition. It receives merchant state rather
than the full game object.

### `src/theme/colors.js`

Central palette for JavaScript-drawn paper, ink, ghost, overlay, glyph, and semantic corner colors.
CSS has corresponding variables for DOM UI.

## Styling And Assets

`styles.css` owns responsive sizing, safe-area padding, cover and stats layout, pause dimming,
shakes, rolling numbers, tags, and the mobile pause control. The board shrinks with viewport width
and height so the active piece, encounter row, and monster lane remain readable together.

Bundled fonts:

- `YDWaosagi.otf`: cover title
- `huiwen-fangsong.ttf`: gameplay UI and glyphs
- `zhaohua.ttf`: pause title

The cover and game share the warm paper background. The cover SVG aging filter is currently off.

## Invariants And Extension Rules

- Rules and random outcomes belong in `src/core`, never in a renderer.
- Apply state changes immediately; use effects only to communicate them.
- Keep displayed and resolved damage routed through `combatRules.js`.
- Put tunable values in `config.js` and semantic canvas colors in `theme/colors.js`.
- Keep preview reads non-consuming.
- Do not let animation progress determine rewards or survival.
- Add block metadata in `blockTypes.js`, resolution behavior in `encounterOrchestrator.js`, and
  drawing only where the existing generic renderer cannot express it.
- Add merchant metadata in `merchant.js`; apply purchase consequences in `game.js` or the relevant
  encounter rule.
- Preserve pause/merchant/transition guards when adding input or clocks.

## Verification

`tests/combatPrototype.test.mjs` is the deterministic rule-level suite. It covers landing and
post-settle ghosts, merchant spending, Slash and Momentum, persistent Guard, queued Curse timing,
Cursed Monster targeting/rewards/failure, board shake through armour, and representative combat
interactions. Run it with:

```sh
node --test tests/combatPrototype.test.mjs
```

Visual changes still require checking both a desktop-sized and narrow/coarse-pointer layout.
