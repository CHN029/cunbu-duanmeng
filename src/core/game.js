import { collides, createBoard, isNormalBottomRowFull, rotatePiece, settleBoard, settleBoardColumns, shiftPiece } from "./board.js?v=20260824-1";
import {
  BOARD_SETTLE_ANIMATION_MS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CURSED_MONSTER_REVEAL_MS,
  DROP_MS,
  ENCOUNTER_GATE_EXIT_MS,
  HEAVY_ARMOR_BLOCK_BONUS,
  INSTANT_SLASH_REVEAL_MS,
  INITIAL_BODY,
  INITIAL_ARMOR_VALUE_BONUS,
  INITIAL_GUARD,
  INITIAL_MAX_BODY,
  INITIAL_PENDING_CURSES,
  INITIAL_SWORD_SKILL,
  INITIAL_TREASURE,
  MAX_SWORD_SKILL,
  MERCHANT_PURCHASE_COST,
  MERCHANT_SKIP_COST,
  MONSTER_START_X,
  NORMAL_COLUMNS,
  SLAY_MARK_FADE_MS,
  SHARPEN_SWORD_SKILL_GAIN,
  TEMPER_BODY_BODY_GAIN,
  TEMPER_BODY_MAX_BODY_GAIN,
  UPCOMING_BLOCK_PREVIEW_COUNT,
} from "./config.js?v=20260824-3";
import { clearEncounter, startEncounter, updateEncounter as updateEncounterState } from "./encounterOrchestrator.js?v=20260825-5";
import { canSkipMerchant, createMerchant, isModifierBlessing, moveMerchantSelectionIndex, shouldOpenMerchant } from "./merchant.js?v=20260824-1";
import { createMonsterPiece, createNormalPiece } from "./pieces.js?v=20260824-1";
import { createRun, getDifficultyPhase, getNextRound, peekUpcomingBlocks } from "./runOrchestrator.js?v=20260825-3";

export function createGame() {
  const game = {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    normalColumns: NORMAL_COLUMNS,
    monsterColumns: BOARD_WIDTH - NORMAL_COLUMNS,
    board: createBoard(),
    active: {
      normal: null,
      monsters: null,
    },
    run: createRun(),
    player: {
      body: INITIAL_BODY,
      maxBody: INITIAL_MAX_BODY,
      swordSkill: INITIAL_SWORD_SKILL,
      treasure: INITIAL_TREASURE,
      guard: INITIAL_GUARD,
      pendingCurses: INITIAL_PENDING_CURSES,
      blessings: [],
      blessingIds: [],
      armorValueBonus: INITIAL_ARMOR_VALUE_BONUS,
    },
    dropMs: DROP_MS,
    completedEncounters: 0,
    gameOver: false,
    paused: false,
    runComplete: false,
    encounter: null,
    encounterGate: null,
    settleGate: null,
    effects: [],
    uiEffects: [],
    gravityAnimations: [],
    exitAnimations: [],
    merchant: null,
  };

  spawnRound(game);
  return game;
}

export function getUpcomingBlocks(game, count = UPCOMING_BLOCK_PREVIEW_COUNT) {
  return peekUpcomingBlocks(game.run, count, getCurrentDifficultyPhase(game));
}

export function tick(game) {
  if (isBoardTransitioning(game) || game.paused || game.gameOver || game.runComplete || game.encounter || game.merchant) return;

  dropActive(game, "normal");
  finishRoundIfSettled(game);
}

export function tickMonsters(game) {
  if (isAdvanceTransitioning(game) || game.paused || game.gameOver || game.runComplete || game.encounter || game.merchant || !game.active.monsters) return false;

  const moved = dropActive(game, "monsters");
  finishRoundIfSettled(game);
  return moved;
}

export function canMove(game, dx, dy) {
  if (isBoardTransitioning(game) || game.paused || game.gameOver || game.runComplete || game.encounter || game.merchant || !game.active.normal) return false;

  const next = shiftPiece(game.active.normal, dx, dy);
  return !collides(game.board, next, 0, NORMAL_COLUMNS - 1);
}

export function hasActiveMonsters(game) {
  return Boolean(game.active.monsters);
}

export function canMonstersDrop(game) {
  if (isAdvanceTransitioning(game) || game.paused || game.gameOver || game.runComplete || game.encounter || game.merchant || !game.active.monsters) return false;

  return game.active.monsters.blocks.some((block) => {
    const next = {
      ...block,
      y: block.y + 1,
    };

    return !collides(game.board, { blocks: [next] }, MONSTER_START_X, BOARD_WIDTH - 1);
  });
}

function finishRoundIfSettled(game) {
  if (game.settleGate || game.gravityAnimations.length) return;

  if (!game.active.normal && !game.active.monsters) {
    const movements = settleBoard(game.board);

    if (movements.length) {
      game.gravityAnimations = movements;
      game.settleGate = { resumeAfter: true };
      return;
    }

    continueAfterSettling(game);
  }
}

export function move(game, dx, dy) {
  if (!canMove(game, dx, dy)) return false;

  const next = shiftPiece(game.active.normal, dx, dy);
  game.active.normal = next;
  return true;
}

export function rotate(game) {
  if (isBoardTransitioning(game) || game.paused || game.gameOver || game.runComplete || game.merchant || !game.active.normal) return false;
  if (game.active.normal.blocks.length < 2) return false;

  const next = rotatePiece(game.active.normal);
  if (collides(game.board, next, 0, NORMAL_COLUMNS - 1)) return false;

  game.active.normal = next;
  return true;
}

export function hardDrop(game) {
  if (isBoardTransitioning(game) || game.paused || game.gameOver || game.runComplete || game.encounter || game.merchant) return;

  while (move(game, 0, 1)) {
    continue;
  }

  if (game.active.normal) lockActive(game, "normal");

  finishRoundIfSettled(game);
}

export function togglePause(game) {
  if (!game.gameOver && !game.runComplete) game.paused = !game.paused;
}

export function updateEncounter(game, delta) {
  if (game.paused) return;

  if (updateEncounterState(game, delta)) finishEncounter(game);
}

export function updateBoardAnimations(game, delta) {
  updatePendingRemovals(game, delta);
  updateDamageReveals(game, delta);
  updateCurseReveals(game, delta);
  updateInstantReveals(game, delta);
  updateHitShakes(game, delta);

  if (game.encounterGate) {
    game.encounterGate.elapsed += delta;
    if (game.encounterGate.elapsed >= game.encounterGate.duration) {
      const shouldResume = game.encounterGate.resumeAfter;
      game.encounterGate = null;
      if (shouldResume) continueAfterEncounter(game);
    }
  }

  game.exitAnimations.forEach((animation) => {
    animation.elapsed = (animation.elapsed ?? 0) + delta;
    animation.duration = animation.duration ?? BOARD_SETTLE_ANIMATION_MS;
  });
  game.exitAnimations = game.exitAnimations.filter((animation) => animation.elapsed < animation.duration);

  if (game.gravityAnimations.length) {
    game.gravityAnimations.forEach((animation) => {
      animation.elapsed = (animation.elapsed ?? 0) + delta;
      animation.duration = animation.duration ?? BOARD_SETTLE_ANIMATION_MS;
    });
    game.gravityAnimations = game.gravityAnimations.filter((animation) => animation.elapsed < animation.duration);
  }

  if (!game.gravityAnimations.length && !game.exitAnimations.length && game.settleGate) {
    const shouldResume = game.settleGate.resumeAfter;
    game.settleGate = null;
    if (shouldResume) continueAfterSettling(game);
  }
}

function updateHitShakes(game, delta) {
  game.board.forEach((row) => {
    row.forEach((block) => {
      if (!block?.hitShake) return;

      block.hitShake.elapsed += delta;
      if (block.hitShake.elapsed >= block.hitShake.duration) {
        delete block.hitShake;
      }
    });
  });
}

function updateCurseReveals(game, delta) {
  game.board.forEach((row) => {
    row.forEach((block) => updateBlockCurseReveal(block, delta));
  });
  game.run.rounds.forEach((round) => {
    round.forEach((block) => updateBlockCurseReveal(block, delta));
  });
}

function updateBlockCurseReveal(block, delta) {
  if (!block) return;

  if (block.curseReveal) {
    block.curseReveal.elapsed += delta;
    if (block.curseReveal.elapsed >= block.curseReveal.duration) {
      delete block.curseReveal;
      block.curseRevealFade = {
        elapsed: 0,
        duration: CURSED_MONSTER_REVEAL_MS,
      };
    }
    return;
  }

  if (!block.curseRevealFade) return;

  block.curseRevealFade.elapsed += delta;
  if (block.curseRevealFade.elapsed >= block.curseRevealFade.duration) {
    delete block.curseRevealFade;
  }
}

function updateInstantReveals(game, delta) {
  game.board.forEach((row) => {
    row.forEach((block) => {
      if (!block?.instantRevealFade) return;

      block.instantRevealFade.elapsed += delta;
      if (block.instantRevealFade.elapsed >= block.instantRevealFade.duration) {
        delete block.instantRevealFade;
      }
    });
  });
}

function updatePendingRemovals(game, delta) {
  game.board.forEach((row, y) => {
    row.forEach((block, x) => {
      if (!block?.pendingRemoval) return;

      block.pendingRemoval.elapsed += delta;
      if (block.pendingRemoval.elapsed >= 0) {
        game.board[y][x] = null;
      }
    });
  });
}

function updateDamageReveals(game, delta) {
  game.board.forEach((row) => {
    row.forEach((block) => {
      if (!block?.damageReveal) return;

      block.damageReveal.elapsed += delta;
      if (block.damageReveal.elapsed >= block.damageReveal.delay) {
        delete block.damageReveal;
        if (block.slayed) {
          block.slayMark = {
            elapsed: 0,
            duration: SLAY_MARK_FADE_MS,
          };
        }
      }
    });
  });

  game.board.forEach((row) => {
    row.forEach((block) => {
      if (!block?.slayMark) return;

      block.slayMark.elapsed += delta;
      if (block.slayMark.elapsed >= block.slayMark.duration) {
        delete block.slayMark;
      }
    });
  });
}

export function chooseMerchantOption(game, index) {
  if (!game.merchant || !game.merchant.options[index]) return false;

  const option = game.merchant.options[index];
  const resumeWithNewRound = game.merchant.resumeWithNewRound;
  if (!game.merchant.preview) {
    applyBlessing(game, option);
    game.player.treasure = MERCHANT_PURCHASE_COST == null
      ? 0
      : Math.max(0, game.player.treasure - MERCHANT_PURCHASE_COST);
  }
  game.merchant = null;
  if (resumeWithNewRound) spawnRound(game);
  return true;
}

export function skipMerchant(game) {
  if (!game.merchant || !canSkipMerchant(game)) return false;

  const resumeWithNewRound = game.merchant.resumeWithNewRound;
  if (!game.merchant.preview) game.player.treasure -= MERCHANT_SKIP_COST;
  game.merchant = null;
  if (resumeWithNewRound) spawnRound(game);
  return true;
}

export function moveMerchantSelection(game, direction) {
  if (!game.merchant) return false;

  game.merchant.selectedIndex = moveMerchantSelectionIndex(game.merchant, direction);
  return true;
}

export function activateMerchantSelection(game) {
  if (!game.merchant) return false;

  if (game.merchant.selectedIndex < game.merchant.options.length) {
    return chooseMerchantOption(game, game.merchant.selectedIndex);
  }

  return skipMerchant(game);
}

export function openMerchantPreview(game) {
  if (game.gameOver || game.runComplete || game.merchant) return false;

  openMerchant(game, false, true);
  return true;
}

function spawnRound(game) {
  const round = getNextRound(game.run, getCurrentDifficultyPhase(game));

  if (!round) {
    game.runComplete = true;
    return;
  }

  const normalBlocks = round.filter((block) => block.lane === "normal");
  const monsterBlocks = round.filter((block) => block.lane === "monster");

  game.active.normal = normalBlocks.length ? createNormalPiece(normalBlocks) : null;
  game.active.monsters = monsterBlocks.length ? createMonsterPiece(monsterBlocks) : null;

  if (game.active.normal && collides(game.board, shiftPiece(game.active.normal, 0, 1), 0, NORMAL_COLUMNS - 1)) {
    game.gameOver = true;
  }

  if (game.active.monsters && collides(game.board, shiftPiece(game.active.monsters, 0, 1), MONSTER_START_X, BOARD_WIDTH - 1)) {
    game.gameOver = true;
  }
}

function dropActive(game, lane) {
  const piece = game.active[lane];
  if (!piece) return false;
  if (lane === "monsters") return dropMonsterBlocks(game, piece);

  const minX = lane === "normal" ? 0 : MONSTER_START_X;
  const maxX = lane === "normal" ? NORMAL_COLUMNS - 1 : BOARD_WIDTH - 1;
  const next = shiftPiece(piece, 0, 1);

  if (!collides(game.board, next, minX, maxX)) {
    game.active[lane] = next;
    return true;
  }

  lockActive(game, lane);
  return false;
}

function dropMonsterBlocks(game, piece) {
  const fallingBlocks = [];
  let moved = false;

  piece.blocks.forEach((block) => {
    const next = {
      ...block,
      y: block.y + 1,
    };

    if (!collides(game.board, { blocks: [next] }, MONSTER_START_X, BOARD_WIDTH - 1)) {
      fallingBlocks.push(next);
      moved = true;
      return;
    }

    if (block.y >= 0) game.board[block.y][block.x] = block;
  });

  game.active.monsters = fallingBlocks.length ? { ...piece, blocks: fallingBlocks } : null;
  return moved;
}

function lockActive(game, lane) {
  const piece = game.active[lane];
  if (!piece) return;

  piece.blocks.forEach((block) => {
    if (block.y >= 0) game.board[block.y][block.x] = block;
  });

  game.active[lane] = null;

  if (lane === "normal") settleNormalColumns(game);
  pairMomentumWithSlashRows(game);
}

function finishEncounter(game) {
  clearEncounter(game);
  game.completedEncounters += 1;
  game.encounterGate = {
    phase: "opening",
    elapsed: 0,
    duration: ENCOUNTER_GATE_EXIT_MS,
    resumeAfter: true,
  };
}

function getCurrentDifficultyPhase(game) {
  return getDifficultyPhase(game.completedEncounters);
}

function continueAfterEncounter(game) {
  if (game.gravityAnimations.length || game.exitAnimations.length) {
    game.settleGate = { resumeAfter: true };
    return;
  }

  continueAfterSettling(game);
}

function continueAfterSettling(game) {
  if (game.gameOver) return;

  pairMomentumWithSlashRows(game);

  if (isNormalBottomRowFull(game.board)) {
    startEncounter(game);
  } else if (shouldOpenMerchant(game)) {
    openMerchant(game);
  } else {
    spawnRound(game);
  }
}

function pairMomentumWithSlashRows(game) {
  game.board.forEach((row) => {
    const availableMomentums = row
      .slice(0, NORMAL_COLUMNS)
      .filter((block) => block?.type === "O" && !block.instantSlashSpent);
    const availableSlashes = row
      .slice(0, NORMAL_COLUMNS)
      .filter((block) => block?.type === "L" && !block.instantSlash);

    const pairCount = Math.min(availableMomentums.length, availableSlashes.length);
    for (let index = 0; index < pairCount; index += 1) {
      availableMomentums[index].instantSlashSpent = true;
      availableSlashes[index].instantSlash = true;
      availableSlashes[index].instantRevealFade = {
        elapsed: 0,
        duration: INSTANT_SLASH_REVEAL_MS,
      };
    }
  });
}

function isBoardTransitioning(game) {
  return Boolean(game.encounterGate || game.settleGate || game.gravityAnimations.length || game.exitAnimations.length);
}

function isAdvanceTransitioning(game) {
  return Boolean(game.encounterGate || game.settleGate);
}

function settleNormalColumns(game) {
  const movements = settleBoardColumns(game.board, 0, NORMAL_COLUMNS - 1);
  if (!movements.length) return;

  game.gravityAnimations = movements;
  if (!game.active.monsters) game.settleGate = { resumeAfter: true };
}

function openMerchant(game, resumeWithNewRound = true, preview = false) {
  game.merchant = createMerchant(resumeWithNewRound, preview);
}

function applyBlessing(game, blessing) {
  if (isModifierBlessing(blessing)) game.player.blessings.push(blessing.label);
  game.player.blessingIds.push(blessing.id);

  if (blessing.id === "renewal") {
    game.player.body = game.player.maxBody;
  }

  if (blessing.id === "sharpen") {
    game.player.swordSkill = Math.min(MAX_SWORD_SKILL, game.player.swordSkill + SHARPEN_SWORD_SKILL_GAIN);
  }

  if (blessing.id === "temperBody") {
    game.player.maxBody += TEMPER_BODY_MAX_BODY_GAIN;
    healPlayer(game.player, TEMPER_BODY_BODY_GAIN);
  }

  if (blessing.id === "heavyArmor") {
    game.player.armorValueBonus += HEAVY_ARMOR_BLOCK_BONUS;
  }
}

function healPlayer(player, amount) {
  player.body = Math.min(player.maxBody, player.body + amount);
}
