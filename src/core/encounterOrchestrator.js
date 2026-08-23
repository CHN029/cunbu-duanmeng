import { settleBoard } from "./board.js?v=20260822-2";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CHAIN_SLASH_DAMAGE_PER_SLASH,
  CURSE_BLOCK_DAMAGE_BONUS,
  ENCOUNTER_ATTACK_EFFECT_WAIT_MS,
  ENCOUNTER_DAMAGE_EFFECT_WAIT_MS,
  ENCOUNTER_INTRO_MS,
  ENCOUNTER_MINOR_EFFECT_WAIT_MS,
  ENCOUNTER_SLAY_EFFECT_WAIT_MS,
  ENCOUNTER_STEP_MS,
  ENCOUNTER_UI_EFFECT_WAIT_MS,
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
  SLASH_LOOT_ENABLED,
  SLASH_BEAM_EFFECT_MS,
  SLASH_DAMAGE_REVEAL_DELAY_MS,
  SWORD_BLOCK_SKILL_GAIN,
  TREASURE_BLOCK_GAIN,
  UI_EFFECT_APPLY_MS,
  UI_EFFECT_STAGGER_MS,
} from "./config.js?v=20260822-9";
import { addEffect, updateEffects } from "./effects.js?v=20260822-1";
import { addUiEffect } from "./uiEffects.js?v=20260822-2";
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
    queue: createEncounterGroups(supportEvents, attackEvents, monsterEvents),
    current: null,
    elapsed: 0,
    duration: ENCOUNTER_STEP_MS,
    introElapsed: 0,
    introDuration: ENCOUNTER_INTRO_MS,
    slashMultiplier: INITIAL_ENCOUNTER_SLASH_MULTIPLIER,
    slashCount: attackEvents.length,
    hasMonsters: monsterEvents.length > 0,
    curseBonus: INITIAL_ENCOUNTER_CURSE_BONUS,
    shield: INITIAL_ENCOUNTER_SHIELD,
  };
}

function createEncounterGroups(supportEvents, attackEvents, monsterEvents) {
  return [
    { type: "support", events: supportEvents },
    { type: "attack", events: attackEvents },
    { type: "monster", events: monsterEvents },
  ].filter((group) => group.events.length > 0);
}

export function updateEncounter(game, delta) {
  updateEffects(game, delta);

  if (game.gameOver || game.runComplete || game.merchant || !game.encounter) return false;

  if (game.encounter.introElapsed < game.encounter.introDuration) {
    game.encounter.introElapsed += delta;
    return false;
  }

  if (!game.encounter.current) {
    game.encounter.current = game.encounter.queue.shift() ?? null;
    game.encounter.elapsed = 0;
    game.encounter.applied = false;
    game.encounter.afterApplyWait = 0;
  }

  if (!game.encounter.current) return true;

  game.encounter.elapsed += delta;

  if (!game.encounter.applied) {
    if (game.encounter.elapsed < ENCOUNTER_STEP_MS) return false;

    game.encounter.afterApplyWait = completeEncounterGroup(game, game.encounter.current);
    game.encounter.applied = true;
    game.encounter.elapsed = 0;
    return false;
  }

  if (game.encounter.elapsed < game.encounter.afterApplyWait) return false;

  game.encounter.current = null;
  game.encounter.elapsed = 0;
  game.encounter.applied = false;
  game.encounter.afterApplyWait = 0;

  return !game.encounter.queue.length;
}

export function clearEncounter(game) {
  game.encounter = null;
  game.exitAnimations = removeSlainMonsters(game.board);
  game.gravityAnimations = settleBoard(game.board);
}

function completeEncounterGroup(game, group) {
  if (group.type === "attack") return completeAttackGroup(game, group);

  return [...group.events]
    .sort((a, b) => a.x - b.x)
    .reduce((wait, event, index) => {
      const delay = group.type === "support" ? index * UI_EFFECT_STAGGER_MS : 0;
      return Math.max(wait, completeEncounterEvent(game, event, delay));
    }, ENCOUNTER_MINOR_EFFECT_WAIT_MS);
}

function completeAttackGroup(game, group) {
  const slashEvents = group.events
    .filter((event) => game.board[event.y]?.[event.x] === event.block)
    .sort((a, b) => a.x - b.x);

  if (!slashEvents.length) return ENCOUNTER_MINOR_EFFECT_WAIT_MS;

  slashEvents.forEach((event) => {
    game.board[event.y][event.x] = null;
  });

  if (!game.encounter?.hasMonsters) {
    return ENCOUNTER_MINOR_EFFECT_WAIT_MS;
  }

  const damage = slashEvents.reduce((sum) => sum + getSlashDamage(game), 0);
  return damageFrontMonsters(game, damage, slashEvents);
}

function completeEncounterEvent(game, event, delay = 0) {
  if (game.board[event.y]?.[event.x] !== event.block) return ENCOUNTER_MINOR_EFFECT_WAIT_MS;

  if (event.type === "normal") {
    game.board[event.y][event.x] = null;
    return applyNormalBlock(game, event, delay);
  }

  if (event.type === "monster") {
    if (event.block.slayed) return ENCOUNTER_MINOR_EFFECT_WAIT_MS;

    game.board[event.y][event.x] = null;
    return takeDamage(game, event);
  }

  return ENCOUNTER_MINOR_EFFECT_WAIT_MS;
}

function applyNormalBlock(game, event, delay = 0) {
  const block = event.block;
  let wait = ENCOUNTER_MINOR_EFFECT_WAIT_MS;

  if (block.type === "B") {
    addUiEffect(game, {
      type: "travel",
      label: block.label,
      color: COLORS.red,
      target: "body",
      stat: "body",
      amount: HEAL_BLOCK_BODY_GAIN,
      applyAt: UI_EFFECT_APPLY_MS,
      delay,
      x: event.x,
      y: event.y,
    });
    wait = ENCOUNTER_UI_EFFECT_WAIT_MS + delay;
  }

  if (block.type === "D") {
    addUiEffect(game, {
      type: "travel",
      label: "劍",
      color: COLORS.corners.sword,
      target: "sword",
      stat: "sword",
      amount: SWORD_BLOCK_SKILL_GAIN,
      applyAt: UI_EFFECT_APPLY_MS,
      delay,
      x: event.x,
      y: event.y,
    });
    wait = ENCOUNTER_UI_EFFECT_WAIT_MS + delay;
  }

  if (block.type === "L") {
    wait = damageFrontMonsters(game, getSlashDamage(game), event);
  }

  if (block.type === "C") {
    if (game.encounter) game.encounter.curseBonus += CURSE_BLOCK_DAMAGE_BONUS;
  }

  if (block.type === "T") {
    addUiEffect(game, {
      type: "travel",
      label: "寶",
      color: COLORS.corners.treasure,
      target: "treasure",
      stat: "treasure",
      amount: TREASURE_BLOCK_GAIN,
      applyAt: UI_EFFECT_APPLY_MS,
      delay,
      x: event.x,
      y: event.y,
    });
    wait = ENCOUNTER_UI_EFFECT_WAIT_MS + delay;
  }

  if (block.type === "O") {
    if (game.encounter) game.encounter.slashMultiplier *= MOMENTUM_BLOCK_SLASH_MULTIPLIER;
  }

  if (block.type === "E") {
    addUiEffect(game, {
      type: "travel",
      label: "甲",
      color: COLORS.corners.armor,
      target: "body",
      stat: "shield",
      amount: getArmorBlockValue(game, block),
      applyAt: UI_EFFECT_APPLY_MS,
      delay,
      x: event.x,
      y: event.y,
    });
    wait = ENCOUNTER_UI_EFFECT_WAIT_MS + delay;
  }

  return wait;
}

function getSlashDamage(game) {
  const multiplier = game.encounter?.slashMultiplier ?? 1;
  return game.player.swordSkill * multiplier + getChainSlashBonus(game);
}

function getChainSlashBonus(game) {
  if (!game.player.blessingIds.includes("chainSlash")) return 0;
  if ((game.encounter?.slashCount ?? 0) <= 1) return 0;
  return game.encounter.slashCount * CHAIN_SLASH_DAMAGE_PER_SLASH;
}

function getArmorBlockValue(game, block) {
  return block.value + game.player.armorValueBonus;
}

function damageFrontMonsters(game, damage, sources) {
  let remainingDamage = damage;
  let wait = ENCOUNTER_MINOR_EFFECT_WAIT_MS;
  const targets = [];

  while (remainingDamage > 0) {
    const target = findFrontEncounterMonster(game);
    if (!target) return addSlashBeamEffect(game, sources, targets, wait);

    const previousValue = target.block.value;
    target.block.damageReveal = {
      fromValue: previousValue,
      elapsed: 0,
      delay: SLASH_DAMAGE_REVEAL_DELAY_MS,
    };
    target.block.value -= remainingDamage;
    targets.push({
      x: target.x,
      y: target.y,
      damage: Math.min(previousValue, remainingDamage),
    });

    if (target.block.value > 0) return addSlashBeamEffect(game, sources, targets, ENCOUNTER_ATTACK_EFFECT_WAIT_MS);

    remainingDamage = Math.abs(target.block.value);
    target.block.value = 0;
    target.block.slayed = true;
    wait = tryLootSlainMonster(game, target) ? ENCOUNTER_SLAY_EFFECT_WAIT_MS : ENCOUNTER_ATTACK_EFFECT_WAIT_MS;
  }

  return addSlashBeamEffect(game, sources, targets, wait);
}

function addSlashBeamEffect(game, source, targets, wait) {
  if (!targets.length) {
    return Math.max(wait, ENCOUNTER_ATTACK_EFFECT_WAIT_MS);
  }

  const sources = Array.isArray(source) ? source : [source];
  sources.forEach((item) => {
    addEffect(game, {
      type: "slashBeam",
      color: COLORS.red,
      x: item.x,
      y: item.y,
      targets,
      duration: SLASH_BEAM_EFFECT_MS,
    });
  });

  return Math.max(wait, SLASH_BEAM_EFFECT_MS + 80);
}

function tryLootSlainMonster(game, target) {
  if (!SLASH_LOOT_ENABLED) return false;
  if (Math.random() >= getLootChance(game)) return false;

  if (Math.random() < LOOT_TREASURE_CHANCE) {
    game.player.treasure += LOOT_TREASURE_GAIN;
  } else {
    healPlayer(game.player, LOOT_BODY_GAIN);
  }

  addEffect(game, { label: "奪", color: COLORS.lootGreen, x: target.x, y: target.y, delay: LOOT_EFFECT_DELAY_MS });
  return true;
}

function getLootChance(game) {
  const blessingCount = game.player.blessingIds.filter((id) => id === "lootCraft").length;
  return Math.min(1, LOOT_CHANCE + blessingCount * LOOT_CHANCE_BLESSING_BONUS);
}

function findFrontEncounterMonster(game) {
  const monsterEvents = [
    ...(game.encounter?.current?.events ?? []),
    ...(game.encounter?.queue ?? []).flatMap((group) => group.events),
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
  const exits = [];

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = MONSTER_START_X; x < BOARD_WIDTH; x += 1) {
      if (board[y][x]?.slayed) {
        exits.push({ block: board[y][x], x, y, elapsed: 0 });
        board[y][x] = null;
      }
    }
  }

  return exits;
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
  if (shieldedDamage > 0) addUiEffect(game, { type: "expand", label: "甲", color: COLORS.corners.armor, target: "body" });
  if (finalDamage > 0) addUiEffect(game, { type: "shake", target: "body" });

  if (game.player.body <= 0) {
    game.gameOver = true;
  }

  return shieldedDamage > 0 || finalDamage > 0 ? ENCOUNTER_DAMAGE_EFFECT_WAIT_MS : ENCOUNTER_MINOR_EFFECT_WAIT_MS;
}

function healPlayer(player, amount) {
  player.body = Math.min(player.maxBody, player.body + amount);
}

function isMonsterBlock(block) {
  return block?.lane === "monster";
}
