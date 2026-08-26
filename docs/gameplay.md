# Gameplay

`随手無常記` is a falling-block roguelike about arranging techniques, supplies, armour, treasure,
and threats into a survivable sequence of encounters.

## Starting And Ending A Run

The cover can be dismissed with any unmodified key or a mouse/touch click. It fades away, then the
board and UI remain still for 1.3 seconds so the player can read the layout before anything falls.

A run contains 80 rounds. The player wins after all rounds have been played. The player loses if:

- `體魄` reaches zero, or
- a newly spawned normal or monster piece is blocked at the top of its lane.

## Board And Round Flow

The board is 6 columns by 9 rows:

- the left four columns hold player-controlled normal blocks
- the right two columns hold automatically falling monsters

Every round contains exactly two normal blocks and zero to two monster blocks. The normal pair falls
as one piece. It may move horizontally, rotate around its first block, fall automatically, or be
hard-dropped. Monster blocks fall much faster and independently; a blocked monster settles while
another monster from the same round may continue falling.

After pieces lock, columns collapse downward to fill gaps. Normal columns may settle before the
monster lane has finished. A faint landing ghost previews where the normal blocks will be after this
column settling, including any lower gaps. It appears once the falling piece is visible and fades as
the piece approaches.

The strip above the board previews the next six blocks from unstarted rounds. Reading the preview
does not consume them.

An encounter begins whenever all four cells in the normal bottom row are occupied. After an
encounter, removed blocks disappear, all columns settle, and the game either starts another
encounter, opens the merchant, or spawns the next round.

## Difficulty

Difficulty advances by completed encounter count rather than round number:

| Phase | Completed encounters | 0 monsters | 1 monster | 2 monsters | `獸` | `賊` | `兇` | Value bonus |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0–6 | 40% | 50% | 10% | 60% | 32% | 8% | +0 |
| 2 | 7–14 | 30% | 50% | 20% | 48% | 36% | 16% | +0 |
| 3 | 15–23 | 20% | 50% | 30% | 36% | 40% | 24% | +1 |
| 4 | 24+ | 10% | 50% | 40% | 24% | 44% | 32% | +2 |

Normal block rates remain constant:

| Block | Rate |
| --- | ---: |
| `藥` | 12% |
| `斬` | 44% |
| `呪` | 9% |
| `寶` | 13% |
| `機` | 8% |
| `甲` | 14% |
| `劍` | 0% |

Rounds are generated only as needed for play and preview. A block already visible in the preview is
not regenerated when its round begins. The design intent and tuning knobs are documented in
[Balancing](./balancing.md).

## Player State

The current starting values are:

- `體魄`: 3 health
- `根骨`: 6 maximum health
- `劍法`: 0 persistent Slash bonus
- `財寶`: 0
- Guard: 0, capped at 6
- pending Curses: 0

The visible side panel shows:

- the current encounter number
- `體` as health dots
- Guard as slightly larger blue outline circles following the health dots
- `寶` as a Chinese-text number
- lasting blessing tags
- a `呪` tag and count while Curses are pending

Instant blessings change the underlying stats but are not listed as blessing tags.

## Normal Blocks

### `藥` — Medicine

Restores 1 `體魄`, up to `根骨`.

### `斬` — Slash

Each ordinary Slash contributes:

```text
1 intrinsic damage + local encounter bonus + bounded 劍法 bonus
```

All ordinary Slash damage in the encounter is pooled. It attacks the front bottom-row monster and
carries any excess into the next bottom-row monster. It cannot reach monsters above that row.

Slash blocks show their resolved damage as dots. Damage display and combat resolution use the same
calculation.

### `機` — Opening / Momentum

When a settled row contains both `機` and `斬`, they pair one-to-one. Each pair changes one Slash to
`必殺`; the change is revealed before the encounter.

During the Slash group, each `必殺` instantly slays the highest-value surviving bottom-row monster.
Multiple `機` blocks can empower multiple Slashes, but each block participates in only one pair.
`機` has no additional effect when its encounter event resolves.

### `甲` — Armour

Adds Guard equal to its displayed value, capped at 6. Its base value is 1; each `重甲` blessing adds
1 to every future `甲` block. Guard persists between encounters and absorbs monster damage before
health.

Every monster attack shakes the board even when Guard absorbs it completely. The health meter only
shakes when health is actually lost.

### `呪` — Curse

Adds one pending Curse charge. Charges follow a queue:

```text
呪 resolves -> charge waits -> a later monster encounter consumes one charge
            -> front monster gains +1 value
            -> kill it for +2 財寶, or let it attack for no bounty
```

Detailed rules:

- A Curse never affects a monster in the same encounter in which it resolves.
- Empty encounters preserve every pending charge.
- Multiple Curse blocks add multiple charges; there is no current queue cap.
- At the start of an encounter containing monsters, at most one charge is consumed.
- The charge infects only the front bottom-row monster.
- Remaining charges wait for later monster encounters.
- The infected monster becomes visibly cursed and gains exactly +1 value before resolution.
- Slaying that specific monster before its attack grants exactly 2 treasure.
- If it survives to attack, no bounty is granted, even if Guard absorbs all damage.
- A new Curse resolved during an already-cursed encounter joins the queue for a later encounter.

The side tag shows `呪` for one charge and `呪` plus a Chinese count for multiple charges.

### `寶` — Treasure

Adds 1 `財寶`.

### `劍` — Legacy Sword block

The type still exists and would add 1 bounded `劍法`, but its generation rate is zero. Current Sword
progression comes from the merchant.

## Monsters

A monster's current value is both its health and its attack damage. Phase bonuses are added when the
monster is generated; Curse adds another +1 when attached.

- `獸`: base value 1
- `賊`: base value 2
- `兇`: base value 3

Slash reduces the displayed value. A surviving monster attacks for its remaining value, Guard is
spent first, and the remainder reduces `體魄`. A slain monster receives a red ring before cleanup and
does not attack.

## Encounter Resolution

The bottom row is briefly highlighted before resolution. Events then resolve in three groups:

1. support blocks: `藥`, `劍`, `呪`, `寶`, `機`, and `甲`
2. all `斬` blocks
3. bottom-row monsters

Support and monster events use left-to-right order. Support state changes happen before Slash even
when the support block is positioned to its right. The staggered traveling glyphs are presentation;
their effects have already been committed.

Slash resolution handles `必殺` kills first, then pooled ordinary damage. Slain Cursed Monster
treasure is awarded after the monster group confirms the target did not attack. After the group
sequence, slain monsters exit and the remaining board collapses.

## Merchant And Blessings

The merchant opens between rounds when `財寶` is at least 10. Existing board content is preserved.
Each visit offers three random entries from the full blessing pool plus a skip option.

Buying a blessing currently spends all treasure. Skipping costs 5 treasure. The run resumes after
either choice.

| Blessing | Type | Effect |
| --- | --- | --- |
| `回春` | instant | Restore `體魄` to `根骨` |
| `磨鋒` | instant | `劍法 +1`, capped at +2 |
| `連斬` | lasting | With at least two Slashes in an encounter, each ordinary Slash gains +1 damage |
| `鍊體` | instant | `根骨 +2` and `體魄 +2`, respecting the new maximum |
| `重甲` | lasting | Every future `甲` gains +1 Guard value |
| `斬奪` | lasting | Adds 10% to the `奪` chance if `奪` is enabled |

Lasting blessings appear in the side panel and repeated copies are shown as a stack count. Instant
blessings apply immediately and do not appear there.

`奪` is currently disabled by configuration. Therefore `斬奪` can appear and be bought but has no
combat effect in the current build. If re-enabled, each slain monster starts with a 10% `奪` chance,
each `斬奪` adds 10% up to 100%, and a trigger grants either 1 treasure or 1 health with equal
probability.

## Feedback And Presentation

- The warm corner marks communicate cells without enclosing every block in a border.
- Block corner colors distinguish Medicine, Slash, Curse, Treasure, Momentum, Armour, and monsters.
- A Slash draws a red path through its targets; struck monsters shake and reveal reduced value.
- Support glyphs travel from their board cells to the affected stat.
- Curse travels from the pending tag to the target monster on attachment.
- Cursed Monster treasure travels back to the treasure stat before the displayed total catches up.
- The bottom-row encounter gate appears and retreats instead of using a permanent lane-wide border.

## Pause And Ending States

Pausing freezes falling, encounters, board animations, and UI effects. A quick fade dims the board,
upcoming strip, and side panel while keeping their information visible. The pause bookmark reads
`按兵不動`. The mobile pause button hides while paused; tapping the dimmed canvas resumes. A short
resume hold lets the player reacquire the board before motion continues.

End overlays read:

- loss: `折戟沉沙`
- victory: `克敵制勝`

## Controls

### Keyboard

Normal play:

- Left / Right: move the normal piece one column
- Down: hard-drop
- Space: rotate; while paused, resume
- Escape: pause or resume
- R: leave the current run and return to the cover state

Merchant:

- Left / Right: move the selection through the vertical choices
- Space or Enter: activate the selection
- 1–3: buy the corresponding visible blessing
- S: skip
- R: leave the run

### Touch

- Swipe left / right: move one column
- Swipe down: hard-drop
- Swipe up: rotate; while paused, resume
- `歇` button at bottom right: pause
- Tap the paused board: resume
- Tap a merchant blessing or skip column: choose it

## Current Provisional Areas

- Generation curves, treasure pace, and blessing strength still need full-run balancing.
- `奪` and therefore the practical value of `斬奪` are disabled.
- The retained merchant preview path and legacy Sword block exist for development but are hidden from
  normal play.
