# Gameplay

This is a falling-block roguelike about turning a messy stream of items, techniques, armor, treasure, and enemies into a survivable adventure.

The game is not balanced yet. The current rules are meant to make the core loop visible and tunable.

## Run Structure

A run has 80 pregenerated rounds.

Each round drops:

- two normal blocks in the left four columns
- zero, one, or two monster blocks in the right two columns

Normal blocks are controlled by the player. Monster blocks drop automatically and quickly into the monster columns.

Block types are randomized before the run starts. Their appearance rates are controlled by percentage tables in `src/core/config.js`.

The row above the board shows the next six blocks from unstarted rounds. When a round starts, its blocks leave the preview queue and later blocks slide forward.

The board is 6 columns by 12 rows:

- columns 1-4 are normal columns
- columns 5-6 are monster columns

After blocks settle, each column collapses downward so blocks fill any gaps beneath them.

## Objective

Survive the full 80-round run.

The player loses when `體魄` reaches `無`.

The player wins when the run completes.

## Player Stats

`體魄`

The player’s health. If it reaches `無`, the run ends in defeat.

`根骨`

The player’s maximum health. Healing cannot raise `體魄` above `根骨`.

`劍法`

The player’s base slash damage. It starts at 1, so a `斬` block always has at least one damage.

`財寶`

Currency. Treasure opens the merchant when it reaches 10.

`福澤`

Long-lasting modifier blessings bought from the merchant. One-time stat blessings still apply their effect, but they are not shown in the panel.

## Normal Blocks

`藥`

Healing. When resolved, `體魄 +1`, capped by `根骨`.

`劍`

Training. When resolved, `劍法 +1`.

`斬`

Attack. When resolved, deals `劍法 * 勢 multiplier` damage to the monster front.

Damage bleeds across monsters in the current encounter only. If the first bottom-row monster is slain and damage remains, the remainder can hit the other bottom-row monster. It cannot reach monsters stacked above the bottom row.

`咒`

Curse. Adds +1 damage to the next surviving monster attack in the current encounter.

`寶`

Treasure. When resolved, `財寶 +1`.

`勢`

Momentum. Doubles all later `斬` blocks in the same encounter. Multiple momentum blocks multiply further.

`甲`

Armor. Has value 2, shown with two dots. When resolved, adds 2 temporary shield for the current encounter. Shield is spent before `體魄` when monsters attack.

## Monster Blocks

Monster value is both health and damage.

`賊`

Value 1.

`鬼`

Value 2.

`將`

Value 3.

If a monster survives until its monster event resolves, it damages the player by its remaining value plus any curse bonus.

If a monster is slain, it stays in its normal block style until its monster event clears it.

## Encounter Trigger

An encounter starts when the bottom row of the four normal columns is full.

The encounter does not clear instantly. It resolves block by block with a short animation delay.

Resolution order:

1. Non-attacking normal blocks
2. `斬` blocks
3. Bottom-row monster blocks

This means setup blocks like `勢`, `劍`, `甲`, `藥`, `寶`, and `咒` resolve before attacks, regardless of their left-to-right position.

## Encounter Feedback

Status blocks fade as they apply their effect.

When `斬` slays a monster, the slain monster creates a red expanding glyph.

When a monster attacks, a red shadow of its glyph expands outward.

When a monster is slain, its block no longer changes into a red card.

`奪` has a 10% base chance to trigger on each slain monster. It appears as a green expanding glyph from the slain monster after the red slay glyph has started. It grants either:

- `財寶 +1`
- or `體魄 +1`, capped by `根骨`

Each `斬奪` blessing adds another 10% trigger chance, capped at 100%.

## Merchant

The merchant opens after `財寶` reaches 10 and the game is between rounds.

The board content is preserved underneath the merchant view. After choosing or skipping, the game resumes.

Current merchant title:

`寶至福臨`

Each merchant visit shows 3 random blessings from the full blessing pool.

Current blessing pool:

- `回春`: one-time stat effect; restore `體魄` to full
- `磨鋒`: one-time stat effect; `劍法 +2`
- `連斬`: lasting modifier; if an encounter has more than one `斬`, each `斬` gains +1 damage for each `斬` in that encounter
- `鍊體`: one-time stat effect; `根骨 +2` and `體魄 +2`
- `重甲`: lasting modifier; `甲` value +1
- `斬奪`: lasting modifier; `奪` trigger chance +10%

Buying any boon currently:

- costs all `財寶`
- applies the boon effect
- adds the boon name to `福澤` only if it is a lasting modifier
- resumes the run

Skipping:

- costs 5 `財寶`
- does not add a blessing
- resumes the run

The temporary `暫看行商` button is currently hidden.

## Controls

Normal play:

- Escape: pause or unpause
- R: new run
- Left: move normal blocks left
- Right: move normal blocks right
- Down: hard drop
- Space: rotate the normal piece, or unpause if paused

Merchant:

- Up/Down: move highlighted option
- Space: choose highlighted option
- Enter: choose highlighted option
- 1-3: choose a visible option directly
- S: skip
- R: new run

## Current Design Questions

The game already has the shape of a roguelike, but several systems are intentionally unfinished:

- `奪` starts at 10% and can be raised by `斬奪`; both values are tunable.
- Treasure pacing needs tuning once shop boons matter.
- Monster frequency, monster tiers, and normal block appearance percentages are tunable but not balanced yet.
- `咒` is negative but may need stronger player-facing tension.
- The board puzzle should continue to reward planning around encounter order.
