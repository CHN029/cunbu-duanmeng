import assert from "node:assert/strict";

import { createBoard } from "../src/core/board.js";
import { BLOCK_TYPES } from "../src/core/blockTypes.js";
import { NORMAL_BLOCK_PERCENTAGES } from "../src/core/config.js";
import { getSlashDamage } from "../src/core/combatRules.js";
import { startEncounter, updateEncounter } from "../src/core/encounterOrchestrator.js";
import { updateUiEffects } from "../src/core/uiEffects.js";

function block(type) {
  return {
    ...BLOCK_TYPES[type],
    type,
  };
}

function makeGame() {
  return {
    width: 6,
    height: 9,
    normalColumns: 4,
    monsterColumns: 2,
    board: createBoard(),
    active: { normal: null, monsters: null },
    player: {
      body: 3,
      maxBody: 6,
      swordSkill: 0,
      treasure: 0,
      guard: 0,
      curseChain: { phase: "inactive" },
      blessings: [],
      blessingIds: [],
      armorValueBonus: 0,
    },
    gameOver: false,
    runComplete: false,
    run: {
      currentRound: 0,
      rounds: [],
    },
    encounter: null,
    merchant: null,
    effects: [],
    uiEffects: [],
  };
}

function setBottomRow(game, normalTypes, monsterTypes = []) {
  const y = game.height - 1;
  normalTypes.forEach((type, x) => {
    game.board[y][x] = block(type);
  });
  monsterTypes.forEach((type, index) => {
    game.board[y][4 + index] = block(type);
  });
}

function resolveEncounter(game) {
  startEncounter(game);
  advanceEncounter(game);
}

function advanceEncounter(game) {
  for (let step = 0; step < 80; step += 1) {
    updateUiEffects(game, 100);
    if (updateEncounter(game, 100)) return;
  }

  throw new Error("Encounter did not resolve in test loop.");
}

function resolveEncounterWithoutUiEffects(game) {
  startEncounter(game);

  for (let step = 0; step < 80; step += 1) {
    if (updateEncounter(game, 100)) return;
  }

  throw new Error("Encounter did not resolve in rules-only test loop.");
}

function bottom(game, x) {
  return game.board[game.height - 1][x];
}

assert.equal(NORMAL_BLOCK_PERCENTAGES.D, 0, "Sword block should not appear in normal generation.");

{
  const game = makeGame();
  setBottomRow(game, ["L", "T", "T", "T"], ["R"]);
  resolveEncounter(game);
  assert.equal(bottom(game, 4).slayed, true, "One ordinary Slash should slay a tier-1 monster.");
}

{
  const game = makeGame();
  setBottomRow(game, ["O", "L", "L", "T"], ["G", "M"]);
  resolveEncounter(game);
  assert.equal(bottom(game, 4).slayed, true, "Momentum should convert one Slash into a front-monster kill.");
  assert.equal(game.player.body, 2, "Remaining ordinary Slash damage should reduce the next monster's attack.");
}

{
  const game = makeGame();
  setBottomRow(game, ["E", "T", "T", "T"]);
  resolveEncounter(game);
  assert.equal(game.player.guard, 1, "Armor should add persistent Guard when no monster is present.");
}

{
  const game = makeGame();
  setBottomRow(game, ["E", "T", "T", "T"], ["R"]);
  resolveEncounterWithoutUiEffects(game);
  assert.equal(game.player.body, 3, "Armor should protect before UI animation effects advance.");
  assert.equal(game.player.guard, 0, "Armor protection should be spent by the monster attack.");
}

{
  const game = makeGame();
  setBottomRow(game, ["C", "T", "T", "T"]);
  resolveEncounter(game);
  assert.equal(game.player.curseChain.phase, "pendingMonster", "Curse should remain pending after an empty encounter.");
}

{
  const game = makeGame();
  setBottomRow(game, ["C", "T", "T", "T"], ["R"]);
  startEncounter(game);
  assert.equal(bottom(game, 4).cursedMonster, undefined, "A Curse created in the current encounter should not curse that encounter's monster.");
  advanceEncounter(game);
  assert.equal(game.player.body, 2, "The current monster should attack with its ordinary value.");
  assert.equal(game.player.curseChain.phase, "pendingMonster", "Current-encounter Curse should wait for the next monster encounter.");
}

{
  const game = makeGame();
  game.player.curseChain = { phase: "pendingMonster" };
  setBottomRow(game, ["T", "T", "T", "T"], ["R"]);
  resolveEncounter(game);
  assert.equal(game.player.body, 1, "A surviving Cursed Monster should attack with its increased remaining value.");
  assert.equal(game.player.curseChain.phase, "inactive", "A surviving Cursed Monster should end the chain.");
}

{
  const game = makeGame();
  game.player.curseChain = { phase: "pendingMonster" };
  game.player.guard = 2;
  setBottomRow(game, ["T", "T", "T", "T"], ["R"]);
  resolveEncounter(game);
  assert.equal(game.player.body, 3, "Guard should absorb a Cursed Monster attack without earning the reward.");
  assert.equal(game.player.guard, 0, "Guard should be spent by the increased Cursed Monster attack.");
  assert.equal(game.player.curseChain.phase, "inactive", "Guard absorption should still end a failed Curse chain.");
}

{
  const game = makeGame();
  game.player.curseChain = { phase: "pendingMonster" };
  setBottomRow(game, ["T", "T", "T", "T"], ["R", "M"]);
  startEncounter(game);
  assert.equal(bottom(game, 4).cursedMonster, true, "Pending Curse should attach to the front monster.");
  assert.equal(bottom(game, 4).value, 2, "A value-1 monster should display and resolve as value 2 when cursed.");
  assert.equal(bottom(game, 5).cursedMonster, undefined, "Curse should not attach to the second monster first.");
}

{
  const game = makeGame();
  game.player.curseChain = { phase: "pendingMonster" };
  setBottomRow(game, ["L", "L", "T", "T"], ["R"]);
  resolveEncounter(game);
  assert.equal(bottom(game, 4).slayed, true, "Ordinary Slash damage should slay a Cursed tier-1 monster.");
  assert.equal(game.player.curseChain.phase, "pendingSlash", "Slaying a Cursed Monster should create one future Cursed Slash.");
}

{
  const game = makeGame();
  game.player.curseChain = { phase: "pendingMonster" };
  setBottomRow(game, ["O", "L", "T", "T"], ["G"]);
  resolveEncounter(game);
  assert.equal(bottom(game, 4).slayed, true, "Momentum should count as a legitimate Cursed Monster slay.");
  assert.equal(game.player.curseChain.phase, "pendingSlash", "Momentum slay should create the same future Cursed Slash reward.");
}

{
  const game = makeGame();
  game.player.curseChain = { phase: "pendingMonster" };
  game.board[game.height - 2][0] = block("L");
  setBottomRow(game, ["L", "L", "T", "T"], ["R"]);
  const currentSlash = bottom(game, 0);
  resolveEncounter(game);
  assert.equal(currentSlash.cursedSlash, undefined, "The reward should not empower a Slash in the same encounter that earned it.");
  assert.equal(game.board[game.height - 2][0].cursedSlash, true, "The next future Slash on the board should be marked.");
  assert.equal(game.player.curseChain.phase, "cursedSlash", "A marked future Slash should hold the cursedSlash phase.");
}

{
  const game = makeGame();
  setBottomRow(game, ["L", "T", "T", "T"], ["M"]);
  const slash = bottom(game, 0);
  slash.cursedSlash = true;
  game.player.curseChain = { phase: "cursedSlash" };
  assert.equal(getSlashDamage(game, null, slash), 2, "A Cursed Slash should display +1 damage through shared rules.");
  resolveEncounter(game);
  assert.equal(bottom(game, 4).slayed, true, "A Cursed Slash should apply its +1 damage once.");
  assert.equal(game.player.curseChain.phase, "inactive", "A resolving Cursed Slash should end the chain.");
}

{
  const game = makeGame();
  setBottomRow(game, ["L", "T", "T", "T"]);
  const slash = bottom(game, 0);
  slash.cursedSlash = true;
  game.player.curseChain = { phase: "cursedSlash" };
  resolveEncounter(game);
  assert.equal(game.player.curseChain.phase, "inactive", "A Cursed Slash should be spent even without monsters.");
}

{
  const game = makeGame();
  game.player.curseChain = { phase: "pendingMonster" };
  setBottomRow(game, ["C", "T", "T", "T"]);
  startEncounter(game);
  assert.equal(bottom(game, 0).type, "L", "A second Curse should be deterministically replaced while a chain is active.");
}

console.log("combat prototype scenarios passed");
