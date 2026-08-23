import { drawMerchant } from "./merchantRenderer.js?v=20260821-42";
import { CHAIN_SLASH_DAMAGE_PER_SLASH } from "../core/config.js?v=20260822-9";
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
      drawEncounterGate(context, game, cell, laneGap);
      drawBoard(context, game.board, cell, game.normalColumns, laneGap, game);
      drawExitAnimations(context, game, cell, game.normalColumns, laneGap);
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

function drawEncounterGate(context, game, cell, laneGap) {
  if (!game.encounter && !game.encounterGate) return;

  const top = (game.height - 1) * cell;
  const totalWidth = game.width * cell + laneGap;

  context.save();
  if (game.encounterGate) {
    drawEncounterGateExit(context, game, top, totalWidth, cell);
  } else {
    drawEncounterGateIntro(context, game, top, totalWidth, cell);
  }
  context.restore();
}

function drawEncounterGateIntro(context, game, top, totalWidth, cell) {
  const progress = Math.min((game.encounter.introElapsed ?? 0) / (game.encounter.introDuration ?? 1), 1);
  const fillWidth = (totalWidth / 2) * progress;
  const fillAlpha = 0.052 * progress;

  context.fillStyle = `rgba(178, 143, 92, ${fillAlpha})`;
  context.fillRect(0, top, fillWidth, cell);
  context.fillRect(totalWidth - fillWidth, top, fillWidth, cell);
}

function drawEncounterGateExit(context, game, top, totalWidth, cell) {
  const progress = Math.min((game.encounterGate?.elapsed ?? 0) / (game.encounterGate?.duration ?? 1), 1);
  const eased = easeOutCubic(Math.min(progress * 1.65, 1));
  const y = top + cell * 1.18 * eased;
  const fillAlpha = 0.052 * (1 - progress * 0.22);

  context.fillStyle = `rgba(178, 143, 92, ${fillAlpha})`;
  context.fillRect(0, y, totalWidth, cell);
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
  const animatedY = getSettledBlockY(game, block, y);
  const top = animatedY * cell;
  const size = cell;
  const isMonster = block.lane === "monster";
  const opacity = visual.opacity ?? getBoardBlockOpacity(game, block, x, y);

  context.save();
  context.globalAlpha = opacity;
  drawCornerMarks(context, left, top, size, block);
  if (visual.monsterAttackProgress != null) drawMonsterAttackShadow(context, left, top, size, block, visual.monsterAttackProgress);
  if (visual.slashChargeProgress != null) {
    drawSlashCharge(context, left, top, size, visual.slashChargeProgress);
    context.restore();
    return;
  }

  context.fillStyle = getGlyphColor(block);
  context.font = `${isMonster ? 500 : 400} ${Math.floor(cell * 0.7)}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(block.label, left + size / 2, top + size * getGlyphCenterY(block));
  if (block.slayed && !block.damageReveal) drawSlainMonsterRing(context, left, top, size, getSlayMarkAlpha(block));

  if (isMonster) {
    drawValueDots(context, left, top, size, getMonsterDisplayValue(block));
  }
  if (block.type === "L") {
    drawValueDots(context, left, top, size, getSlashDamage(game, block, x, y));
  }
  if (block.type === "E") {
    drawValueDots(context, left, top, size, getArmorBlockValue(game, block), COLORS.corners.armor);
  }
  context.restore();
}

function getSettledBlockY(game, block, y) {
  const animation = game.gravityAnimations?.find((item) => item.block === block);
  if (!animation) return y;

  const progress = Math.min((animation.elapsed ?? 0) / (animation.duration ?? 1), 1);
  const eased = 1 - (1 - progress) ** 3;
  return animation.fromY + (animation.toY - animation.fromY) * eased;
}

function getBoardBlockOpacity(game, block, x, y) {
  if (block.pendingRemoval?.elapsed >= 0) return 0;
  const slainOpacity = getSlainBlockOpacity(game, block, x, y);
  if (slainOpacity !== 1) return slainOpacity;
  if (!game.encounter || y === game.height - 1) return 1;

  const introProgress = Math.min((game.encounter.introElapsed ?? 0) / (game.encounter.introDuration ?? 1), 1);
  const dim = 0.74 + 0.26 * (1 - introProgress);
  return Math.min(1, dim);
}

function getSlainBlockOpacity(game, block, x, y) {
  return 1;
}

function getSlayMarkAlpha(block) {
  if (!block.slayMark) return 1;

  const progress = Math.min((block.slayMark.elapsed ?? 0) / (block.slayMark.duration ?? 1), 1);
  return easeOutCubic(progress);
}

function drawSlainMonsterRing(context, left, top, size, alpha = 1) {
  context.save();
  context.strokeStyle = COLORS.red;
  context.globalAlpha *= 0.92 * alpha;
  context.lineWidth = Math.max(2.2, size * 0.04);
  context.beginPath();
  context.arc(left + size / 2, top + size * 0.48, size * 0.24, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function getMonsterDisplayValue(block) {
  return block.damageReveal ? block.damageReveal.fromValue : block.value;
}

function drawExitAnimations(context, game, cell, normalColumns, laneGap) {
  game.exitAnimations?.forEach((animation) => {
    const progress = Math.min((animation.elapsed ?? 0) / (animation.duration ?? 1), 1);
    const eased = easeInQuad(progress);
    drawCell(context, animation.x, animation.y + eased * 1.18, cell, animation.block, normalColumns, laneGap, game, {
      opacity: Math.max(0, 1 - progress * 0.18),
    });
  });
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

  return getEncounterEvents(encounter).some(
    (event) => event?.type === "normal" && event.block === block && event.block.type === "L" && event.x === x && event.y === y,
  );
}

function getArmorBlockValue(game, block) {
  return block.value + game.player.armorValueBonus;
}

function getEncounterVisual(encounter, block, x, y) {
  if (!encounter?.current) return { opacity: 1 };
  const currentEvent = encounter.current.events.find((event) => event.block === block && event.x === x && event.y === y);

  if (!currentEvent) return { opacity: 1 };
  if (currentEvent.type === "monster" && block.slayed) return { opacity: 1 };

  const progress = encounter.elapsed / encounter.duration;
  const shouldTravel = encounter.current.type === "support" && hasTravelingSupportGlyph(currentEvent);
  const minOpacity = shouldTravel ? 1 : 0.08;

  return {
    opacity: Math.max(minOpacity, 1 - progress),
    monsterAttackProgress: currentEvent.type === "monster" && !block.slayed ? progress : null,
    slashChargeProgress: shouldShowSlashCharge(encounter, currentEvent) ? progress : null,
  };
}

function shouldShowSlashCharge(encounter, event) {
  if (event.block.type !== "L") return false;
  return encounter.hasMonsters;
}

function hasTravelingSupportGlyph(event) {
  return ["B", "D", "T", "E"].includes(event.block.type);
}

function getEncounterEvents(encounter) {
  return [
    ...(encounter.current?.events ?? []),
    ...(encounter.queue ?? []).flatMap((group) => group.events),
  ];
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
    if (effect.type === "slashBeam") {
      drawSlashBeam(context, effect, cell, normalColumns, laneGap);
      return;
    }
    if (effect.type === "fadeGlyph") {
      drawFadeGlyph(context, effect, cell, normalColumns, laneGap);
      return;
    }

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

function drawFadeGlyph(context, effect, cell, normalColumns, laneGap) {
  const progress = Math.min(effect.elapsed / effect.duration, 1);
  const left = effect.x * cell + (effect.x >= normalColumns ? laneGap : 0);
  const top = effect.y * cell;
  const alpha = Math.max(0, 0.8 * (1 - easeOutCubic(progress)));

  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = effect.color;
  context.font = `500 ${Math.floor(cell * 0.74)}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(effect.label, left + cell / 2, top + cell * 0.5);
  context.restore();
}

function drawSlashCharge(context, left, top, size, progress) {
  const centerX = left + size / 2;
  const centerY = top + size * 0.5;
  const squeeze = 1 - easeOutCubic(progress) * 0.92;
  const alpha = 0.9 - progress * 0.16;

  context.save();
  context.globalAlpha *= alpha;
  context.fillStyle = COLORS.red;
  context.font = `500 ${Math.floor(size * 0.74)}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.translate(centerX, centerY);
  context.scale(1, squeeze);
  context.fillText("斬", 0, 0);
  context.restore();

  if (progress < 0.55) return;

  const lineProgress = (progress - 0.55) / 0.45;
  context.save();
  context.globalAlpha *= lineProgress * 0.78;
  context.strokeStyle = COLORS.red;
  context.lineWidth = Math.max(1.2, size * 0.035);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(centerX - size * 0.34 * lineProgress, centerY);
  context.lineTo(centerX + size * 0.34 * lineProgress, centerY);
  context.stroke();
  context.restore();
}

function drawSlashBeam(context, effect, cell, normalColumns, laneGap) {
  const progress = Math.min(effect.elapsed / effect.duration, 1);
  const source = getEffectCellCenter(effect.x, effect.y, cell, normalColumns, laneGap);
  const targets = effect.targets.map((target) => getEffectCellCenter(target.x, target.y, cell, normalColumns, laneGap));
  const exit = getSlashExitPoint(context, targets.at(-1) ?? source, cell);
  const points = [source, ...targets, exit];
  const segments = getPathSegments(points);
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  const headLength = totalLength * easeInQuad(progress);
  const bladeLength = Math.max(cell * 2.15, 96);
  const tailLength = Math.max(0, headLength - bladeLength);
  const alpha = progress < 0.82 ? 1 : Math.max(0, 1 * (1 - (progress - 0.82) / 0.18));

  context.save();
  context.strokeStyle = effect.color;
  context.globalAlpha = alpha;
  context.lineWidth = Math.max(1.4, cell * 0.026);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  drawPathSegment(context, segments, tailLength, headLength);
  context.stroke();
  context.restore();

}

function getSlashExitPoint(context, lastTarget, cell) {
  return {
    x: context.canvas.width + cell * 0.35,
    y: lastTarget.y,
  };
}

function getEffectCellCenter(x, y, cell, normalColumns, laneGap) {
  const left = x * cell + (x >= normalColumns ? laneGap : 0);
  return {
    x: left + cell / 2,
    y: y * cell + cell / 2,
  };
}

function getPathSegments(points) {
  return points.slice(1).map((point, index) => {
    const from = points[index];
    const length = Math.hypot(point.x - from.x, point.y - from.y);
    return { from, to: point, length };
  });
}

function drawPathSegment(context, segments, startLength, endLength) {
  if (!segments.length) return;

  let traveled = 0;
  let hasStarted = false;
  for (const segment of segments) {
    const segmentStart = traveled;
    const segmentEnd = traveled + segment.length;
    traveled = segmentEnd;

    if (endLength <= segmentStart) return;
    if (startLength >= segmentEnd) continue;

    const fromAmount = Math.max(0, (startLength - segmentStart) / segment.length);
    const toAmount = Math.min(1, (endLength - segmentStart) / segment.length);
    const from = interpolatePoint(segment.from, segment.to, fromAmount);
    const to = interpolatePoint(segment.from, segment.to, toAmount);

    if (!hasStarted) {
      context.moveTo(from.x, from.y);
      hasStarted = true;
    } else {
      context.lineTo(from.x, from.y);
    }
    context.lineTo(to.x, to.y);
  }
}

function interpolatePoint(from, to, amount) {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function easeInQuad(value) {
  return value * value;
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
