import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  FALL_STEP_ANIMATION_MS,
  INITIAL_MAX_BODY,
  MONSTER_DROP_MS,
  MONSTER_FALL_STEP_ANIMATION_MS,
  NORMAL_COLUMNS,
} from "./core/config.js?v=20260821-40";
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
  updateEncounter,
} from "./core/game.js?v=20260821-51";
import { createCanvasRenderer } from "./renderers/canvasRenderer.js?v=20260821-55";
import { COLORS } from "./theme/colors.js?v=20260821-14";
import { bindInput, bindSwipeInput } from "./ui/input.js?v=20260821-51";
import { toChineseNumber } from "./ui/chineseNumbers.js?v=20260821-1";

const canvas = document.querySelector("#game");
const upcoming = document.querySelector("#upcoming");
const round = document.querySelector("#round");
const bodyMeter = document.querySelector("#body-meter");
const sword = document.querySelector("#sword");
const treasure = document.querySelector("#treasure");
const blessings = document.querySelector("#blessings");
const newRun = document.querySelector("#new-run");
const pauseRun = document.querySelector("#pause-run");
const showShop = document.querySelector("#show-shop");

let game = null;
let renderer = createCanvasRenderer(canvas);
let lastTime = 0;
let dropCounter = 0;
let monsterDropCounter = 0;
let upcomingKey = "";

bindInput(
  () => game,
  (nextGame) => {
    game = nextGame;
    dropCounter = 0;
    monsterDropCounter = 0;
  },
  render,
);
bindSwipeInput(document.body, () => game, render);
newRun.addEventListener("click", reset);
pauseRun.addEventListener("click", pause);
showShop.addEventListener("click", openShopPreview);
canvas.addEventListener("click", handleCanvasClick);

requestAnimationFrame(loop);

function loop(time) {
  const delta = time - lastTime;
  lastTime = time;
  const running = game && !game.paused && !game.gameOver && !game.runComplete && !game.merchant;

  if (running) {
    updateEncounter(game, delta);

    if (!game.encounter && hasActiveMonsters(game)) {
      monsterDropCounter += delta;

      if (monsterDropCounter >= MONSTER_DROP_MS) {
        tickMonsters(game);
        monsterDropCounter -= MONSTER_DROP_MS;
      }
    } else if (!game.encounter) {
      dropCounter += delta;
      monsterDropCounter = 0;

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

  const running = !game.paused && !game.gameOver && !game.runComplete && !game.merchant;
  const normalDropProgress = running && !game.encounter && canMove(game, 0, 1) ? getStepDropProgress(dropCounter) : 0;
  const monsterDropProgress = running && !game.encounter && canMonstersDrop(game) ? getMonsterStepDropProgress(monsterDropCounter) : 0;

  renderer.draw(game, { normalDropProgress, monsterDropProgress });
  round.textContent = `第${toChineseNumber(Math.min(game.run.currentRound, game.run.totalRounds))}回合`;
  newRun.textContent = "週而復始";
  renderBodyMeter();
  sword.textContent = toChineseNumber(game.player.swordSkill);
  treasure.textContent = toChineseNumber(game.player.treasure);
  renderUpcoming();
  renderBlessings();
  renderPauseButton();
}

function renderIdle() {
  renderer.drawIdle({ width: BOARD_WIDTH, height: BOARD_HEIGHT, normalColumns: NORMAL_COLUMNS });
  round.textContent = "未開局";
  renderBodyDots(INITIAL_MAX_BODY, 0);
  sword.textContent = "無";
  treasure.textContent = "無";
  upcomingKey = "";
  upcoming.replaceChildren(...Array.from({ length: 6 }, () => {
    const slot = document.createElement("span");
    slot.className = "upcoming-slot empty";
    return slot;
  }));
  blessings.replaceChildren();
  newRun.textContent = "開局";
  renderPauseButton();
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
  renderBodyDots(game.player.maxBody, Math.max(0, game.player.body));
}

function renderBodyDots(maxBody, currentBody) {
  bodyMeter.replaceChildren(
    ...Array.from({ length: maxBody }, (_, index) => {
      const dot = document.createElement("span");
      dot.className = `body-dot${index < currentBody ? " filled" : ""}`;
      return dot;
    }),
  );
}

function renderBlessings() {
  if (game.player.blessings.length === 0) {
    blessings.replaceChildren();
    return;
  }

  blessings.replaceChildren(
    ...getBlessingStacks(game.player.blessings).map(({ label, count }) => {
      const tag = document.createElement("span");
      tag.className = "blessing-tag";
      tag.textContent = count > 1 ? `${label}${toChineseNumber(count)}` : label;
      return tag;
    }),
  );
}

function renderPauseButton() {
  pauseRun.hidden = !game || game.paused || game.gameOver || game.runComplete || game.merchant;
}

function getBlessingStacks(labels) {
  const stacks = new Map();

  labels.forEach((label) => {
    stacks.set(label, (stacks.get(label) ?? 0) + 1);
  });

  return Array.from(stacks, ([label, count]) => ({ label, count }));
}

function renderUpcoming() {
  const blocks = getUpcomingBlocks(game, 6);
  const nextKey = `${game.run.currentRound}|${blocks.map((block) => block.type).join("-")}`;
  if (nextKey === upcomingKey) return;

  upcomingKey = nextKey;

  upcoming.replaceChildren(
    ...Array.from({ length: 6 }, (_, index) => {
      const slot = document.createElement("span");
      const block = blocks[index];
      slot.className = `upcoming-slot${block ? "" : " empty"}`;

      if (block) {
        slot.textContent = block.label;
        slot.style.setProperty("--corner", getBlockCornerColor(block));
        slot.classList.toggle("attack", block.type === "L");
      }

      return slot;
    }),
  );
}

function getBlockCornerColor(block) {
  if (block.type === "B") return COLORS.corners.heal;
  if (block.type === "D") return COLORS.corners.sword;
  if (block.type === "L") return COLORS.corners.slash;
  if (block.type === "C") return COLORS.corners.curse;
  if (block.type === "T") return COLORS.corners.treasure;
  if (block.type === "O") return COLORS.corners.momentum;
  if (block.type === "E") return COLORS.corners.armor;
  if (block.lane === "monster") return COLORS.corners.monster;
  return COLORS.corners.grid;
}

function reset() {
  game = createGame();
  dropCounter = 0;
  monsterDropCounter = 0;
  upcomingKey = "";
  newRun.textContent = "週而復始";
  render();
}

function pause() {
  if (!game || game.gameOver || game.runComplete || game.merchant) return;

  togglePause(game);
  render();
}

function openShopPreview() {
  if (!game) return;

  openMerchantPreview(game);
  render();
}

function handleCanvasClick(event) {
  if (!game) {
    reset();
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
