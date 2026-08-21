import { drawMerchant } from "./merchantRenderer.js?v=20260821-42";
import { CHAIN_SLASH_DAMAGE_PER_SLASH } from "../core/config.js?v=20260821-40";
import { COLORS } from "../theme/colors.js?v=20260821-14";

export function createCanvasRenderer(canvas) {
  const context = canvas.getContext("2d");

  return {
    drawIdle(board) {
      resizeCanvasToDisplaySize(canvas);

      const cell = canvas.height / board.height;
      const laneGap = canvas.width - cell * board.width;

      context.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground(context, canvas);
      drawGrid(context, board.width, board.height, cell, board.normalColumns, laneGap);
      drawLaneDivider(context, canvas, board.normalColumns, cell, laneGap);
      drawVerticalLabel(context, canvas, "單刀直入");
    },

    draw(game, options = {}) {
      resizeCanvasToDisplaySize(canvas);

      const cell = canvas.height / game.height;
      const laneGap = canvas.width - cell * game.width;
      const normalDropProgress = options.normalDropProgress ?? 0;
      const monsterDropProgress = options.monsterDropProgress ?? 0;

      context.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground(context, canvas);
      if (game.merchant) {
        drawMerchant(context, canvas, game.merchant);
        drawOverlay(context, canvas, game);
        return;
      }
      drawGrid(context, game.width, game.height, cell, game.normalColumns, laneGap);
      drawBoard(context, game.board, cell, game.normalColumns, laneGap, game);
      drawPiece(context, game.active.normal, cell, game.normalColumns, laneGap, game, normalDropProgress);
      drawPiece(context, game.active.monsters, cell, game.normalColumns, laneGap, game, monsterDropProgress);
      drawLaneDivider(context, canvas, game.normalColumns, cell, laneGap);
      drawEffects(context, game.effects, cell, game.normalColumns, laneGap);
      drawOverlay(context, canvas, game);
    },
  };
}

function drawStartPrompt(context, canvas) {
  drawVerticalLabel(context, canvas, "開局");
}

function resizeCanvasToDisplaySize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * pixelRatio);
  const height = Math.round(rect.height * pixelRatio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawBackground(context, canvas) {
  context.fillStyle = COLORS.white;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function drawBoard(context, board, cell, normalColumns, laneGap, game) {
  board.forEach((row, y) => {
    row.forEach((block, x) => {
      if (block) drawCell(context, x, y, cell, block, normalColumns, laneGap, game, getEncounterVisual(game.encounter, block, x, y));
    });
  });
}

function drawGrid(context, width, height, cell, normalColumns, laneGap) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const left = x * cell + (x >= normalColumns ? laneGap : 0);
      drawCornerMarks(context, left, y * cell, cell, null, COLORS.corners.grid);
    }
  }
}

function drawPiece(context, piece, cell, normalColumns, laneGap, game, yOffset = 0) {
  if (!piece) return;

  piece.blocks.forEach((block) => {
    const blockOffset = getBlockYOffset(game, block, yOffset);
    if (block.y + blockOffset >= 0) drawCell(context, block.x, block.y + blockOffset, cell, block, normalColumns, laneGap, game);
  });
}

function getBlockYOffset(game, block, yOffset) {
  if (yOffset === 0 || block.lane !== "monster") return yOffset;
  if (block.y + 1 >= game.height) return 0;
  if (block.y >= 0 && game.board[block.y + 1]?.[block.x]) return 0;
  return yOffset;
}

function drawCell(context, x, y, cell, block, normalColumns, laneGap, game, visual = {}) {
  const left = x * cell + (x >= normalColumns ? laneGap : 0);
  const top = y * cell;
  const size = cell;
  const isMonster = block.lane === "monster";
  const opacity = visual.opacity ?? getSlainBlockOpacity(game, block, x, y);

  context.save();
  context.globalAlpha = opacity;
  drawCornerMarks(context, left, top, size, block);
  if (visual.monsterAttackProgress != null) drawMonsterAttackShadow(context, left, top, size, block, visual.monsterAttackProgress);

  context.fillStyle = getGlyphColor(block);
  context.font = `${isMonster ? 500 : 400} ${Math.floor(cell * 0.7)}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(block.label, left + size / 2, top + size * getGlyphCenterY(block));

  if (isMonster) {
    drawValueDots(context, left, top, size, block.value);
  }
  if (block.type === "L") {
    drawValueDots(context, left, top, size, getSlashDamage(game, block, x, y));
  }
  if (block.type === "E") {
    drawValueDots(context, left, top, size, getArmorBlockValue(game, block), COLORS.corners.armor);
  }
  context.restore();
}

function getSlainBlockOpacity(game, block, x, y) {
  if (!block.slayed) return 1;

  const slayEffect = game.effects.find((effect) => effect.label === "斬" && effect.x === x && effect.y === y && effect.elapsed >= 0);
  if (!slayEffect) return 0.08;

  const progress = Math.min(slayEffect.elapsed / slayEffect.duration, 1);
  return Math.max(0.08, 1 - progress);
}

function drawValueDots(context, left, top, size, value, color = COLORS.red) {
  const isCompactBoard = context.canvas.getBoundingClientRect().width <= 280;
  const dotRadius = Math.max(isCompactBoard ? 2.8 : 2, size * (isCompactBoard ? 0.047 : 0.035));
  const gap = size * (isCompactBoard ? 0.14 : 0.12);
  const totalWidth = (value - 1) * gap;
  const startX = left + size / 2 - totalWidth / 2;
  const y = top + size * 0.9;

  context.fillStyle = color;

  for (let index = 0; index < value; index += 1) {
    context.beginPath();
    context.arc(startX + index * gap, y, dotRadius, 0, Math.PI * 2);
    context.fill();
  }
}

function getSlashDamage(game, block, x, y) {
  const isEncounterSlash = isEncounterSlashBlock(game.encounter, block, x, y);
  const multiplier = isEncounterSlash ? game.encounter.slashMultiplier : 1;
  const chainBonus =
    isEncounterSlash && game.player.blessingIds.includes("chainSlash") && (game.encounter?.slashCount ?? 0) > 1
      ? game.encounter.slashCount * CHAIN_SLASH_DAMAGE_PER_SLASH
      : 0;
  return game.player.swordSkill * multiplier + chainBonus;
}

function isEncounterSlashBlock(encounter, block, x, y) {
  if (!encounter) return false;

  return [encounter.current, ...encounter.queue].some(
    (event) => event?.type === "normal" && event.block === block && event.block.type === "L" && event.x === x && event.y === y,
  );
}

function getArmorBlockValue(game, block) {
  return block.value + game.player.armorValueBonus;
}

function getEncounterVisual(encounter, block, x, y) {
  if (!encounter?.current) return { opacity: 1 };
  const current = encounter.current;
  const isCurrent = current.block === block && current.x === x && current.y === y;

  if (!isCurrent) return { opacity: 1 };

  const progress = encounter.elapsed / encounter.duration;

  return {
    opacity: Math.max(0.08, 1 - progress),
    monsterAttackProgress: current.type === "monster" && !block.slayed ? progress : null,
  };
}

function drawMonsterAttackShadow(context, left, top, size, block, progress) {
  const centerX = left + size / 2;
  const centerY = top + size * 0.48;
  const scale = 1 + progress * 1.9;
  const alpha = Math.max(0, 0.5 * (1 - progress));

  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = COLORS.red;
  context.font = `500 ${Math.floor(size * 0.7)}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.translate(centerX, centerY);
  context.scale(scale, scale);
  context.fillText(block.label, 0, 0);
  context.restore();
}

function drawEffects(context, effects, cell, normalColumns, laneGap) {
  effects.forEach((effect) => {
    if (effect.elapsed < 0) return;

    const progress = Math.min(effect.elapsed / effect.duration, 1);
    const left = effect.x * cell + (effect.x >= normalColumns ? laneGap : 0);
    const top = effect.y * cell;
    const centerX = left + cell / 2;
    const centerY = top + cell * 0.48;
    const scale = 1 + progress * 2.2;
    const alpha = Math.max(0, 0.72 * (1 - progress));

    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = effect.color;
    context.font = `500 ${Math.floor(cell * 0.7)}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.translate(centerX, centerY);
    context.scale(scale, scale);
    context.fillText(effect.label, 0, 0);
    context.restore();
  });
}

function drawCornerMarks(context, left, top, size, block, color = getCornerColor(block)) {
  const inset = Math.max(3, size * 0.03);
  const length = Math.max(9, size * 0.1);
  const max = left + size - inset;
  const min = left + inset;
  const topY = top + inset;
  const bottomY = top + size - inset;

  context.strokeStyle = color;
  context.lineWidth = Math.max(1.5, size * 0.014);

  drawCorner(context, min, topY, length, 1, 1);
  drawCorner(context, max, topY, length, -1, 1);
  drawCorner(context, min, bottomY, length, 1, -1);
  drawCorner(context, max, bottomY, length, -1, -1);
}

function drawCorner(context, x, y, length, xDirection, yDirection) {
  context.beginPath();
  context.moveTo(x, y + length * yDirection);
  context.lineTo(x, y);
  context.lineTo(x + length * xDirection, y);
  context.stroke();
}

function getGlyphColor(block) {
  if (block.type === "L") return COLORS.red;
  return COLORS.glyph;
}

function getGlyphCenterY(block) {
  return block.lane === "monster" || block.type === "L" ? 0.48 : 0.55;
}

function getCornerColor(block) {
  if (!block) return COLORS.corners.grid;
  if (block.type === "B") return COLORS.corners.heal;
  if (block.type === "D") return COLORS.corners.sword;
  if (block.type === "L") return COLORS.corners.slash;
  if (block.type === "C") return COLORS.corners.curse;
  if (block.type === "T") return COLORS.corners.treasure;
  if (block.type === "O") return COLORS.corners.momentum;
  if (block.type === "E") return COLORS.corners.armor;
  if (block.lane === "monster") return COLORS.corners.monster;
  return COLORS.corners.fallback;
}

function drawLaneDivider(context, canvas, normalColumns, cell, laneGap) {
  const x = normalColumns * cell + laneGap / 2;

  context.strokeStyle = COLORS.divider;
  context.lineWidth = 0.25;
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, canvas.height);
  context.stroke();
}

function drawOverlay(context, canvas, game) {
  if (!game.gameOver && !game.paused && !game.runComplete) return;

  context.fillStyle = COLORS.overlay;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const label = game.gameOver ? "折戟沉沙" : game.runComplete ? "斬將搴旗" : "屏息待機";
  drawVerticalLabel(context, canvas, label);
}

function drawVerticalLabel(context, canvas, label) {
  const centerX = Math.round(canvas.width / 2);
  const centerY = Math.round(canvas.height / 2);
  const cssWidth = canvas.getBoundingClientRect().width;
  const pixelRatio = window.devicePixelRatio || 1;
  const fontSize = cssWidth <= 280 ? 46 * pixelRatio : 36 * pixelRatio;
  const gap = fontSize * 1.08;
  const startY = centerY - ((label.length - 1) * gap) / 2;

  context.fillStyle = COLORS.ink;
  context.font = `500 ${fontSize}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  Array.from(label).forEach((character, index) => {
    context.fillText(character, centerX, startY + index * gap);
  });
}
