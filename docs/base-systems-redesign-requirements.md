# Curse Chain Redesign Handoff

## Status

Accepted design direction for the next implementation agent. This document replaces the previous
Armor, Doom, Sword-block, and general base-system redesign discussion. Those systems have already
been prototyped; do not reopen them as part of this task.

The existing code is the source of truth for current behavior. Other design documents may lag
behind the implementation.

## Mission

Replace the current delayed Doom wager with a short, finite Curse chain:

```text
Curse block
    -> next monster becomes a Cursed Monster
    -> slaying it creates one Cursed Slash
    -> that Slash resolves with +1 damage
    -> chain ends
```

Design shorthand:

> Accept a harder monster now to earn one stronger Slash later.

The chain should strengthen the existing core mechanism:

> Queue -> Commit -> Resolve.

It must remain easy to predict from the board and upcoming-block display. Do not add monster-specific
traits, separate monster health and damage, block-combination recipes, permanent Curse possession,
or a repeating transfer loop.

## Established Combat Baseline

Preserve the current accepted base rules unless this Curse chain strictly requires a small change:

- A monster's remaining value is both its remaining health and its attack damage.
- Slash has nonzero intrinsic damage.
- Slash damage follows:

  ```text
  intrinsic Slash value + local encounter bonuses + bounded blessing bonuses
  ```

- Armor grants capped persistent Guard.
- Guard absorbs incoming monster damage and persists until consumed, subject to its cap.
- Momentum can slay a front monster through the existing instant-Slash behavior.
- Sword blocks do not appear in normal block generation.
- Support effects resolve before Slashes, and Slashes resolve before monster attacks.

The new Cursed Slash bonus is a one-use local bonus. It is not Sword Skill and must not create
permanent Slash scaling.

## Required Curse Chain

### 1. Curse block creates a pending Curse

- Resolving `呪` creates one pending Curse chain.
- If the current encounter has no valid monster, the Curse waits for the next applicable monster.
- The pending state must be visible to the player.
- Empty encounters must not discard the Curse.

### 2. The next monster becomes a Cursed Monster

- Before Slash activation, the pending Curse attaches to the next monster that would attack.
- For the prototype, a Cursed Monster has exactly `+1 value`.
- Because monster value remains unified, this increases both its initial durability and its
  potential attack damage through the existing remaining-value rule.
- The monster must have an unmistakable cursed visual state before damage resolves.
- Displayed value and resolved value must match.
- Do not add a separate Doom damage bonus on top of the increased monster value.

When multiple monsters are present, use the existing front-monster targeting order. Do not add a
new target-selection interface for this prototype.

### 3. Slaying the Cursed Monster creates one Cursed Slash

- If the Cursed Monster is slain before it attacks, create exactly one Cursed Slash reward.
- Slaying it by ordinary Slash, accumulated Slash damage, Momentum, or another legitimate combat
  effect must count consistently.
- The reward applies to a future Slash, not to another Slash in the encounter that earned it.
- No treasure, healing, or additional bounty is granted by this chain.
- If the Cursed Monster survives to attack, no Cursed Slash is created and the chain ends.
- Guard may absorb the failed Cursed Monster's attack, but Guard does not count as slaying it and
  cannot earn the reward.

### 4. The next Slash becomes a Cursed Slash

- Mark the next available future Slash as Cursed as soon as it can be identified.
- The marked Slash must be visible in the upcoming stream and on the board.
- A Cursed Slash deals exactly `+1 damage` through the shared core Slash-damage calculation.
- The bonus applies once to that Slash block only.
- When the Cursed Slash resolves, the chain ends whether or not it hits or slays a monster.
- Resolving it in an encounter without monsters spends the bonus. This keeps commitment timing
  relevant and avoids an invisible banked damage modifier.
- A Cursed Slash cannot create another Cursed Monster or another Cursed Slash.

## Chain Lifetime and Multiplicity

The first prototype supports only one active Curse chain at a time.

An active chain is any of:

- a pending Curse waiting for a monster;
- a Cursed Monster waiting to resolve;
- a Cursed Slash waiting to resolve.

Do not allow another Curse block to resolve into a second chain while one is active. Prevent or
replace additional Curse blocks before they become a dead player choice; do not silently consume a
Curse block with no effect. Keep the suppression or replacement rule explicit and deterministic.

The Curse bonus is fixed at `+1`. It does not stack, level up, or persist after the Cursed Slash
resolves.

## State and Resolution Requirements

- Represent the chain with an explicit core state; do not infer it solely from animation objects or
  rendered labels.
- A monster and Slash should carry explicit cursed identity while affected.
- Apply all value and damage changes in core combat logic before their animations play.
- Animation timing must never determine whether the Curse, monster value increase, kill reward, or
  Cursed Slash bonus is applied.
- Cleanup must remove stale cursed flags after the relevant monster or Slash resolves.
- Starting, finishing, pausing, or cascading encounters must not duplicate or lose the chain.
- Game over ends the run normally; no special Curse cleanup beyond ordinary run disposal is needed.

Suggested conceptual states:

```text
inactive
pendingMonster
cursedMonster
```

The implementation may use different names, but equivalent lifetimes must be explicit and
testable.

## Player Communication

The complete chain should be understandable without opening documentation:

- Pending Curse: show that a future monster will be cursed.
- Cursed Monster: distinct mark plus its already-increased value.
- Successful slay: visibly transfer the Curse reward toward the upcoming Slash stream.
- Cursed Slash: distinct mark and displayed damage including `+1`.
- Failed slay: visibly end the chain without implying that a reward remains pending.
- Cursed Slash resolution: visibly consume the cursed state.

Keep the presentation compact and consistent with the existing glyph-and-dot visual language. Broad
UI or art-direction changes are out of scope.

## Deterministic Prototype Scenarios

Add rule-level tests covering at least:

1. Curse resolves without a monster and remains pending.
2. Pending Curse attaches to the next front monster before Slash damage.
3. A value-1 monster becomes value 2 when cursed.
4. Cursed Monster survives, attacks with its remaining value, and produces no Cursed Slash.
5. Guard absorbs some or all of a surviving Cursed Monster's attack without earning the reward.
6. Ordinary Slash slays a Cursed Monster and creates exactly one future Cursed Slash.
7. Momentum slays a Cursed Monster and creates the same reward.
8. The reward does not empower a later Slash in the same encounter.
9. The next future Slash is visibly marked and resolves with exactly `+1 damage`.
10. A Cursed Slash resolving without a monster is consumed.
11. A Cursed Slash resolves once and cannot continue or restart the chain.
12. Multiple monsters use the existing front-target order for Curse attachment.
13. Consecutive or cascade encounters preserve the correct chain state.
14. A second Curse cannot create a concurrent chain or disappear as a no-effect block.
15. Displayed monster value and Slash damage match the applied core values.

Tests must validate player health, Guard, monster values, cursed identities, chain state, resulting
Slash damage, and cleanup after resolution.

## Implementation Areas

Inspect the current code before editing. Likely areas include:

- `src/core/config.js`
- `src/core/blockTypes.js`
- `src/core/combatRules.js`
- `src/core/encounterOrchestrator.js`
- `src/core/runOrchestrator.js`
- `src/core/pieces.js`
- `src/core/game.js`
- `src/renderers/canvasRenderer.js`
- `src/main.js`
- `tests/combatPrototype.test.mjs`

Keep rule ownership in core modules. Rendering should only visualize resolved state.

## Out of Scope

- Unique monster traits or behaviors.
- Separate health and attack statistics.
- Permanent or endlessly transferring Curse.
- Curse-to-block adjacency or block-combination recipes.
- Cursed Armor or Curse interactions with every block type.
- Multiple simultaneous Curse chains.
- Stackable Curse strength.
- New treasure rewards for cursed kills.
- Final Curse frequency, monster curve, or full-run numerical balance.
- Broad blessing redesign.
- Broad combat, UI, input, or board-placement refactors.

## Deliverables

The implementing agent should provide:

1. A playable finite Curse chain matching this document.
2. Core state and cleanup rules for every chain phase.
3. Cursed Monster and Cursed Slash presentation in the board and upcoming stream.
4. Deterministic tests for the required scenarios.
5. A short validation record explaining whether the chain changes encounter timing and future-row
   planning.
6. A list of removed or deprecated Doom state, constants, UI labels, and code paths.
7. A note describing how additional Curse blocks are prevented or replaced while a chain is active.
8. No final balance claims unless supported by repeatable simulations.

## Acceptance Criteria

The redesign is ready when:

- Curse reliably follows `Curse -> Cursed Monster -> Cursed Slash -> end`.
- The affected monster is cursed before Slash activation.
- A Cursed Monster uses the existing unified value rule with a visible `+1` increase.
- Slaying it is the only way to earn the one-use Cursed Slash.
- Failure ends the chain without granting the reward.
- The reward cannot affect the encounter that created it.
- The Cursed Slash deals exactly `+1` displayed and applied damage once.
- The chain never loops, stacks, duplicates, or disappears ambiguously.
- Empty and cascade encounters preserve the defined state.
- A second Curse cannot become a dead block or create a concurrent chain.
- Core outcomes do not depend on animation timing.
- The implementation gives the player a visible reason to plan the current monster encounter and a
  later encounter together.
