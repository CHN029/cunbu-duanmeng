# Architecture

This project is a lightweight falling-block roguelike built with plain HTML, CSS, JavaScript modules, and Canvas 2D. The main architectural goal is to keep game rules independent from rendering, so the board visualization can later move to SVG assets, PixiJS, WebGL, or another renderer without rewriting the core loop.

## Runtime Shape

`index.html` loads `src/main.js` as the browser entry point. `main.js` owns the browser loop, DOM updates, canvas click handling, and wiring between input, the game core, and the renderer.

The shared game object is created by `createGame()` in `src/core/game.js`. It contains:

- board dimensions and lane counts
- settled board blocks
- active falling normal and monster pieces
- pregenerated run state
- upcoming block preview from unstarted pregenerated rounds
- player stats and blessings
- encounter state
- merchant state
- transient visual effects
- pause, game-over, and completion flags

`main.js` calls `tick(game)` for falling-block progression and `updateEncounter(game, delta)` for encounter animation/resolution. `game.js` delegates encounter internals to `encounterOrchestrator.js`, then decides whether the run should continue, open the merchant, or start another encounter. The renderer receives the whole game state, but should not mutate it.

## Core Modules

`src/core/game.js`

The central orchestrator. It coordinates the lifecycle of a run:

- create a new game
- spawn rounds
- move, rotate, and hard-drop active pieces
- lock pieces into the board
- trigger encounters
- delegate encounter event resolution
- open and close merchant views
- pause, resume, win, and lose

This file should stay focused on sequencing. If a rule becomes self-contained, prefer moving it into a smaller core module.

`src/core/encounterOrchestrator.js`

Owns encounter-specific sequencing and effects:

- build the encounter queue from the bottom row
- resolve non-attacking blocks before `斬`
- apply normal block effects
- calculate slash damage and bleed-over
- apply monster attacks, Curse chain state, and Guard
- roll `奪` rewards from slain monsters
- create encounter visual effects
- clear slain monsters and collapse the board after an encounter

It mutates the shared game state during an encounter, but it does not decide the next run phase. After an encounter ends, `game.js` decides whether to start another encounter, open the merchant, spawn the next round, or stop because the player lost.

Support block rule changes are applied here immediately. `src/core/uiEffects.js` is presentation-only:
traveling glyphs, shakes, and timing should represent already-committed state, not decide whether
healing, treasure, sword skill, or Guard exists.

`src/core/combatRules.js`

Shared combat calculations used by both resolution and display:

- ordinary Slash damage
- local encounter bonuses
- bounded Sword blessing bonuses
- `必殺` Slash selection from Momentum
- encounter event lookup helpers

Keep displayed attack values and resolved attack values routed through this module so the canvas
does not invent gameplay numbers.

`src/core/config.js`

Shared constants and the main balance-tuning surface:

- board size
- lane layout
- timing values
- run length and per-round block counts
- monster-count probabilities
- normal and monster block appearance percentages
- starting player stats
- block effect amounts
- monster values
- loot probabilities and reward values
- merchant thresholds and costs

Use this file when tuning numbers that are part of the game model.

Each exported constant has a short comment. Keep future balance numbers here instead of burying them in rule modules; `blockTypes.js`, `runOrchestrator.js`, `merchant.js`, and `encounterOrchestrator.js` should import values from this file.

`src/core/blockTypes.js`

Block catalogue. It defines the glyph, name, lane, and optional value for each block type.

Current normal blocks:

- `藥`: healing
- `斬`: slash attack
- `咒`: curse
- `寶`: treasure
- `勢`: momentum
- `甲`: armor/shield

The retained `劍` block type is deprecated for normal generation during the current combat
prototype. Sword progression is tested through bounded merchant blessings instead.

Current monster blocks:

- `賊`: value 1
- `鬼`: value 2
- `將`: value 3

`src/core/runOrchestrator.js`

Pregenerates the 80-round run. Each round currently contains two normal blocks and zero to two monster blocks. Normal block types and monster block tiers are selected through percentage tables from `config.js`, so balance can be adjusted without changing generation logic. Each table should add up to 100. This module also exposes a peek helper for the upcoming-block UI, which reads from rounds that have not started yet without consuming them. This is the right place to tune drop distribution, pacing, monster frequency, and future run scripting.

`src/core/board.js`

Pure board and piece geometry helpers:

- create an empty board
- check the normal bottom row
- collapse columns downward
- collision detection
- shift and rotate pieces

This module should remain mostly free of gameplay meaning.

`src/core/pieces.js`

Creates active falling pieces from block templates. Normal pieces spawn in the normal lane; monster pieces spawn in the monster lane and choose a monster column when needed.

`src/core/effects.js`

Stores and ages temporary visual effects, such as expanding `斬` or `奪` glyphs. Effects are game-state data, but their exact drawing belongs to renderers.

`src/core/merchant.js`

Merchant configuration and selection helpers:

- shop title
- boon options
- threshold and skip checks
- selection movement
- merchant state creation

The actual spending and blessing recording is still coordinated by `game.js` because it changes player/run flow.

## UI Modules

`src/ui/input.js`

Maps keyboard input to game actions. It is aware of merchant mode, because the same keys have different meanings when the shop is open.

Normal play:

- Escape pauses/unpauses
- R starts a new run
- Left/Right move the normal piece
- Down hard-drops
- Space rotates, or unpauses when paused

Merchant:

- Left/Right move selection
- Space or Enter selects
- 1-3 choose a visible boon directly
- S skips
- R starts a new run

`src/ui/chineseNumbers.js`

Shared Traditional Chinese number formatting for the stats panel and merchant copy.

## Theme Modules

`src/theme/colors.js`

Central palette for JavaScript-rendered colors, especially Canvas 2D rendering and encounter effect colors. Use this file when changing block corner colors, glyph colors, overlays, merchant highlights, or animated effect colors.

## Rendering Modules

`src/renderers/canvasRenderer.js`

The main Canvas 2D renderer. It draws:

- board background
- settled blocks
- active falling pieces
- lane divider
- expanding effects
- pause/win/loss overlays

It delegates merchant rendering to `merchantRenderer.js`.

`src/renderers/merchantRenderer.js`

Draws the merchant view on the canvas. It receives merchant state only, not the full game object. This keeps the shop view easier to restyle or replace.

## Styling And Assets

`styles.css` handles page layout, the side panel, buttons, stat tags, and the bundled font. The visual language is intentionally spare: white and gray, no shadows, no border radius.

`assets/fonts/huiwen-fangsong.ttf` provides the Huiwen-Fangsong font used across the UI and canvas glyphs.

## Extension Guidelines

Keep gameplay rules in `src/core`.

Keep browser events and DOM updates in `src/ui` or `src/main.js`.

Keep drawing code in `src/renderers`.

Tune gameplay numbers in `src/core/config.js`.

Tune JavaScript-rendered colors in `src/theme/colors.js`.

When adding new block types, start in `blockTypes.js`, then add encounter behavior in `encounterOrchestrator.js`.

When adding new shop boons, start in `merchant.js`, then add purchase-time behavior in the merchant choice flow or encounter-time behavior in `encounterOrchestrator.js`.

When adding visual feedback, store only minimal effect data in core state, then draw it in the renderer.
