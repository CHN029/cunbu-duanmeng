# Queued Curse Bounty Handoff

## Status

Accepted and implemented direction for the base combat prototype. This document replaces the
discarded delayed Doom and Cursed Slash designs.

The code is the source of truth for current behavior. Future work should preserve this Curse timing
through the first balance and blessing phases unless playtesting demonstrates a structural problem.

## Core Mechanism

The game is organized around:

> Queue -> Commit -> Resolve.

Curse strengthens this mechanism across two encounters:

```text
Encounter A
Curse resolves -> moves to the side as a pending charge

Encounter B
one pending charge infects the front monster before resolution
-> Cursed Monster gains +1 value
-> slay it for +2 treasure
-> or let it survive and receive no bounty
```

Design shorthand:

> Accept a future harder monster for a visible treasure bounty.

## Established Combat Baseline

- A monster's remaining value is both its remaining health and attack damage.
- Slash has nonzero intrinsic damage.
- Slash damage follows:

  ```text
  intrinsic Slash value + local encounter bonuses + bounded blessing bonuses
  ```

- Armor grants capped persistent Guard.
- Guard absorbs incoming monster damage and persists until consumed, subject to its cap.
- Momentum can turn a paired Slash into an instant front-monster kill.
- Sword blocks do not appear in normal generation.
- Support resolves before Slash, and Slash resolves before monster attacks.
- Core outcomes must never depend on animation timing.

## Required Curse Rules

### Resolving Curse

- Every resolved `呪` adds one pending Curse charge.
- The charge moves visibly from the encounter row to the side panel.
- A Curse resolved in an encounter does **not** infect a monster in that same encounter.
- This delay is intentional: Curse already occupies one of the four current combat blocks, so it
  must not also strengthen the current threat.
- Encounters without monsters preserve all pending charges.

### Queued charges

- Pending Curse is a non-negative count, not a single active-chain flag.
- Multiple Curse blocks may resolve in one row and each adds one charge.
- There is no arbitrary cap in the first prototype; measure naturally occurring queue sizes during
  simulations before adding one.
- Display one charge as `呪` and multiple charges as `呪` plus the count.

### Infecting a monster

- At the start of an encounter containing monsters, consume at most one pending Curse charge.
- Infect the front monster using the existing front-target order.
- Infection happens before support, Slash, and monster-attack resolution.
- A second monster in the same encounter is not infected by another queued charge.
- Remaining charges wait for later applicable encounters.
- A Curse block resolving during the infected encounter joins the pending queue for a later
  encounter.

### Cursed Monster

- A Cursed Monster gains exactly `+1 value` for the prototype.
- Because monster value is unified, this increases durability and potential attack damage through
  the existing remaining-value rule.
- The increased value must be applied in core logic and displayed before combat resolves.
- The monster must have a clear cursed visual state.
- Do not add separate Doom damage or unique cursed-monster traits.

### Success and failure

- Slaying the Cursed Monster before it attacks grants exactly `+2 treasure`.
- Ordinary Slash, accumulated Slash damage, Momentum, and other legitimate kills must grant the
  same bounty.
- The bounty belongs to the cursed target: killing it earns the reward even if another monster in
  the encounter survives.
- If the Cursed Monster survives to attack, it grants no treasure.
- Guard may absorb its attack but cannot earn the bounty.
- The consumed charge ends after either success or failure and never returns.
- There is no Cursed Slash reward or continuing Curse chain.

## Player Communication

The complete rule must be understandable in play:

- Resolving `呪` visibly transfers it to the side.
- The side displays the pending count.
- At the next monster encounter, one Curse visibly travels to the front monster.
- The Cursed Monster displays its already-increased value.
- A successful kill visibly awards two treasure.
- Failure removes the infected monster normally and does not imply that a reward remains.
- If more Curse charges remain, the side count stays visible after one is consumed.

Keep presentation consistent with the existing glyph-and-dot language. Broad UI redesign is out of
scope.

## Deterministic Scenarios

Rule-level tests must cover:

1. One ordinary Slash versus a value-1 monster.
2. Momentum plus Slash against multiple monsters.
3. Persistent Guard in an empty encounter.
4. Guard applying correctly without UI animation updates.
5. Curse resolving in an empty encounter and remaining pending.
6. An empty encounter preserving multiple queued Curses.
7. Curse and monster in the same row: the current monster remains ordinary and Curse queues.
8. The next monster encounter consuming exactly one queued Curse.
9. The front monster receiving `+1 value` before resolution.
10. A surviving Cursed Monster attacking with increased remaining value and granting no bounty.
11. Guard absorbing that attack without earning treasure.
12. Multiple monsters: only the front monster is infected.
13. Ordinary Slash killing a Cursed Monster for exactly two treasure.
14. Momentum killing a Cursed Monster for the same bounty.
15. Killing the cursed target while another monster survives still granting the bounty.
16. Two Curse blocks in one row adding two pending charges.
17. A newly resolved Curse during a cursed encounter queueing for a later encounter.

Tests must validate player health, Guard, monster values and identity, treasure, pending Curse count,
front-target order, and cleanup.

## Implementation Constraints

- Keep state transitions and calculations in core modules, not renderers.
- Apply Guard, Curse, monster value, damage, and treasure independently of animation timing.
- Consume at most one pending charge per monster encounter.
- Do not silently discard additional Curse blocks.
- Do not infect a same-row monster with a newly resolved Curse.
- Preserve existing board placement and input behavior.
- Preserve the shared Slash-damage source used by resolution and display.
- Do not tune final percentages, monster curves, or blessing power in this implementation task.

## Out of Scope

- Cursed Slash.
- Endless Curse transfer.
- Same-row Curse infection.
- Stacking several Curse bonuses on one monster.
- Unique monster traits.
- Separate health and attack values.
- Curse/block adjacency recipes.
- Final Curse frequency or merchant-economy balance.
- Broad blessing redesign.

## Acceptance Criteria

The system is ready when:

- Every resolved Curse adds one visible pending charge.
- A newly resolved Curse waits until a later monster encounter.
- Empty encounters preserve the full queue.
- An applicable encounter consumes exactly one charge and infects only the front monster.
- A Cursed Monster visibly and mechanically gains `+1 value` before resolution.
- Slaying it grants exactly two treasure through core logic.
- Failure and Guard absorption grant no bounty.
- Additional queued charges remain available for later encounters.
- Multiple Curse blocks never become dead blocks.
- No Cursed Slash state or behavior remains.
- Deterministic tests pass without depending on animation updates.
