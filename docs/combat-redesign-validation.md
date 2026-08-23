# Combat Redesign Validation

## Prototype Implemented

This pass replaces the previous delayed Doom wager with the finite Curse chain described in
`base-systems-redesign-requirements.md`.

- `劍` no longer appears in normal block generation.
- `斬` damage is calculated through `src/core/combatRules.js`.
- Ordinary `斬` has intrinsic damage, independent of Sword blessings.
- `磨鋒` gives a bounded Sword blessing bonus instead of uncapped common-block growth.
- `勢` converts one `斬` into `必殺`; each `必殺` slays one front monster.
- `甲` adds capped persistent Guard on the player.
- `咒` creates one finite chain: pending Curse, Cursed Monster, future Cursed Slash, then end.
- A Cursed Monster gains +1 value directly; there is no separate Doom attack bonus.
- Slaying a Cursed Monster creates exactly one future Cursed Slash with +1 damage.
- Additional `咒` blocks are deterministically replaced by `斬` while a Curse chain is active.

## Rule Scenarios

`tests/combatPrototype.test.mjs` covers the first prototype checks:

- `劍` has 0% normal generation weight.
- One ordinary `斬` slays a tier-1 monster.
- `勢` converts one `斬` into a front-monster kill, while remaining ordinary Slash damage still
  affects the next monster.
- `甲` adds Guard in an empty encounter.
- `甲` protects against monster damage even when UI effects are not advanced.
- `咒` remains pending through an empty encounter.
- `咒` created in a monster encounter does not affect that encounter's monster.
- Pending Curse attaches to the front monster, increases value by 1, and does not attach to the
  second monster first.
- A surviving Cursed Monster attacks with its remaining value and ends the chain without reward.
- Guard can absorb a Cursed Monster attack but still does not earn the reward.
- Ordinary Slash damage and Momentum can both slay a Cursed Monster and create the future Cursed
  Slash reward.
- The reward does not empower a Slash in the same encounter that earned it.
- A Cursed Slash displays and applies +1 damage through `src/core/combatRules.js`.
- A Cursed Slash is consumed even if it resolves without monsters.
- A second Curse is replaced while a chain is active.

## Queue -> Commit -> Resolve Effects

Guard gives the player a reason to accept a weaker current row because protection can be banked for
future encounters. Slash remains better when the current row contains threats that should be
removed immediately.

Curse now asks the player to prepare for a later harder monster in exchange for one stronger Slash
afterward. A `咒` created in the current encounter waits for a later encounter, so it cannot
retroactively change the monster already committed in that row. The reward is explicitly
future-facing; it cannot empower the same encounter that earned it.

Momentum changes which effects the player wants to resolve together: it needs at least one `斬`,
and it is wasted without monsters. Its power is capped by available Slashes and current monsters
instead of multiplying all damage.

Sword progression now belongs to merchant blessings. A run without Sword blessings still has
intrinsic Slash damage and Momentum one-hit kills, so basic combat does not depend on seeing
`磨鋒`.

## Provisional Values

- Ordinary Slash intrinsic damage: 1.
- Sword blessing cap: 2.
- Guard cap: 6.
- Momentum: one `必殺` per `勢`.
- Cursed Monster value bonus: +1.
- Cursed Slash damage bonus: +1.
- `連斬`: currently bounded to +1 local Slash damage when more than one `斬` is present.

## Removed Doom Paths

- Removed `pendingDoom` player state.
- Removed `CURSE_BLOCK_DOOM_GAIN`, `DOOM_REWARD_TREASURE_GAIN`, and the old Doom attack/reward
  resolution path.
- Removed Doom labels from the panel; the panel now shows `咒` while a future monster curse is pending.
- Removed the treasure reward for killing all cursed/applicable monsters.

## Known Follow-Up

- Add more deterministic tests around cascaded encounters and future-run marking.
- Review whether `磨鋒` should stack to cap, upgrade, or be excluded once capped.
- Review whether `連斬` should remain as a bounded modifier or become a different Sword blessing.
- Review whether active-chain `咒 -> 斬` replacement is the right deterministic suppression rule.
