import { settleBoard } from "./board.js?v=20260821-35";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CHAIN_SLASH_DAMAGE_PER_SLASH,
  CURSE_BLOCK_DAMAGE_BONUS,
  ENCOUNTER_STEP_MS,
  HEAL_BLOCK_BODY_GAIN,
  INITIAL_ENCOUNTER_CURSE_BONUS,
  INITIAL_ENCOUNTER_SHIELD,
  INITIAL_ENCOUNTER_SLASH_MULTIPLIER,
  LOOT_BODY_GAIN,
  LOOT_CHANCE,
  LOOT_CHANCE_BLESSING_BONUS,
  LOOT_EFFECT_DELAY_MS,
  LOOT_TREASURE_CHANCE,
  LOOT_TREASURE_GAIN,
  MOMENTUM_BLOCK_SLASH_MULTIPLIER,
  MONSTER_START_X,
  NORMAL_COLUMNS,
  SWORD_BLOCK_SKILL_GAIN,
  TREASURE_BLOCK_GAIN,
} from "./config.js?v=20260821-40";
import { addEffect, updateEffects } from "./effects.js?v=20260821-36";
import { addUiEffect } from "./uiEffects.js?v=20260821-2";
import { COLORS } from "../theme/colors.js?v=20260821-14";

export function startEncounter(game) {
  const normalEvents = game.board[BOARD_HEIGHT - 1]
    .slice(0, NORMAL_COLUMNS)
    .map((block, x) => ({ type: "normal", block, x, y: BOARD_HEIGHT - 1 }));
  const supportEvents = normalEvents.filter((event) => event.block.type !== "L");
  const attackEvents = normalEvents.filter((event) => event.block.type === "L");
  const monsterEvents = [];

  for (let x = MONSTER_START_X; x < BOARD_WIDTH; x += 1) {
    const block = game.board[BOARD_HEIGHT - 1][x];
    if (block) monsterEvents.push({ type: "monster", block, x, y: BOARD_HEIGHT - 1 });
  }

  game.encounter = {
    queue: [...supportEvents, ...attackEvents, ...monsterEvents],
    current: null,
    elapsed: 0,
    duration: ENCOUNTER_STEP_MS,
    slashMultiplier: INITIAL_ENCOUNTER_SLASH_MULTIPLIER,
    slashCount: attackEvents.length,
    curseBonus: INITIAL_ENCOUNTER_CURSE_BONUS,
    shield: INITIAL_ENCOUNTER_SHIELD,
  };
}

export function updateEncounter(game, delta) {
  updateEffects(game, delta);

  if (game.gameOver || game.runComplete || game.merchant || !game.encounter) return false;

  if (!game.encounter.current) {
    game.encounter.current = game.encounter.queue.shift() ?? null;
    game.encounter.elapsed = 0;
  }

  if (!game.encounter.current) return true;

  game.encounter.elapsed += delta;

  if (game.encounter.elapsed < ENCOUNTER_STEP_MS) return false;

  completeEncounterEvent(game, game.encounter.current);
  game.encounter.current = null;
  game.encounter.elapsed = 0;

  return !game.encounter.queue.length;
}

export function clearEncounter(game) {
  game.encounter = null;
  removeSlainMonsters(game.board);
  settleBoard(game.board);
}

function completeEncounterEvent(game, event) {
  if (game.board[event.y]?.[event.x] !== event.block) return;

  if (event.type === "normal") {
    game.board[event.y][event.x] = null;
    applyNormalBlock(game, event);
    return;
  }

  if (event.type === "monster") {
    game.board[event.y][event.x] = null;
    if (!event.block.slayed) takeDamage(game, event);
  }
}

function applyNormalBlock(game, event) {
  const block = event.block;
  const player = game.player;

  if (block.type === "B") {
    healPlayer(player, HEAL_BLOCK_BODY_GAIN);
    addUiEffect(game, { type: "travel", label: "體", color: COLORS.red, target: "body", x: event.x, y: event.y });
  }

  if (block.type === "D") {
    player.swordSkill += SWORD_BLOCK_SKILL_GAIN;
    addUiEffect(game, { type: "travel", label: "劍", color: COLORS.corners.sword, target: "sword", x: event.x, y: event.y });
  }

  if (block.type === "L") {
    const multiplier = game.encounter?.slashMultiplier ?? 1;
    const bonus = getChainSlashBonus(game);
    damageFrontMonsters(game, player.swordSkill * multiplier + bonus);
  }

  if (block.type === "C") {
    if (game.encounter) game.encounter.curseBonus += CURSE_BLOCK_DAMAGE_BONUS;
  }

  if (block.type === "T") {
    player.treasure += TREASURE_BLOCK_GAIN;
    addUiEffect(game, { type: "travel", label: "寶", color: COLORS.corners.treasure, target: "treasure", x: event.x, y: event.y });
  }

  if (block.type === "O") {
    if (game.encounter) game.encounter.slashMultiplier *= MOMENTUM_BLOCK_SLASH_MULTIPLIER;
  }

  if (block.type === "E") {
    if (game.encounter) game.encounter.shield += getArmorBlockValue(game, block);
  }
}

function getChainSlashBonus(game) {
  if (!game.player.blessingIds.includes("chainSlash")) return 0;
  if ((game.encounter?.slashCount ?? 0) <= 1) return 0;
  return game.encounter.slashCount * CHAIN_SLASH_DAMAGE_PER_SLASH;
}

function getArmorBlockValue(game, block) {
  return block.value + game.player.armorValueBonus;
}

function damageFrontMonsters(game, damage) {
  let remainingDamage = damage;
  let defeated = false;

  while (remainingDamage > 0) {
    const target = findFrontEncounterMonster(game);
    if (!target) return defeated;

    target.block.value -= remainingDamage;

    if (target.block.value > 0) return defeated;

    remainingDamage = Math.abs(target.block.value);
    target.block.value = 0;
    target.block.slayed = true;
    addEffect(game, { label: "斬", color: COLORS.red, x: target.x, y: target.y });
    tryLootSlainMonster(game, target);
    defeated = true;
  }

  return defeated;
}

function tryLootSlainMonster(game, target) {
  if (Math.random() >= getLootChance(game)) return;

  if (Math.random() < LOOT_TREASURE_CHANCE) {
    game.player.treasure += LOOT_TREASURE_GAIN;
  } else {
    healPlayer(game.player, LOOT_BODY_GAIN);
  }

  addEffect(game, { label: "奪", color: COLORS.lootGreen, x: target.x, y: target.y, delay: LOOT_EFFECT_DELAY_MS });
}

function getLootChance(game) {
  const blessingCount = game.player.blessingIds.filter((id) => id === "lootCraft").length;
  return Math.min(1, LOOT_CHANCE + blessingCount * LOOT_CHANCE_BLESSING_BONUS);
}

function findFrontEncounterMonster(game) {
  const monsterEvents = [
    game.encounter?.current,
    ...(game.encounter?.queue ?? []),
  ].filter((event) => event?.type === "monster");

  for (const event of monsterEvents) {
    const block = game.board[event.y]?.[event.x];
    if (block === event.block && isMonsterBlock(block) && !block.slayed) {
      return { block, x: event.x, y: event.y };
    }
  }

  return null;
}

function removeSlainMonsters(board) {
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = MONSTER_START_X; x < BOARD_WIDTH; x += 1) {
      if (board[y][x]?.slayed) board[y][x] = null;
    }
  }
}

function takeDamage(game, event) {
  const bonus = game.encounter?.curseBonus ?? 0;
  const monsterValue = event?.block?.value ?? game.encounter?.current?.block?.value ?? 1;
  const incomingDamage = monsterValue + bonus;
  const shieldedDamage = Math.min(game.encounter?.shield ?? 0, incomingDamage);
  const finalDamage = incomingDamage - shieldedDamage;

  if (game.encounter) game.encounter.shield -= shieldedDamage;
  game.player.body -= finalDamage;
  if (game.encounter) game.encounter.curseBonus = 0;
  if (finalDamage > 0) addUiEffect(game, { type: "shake", target: "body" });

  if (game.player.body <= 0) {
    game.gameOver = true;
  }
}

function healPlayer(player, amount) {
  player.body = Math.min(player.maxBody, player.body + amount);
}

function isMonsterBlock(block) {
  return block?.lane === "monster";
}
