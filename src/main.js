import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  FALL_STEP_ANIMATION_MS,
  INITIAL_MAX_BODY,
  MONSTER_DROP_MS,
  MONSTER_FALL_STEP_ANIMATION_MS,
  NORMAL_COLUMNS,
  UPCOMING_BLOCK_PREVIEW_COUNT,
} from "./core/config.js?v=20260824-3";
import {
  canMonstersDrop,
  canMove,
  chooseMerchantOption,
  createGame,
  getUpcomingBlocks,
  hasActiveMonsters,
  openMerchantPreview,
  skipMerchant,
  tick,
  tickMonsters,
  togglePause,
  updateBoardAnimations,
  updateEncounter,
} from "./core/game.js?v=20260825-4";
import { createCanvasRenderer } from "./renderers/canvasRenderer.js?v=20260825-112";
import { COLORS } from "./theme/colors.js?v=20260825-23";
import { bindInput, bindSwipeInput } from "./ui/input.js?v=20260825-2";
import { toChineseNumber } from "./ui/chineseNumbers.js?v=20260821-1";
import { updateUiEffects } from "./core/uiEffects.js?v=20260824-1";

const uiEffects = document.querySelector("#ui-effects");
const cover = document.querySelector("#cover");
const canvas = document.querySelector("#game");
const upcoming = document.querySelector("#upcoming");
const round = document.querySelector("#round");
const pauseRun = document.querySelector("#pause-run");
const bodyMeter = document.querySelector("#body-meter");
const treasure = document.querySelector("#treasure");
const blessings = document.querySelector("#blessings");
const newRun = document.querySelector("#new-run");
const showShop = document.querySelector("#show-shop");

const ROLL_STEP_MS = 130;
const PAUSE_FADE_MS = 240;
const RESUME_HOLD_MS = 360;

let game = null;
let renderer = createCanvasRenderer(canvas);
let lastTime = 0;
let uiTime = 0;
let dropCounter = 0;
let monsterDropCounter = 0;
let upcomingKey = "";
let runReadyAt = 0;
let pauseVisual = 0;
let wasPaused = false;
const rollingStats = {
  treasure: createRollingStat(),
};

bindInput(
  () => (uiTime >= runReadyAt ? game : null),
  (nextGame) => {
    game = nextGame;
    dropCounter = 0;
    monsterDropCounter = 0;
  },
  handleGameChange,
);
bindSwipeInput(document.body, () => (uiTime >= runReadyAt ? game : null), handleGameChange);
cover.addEventListener("click", dismissCover);
document.addEventListener("keydown", dismissCover);
newRun.addEventListener("click", handleNewRun);
pauseRun.addEventListener("click", handlePauseControl);
showShop.addEventListener("click", openShopPreview);
canvas.addEventListener("click", handleCanvasClick);

requestAnimationFrame(loop);

function loop(time) {
  const delta = time - lastTime;
  lastTime = time;
  uiTime = time;
  const ready = game && time >= runReadyAt;
  const running = ready && !game.paused && !game.gameOver && !game.runComplete && !game.encounterGate && !game.merchant;

  if (game?.paused) pauseVisual = Math.min(1, pauseVisual + delta / PAUSE_FADE_MS);
  else pauseVisual = Math.max(0, pauseVisual - delta / PAUSE_FADE_MS);

  if (ready && !game.paused) {
    updateUiEffects(game, delta);
    updateBoardAnimations(game, delta);
  }

  if (running) {
    updateEncounter(game, delta);

    if (!game.encounter) {
      if (hasActiveMonsters(game)) {
        monsterDropCounter += delta;

        if (monsterDropCounter >= MONSTER_DROP_MS) {
          tickMonsters(game);
          monsterDropCounter -= MONSTER_DROP_MS;
        }
      } else {
        monsterDropCounter = 0;
      }

      dropCounter += delta;

      if (dropCounter >= game.dropMs) {
        tick(game);
        dropCounter = 0;
      }
    }
  }

  render();
  requestAnimationFrame(loop);
}

function render() {
  if (!game) {
    renderIdle();
    return;
  }

  document.body.classList.remove("is-idle");
  document.body.classList.toggle("is-paused", game.paused);
  const running = uiTime >= runReadyAt && !game.paused && !game.gameOver && !game.runComplete && !game.encounterGate && !game.merchant;
  const normalDropProgress = running && !game.encounter && canMove(game, 0, 1) ? getStepDropProgress(dropCounter) : 0;
  const monsterDropProgress = running && !game.encounter && canMonstersDrop(game) ? getMonsterStepDropProgress(monsterDropCounter) : 0;

  renderer.draw(game, { normalDropProgress, monsterDropProgress, pauseProgress: pauseVisual });
  round.textContent = `第${toChineseNumber(getEncounterDisplayCount())}回`;
  newRun.textContent = "週而復始";
  pauseRun.hidden = game.paused || game.gameOver || game.runComplete || Boolean(game.merchant);
  renderBodyMeter();
  renderRollingStat(treasure, rollingStats.treasure, getVisibleTreasure());
  renderUpcoming();
  renderBlessings();
  renderUiEffects();
  renderPanelEffects();
}

function renderIdle() {
  document.body.classList.add("is-idle");
  document.body.classList.remove("is-paused");
  renderer.drawIdle({ width: BOARD_WIDTH, height: BOARD_HEIGHT, normalColumns: NORMAL_COLUMNS });
  round.textContent = "第一回";
  renderBodyDots(INITIAL_MAX_BODY, 0);
  resetRollingStats();
  treasure.textContent = "無";
  upcomingKey = "";
  upcoming.replaceChildren(...Array.from({ length: UPCOMING_BLOCK_PREVIEW_COUNT }, () => {
    const slot = document.createElement("span");
    slot.className = "upcoming-slot empty";
    return slot;
  }));
  blessings.replaceChildren();
  uiEffects.replaceChildren();
  renderPanelEffects();
  newRun.textContent = "週而復始";
  pauseRun.hidden = true;
}

function handleGameChange() {
  const paused = Boolean(game?.paused);
  if (wasPaused && !paused) runReadyAt = performance.now() + RESUME_HOLD_MS;
  if (!game) pauseVisual = 0;
  wasPaused = paused;
  render();
}

function getStepDropProgress(elapsed) {
  const progress = Math.min(elapsed / FALL_STEP_ANIMATION_MS, 1);
  return 1 - (1 - progress) ** 3;
}

function getMonsterStepDropProgress(elapsed) {
  const progress = Math.min(elapsed / MONSTER_FALL_STEP_ANIMATION_MS, 1);
  return progress;
}

function renderBodyMeter() {
  renderBodyDots(game.player.maxBody, Math.max(0, game.player.body), game.player.guard);
}

function renderBodyDots(maxBody, currentBody, guard = 0) {
  bodyMeter.replaceChildren(
    ...Array.from({ length: maxBody }, (_, index) => {
      const dot = document.createElement("span");
      dot.className = `body-dot${index < currentBody ? " filled" : ""}`;
      return dot;
    }),
    ...Array.from({ length: guard }, () => {
      const dot = document.createElement("span");
      dot.className = "guard-dot";
      return dot;
    }),
  );
}

function renderBlessings() {
  const tags = [
    ...getBlessingStacks(game.player.blessings).map(({ label, count }) => (count > 1 ? `${label}${toChineseNumber(count)}` : label)),
  ];

  const curseTag = getCurseTag(game.player.pendingCurses);
  if (curseTag) tags.push(curseTag);

  if (tags.length === 0) {
    blessings.replaceChildren();
    return;
  }

  blessings.replaceChildren(
    ...tags.map((label) => {
      const tag = document.createElement("span");
      tag.className = `blessing-tag${label.startsWith("呪") ? " curse-tag" : ""}`;
      tag.textContent = label;
      return tag;
    }),
  );
}

function renderUiEffects() {
  const effects = game.uiEffects.filter((effect) => effect.type === "expand" || (effect.type === "travel" && effect.elapsed >= 0));

  uiEffects.replaceChildren(
    ...effects.map((effect) => {
      const glyph = document.createElement("span");
      const end = getEffectTargetCenter(effect);
      const progress = Math.min(effect.elapsed / effect.duration, 1);
      const visual = effect.type === "travel" ? getTravelEffectVisual(effect, end) : getExpandEffectVisual(end, progress);

      glyph.className = `ui-effect-glyph ${effect.type}`;
      glyph.textContent = effect.label;
      glyph.style.color = visual.color ?? effect.color;
      glyph.style.opacity = String(visual.opacity);
      glyph.style.transform = `translate(${visual.x}px, ${visual.y}px) translate(-50%, -50%) scale(${visual.scale})`;
      return glyph;
    }),
  );
}

function getTravelEffectVisual(effect, end) {
  const start = getEffectStartCenter(effect);
  const rawProgress = Math.min(effect.elapsed / effect.duration, 1);
  const travelProgress = easeInQuad(rawProgress);
  const position = effect.path === "curseToMonster"
    ? getCurseToMonsterPosition(start, end, travelProgress)
    : {
        x: getTravelX(start, end, travelProgress),
        y: getTravelY(start, end, travelProgress),
      };

  return {
    x: position.x,
    y: position.y,
    scale: 1 - 0.34 * rawProgress,
    opacity: Math.max(0, 0.74 - rawProgress * 0.3),
    color: mixHexColors(COLORS.glyph, effect.color, rawProgress),
  };
}

function getEffectStartCenter(effect) {
  if (effect.source) return getTargetCenter(effect.source);
  return getBoardCellCenter(effect.x, effect.y);
}

function getTravelX(start, end, progress) {
  const horizontalProgress = progress ** 1.28;
  return start.x + (end.x - start.x) * horizontalProgress;
}

function getTravelY(start, end, progress) {
  const directY = start.y + (end.y - start.y) * progress;
  const arcedY = directY - getTravelArcHeight(start, end) * Math.sin(progress * Math.PI);
  return Math.max(arcedY, end.y);
}

function getTravelArcHeight(start, end) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  return Math.min(70, Math.max(22, distance * 0.14));
}

function getCurseToMonsterPosition(start, end, progress) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const firstControl = {
    x: start.x + deltaX * 0.68,
    y: start.y,
  };
  const secondControl = {
    x: end.x,
    y: start.y + deltaY * 0.56,
  };

  return getCubicBezierPoint(start, firstControl, secondControl, end, progress);
}

function getCubicBezierPoint(start, firstControl, secondControl, end, progress) {
  const inverse = 1 - progress;
  const startWeight = inverse ** 3;
  const firstWeight = 3 * inverse ** 2 * progress;
  const secondWeight = 3 * inverse * progress ** 2;
  const endWeight = progress ** 3;

  return {
    x: start.x * startWeight + firstControl.x * firstWeight + secondControl.x * secondWeight + end.x * endWeight,
    y: start.y * startWeight + firstControl.y * firstWeight + secondControl.y * secondWeight + end.y * endWeight,
  };
}

function mixHexColors(from, to, amount) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  if (!start || !end) return to;

  const mix = (channel) => Math.round(start[channel] + (end[channel] - start[channel]) * amount);
  return `rgb(${mix("r")}, ${mix("g")}, ${mix("b")})`;
}

function easeInQuad(value) {
  return value * value;
}

function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;

  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

function getExpandEffectVisual(center, progress) {
  return {
    x: center.x,
    y: center.y,
    scale: 1 + progress * 1.35,
    opacity: Math.max(0, 0.82 * (1 - progress)),
  };
}

function renderPanelEffects() {
  const hasBodyShake = hasActiveUiEffect("body", "shake");

  bodyMeter.classList.toggle("hp-shake", hasBodyShake);
  canvas.classList.toggle("board-shake", hasBodyShake);
}

function hasActiveUiEffect(target, type) {
  return Boolean(game?.uiEffects.some((effect) => effect.target === target && effect.type === type));
}

function getBoardCellCenter(x, y) {
  const rect = canvas.getBoundingClientRect();
  const cell = rect.height / game.height;
  const laneGap = rect.width - cell * game.width;
  const left = rect.left + x * cell + (x >= game.normalColumns ? laneGap : 0);

  return {
    x: left + cell / 2,
    y: rect.top + y * cell + cell / 2,
  };
}

function createRollingStat() {
  return {
    from: null,
    target: null,
    display: null,
    lastRendered: null,
    startedAt: 0,
  };
}

function renderRollingStat(element, state, target) {
  if (state.display == null) {
    state.from = target;
    state.target = target;
    state.display = target;
  }

  if (state.target !== target) {
    state.from = state.display;
    state.target = target;
    state.startedAt = uiTime;
  }

  const diff = state.target - state.from;
  const direction = Math.sign(diff);
  const steps = Math.min(Math.abs(diff), Math.floor((uiTime - state.startedAt) / ROLL_STEP_MS));
  state.display = state.from + direction * steps;

  renderRollingText(element, state, direction);
}

function renderRollingText(element, state, direction) {
  if (state.lastRendered === state.display) return;

  element.textContent = toChineseNumber(Math.max(0, state.display));
  if (state.lastRendered != null && direction !== 0) {
    element.classList.remove("value-roll-up", "value-roll-down");
    void element.offsetWidth;
    element.classList.add(direction > 0 ? "value-roll-up" : "value-roll-down");
  }
  state.lastRendered = state.display;
}

function getVisibleTreasure() {
  const deferredTreasure = game.uiEffects
    .filter((effect) => effect.deferPanelStat === "treasure")
    .reduce((sum, effect) => sum + (effect.amount ?? 0), 0);
  return game.player.treasure - deferredTreasure;
}

function resetRollingStats() {
  Object.values(rollingStats).forEach((state) => {
    state.from = null;
    state.target = null;
    state.display = null;
    state.lastRendered = null;
    state.startedAt = 0;
  });
}

function getTargetCenter(target) {
  const element = {
    body: bodyMeter,
    curse: blessings,
    treasure,
    upcoming,
  }[target];
  const rect = element.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function getEffectTargetCenter(effect) {
  if (effect.target === "cell") return getBoardCellCenter(effect.targetX, effect.targetY);
  return getTargetCenter(effect.target);
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function getBlessingStacks(labels) {
  const stacks = new Map();

  labels.forEach((label) => {
    stacks.set(label, (stacks.get(label) ?? 0) + 1);
  });

  return Array.from(stacks, ([label, count]) => ({ label, count }));
}

function getCurseTag(pendingCurses) {
  if (!pendingCurses) return "";
  if (hasActiveUiEffect("curse", "travel")) return "";
  return pendingCurses > 1 ? `呪${toChineseNumber(pendingCurses)}` : "呪";
}

function renderUpcoming() {
  const blocks = getUpcomingBlocks(game);
  const nextKey = `${game.run.currentRound}|${blocks.map((block) => `${block.type}${block.cursedMonster ? "!" : ""}${block.curseReveal ? "~" : ""}`).join("-")}`;
  if (nextKey === upcomingKey) return;

  upcomingKey = nextKey;

  upcoming.replaceChildren(
    ...Array.from({ length: UPCOMING_BLOCK_PREVIEW_COUNT }, (_, index) => {
      const slot = document.createElement("span");
      const block = blocks[index];
      slot.className = `upcoming-slot${block ? "" : " empty"}`;

      if (block) {
        slot.textContent = block.label;
        slot.style.setProperty("--corner", getBlockCornerColor(block));
        slot.classList.toggle("attack", block.type === "L");
        slot.classList.toggle("cursed", Boolean(block.cursedMonster));
      }

      return slot;
    }),
  );
}

function getEncounterDisplayCount() {
  if (!game) return 1;
  if (game.runComplete) return game.completedEncounters;
  return game.completedEncounters + 1;
}

function getBlockCornerColor(block) {
  if (block.cursedMonster) return COLORS.corners.curse;
  if (block.type === "B") return COLORS.corners.heal;
  if (block.type === "L") return COLORS.corners.slash;
  if (block.type === "C") return COLORS.corners.curse;
  if (block.type === "T") return COLORS.corners.treasure;
  if (block.type === "O") return COLORS.corners.momentum;
  if (block.type === "E") return COLORS.corners.armor;
  if (block.lane === "monster") return COLORS.corners.monster;
  return COLORS.corners.grid;
}

function handleNewRun() {
  if (game) {
    game = null;
    dropCounter = 0;
    monsterDropCounter = 0;
    upcomingKey = "";
    render();
    return;
  }

  startRun();
}

function handlePauseControl() {
  if (!game || uiTime < runReadyAt || game.gameOver || game.runComplete || game.merchant) return;
  togglePause(game);
  handleGameChange();
}

function startRun(readyDelay = 0) {
  document.body.classList.remove("is-cover-exiting");
  game = createGame();
  runReadyAt = performance.now() + readyDelay;
  dropCounter = 0;
  monsterDropCounter = 0;
  upcomingKey = "";
  pauseVisual = 0;
  wasPaused = false;
  newRun.textContent = "週而復始";
  render();
}

function dismissCover(event) {
  if (game || !document.body.classList.contains("is-idle") || document.body.classList.contains("is-cover-exiting")) return;
  if (event.type === "keydown" && (event.metaKey || event.ctrlKey || event.altKey)) return;

  event.preventDefault();
  document.body.classList.add("is-cover-exiting");
  setTimeout(() => startRun(1300), 900);
}

function openShopPreview() {
  if (!game) return;

  openMerchantPreview(game);
  render();
}

function handleCanvasClick(event) {
  if (!game) {
    startRun();
    return;
  }

  if (game.paused) {
    togglePause(game);
    handleGameChange();
    return;
  }

  if (!game.merchant) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const choice = getMerchantChoice(x, y);

  if (!choice) return;
  game.merchant.selectedIndex = choice.type === "option" ? choice.index : game.merchant.options.length;
  if (choice.type === "option") chooseMerchantOption(game, choice.index);
  if (choice.type === "skip") skipMerchant(game);
  dropCounter = 0;
  monsterDropCounter = 0;
  render();
}

function getMerchantChoice(x, y) {
  const layout = getMerchantLayout();

  for (let index = 0; index < game.merchant.options.length; index += 1) {
    const left = layout.options[index].x - layout.optionWidth / 2;
    if (x >= left && x <= left + layout.optionWidth && y >= layout.optionTop && y <= layout.optionTop + layout.optionHeight) {
      return { type: "option", index };
    }
  }

  if (x >= layout.skipX && x <= layout.skipX + layout.skipWidth && y >= layout.skipY && y <= layout.skipY + layout.skipHeight) {
    return { type: "skip" };
  }
  return null;
}

function getMerchantLayout() {
  const scale = canvas.width / 300;
  const columnGap = 48 * scale;
  const skipGap = 64 * scale;
  const optionWidth = 42 * scale;
  const optionTop = canvas.height * 0.36;
  const optionHeight = canvas.height * 0.36;
  const startX = canvas.width * 0.7;
  const options = Array.from({ length: game.merchant.options.length }, (_, index) => ({ x: startX - index * columnGap }));
  const skipWidth = 38 * scale;

  return {
    options,
    optionWidth,
    optionTop,
    optionHeight,
    skipX: options[game.merchant.options.length - 1].x - skipGap - skipWidth / 2,
    skipY: optionTop,
    skipWidth,
    skipHeight: optionHeight,
  };
}
