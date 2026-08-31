import { settleBoard } from "./board.js?v=20260824-1";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CURSED_MONSTER_TREASURE_GAIN,
  CURSED_MONSTER_VALUE_BONUS,
  CURSE_BLOCK_PENDING_GAIN,
  ENCOUNTER_ATTACK_EFFECT_WAIT_MS,
  ENCOUNTER_DAMAGE_EFFECT_WAIT_MS,
  ENCOUNTER_INTRO_MS,
  ENCOUNTER_MINOR_EFFECT_WAIT_MS,
  ENCOUNTER_SLAY_EFFECT_WAIT_MS,
  ENCOUNTER_STEP_MS,
  ENCOUNTER_UI_EFFECT_WAIT_MS,
  HEAL_BLOCK_BODY_GAIN,
  LOOT_BODY_GAIN,
  LOOT_CHANCE,
  LOOT_EFFECT_DELAY_MS,
  LOOT_TREASURE_CHANCE,
  LOOT_TREASURE_GAIN,
  MAX_GUARD,
  MAX_LOOT_CHANCE,
  MONSTER_HIT_SHAKE_MS,
  MONSTER_START_X,
  NORMAL_COLUMNS,
  SLASH_LOOT_ENABLED,
  SLASH_BEAM_EFFECT_MS,
  SLASH_DAMAGE_REVEAL_DELAY_MS,
  TREASURE_BLOCK_GAIN,
  UI_EFFECT_MS,
  UI_EFFECT_STAGGER_MS,
} from "./config.js?v=20260831-2";
import { getStackedBlessingEffectTotal } from "./blessings.js?v=20260831-6";
import { getSlashDamage } from "./combatRules.js?v=20260831-6";
import { addEffect, updateEffects } from "./effects.js?v=20260824-1";
import { addUiEffect } from "./uiEffects.js?v=20260824-1";
import { COLORS } from "../theme/colors.js?v=20260825-23";

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
    slashCount: attackEvents.length,
    hasMonsters: monsterEvents.length > 0,
    hasCursedMonster: false,
  };

  attachPendingCurseToFrontMonster(game);
  game.encounter.hasCursedMonster = hasCursedEncounterMonster(game);
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

  const wait = [...group.events]
    .sort((a, b) => a.x - b.x)
    .reduce((wait, event, index) => {
      const delay = group.type === "support" ? index * UI_EFFECT_STAGGER_MS : 0;
      return Math.max(wait, completeEncounterEvent(game, event, delay));
    }, ENCOUNTER_MINOR_EFFECT_WAIT_MS);

  if (group.type === "monster") resolveSlainCursedMonsterReward(game, wait);
  return wait;
}

function completeAttackGroup(game, group) {
  const slashEvents = group.events
    .filter((event) => game.board[event.y]?.[event.x] === event.block)
    .sort((a, b) => a.x - b.x);

  if (!slashEvents.length) return ENCOUNTER_MINOR_EFFECT_WAIT_MS;

  slashEvents.forEach((event) => {
    game.board[event.y][event.x] = null;
  });

  if (!game.encounter?.hasMonsters) return ENCOUNTER_MINOR_EFFECT_WAIT_MS;

  const wait = damageFrontMonsters(game, slashEvents, slashEvents);
  return wait;
}

function completeEncounterEvent(game, event, delay = 0) {
  if (game.board[event.y]?.[event.x] !== event.block) return ENCOUNTER_MINOR_EFFECT_WAIT_MS;

  if (event.type === "normal") {
    const wait = applyNormalBlock(game, event, delay);
    if (hasTravelingSupportGlyph(event.block)) {
      event.block.pendingRemoval = {
        elapsed: -delay,
        x: event.x,
        y: event.y,
      };
    } else {
      game.board[event.y][event.x] = null;
    }
    return wait;
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
    healPlayer(game.player, HEAL_BLOCK_BODY_GAIN);
    addUiEffect(game, {
      type: "travel",
      label: block.label,
      color: COLORS.red,
      target: "body",
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
    enqueuePendingCurse(game);
    addUiEffect(game, {
      type: "travel",
      label: block.label,
      color: COLORS.corners.curse,
      target: "curse",
      delay,
      x: event.x,
      y: event.y,
    });
    wait = ENCOUNTER_UI_EFFECT_WAIT_MS + delay;
  }

  if (block.type === "T") {
    game.player.treasure += TREASURE_BLOCK_GAIN;
    addUiEffect(game, {
      type: "travel",
      label: "寶",
      color: COLORS.corners.treasure,
      target: "treasure",
      delay,
      x: event.x,
      y: event.y,
    });
    wait = ENCOUNTER_UI_EFFECT_WAIT_MS + delay;
  }

  if (block.type === "O") {
    wait = ENCOUNTER_MINOR_EFFECT_WAIT_MS;
  }

  if (block.type === "E") {
    addGuard(game.player, getArmorBlockValue(game, block));
    addUiEffect(game, {
      type: "travel",
      label: "甲",
      color: COLORS.corners.armor,
      target: "body",
      delay,
      x: event.x,
      y: event.y,
    });
    wait = ENCOUNTER_UI_EFFECT_WAIT_MS + delay;
  }

  return wait;
}

function hasTravelingSupportGlyph(block) {
  return ["B", "C", "T", "E"].includes(block.type);
}

function getArmorBlockValue(game, block) {
  return block.value + game.player.armorValueBonus;
}

function damageFrontMonsters(game, slashEvents, sources) {
  const instantSlashEvents = slashEvents.filter((event) => event.block.instantSlash);
  let instantSlays = instantSlashEvents.length;
  let normalDamage = getOrdinarySlashDamage(game, slashEvents.filter((event) => !event.block.instantSlash));
  let wait = ENCOUNTER_MINOR_EFFECT_WAIT_MS;
  const targets = [];

  while (instantSlays > 0 || normalDamage > 0) {
    const target = instantSlays > 0 ? findHighestValueEncounterMonster(game) : findFrontEncounterMonster(game);
    if (!target) return addSlashBeamEffect(game, sources, targets, wait);

    const previousValue = target.block.value;
    const damage = instantSlays > 0 ? previousValue : normalDamage;
    target.block.damageReveal = {
      fromValue: previousValue,
      elapsed: 0,
      delay: SLASH_DAMAGE_REVEAL_DELAY_MS,
    };
    target.block.value -= damage;
    targets.push({
      block: target.block,
      x: target.x,
      y: target.y,
      damage: Math.min(previousValue, damage),
    });

    if (target.block.value > 0) return addSlashBeamEffect(game, sources, targets, ENCOUNTER_ATTACK_EFFECT_WAIT_MS);

    if (instantSlays > 0) {
      instantSlays -= 1;
    } else {
      normalDamage = Math.abs(target.block.value);
    }
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
  targets.forEach((target) => {
    target.block.hitShake = {
      elapsed: 0,
      duration: MONSTER_HIT_SHAKE_MS,
    };
  });
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

  addEffect(game, { label: "奪", color: COLORS.corners.treasure, x: target.x, y: target.y, delay: LOOT_EFFECT_DELAY_MS });
  return true;
}

function getLootChance(game) {
  return Math.min(MAX_LOOT_CHANCE, LOOT_CHANCE + getStackedBlessingEffectTotal(game.player, "increaseLootChance"));
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

function findHighestValueEncounterMonster(game) {
  return getMonsterEncounterEvents(game).reduce((best, event) => {
    const block = game.board[event.y]?.[event.x];
    if (block !== event.block || !isMonsterBlock(block) || block.slayed) return best;
    if (!best || block.value > best.block.value) return { block, x: event.x, y: event.y };
    return best;
  }, null);
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
  const monsterValue = event?.block?.value ?? game.encounter?.current?.block?.value ?? 1;
  const incomingDamage = monsterValue;
  const shieldedDamage = Math.min(game.player.guard, incomingDamage);
  const finalDamage = incomingDamage - shieldedDamage;

  game.player.guard -= shieldedDamage;
  game.player.body -= finalDamage;
  if (incomingDamage > 0) addUiEffect(game, { type: "shake", target: "board" });
  if (finalDamage > 0) addUiEffect(game, { type: "shake", target: "body" });

  if (game.player.body <= 0) {
    game.gameOver = true;
  }

  return shieldedDamage > 0 || finalDamage > 0 ? ENCOUNTER_DAMAGE_EFFECT_WAIT_MS : ENCOUNTER_MINOR_EFFECT_WAIT_MS;
}

function enqueuePendingCurse(game) {
  game.player.pendingCurses = (game.player.pendingCurses ?? 0) + CURSE_BLOCK_PENDING_GAIN;
}

function attachPendingCurseToFrontMonster(game) {
  if ((game.player.pendingCurses ?? 0) <= 0) return false;

  const target = findFrontEncounterMonster(game);
  if (!target) return false;

  game.player.pendingCurses -= 1;
  target.block.cursedMonster = true;
  target.block.value += CURSED_MONSTER_VALUE_BONUS;
  target.block.curseValueBonus = CURSED_MONSTER_VALUE_BONUS;
  target.block.curseReveal = {
    elapsed: 0,
    duration: UI_EFFECT_MS,
  };
  addUiEffect(game, {
    type: "travel",
    label: "呪",
    color: COLORS.corners.curse,
    source: "curse",
    target: "cell",
    path: "curseToMonster",
    targetX: target.x,
    targetY: target.y,
  });
  return true;
}

function resolveSlainCursedMonsterReward(game, delay = 0) {
  const target = findSlainCursedEncounterMonster(game);
  if (!target) return false;

  const treasureGain = getCursedMonsterTreasureGain(game);
  game.player.treasure += treasureGain;
  for (let index = 0; index < treasureGain; index += 1) {
    addUiEffect(game, {
      type: "travel",
      label: "寶",
      color: COLORS.corners.treasure,
      target: "treasure",
      deferPanelStat: "treasure",
      amount: 1,
      delay: delay + index * UI_EFFECT_STAGGER_MS,
      x: target.x,
      y: target.y,
    });
  }
  return true;
}

function getCursedMonsterTreasureGain(game) {
  return CURSED_MONSTER_TREASURE_GAIN + getStackedBlessingEffectTotal(game.player, "increaseCursedMonsterTreasure");
}

function getOrdinarySlashDamage(game, slashEvents) {
  return slashEvents.reduce((sum, event) => sum + getSlashDamage(game, game.encounter, event.block), 0);
}

function findSlainCursedEncounterMonster(game) {
  const monsterEvents = getMonsterEncounterEvents(game);

  for (const event of monsterEvents) {
    const block = game.board[event.y]?.[event.x];
    if (block === event.block && block.cursedMonster && block.slayed) {
      return { block, x: event.x, y: event.y };
    }
  }

  return null;
}

function getMonsterEncounterEvents(game) {
  return [
    ...(game.encounter?.current?.events ?? []),
    ...(game.encounter?.queue ?? []).flatMap((group) => group.events),
  ].filter((event) => event?.type === "monster");
}

function hasCursedEncounterMonster(game) {
  return getMonsterEncounterEvents(game).some((event) => {
    const block = game.board[event.y]?.[event.x];
    return block === event.block && block.cursedMonster;
  });
}

function healPlayer(player, amount) {
  player.body = Math.min(player.maxBody, player.body + amount);
}

function addGuard(player, amount) {
  player.guard = Math.min(MAX_GUARD, player.guard + amount);
}

function isMonsterBlock(block) {
  return block?.lane === "monster";
}
