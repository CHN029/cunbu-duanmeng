import { drawMerchant } from "./merchantRenderer.js?v=20260825-4";
import { getSettledLandingPiece } from "../core/board.js?v=20260825-3";
import { getEncounterEvents, getSlashDamage as getResolvedSlashDamage, isInstantSlashEvent } from "../core/combatRules.js?v=20260831-5";
import { COLORS } from "../theme/colors.js?v=20260825-23";

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
      const pauseProgress = options.pauseProgress ?? (game.paused ? 1 : 0);
      const endingProgress = options.endingProgress ?? (game.gameOver || game.runComplete ? 1 : 0);

      context.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground(context, canvas);
      if (game.merchant) {
        drawMerchant(context, canvas, game.merchant);
        drawOverlay(context, canvas, game, pauseProgress, endingProgress);
        return;
      }
      drawGrid(context, game.width, game.height, cell, game.normalColumns, laneGap);
      drawEncounterGate(context, game, cell, laneGap);
      drawBoard(context, game.board, cell, game.normalColumns, laneGap, game);
      drawExitAnimations(context, game, cell, game.normalColumns, laneGap);
      drawLandingGhost(context, game, cell, laneGap, normalDropProgress);
      drawPiece(context, game.active.normal, cell, game.normalColumns, laneGap, game, normalDropProgress);
      drawPiece(context, game.active.monsters, cell, game.normalColumns, laneGap, game, monsterDropProgress);
      drawLaneDivider(context, canvas, game.normalColumns, cell, laneGap);
      drawEffects(context, game.effects, cell, game.normalColumns, laneGap);
      drawOverlay(context, canvas, game, pauseProgress, endingProgress);
    },
  };
}

export function createBlockStyleRenderer(canvas) {
  const context = canvas.getContext("2d");
  const game = {
    board: [],
    encounter: null,
    gravityAnimations: [],
    player: { armorValueBonus: 0, blessingIds: [], swordSkill: 0 },
  };

  return {
    draw(blocks, columns = 1, getStyleGlyphColor = null, glyphFamily = null) {
      resizeCanvasToDisplaySize(canvas);
      const cell = canvas.width / columns;
      game.height = Math.ceil(blocks.length / columns);
      game.encounter = {
        current: { events: blocks.flatMap((block, index) => block.instantSlash ? [{ type: "normal", block, x: index % columns, y: Math.floor(index / columns) }] : []) },
        introElapsed: 0,
        queue: [],
      };
      context.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground(context, canvas);
      blocks.forEach((block, index) => drawCell(context, index % columns, Math.floor(index / columns), cell, block, columns, 0, game, {
        glyphColor: getStyleGlyphColor?.(block) ?? null,
        glyphFamily,
      }));
    },
  };
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
  context.fillStyle = COLORS.paper;
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

function drawLandingGhost(context, game, cell, laneGap, dropProgress) {
  const piece = game.active.normal;
  if (!piece || !piece.blocks.some((block) => block.y >= -1) || game.paused || game.gameOver || game.runComplete || game.encounter || game.merchant) return;

  const landing = getSettledLandingPiece(game.board, piece, 0, game.normalColumns - 1);
  if (landing.blocks.every((block, index) => block.y === piece.blocks[index].y)) return;
  const distance = Math.min(...landing.blocks.map((block, index) => block.y - piece.blocks[index].y - dropProgress));
  const visibility = Math.min(1, Math.max(0, (distance - 0.25) / 2.5));

  landing.blocks.forEach((block) => {
    if (block.y >= 0) drawGhostCell(context, block.x, block.y, cell, block, visibility);
  });
}

function drawGhostCell(context, x, y, cell, block, visibility) {
  const left = x * cell;
  const top = y * cell;

  context.save();
  context.globalAlpha = visibility;
  context.fillStyle = COLORS.ghost;
  context.textAlign = "center";
  context.textBaseline = "middle";
  drawCornerMarks(context, left, top, cell, null, COLORS.ghost);
  context.font = `300 ${Math.floor(cell * 0.7)}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
  if (block.label.length > 1) {
    drawCompressedVerticalGlyph(context, block.label, left + cell / 2, top + cell * 0.5, cell * 0.68, 0.5, 1);
  } else {
    context.fillText(block.label, left + cell / 2, top + cell * getGlyphCenterY(block));
  }
  context.restore();
}

function getBlockYOffset(game, block, yOffset) {
  if (yOffset === 0 || block.lane !== "monster") return yOffset;
  if (block.y + 1 >= game.height) return 0;
  if (block.y >= 0 && game.board[block.y + 1]?.[block.x]) return 0;
  return yOffset;
}

function drawCell(context, x, y, cell, block, normalColumns, laneGap, game, visual = {}) {
  const shake = getHitShakeOffset(block, cell);
  const left = x * cell + (x >= normalColumns ? laneGap : 0) + shake.x;
  const animatedY = getSettledBlockY(game, block, y);
  const top = animatedY * cell + shake.y;
  const size = cell;
  const isMonster = block.lane === "monster";
  const opacity = visual.opacity ?? getBoardBlockOpacity(game, block, x, y);

  context.save();
  context.globalAlpha = opacity;
  drawCornerMarks(context, left, top, size, block);
  if (visual.monsterAttackProgress != null) drawMonsterAttackShadow(context, left, top, size, block, visual.monsterAttackProgress);
  if (visual.slashChargeProgress != null) {
    drawSlashCharge(context, left, top, size, visual.slashChargeProgress, visual.slashChargeLabel);
    context.restore();
    return;
  }

  drawBlockGlyph(context, left, top, size, block, game, x, y, isMonster, visual.glyphColor, visual.glyphFamily);
  if (block.slayed && !block.damageReveal) drawSlainMonsterRing(context, left, top, size, getSlayMarkAlpha(block));

  if (isMonster) {
    drawValueDots(context, left, top, size, getMonsterDisplayValue(block));
  }
  if (block.type === "L" && !isInstantSlashBlock(game.encounter, block, x, y)) {
    drawValueDots(context, left, top, size, getSlashDamage(game, block, x, y));
  }
  if (block.type === "E") {
    drawValueDots(context, left, top, size, getArmorBlockValue(game, block), COLORS.corners.armor);
  }
  context.restore();
}

function getHitShakeOffset(block, cell) {
  if (!block?.hitShake) return { x: 0, y: 0 };

  const progress = Math.min(block.hitShake.elapsed / block.hitShake.duration, 1);
  const strength = cell * 0.085 * (1 - progress);
  const wave = Math.sin(progress * Math.PI * 8);

  return {
    x: wave * strength,
    y: Math.sin(progress * Math.PI * 5) * strength * 0.35,
  };
}

function drawBlockGlyph(context, left, top, size, block, game, x, y, isMonster, glyphColor = null, glyphFamily = `"Huiwen-Fangsong", "STFangsong", "Songti TC", serif`) {
  context.fillStyle = glyphColor ?? getGlyphColor(block);
  context.textAlign = "center";
  context.textBaseline = "middle";

  if (isVisibleCursedMonster(block)) {
    if (block.curseRevealFade) {
      const progress = Math.min(block.curseRevealFade.elapsed / block.curseRevealFade.duration, 1);
      drawGlyphMorph(context, {
        from: block.label,
        to: "鬼",
        x: left + size / 2,
        y: top + size * 0.5,
        size,
        progress,
        fromColor: glyphColor ?? COLORS.glyph,
        color: glyphColor ?? COLORS.glyph,
        glyphFamily,
      });
      return;
    }
    context.font = `400 ${Math.floor(size * 0.7)}px ${glyphFamily}`;
    context.fillText("鬼", left + size / 2, top + size * 0.5);
    return;
  }

  if (isInstantSlashBlock(game.encounter, block, x, y)) {
    if (block.instantRevealFade) {
      const progress = Math.min(Math.max(block.instantRevealFade.elapsed, 0) / block.instantRevealFade.duration, 1);
      drawGlyphMorph(context, {
        from: block.label,
        to: "必殺",
        x: left + size / 2,
        y: top + size * 0.5,
        size,
        progress,
        fromColor: glyphColor ?? COLORS.red,
        color: glyphColor ?? COLORS.red,
        glyphFamily,
      });
      return;
    }
    drawCompressedVerticalGlyph(context, "必殺", left + size / 2, top + size * 0.5, size * 0.74, 0.52, 1.02, glyphFamily);
    return;
  }

  context.font = `400 ${Math.floor(size * 0.7)}px ${glyphFamily}`;
  if (block.label.length > 1) {
    drawCompressedVerticalGlyph(context, block.label, left + size / 2, top + size * 0.5, size * 0.68, 0.5, 1, glyphFamily);
    return;
  }
  context.fillText(block.label, left + size / 2, top + size * getGlyphCenterY(block));
}

function drawVerticalGlyph(context, text, x, y, fontSize, lineGap = 0, glyphFamily = `"Huiwen-Fangsong", "STFangsong", "Songti TC", serif`) {
  context.font = `400 ${Math.floor(fontSize)}px ${glyphFamily}`;
  Array.from(text).forEach((char, index) => {
    context.fillText(char, x, y + index * (fontSize + lineGap));
  });
}

function drawCompressedVerticalGlyph(context, text, x, y, fontSize, yScale, lineAdvance = 0.92, glyphFamily = `"Huiwen-Fangsong", "STFangsong", "Songti TC", serif`) {
  const chars = Array.from(text);
  const advance = fontSize * lineAdvance;
  const startY = -((chars.length - 1) * advance) / 2;

  context.save();
  context.translate(x, y);
  context.scale(1, yScale);
  drawVerticalGlyph(context, text, 0, startY, fontSize, fontSize * (lineAdvance - 1), glyphFamily);
  context.restore();
}

function drawGlyphMorph(context, { from, to, x, y, size, progress, fromColor = COLORS.glyph, color, glyphFamily = `"Huiwen-Fangsong", "STFangsong", "Songti TC", serif` }) {
  const fromAlpha = Math.max(0, 1 - progress * 1.75);
  const toAlpha = Math.min(1, Math.max(0, (progress - 0.22) / 0.58));
  const fromScaleY = Math.max(0.18, 1 - progress * 0.82);
  const easedToAlpha = easeOutCubic(toAlpha);
  const toScaleY = 0.18 + easedToAlpha * (to.length > 1 ? 0.34 : 0.82);

  context.save();
  context.globalAlpha *= fromAlpha;
  context.fillStyle = fromColor;
  context.font = `400 ${Math.floor(size * 0.7)}px ${glyphFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.translate(x, y);
  context.scale(1, fromScaleY);
  context.fillText(from, 0, 0);
  context.restore();

  context.save();
  context.globalAlpha *= toAlpha;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  if (to.length > 1) {
    drawCompressedVerticalGlyph(context, to, x, y, size * 0.74, toScaleY, 1.02, glyphFamily);
  } else {
    context.font = `400 ${Math.floor(size * 0.7)}px ${glyphFamily}`;
    context.translate(x, y);
    context.scale(1, toScaleY);
    context.fillText(to, 0, 0);
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
  return progress * progress * (3 - 2 * progress);
}

function drawSlainMonsterRing(context, left, top, size, alpha = 1) {
  const centerX = left + size / 2;
  const centerY = top + size * 0.5;
  const radius = size * 0.23;

  context.save();
  context.globalAlpha *= 0.92 * alpha;

  context.strokeStyle = COLORS.paper;
  context.lineWidth = Math.max(1.8, size * 0.038);
  context.beginPath();
  context.arc(centerX, centerY, radius + size * 0.032, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = COLORS.red;
  context.lineWidth = Math.max(1.7, size * 0.032);
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = COLORS.paper;
  context.lineWidth = Math.max(1.3, size * 0.026);
  context.beginPath();
  context.arc(centerX, centerY, radius - size * 0.032, 0, Math.PI * 2);
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
  const dotRadius = Math.max(isCompactBoard ? 2.7 : 1.9, size * (isCompactBoard ? 0.045 : 0.032));
  const gap = size * (isCompactBoard ? 0.12 : 0.1);
  const totalWidth = (value - 1) * gap;
  const startX = left + size / 2 - totalWidth / 2;
  const y = top + size - Math.max(4, size * 0.065);

  context.fillStyle = color;

  for (let index = 0; index < value; index += 1) {
    context.beginPath();
    context.arc(startX + index * gap, y, dotRadius, 0, Math.PI * 2);
    context.fill();
  }
}

function getSlashDamage(game, block, x, y) {
  const isEncounterSlash = isEncounterSlashBlock(game.encounter, block, x, y);
  return getResolvedSlashDamage(game, isEncounterSlash ? game.encounter : null, block);
}

function isEncounterSlashBlock(encounter, block, x, y) {
  if (!encounter) return false;

  return getEncounterEvents(encounter).some(
    (event) => event?.type === "normal" && event.block === block && event.block.type === "L" && event.x === x && event.y === y,
  );
}

function isInstantSlashBlock(encounter, block, x, y) {
  return isInstantSlashEvent(encounter, { type: "normal", block, x, y });
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
    slashChargeLabel: getSlashChargeLabel(encounter, block, x, y),
  };
}

function getSlashChargeLabel(encounter, block, x, y) {
  if (isInstantSlashBlock(encounter, block, x, y)) return "必殺";
  return "斬";
}

function shouldShowSlashCharge(encounter, event) {
  if (event.block.type !== "L") return false;
  return encounter.hasMonsters;
}

function hasTravelingSupportGlyph(event) {
  return ["B", "C", "T", "E"].includes(event.block.type);
}

function drawMonsterAttackShadow(context, left, top, size, block, progress) {
  const centerX = left + size / 2;
  const centerY = top + size * 0.5;
  const scale = 1 + progress * 1.9;
  const alpha = Math.max(0, 0.5 * (1 - progress));

  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = COLORS.red;
  context.font = `400 ${Math.floor(size * 0.7)}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.translate(centerX, centerY);
  context.scale(scale, scale);
  context.fillText(block.label, 0, 0);
  context.restore();
}

function drawEffects(context, effects, cell, normalColumns, laneGap) {
  let drewSlashTrail = false;

  effects.forEach((effect) => {
    if (effect.elapsed < 0) return;
    if (effect.type === "slashBeam") {
      drawSlashBeam(context, effect, cell, normalColumns, laneGap, { drawTrail: !drewSlashTrail });
      drewSlashTrail = true;
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
    context.font = `400 ${Math.floor(cell * 0.7)}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
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
  context.font = `400 ${Math.floor(cell * 0.74)}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(effect.label, left + cell / 2, top + cell * 0.5);
  context.restore();
}

function drawSlashCharge(context, left, top, size, progress, label = "斬") {
  const centerX = left + size / 2;
  const centerY = top + size * 0.5;
  const chargeProgress = progress;
  const squeeze = 1 - easeOutCubic(chargeProgress) * 0.92;
  const alpha = 0.9 - progress * 0.16;

  context.save();
  context.globalAlpha *= alpha;
  context.fillStyle = COLORS.red;
  context.font = `400 ${Math.floor(size * 0.74)}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.translate(centerX, centerY);
  context.scale(1, squeeze);
  if (label.length > 1) {
    drawCompressedVerticalGlyph(context, label, 0, 0, size * 0.74, 0.52, 1.02);
  } else {
    context.fillText(label, 0, 0);
  }
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

function drawSlashBeam(context, effect, cell, normalColumns, laneGap, options = {}) {
  const progress = Math.min(effect.elapsed / effect.duration, 1);
  const source = getEffectCellCenter(effect.x, effect.y, cell, normalColumns, laneGap);
  const targets = effect.targets.map((target) => getEffectCellCenter(target.x, target.y, cell, normalColumns, laneGap));
  const exit = getSlashExitPoint(context, source, cell);
  const points = [source, ...targets, exit];
  const segments = getPathSegments(points);
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  const travelProgress = Math.min(progress / 0.78, 1);
  const headLength = totalLength * easeOutCubic(travelProgress);
  const bladeLength = Math.max(cell * 2.4, 112);
  const trailLength = bladeLength * 1.45;
  const tailLength = Math.max(0, headLength - bladeLength);
  const alpha = progress < 0.8 ? 1 : Math.max(0, 1 - (progress - 0.8) / 0.2);

  if (options.drawTrail) {
    context.save();
    context.strokeStyle = effect.color;
    context.globalAlpha = alpha * 0.18;
    context.lineWidth = Math.max(1, cell * 0.018);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    drawPathSegment(context, segments, Math.max(0, headLength - trailLength), headLength);
    context.stroke();
    context.restore();
  }

  context.save();
  context.strokeStyle = effect.color;
  context.globalAlpha = alpha;
  context.lineWidth = Math.max(1.7, cell * 0.032);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  drawPathSegment(context, segments, tailLength, headLength);
  context.stroke();
  context.restore();
}

function getSlashExitPoint(context, source, cell) {
  return {
    x: context.canvas.width + cell * 1.05,
    y: source.y,
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
  if (block.lane === "monster") return COLORS.glyph;
  if (isVisibleCursedMonster(block)) return COLORS.corners.curse;
  if (block.type === "L") return COLORS.red;
  return COLORS.glyph;
}

function getGlyphCenterY(block) {
  return block.lane === "monster" || block.type === "L" ? 0.5 : 0.55;
}

function getCornerColor(block) {
  if (!block) return COLORS.corners.grid;
  if (isVisibleCursedMonster(block)) return COLORS.corners.curse;
  if (block.type === "B") return COLORS.corners.heal;
  if (block.type === "L") return COLORS.corners.slash;
  if (block.type === "C") return COLORS.corners.curse;
  if (block.type === "T") return COLORS.corners.treasure;
  if (block.type === "O") return COLORS.corners.momentum;
  if (block.type === "E") return COLORS.corners.armor;
  if (block.lane === "monster") return COLORS.corners.monster;
  return COLORS.corners.fallback;
}

function isVisibleCursedMonster(block) {
  return Boolean(block.cursedMonster && !block.curseReveal);
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

function drawOverlay(context, canvas, game, pauseProgress = 0, endingProgress = 0) {
  const isEnding = game.gameOver || game.runComplete;
  const overlayProgress = isEnding ? endingProgress : pauseProgress;
  if (overlayProgress <= 0) return;

  context.save();
  context.globalAlpha = overlayProgress * (isEnding ? 0.92 : 0.84);
  context.fillStyle = COLORS.paper;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const label = game.gameOver ? "折戟沉沙" : game.runComplete ? "克敵制勝" : "按兵不動";
  if (isEnding) {
    const promptProgress = Math.min(1, Math.max(0, (endingProgress - 0.18) / 0.82));
    const eased = easeOutCubic(promptProgress);
    const upcomingHeight = canvas.offsetTop - canvas.previousElementSibling.offsetTop;
    context.globalAlpha = eased;
    context.translate(0, (8 * (1 - eased) - upcomingHeight / 2) * (window.devicePixelRatio || 1));
    drawVerticalLabel(context, canvas, label);
  } else {
    drawPauseBookmark(context, canvas, label);
  }
  context.restore();
}

function drawPauseBookmark(context, canvas, label) {
  const pixelRatio = window.devicePixelRatio || 1;
  const upcomingHeight = canvas.offsetTop - canvas.previousElementSibling.offsetTop;
  context.save();
  context.translate(0, -upcomingHeight * pixelRatio / 2);
  const fontSize = 36 * pixelRatio;
  const textHeight = fontSize + (label.length - 1) * fontSize * 1.08;
  const ornamentWidth = 48 * pixelRatio;
  const ornamentHeight = 22 * pixelRatio;
  const outerPadding = 2.5 * pixelRatio;
  const frameHeight = textHeight + 2 * (ornamentHeight + 14 * pixelRatio) + outerPadding * 2;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const frameTop = centerY - frameHeight / 2;
  const pauseInk = "#302e29";

  context.strokeStyle = pauseInk;
  context.lineWidth = 1.25 * pixelRatio;
  context.strokeRect(centerX - ornamentWidth / 2, frameTop, ornamentWidth, frameHeight);

  drawBookmarkOrnament(context, centerX, frameTop + outerPadding, ornamentWidth, ornamentHeight, pixelRatio, false, pauseInk);
  drawBookmarkOrnament(context, centerX, frameTop + frameHeight - outerPadding, ornamentWidth, ornamentHeight, pixelRatio, true, pauseInk);
  drawVerticalLabel(context, canvas, label, `400`, `"Zhaohua", serif`, pauseInk, fontSize);
  context.restore();
}

function drawBookmarkOrnament(context, centerX, edgeY, width, height, pixelRatio, flip, color) {
  context.save();
  context.translate(centerX, edgeY);
  if (flip) context.scale(1, -1);

  const left = -width / 2;
  const right = width / 2;
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(left, 0);
  context.lineTo(right, 0);
  context.lineTo(right, height);
  context.lineTo(0, height * 0.55);
  context.lineTo(left, height);
  context.closePath();
  context.fill();

  const traceGap = 2.5 * pixelRatio;
  context.strokeStyle = color;
  context.lineWidth = 1.75 * pixelRatio;
  context.lineCap = "butt";
  context.lineJoin = "miter";
  context.beginPath();
  context.moveTo(left, height + traceGap);
  context.lineTo(0, height * 0.55 + traceGap);
  context.lineTo(right, height + traceGap);
  context.stroke();

  context.strokeStyle = color;
  context.lineWidth = 1.75 * pixelRatio;
  context.beginPath();
  context.moveTo(left, -traceGap);
  context.lineTo(right, -traceGap);
  context.stroke();
  context.restore();
}

function drawVerticalLabel(context, canvas, label, weight = `500`, family = `"Huiwen-Fangsong", "STFangsong", "Songti TC", serif`, color = COLORS.ink, size = null) {
  const centerX = Math.round(canvas.width / 2);
  const centerY = Math.round(canvas.height / 2);
  const cssWidth = canvas.getBoundingClientRect().width;
  const pixelRatio = window.devicePixelRatio || 1;
  const fontSize = size ?? (cssWidth <= 280 ? 46 * pixelRatio : 36 * pixelRatio);
  const gap = fontSize * 1.08;
  const startY = centerY - ((label.length - 1) * gap) / 2;

  context.fillStyle = color;
  context.font = `${weight} ${fontSize}px ${family}`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  Array.from(label).forEach((character, index) => {
    context.fillText(character, centerX, startY + index * gap);
  });
}
