# Balancing

This document describes the current balance model: how the run becomes harder, which values are
fixed, and which knobs are intended for tuning.

## Balance Goal

The intended curve is:

```text
resources improve slightly through play -> monsters scale more clearly -> blessings decide whether the player keeps up
```

Normal drops provide the basic language of play. Monster pressure advances the run. Treasure and
blessings are the long-term answer to that pressure.

## Difficulty Driver

Difficulty is based on completed encounters, not raw drop rounds.

This matters because the player can delay an encounter by arranging the normal lane. Counting
encounters makes each resolved fight feel like the adventure has advanced, while board space and the
80-round limit remain the anti-stall pressure.

The current phase map lives in `src/core/config.js`:

| Phase | Completed encounters |
| --- | ---: |
| 1 | 0-6 |
| 2 | 7-14 |
| 3 | 15-23 |
| 4 | 24+ |

`game.completedEncounters` increments after an encounter fully resolves. `runOrchestrator.js` uses
that count to choose the phase whenever it lazily generates new rounds.

## Lazy Round Generation

Runs still have a fixed length of 80 rounds, but rounds are not all generated at run start.

The generator creates only:

- the next round when it is needed
- enough future rounds to fill the six-block preview strip

Once a block appears in the preview, it is fixed. It will not be regenerated if the difficulty phase
changes before that round starts. This keeps the preview honest.

## Monster Count Curve

Monster count starts from this base table:

| Monsters in round | Base chance |
| --- | ---: |
| 0 | 40% |
| 1 | 50% |
| 2 | 10% |

The formula is:

```text
pressure = phase - 1
doubleShift = pressure * 10
0 monsters = max(5, 40 - doubleShift)
2 monsters = 10 + doubleShift
1 monster = 100 - 0 monsters - 2 monsters
```

Current result:

| Phase | 0 monsters | 1 monster | 2 monsters |
| --- | ---: | ---: | ---: |
| 1 | 40% | 50% | 10% |
| 2 | 30% | 50% | 20% |
| 3 | 20% | 50% | 30% |
| 4 | 10% | 50% | 40% |

Tuning knob:

- `MONSTER_COUNT_DOUBLE_SHIFT_PER_PHASE`

Raise it to make later phases denser. Lower it if the board becomes too punishing before builds
come online.

## Monster Tier Curve

Monster tier starts from this base table:

| Monster | Base chance |
| --- | ---: |
| `獸` | 60% |
| `賊` | 32% |
| `兇` | 8% |

The formula is:

```text
pressure = phase - 1
strongShift = pressure * 8
兇 = 8 + strongShift
賊 = 32 + floor(strongShift / 2)
獸 = 100 - 賊 - 兇
```

Current result:

| Phase | `獸` | `賊` | `兇` |
| --- | ---: | ---: | ---: |
| 1 | 60% | 32% | 8% |
| 2 | 48% | 36% | 16% |
| 3 | 36% | 40% | 24% |
| 4 | 24% | 44% | 32% |

Tuning knob:

- `MONSTER_BLOCK_STRONG_SHIFT_PER_PHASE`

Raise it if late encounters still contain too many trivial targets. Lower it if early-mid damage
becomes too spiky.

## Monster Value Curve

Base monster values:

| Monster | Base value |
| --- | ---: |
| `獸` | 1 |
| `賊` | 2 |
| `兇` | 3 |

The phase bonus formula is:

```text
monsterValueBonus = max(0, phase - 2)
```

Current result:

| Phase | Bonus | `獸` | `賊` | `兇` |
| --- | ---: | ---: | ---: | ---: |
| 1 | +0 | 1 | 2 | 3 |
| 2 | +0 | 1 | 2 | 3 |
| 3 | +1 | 2 | 3 | 4 |
| 4 | +2 | 3 | 4 | 5 |

Curse adds another +1 to the monster it attaches to.

Tuning knob:

- `MONSTER_VALUE_BONUS_PHASE_OFFSET`

Increase it to delay value scaling. Decrease it to make values rise earlier.

## Resource Drops

Resource drops start from a fixed base table across all phases.

| Block | Rate | Role |
| --- | ---: | --- |
| `藥` | 12% | recover health |
| `斬` | 44% | immediate damage |
| `呪` | 9% | risk-for-reward treasure setup |
| `寶` | 13% | shop progress |
| `機` | 8% | converts one `斬` into `必殺` |
| `甲` | 14% | persistent Guard |

The reason resources do not currently scale by formula is readability. If the monster curve alone
is too harsh, the next likely adjustment is a small authored table for resource rates by phase,
instead of one global resource formula.

Shop blessings can reshape future normal-block weights. Each owned drop blessing multiplies its
target block's base weight, then the full normal-block table is normalized back to 100:

| Blessing | Target | Multiplier |
| --- | --- | ---: |
| `兵庫` | `斬` | 1.25 |
| `甲庫` | `甲` | 1.5 |
| `藥圃` | `藥` | 1.5 |
| `招財` | `寶` | 1.5 |
| `招煞` | `呪` | 1.75 |
| `洞機` | `機` | 1.75 |

These modifiers affect only future unpreviewed rounds. They do not change monster count, monster
tier, monster value, or already visible preview blocks.

## Blessings As The Gap Closer

Monster pressure is meant to scale faster than raw drops. The gap is supposed to be closed by shop
blessings:

- `寶` creates access to the shop
- `呪` can produce extra treasure by making a later monster more dangerous
- lasting blessings make repeated decisions matter
- instant blessings patch survival or power at purchase time

Blessing labels, descriptions, categories, and simple effect values live in
`src/data/blessings.json`. `src/core/blessings.js` interprets those effects. Prefer changing the
JSON first; add code only when a new blessing needs a new effect type.

`懸賞` adds 1 treasure to a successful Cursed Monster bounty, changing the reward from 2 to 3. It
does not reward ordinary monster kills or Cursed Monsters that survive to attack.

The useful tuning question is:

```text
How many merchant visits should a decent run usually see?
```

Current target:

| Shop | Intended timing |
| --- | --- |
| First | around early-mid run |
| Second | around mid run |
| Third | around late run |
| Fourth | possible mainly through good treasure/cursed-monster play |

## Practical Tuning Order

When the game feels too easy:

1. Increase `MONSTER_COUNT_DOUBLE_SHIFT_PER_PHASE`.
2. Increase `MONSTER_BLOCK_STRONG_SHIFT_PER_PHASE`.
3. Let value scaling arrive earlier by lowering `MONSTER_VALUE_BONUS_PHASE_OFFSET`.
4. Reduce comfort resources only after monster-side tuning is understood.

When the game feels too hard:

1. Delay value scaling by raising `MONSTER_VALUE_BONUS_PHASE_OFFSET`.
2. Lower `MONSTER_COUNT_DOUBLE_SHIFT_PER_PHASE`.
3. Lower `MONSTER_BLOCK_STRONG_SHIFT_PER_PHASE`.
4. Increase treasure access before increasing raw healing.

When the shop feels irrelevant:

1. Raise `寶` frequency slightly.
2. Lower `MERCHANT_THRESHOLD`.
3. Improve blessing impact.

When the shop snowballs too hard:

1. Raise `MERCHANT_THRESHOLD`.
2. Reduce treasure from cursed monsters.
3. Make skip/purchase cost less forgiving.

## Invariants

- Percentage tables must add up to 100.
- Normal blocks should remain useful even in late phases.
- Monster values should stay small enough for dots to remain readable.
- Difficulty rules belong in `runOrchestrator.js`; tunable numbers belong in `config.js`.
- Rendering should show the chosen values but never decide them.
