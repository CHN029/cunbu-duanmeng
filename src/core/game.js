import { collides, createBoard, isNormalBottomRowFull, rotatePiece, settleBoard, shiftPiece } from "./board.js?v=20260821-30";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DROP_MS,
  HEAVY_ARMOR_BLOCK_BONUS,
  INITIAL_BODY,
  INITIAL_MAX_BODY,
  INITIAL_SWORD_SKILL,
  INITIAL_TREASURE,
  MERCHANT_SKIP_COST,
  MONSTER_START_X,
  NORMAL_COLUMNS,
  SHARPEN_SWORD_SKILL_GAIN,
  TEMPER_BODY_BODY_GAIN,
  TEMPER_BODY_MAX_BODY_GAIN,
} from "./config.js?v=20260821-40";
import { clearEncounter, startEncounter, updateEncounter as updateEncounterState } from "./encounterOrchestrator.js?v=20260821-39";
import { canSkipMerchant, createMerchant, isModifierBlessing, moveMerchantSelectionIndex, shouldOpenMerchant } from "./merchant.js?v=20260821-46";
import { createMonsterPiece, createNormalPiece } from "./pieces.js?v=20260821-30";
import { createRun, getNextRound, peekUpcomingBlocks } from "./runOrchestrator.js?v=20260821-30";

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
      blessings: [],
      blessingIds: [],
      armorValueBonus: 0,
    },
    dropMs: DROP_MS,
    gameOver: false,
    paused: false,
    runComplete: false,
    encounter: null,
    effects: [],
    uiEffects: [],
    merchant: null,
  };

  spawnRound(game);
  return game;
}

export function getUpcomingBlocks(game, count = 6) {
  return peekUpcomingBlocks(game.run, count);
}

export function tick(game) {
  if (game.paused || game.gameOver || game.runComplete || game.encounter || game.merchant) return;

  dropActive(game, "normal");
  finishRoundIfSettled(game);
}

export function tickMonsters(game) {
  if (game.paused || game.gameOver || game.runComplete || game.encounter || game.merchant || !game.active.monsters) return false;

  const moved = dropActive(game, "monsters");
  finishRoundIfSettled(game);
  return moved;
}

export function canMove(game, dx, dy) {
  if (game.paused || game.gameOver || game.runComplete || game.encounter || game.merchant || !game.active.normal) return false;

  const next = shiftPiece(game.active.normal, dx, dy);
  return !collides(game.board, next, 0, NORMAL_COLUMNS - 1);
}

export function hasActiveMonsters(game) {
  return Boolean(game.active.monsters);
}

export function canMonstersDrop(game) {
  if (game.paused || game.gameOver || game.runComplete || game.encounter || game.merchant || !game.active.monsters) return false;

  return game.active.monsters.blocks.some((block) => {
    const next = {
      ...block,
      y: block.y + 1,
    };

    return !collides(game.board, { blocks: [next] }, MONSTER_START_X, BOARD_WIDTH - 1);
  });
}

function finishRoundIfSettled(game) {
  if (!game.active.normal && !game.active.monsters) {
    settleBoard(game.board);
    if (isNormalBottomRowFull(game.board)) {
      startEncounter(game);
    } else if (shouldOpenMerchant(game)) {
      openMerchant(game);
    } else {
      spawnRound(game);
    }
  }
}

export function move(game, dx, dy) {
  if (!canMove(game, dx, dy)) return false;

  const next = shiftPiece(game.active.normal, dx, dy);
  game.active.normal = next;
  return true;
}

export function rotate(game) {
  if (game.paused || game.gameOver || game.runComplete || game.merchant || !game.active.normal) return false;
  if (game.active.normal.blocks.length < 2) return false;

  const next = rotatePiece(game.active.normal);
  if (collides(game.board, next, 0, NORMAL_COLUMNS - 1)) return false;

  game.active.normal = next;
  return true;
}

export function hardDrop(game) {
  if (game.paused || game.gameOver || game.runComplete || game.encounter || game.merchant) return;

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

export function chooseMerchantOption(game, index) {
  if (!game.merchant || !game.merchant.options[index]) return false;

  const option = game.merchant.options[index];
  const resumeWithNewRound = game.merchant.resumeWithNewRound;
  if (!game.merchant.preview) {
    applyBlessing(game, option);
    game.player.treasure = 0;
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
  const round = getNextRound(game.run);

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
}

function finishEncounter(game) {
  clearEncounter(game);

  if (game.gameOver) return;

  if (isNormalBottomRowFull(game.board)) {
    startEncounter(game);
  } else if (shouldOpenMerchant(game)) {
    openMerchant(game);
  } else {
    spawnRound(game);
  }
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
    game.player.swordSkill += SHARPEN_SWORD_SKILL_GAIN;
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
