import assert from "node:assert/strict";

import { createBoard, getLandingPiece, getSettledLandingPiece } from "../src/core/board.js";
import { BLOCK_TYPES } from "../src/core/blockTypes.js";
import {
  CURSED_MONSTER_TREASURE_GAIN,
  CURSED_MONSTER_VALUE_BONUS,
  MERCHANT_PURCHASE_COST,
  MONSTER_BLOCK_PERCENTAGES,
  MONSTER_COUNT_PERCENTAGES,
  NORMAL_BLOCK_PERCENTAGES,
} from "../src/core/config.js";
import { startEncounter, updateEncounter } from "../src/core/encounterOrchestrator.js";
import { chooseMerchantOption } from "../src/core/game.js";
import { getEligibleBlessingOptions } from "../src/core/blessings.js";
import { createMerchant } from "../src/core/merchant.js";
import { createRun, getEffectiveNormalBlockPercentages, getNextRound, peekUpcomingBlocks } from "../src/core/runOrchestrator.js";
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
      body: 6,
      maxBody: 6,
      swordSkill: 0,
      treasure: 0,
      guard: 0,
      pendingCurses: 0,
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
    gravityAnimations: [],
    exitAnimations: [],
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

function resolveEncounter(game, { updateUi = true } = {}) {
  startEncounter(game);
  advanceEncounter(game, { updateUi });
}

function advanceEncounter(game, { updateUi = true } = {}) {
  for (let step = 0; step < 160; step += 1) {
    if (updateUi) updateUiEffects(game, 100);
    if (updateEncounter(game, 100)) return;
  }

  throw new Error("Encounter did not resolve in test loop.");
}

function bottom(game, x) {
  return game.board[game.height - 1][x];
}

assert.equal(BLOCK_TYPES.D, undefined, "Sword block should not exist in the block catalogue.");
assert.equal(NORMAL_BLOCK_PERCENTAGES.D, undefined, "Sword block should not appear in normal generation.");
assert.equal(Object.values(NORMAL_BLOCK_PERCENTAGES).reduce((sum, value) => sum + value, 0), 100, "Normal block percentages should add up to 100.");
assert.equal(Object.values(MONSTER_BLOCK_PERCENTAGES).reduce((sum, value) => sum + value, 0), 100, "Monster block percentages should add up to 100.");
assert.equal(Object.values(MONSTER_COUNT_PERCENTAGES).reduce((sum, value) => sum + value, 0), 100, "Monster-count percentages should add up to 100.");

{
  const player = { blessingIds: [] };
  const effective = getEffectiveNormalBlockPercentages(player);
  assert.deepEqual(effective, NORMAL_BLOCK_PERCENTAGES, "No drop blessing should preserve base normal-block rates.");
}

{
  const dropBlessings = [
    ["arsenal", "L"],
    ["armoury", "E"],
    ["herbGarden", "B"],
    ["fortune", "T"],
    ["summonCalamity", "C"],
    ["seekOpenings", "O"],
  ];

  dropBlessings.forEach(([id, type]) => {
    const effective = getEffectiveNormalBlockPercentages({ blessingIds: [id] });
    const total = Object.values(effective).reduce((sum, value) => sum + value, 0);
    assert.equal(Math.round(total * 1000) / 1000, 100, `${id} effective rates should add up to 100.`);
    assert.ok(effective[type] > NORMAL_BLOCK_PERCENTAGES[type], `${id} should increase ${type}'s effective rate.`);
  });
}

{
  const firstOrder = getEffectiveNormalBlockPercentages({ blessingIds: ["arsenal", "fortune"] });
  const secondOrder = getEffectiveNormalBlockPercentages({ blessingIds: ["fortune", "arsenal"] });
  assert.deepEqual(firstOrder, secondOrder, "Different drop blessings should combine independently of purchase order.");
}

{
  const player = { blessingIds: [] };
  const run = createRun(4);
  const preview = peekUpcomingBlocks(run, 6, 1, player);
  player.blessingIds.push("arsenal");
  const afterPurchasePreview = peekUpcomingBlocks(run, 6, 1, player);
  assert.deepEqual(afterPurchasePreview, preview, "Already previewed blocks should remain fixed after buying a drop blessing.");
}

{
  const player = { blessingIds: ["arsenal"] };
  const run = createRun(1);
  const originalRandom = Math.random;
  Math.random = () => 0.58;
  try {
    const round = getNextRound(run, 1, player);
    assert.equal(round[0].type, "L", "Newly generated rounds should use updated drop-blessing weights.");
  } finally {
    Math.random = originalRandom;
  }
}

{
  const newBlessings = ["arsenal", "armoury", "herbGarden", "fortune", "summonCalamity", "seekOpenings", "bounty"];
  const unownedIds = getEligibleBlessingOptions({ blessingIds: [] }).map((blessing) => blessing.id);
  newBlessings.forEach((id) => assert.ok(unownedIds.includes(id), `${id} should be eligible before it is owned.`));

  const ownedIds = getEligibleBlessingOptions({ blessingIds: newBlessings }).map((blessing) => blessing.id);
  newBlessings.forEach((id) => assert.equal(ownedIds.includes(id), false, `${id} should be ineligible after it is owned.`));
}

{
  const merchant = createMerchant({ blessingIds: [] }, false, true);
  const optionIds = merchant.options.map((option) => option.id);
  assert.equal(new Set(optionIds).size, optionIds.length, "Merchant offers should not contain duplicate blessing ids.");
  assert.ok(optionIds.length <= 3, "Merchant should show no more than three blessing options.");
}

{
  const board = createBoard();
  const landing = getLandingPiece(board, { blocks: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }, 0, 3);
  assert.deepEqual(landing.blocks.map(({ y }) => y), [8, 8], "Landing ghost should rest on the board floor.");
}

{
  const board = createBoard();
  board[8][1] = block("B");
  const landing = getSettledLandingPiece(board, { blocks: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }, 0, 3);
  assert.deepEqual(landing.blocks.map(({ y }) => y), [7, 8], "Landing ghost should preview column settling into lower gaps.");
}

{
  const game = makeGame();
  game.player.treasure = 12;
  game.merchant = {
    options: [{ id: "renewal", label: "回春", category: "instant" }],
    resumeWithNewRound: false,
    preview: false,
  };
  chooseMerchantOption(game, 0);
  const expectedTreasure = MERCHANT_PURCHASE_COST == null ? 0 : Math.max(0, 12 - MERCHANT_PURCHASE_COST);
  assert.equal(game.player.treasure, expectedTreasure, "Merchant purchase spending should follow config.");
}

{
  const game = makeGame();
  setBottomRow(game, ["L", "B", "B", "B"], ["R"]);
  resolveEncounter(game);
  assert.equal(bottom(game, 4).slayed, true, "One ordinary Slash should slay a tier-1 monster.");
}

{
  const game = makeGame();
  setBottomRow(game, ["O", "L", "L", "B"], ["G", "M"]);
  bottom(game, 1).instantSlash = true;
  resolveEncounter(game);
  assert.equal(bottom(game, 4).slayed, true, "Momentum should convert its paired Slash into a front-monster kill.");
  assert.equal(game.player.body, 5, "Remaining ordinary Slash damage should reduce the next monster's attack.");
}

{
  const game = makeGame();
  setBottomRow(game, ["E", "B", "B", "B"]);
  resolveEncounter(game);
  assert.equal(game.player.guard, 1, "Armor should add persistent Guard when no monster is present.");
}

{
  const game = makeGame();
  setBottomRow(game, ["E", "B", "B", "B"], ["R"]);
  resolveEncounter(game, { updateUi: false });
  assert.equal(game.player.body, 6, "Armor should protect before UI animation effects advance.");
  assert.equal(game.player.guard, 0, "Armor protection should be spent by the monster attack.");
  assert.equal(game.uiEffects.some(({ type, target }) => type === "shake" && target === "board"), true, "An armor-blocked monster attack should still shake the board.");
}

{
  const game = makeGame();
  setBottomRow(game, ["C", "B", "B", "B"]);
  resolveEncounter(game);
  assert.equal(game.player.pendingCurses, 1, "Curse should remain pending after an empty encounter.");
}

{
  const game = makeGame();
  game.player.pendingCurses = 2;
  setBottomRow(game, ["B", "B", "B", "B"]);
  resolveEncounter(game);
  assert.equal(game.player.pendingCurses, 2, "Empty encounters should preserve every queued Curse.");
}

{
  const game = makeGame();
  setBottomRow(game, ["C", "B", "B", "B"], ["R"]);
  startEncounter(game);
  assert.equal(bottom(game, 4).cursedMonster, undefined, "A Curse from the current row must not infect that row's monster.");
  advanceEncounter(game);
  assert.equal(game.player.body, 5, "The current monster should attack with its ordinary value.");
  assert.equal(game.player.pendingCurses, 1, "Current-row Curse should queue for a later monster encounter.");
}

{
  const game = makeGame();
  game.player.pendingCurses = 1;
  setBottomRow(game, ["B", "B", "B", "B"], ["R"]);
  startEncounter(game);
  assert.equal(game.player.pendingCurses, 0, "An applicable encounter should consume exactly one queued Curse.");
  assert.equal(bottom(game, 4).cursedMonster, true, "Queued Curse should infect the front monster before resolution.");
  assert.equal(bottom(game, 4).value, 1 + CURSED_MONSTER_VALUE_BONUS, "Cursed Monster should display its increased value.");
  advanceEncounter(game);
  assert.equal(game.player.body, 4, "A surviving Cursed Monster should attack with its increased value.");
  assert.equal(game.player.treasure, 0, "Surviving a Cursed Monster should grant no bounty.");
}

{
  const game = makeGame();
  game.player.pendingCurses = 1;
  game.player.guard = 2;
  setBottomRow(game, ["B", "B", "B", "B"], ["R"]);
  resolveEncounter(game);
  assert.equal(game.player.body, 6, "Guard should absorb a Cursed Monster attack without earning the bounty.");
  assert.equal(game.player.guard, 0, "Guard should be spent by the increased Cursed Monster attack.");
  assert.equal(game.player.treasure, 0, "Guard absorption must not count as slaying the Cursed Monster.");
}

{
  const game = makeGame();
  game.player.pendingCurses = 2;
  setBottomRow(game, ["B", "B", "B", "B"], ["R", "M"]);
  startEncounter(game);
  assert.equal(game.player.pendingCurses, 1, "A monster encounter should consume only one queued Curse.");
  assert.equal(bottom(game, 4).cursedMonster, true, "The first Curse should infect the front monster.");
  assert.equal(bottom(game, 5).cursedMonster, undefined, "Remaining Curse should wait instead of infecting a second monster.");
}

{
  const game = makeGame();
  game.player.pendingCurses = 1;
  setBottomRow(game, ["L", "L", "B", "B"], ["R"]);
  resolveEncounter(game);
  assert.equal(bottom(game, 4).slayed, true, "Ordinary Slash damage should slay a cursed tier-1 monster.");
  assert.equal(game.player.treasure, CURSED_MONSTER_TREASURE_GAIN, "Slaying a Cursed Monster should grant exactly two treasure.");
  assert.equal(game.player.pendingCurses, 0, "The consumed Curse should not return after the bounty resolves.");
}

{
  const game = makeGame();
  game.player.pendingCurses = 1;
  game.player.blessingIds.push("bounty");
  setBottomRow(game, ["L", "L", "B", "B"], ["R"]);
  resolveEncounter(game);
  assert.equal(game.player.treasure, CURSED_MONSTER_TREASURE_GAIN + 1, "懸賞 should add one treasure to a successful Cursed Monster bounty.");
  assert.equal(game.uiEffects.filter((effect) => effect.deferPanelStat === "treasure" && effect.amount === 1).length, CURSED_MONSTER_TREASURE_GAIN + 1, "懸賞 bounty should create matching treasure UI increments.");
}

{
  const game = makeGame();
  game.player.pendingCurses = 1;
  setBottomRow(game, ["O", "L", "B", "B"], ["G"]);
  bottom(game, 1).instantSlash = true;
  resolveEncounter(game);
  assert.equal(bottom(game, 4).slayed, true, "Momentum should count as a legitimate Cursed Monster slay.");
  assert.equal(game.player.treasure, CURSED_MONSTER_TREASURE_GAIN, "Momentum slay should grant the same bounty.");
}

{
  const game = makeGame();
  game.player.pendingCurses = 1;
  setBottomRow(game, ["L", "L", "B", "B"], ["R", "M"]);
  resolveEncounter(game);
  assert.equal(bottom(game, 4).slayed, true, "The cursed front monster should be slain.");
  assert.equal(game.player.body, 4, "A different surviving monster should still attack normally.");
  assert.equal(game.player.treasure, CURSED_MONSTER_TREASURE_GAIN, "Slaying the cursed target should earn its bounty even if another monster survives.");
}

{
  const game = makeGame();
  setBottomRow(game, ["C", "C", "B", "B"]);
  resolveEncounter(game);
  assert.equal(game.player.pendingCurses, 2, "Two Curse blocks in one row should queue two future infections.");
}

{
  const game = makeGame();
  game.player.pendingCurses = 1;
  setBottomRow(game, ["C", "L", "L", "B"], ["R"]);
  startEncounter(game);
  assert.equal(game.player.pendingCurses, 0, "The previously queued Curse should infect the current front monster.");
  advanceEncounter(game);
  assert.equal(bottom(game, 4).slayed, true, "The infected monster should be slain by the current Slashes.");
  assert.equal(game.player.treasure, CURSED_MONSTER_TREASURE_GAIN, "The infected monster should grant its bounty.");
  assert.equal(game.player.pendingCurses, 1, "The newly resolved Curse should wait for a later monster encounter.");
}

console.log("combat prototype scenarios passed");
