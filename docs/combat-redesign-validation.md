# Combat Redesign Validation

## Implemented Prototype

- `劍` has zero normal-generation weight.
- Ordinary `斬` has intrinsic damage through the shared core combat calculation.
- `機` pairs with one `斬` in its row and turns that Slash into `必殺`.
- `甲` grants capped persistent Guard in core logic.
- Every resolved `呪` adds one pending Curse charge.
- A new Curse does not affect a monster in the same encounter.
- At the start of the next applicable monster encounter, exactly one pending charge infects the
  front monster.
- A Cursed Monster gains +1 value.
- Slaying the Cursed Monster grants two treasure.
- A surviving Cursed Monster grants nothing and attacks using its remaining increased value.
- Multiple Curse charges queue for separate future monster encounters rather than stacking on one
  monster.
- Cursed Slash and delayed Doom paths are not part of the current design.

## Queue -> Commit -> Resolve Effect

Curse creates a delayed obligation instead of immediately taxing a row that already contains only
three other combat resources. Once the Curse moves to the side, the player can use later queues to
prepare Slash, Momentum, or Guard before committing the next monster encounter.

The next encounter consumes one predictable charge and creates a bounded wager: defeat one +1-value
front monster for two treasure, or absorb its remaining attack without earning the bounty. Multiple
Curses extend this planning pressure across encounters without creating a single extreme monster.

## Verified Rule Scenarios

`tests/combatPrototype.test.mjs` validates:

- Base Slash and Momentum behavior.
- Persistent Guard and animation-independent rule application.
- Curse persistence through empty encounters.
- Intentional delayed infection when Curse and a monster share an encounter.
- One-charge consumption and front-monster targeting.
- Increased Cursed Monster value and attack.
- No bounty on failure or Guard absorption.
- Two-treasure rewards from ordinary and Momentum kills.
- Target-specific bounty with another surviving monster.
- Multiple Curses queueing without disappearing.
- A new Curse during a cursed encounter waiting for a later encounter.

## Provisional Values

- Ordinary Slash intrinsic damage: 1.
- Cursed Monster value bonus: +1.
- Cursed Monster bounty: +2 treasure.
- Guard cap: 6.
- Sword blessing cap: 2.
- `連斬` local bonus cap: +1.

These are first-balance values, not final balance claims.

## Next Phase

With the deterministic suite green, the next design phase is blessing review and tuning. Full-run
balance should be revisited after blessing effects, caps, exclusions, and merchant offers are
stable.
