import { settleBoard } from "./board.js?v=20260822-2";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CURSED_MONSTER_TREASURE_GAIN,
  CURSED_MONSTER_VALUE_BONUS,
  ENCOUNTER_ATTACK_EFFECT_WAIT_MS,
  ENCOUNTER_DAMAGE_EFFECT_WAIT_MS,
  ENCOUNTER_INTRO_MS,
  ENCOUNTER_MINOR_EFFECT_WAIT_MS,
  ENCOUNTER_SLAY_EFFECT_WAIT_MS,
  ENCOUNTER_STEP_MS,
  ENCOUNTER_UI_EFFECT_WAIT_MS,
  HEAL_BLOCK_BODY_GAIN,
  INSTANT_SLASH_REVEAL_MS,
  LOOT_BODY_GAIN,
  LOOT_CHANCE,
  LOOT_CHANCE_BLESSING_BONUS,
  LOOT_EFFECT_DELAY_MS,
  LOOT_TREASURE_CHANCE,
  LOOT_TREASURE_GAIN,
  MAX_GUARD,
  MAX_SWORD_SKILL,
  MOMENTUM_BLOCK_INSTANT_SLASH_GAIN,
  MONSTER_START_X,
  NORMAL_COLUMNS,
  SLASH_LOOT_ENABLED,
  SLASH_BEAM_EFFECT_MS,
  SLASH_DAMAGE_REVEAL_DELAY_MS,
  SWORD_BLOCK_SKILL_GAIN,
  TREASURE_BLOCK_GAIN,
  UI_EFFECT_MS,
  UI_EFFECT_STAGGER_MS,
} from "./config.js?v=20260822-20";
import { getSlashDamage } from "./combatRules.js?v=20260822-5";
import { addEffect, updateEffects } from "./effects.js?v=20260822-1";
import { addUiEffect } from "./uiEffects.js?v=20260822-4";
import { COLORS } from "../theme/colors.js?v=20260821-16";

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

  const instantSlashCount = getPreEncounterInstantSlashCount(supportEvents, attackEvents);

  game.encounter = {
    queue: createEncounterGroups(supportEvents, attackEvents, monsterEvents),
    current: null,
    elapsed: 0,
    duration: ENCOUNTER_STEP_MS,
    introElapsed: 0,
    introDuration: ENCOUNTER_INTRO_MS,
    slashCount: attackEvents.length,
    instantSlashCount,
    hasMonsters: monsterEvents.length > 0,
  };
  markInstantSlashReveals(game);

  attachPendingCurseToFrontMonster(game);
}

function getPreEncounterInstantSlashCount(supportEvents, attackEvents) {
  if (!attackEvents.length) return 0;

  const momentumCount = supportEvents.filter((event) => event.block.type === "O").length;
  return Math.min(attackEvents.length, momentumCount * MOMENTUM_BLOCK_INSTANT_SLASH_GAIN);
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

  if (block.type === "D") {
    game.player.swordSkill = Math.min(MAX_SWORD_SKILL, game.player.swordSkill + SWORD_BLOCK_SKILL_GAIN);
    addUiEffect(game, {
      type: "travel",
      label: "劍",
      color: COLORS.corners.sword,
      target: "sword",
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
    if (startPendingCurse(game)) {
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
  return ["B", "C", "D", "T", "E"].includes(block.type);
}

function getArmorBlockValue(game, block) {
  return block.value + game.player.armorValueBonus;
}

function damageFrontMonsters(game, slashEvents, sources) {
  let instantSlays = Math.min(game.encounter?.instantSlashCount ?? 0, slashEvents.length);
  let normalDamage = getOrdinarySlashDamage(game, slashEvents.slice(instantSlays));
  let wait = ENCOUNTER_MINOR_EFFECT_WAIT_MS;
  const targets = [];

  while (instantSlays > 0 || normalDamage > 0) {
    const target = findFrontEncounterMonster(game);
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

function markInstantSlashReveals(game, delay = 0) {
  const attackGroup = game.encounter?.queue.find((group) => group.type === "attack");
  if (!attackGroup) return;

  attackGroup.events
    .filter((event) => event.block.type === "L")
    .sort((a, b) => a.x - b.x)
    .slice(0, game.encounter.instantSlashCount)
    .forEach((event) => {
      if (event.block.instantRevealFade) return;
      event.block.instantRevealFade = {
        elapsed: -delay,
        duration: INSTANT_SLASH_REVEAL_MS,
      };
    });
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
  const monsterValue = event?.block?.value ?? game.encounter?.current?.block?.value ?? 1;
  const incomingDamage = monsterValue;
  const shieldedDamage = Math.min(game.player.guard, incomingDamage);
  const finalDamage = incomingDamage - shieldedDamage;

  game.player.guard -= shieldedDamage;
  game.player.body -= finalDamage;
  if (event.block?.cursedMonster) endCurseChain(game);
  if (finalDamage > 0) addUiEffect(game, { type: "shake", target: "body" });

  if (game.player.body <= 0) {
    game.gameOver = true;
  }

  return shieldedDamage > 0 || finalDamage > 0 ? ENCOUNTER_DAMAGE_EFFECT_WAIT_MS : ENCOUNTER_MINOR_EFFECT_WAIT_MS;
}

function startPendingCurse(game) {
  if (isCurseChainActive(game)) return false;

  game.player.curseChain = {
    phase: "pendingMonster",
  };
  return true;
}

function attachPendingCurseToFrontMonster(game) {
  if (game.player.curseChain?.phase !== "pendingMonster") return false;

  const target = findFrontEncounterMonster(game);
  if (!target) return false;

  target.block.cursedMonster = true;
  target.block.value += CURSED_MONSTER_VALUE_BONUS;
  target.block.curseValueBonus = CURSED_MONSTER_VALUE_BONUS;
  target.block.curseReveal = {
    elapsed: 0,
    duration: UI_EFFECT_MS,
  };
  game.player.curseChain = {
    phase: "cursedMonster",
  };
  addUiEffect(game, {
    type: "travel",
    label: "咒",
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

  game.player.treasure += CURSED_MONSTER_TREASURE_GAIN;
  addUiEffect(game, {
    type: "travel",
    label: "寶",
    color: COLORS.corners.treasure,
    target: "treasure",
    delay,
    x: target.x,
    y: target.y,
  });
  endCurseChain(game);
  return true;
}

function getOrdinarySlashDamage(game, slashEvents) {
  return slashEvents.reduce((sum, event) => sum + getSlashDamage(game, game.encounter, event.block), 0);
}

function isCurseChainActive(game) {
  return game.player.curseChain?.phase && game.player.curseChain.phase !== "inactive";
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

function endCurseChain(game) {
  game.player.curseChain = {
    phase: "inactive",
  };
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
