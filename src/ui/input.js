import {
  activateMerchantSelection,
  chooseMerchantOption,
  createGame,
  hardDrop,
  move,
  moveMerchantSelection,
  rotate,
  skipMerchant,
  togglePause,
} from "../core/game.js?v=20260822-23";

export function bindInput(getGame, setGame, onChange) {
  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const game = getGame();
    const startKeys = {
      Enter: true,
      " ": true,
      r: true,
      R: true,
    };

    if (!game && startKeys[event.key]) {
      event.preventDefault();
      setGame(createGame());
      onChange();
      return;
    }

    if (!game) return;

    const merchantActions = {
      1: () => chooseMerchantOption(game, 0),
      2: () => chooseMerchantOption(game, 1),
      3: () => chooseMerchantOption(game, 2),
      s: () => skipMerchant(game),
      S: () => skipMerchant(game),
      ArrowLeft: () => moveMerchantSelection(game, 1),
      ArrowRight: () => moveMerchantSelection(game, -1),
      Enter: () => activateMerchantSelection(game),
      " ": () => activateMerchantSelection(game),
      r: () => setGame(null),
      R: () => setGame(null),
    };
    const merchantAction = game.merchant ? merchantActions[event.key] : null;

    if (merchantAction) {
      event.preventDefault();
      merchantAction();
      onChange();
      return;
    }

    const actions = {
      ArrowLeft: () => move(game, -1, 0),
      ArrowRight: () => move(game, 1, 0),
      ArrowDown: () => hardDrop(game),
      " ": () => (game.paused ? togglePause(game) : rotate(game)),
      Escape: () => togglePause(game),
      r: () => setGame(null),
      R: () => setGame(null),
    };

    const action = actions[event.key];
    if (!action) return;

    event.preventDefault();
    action();
    onChange();
  });
}

export function bindSwipeInput(element, getGame, onChange) {
  const swipeThreshold = 24;
  let start = null;

  element.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    if (event.target.closest?.("button")) return;
    if (getGame()?.merchant) return;

    start = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener("pointerup", (event) => {
    if (!start || start.id !== event.pointerId) return;

    const game = getGame();
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;

    if (!game || game.merchant) return;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeThreshold) return;

    event.preventDefault();

    if (Math.abs(dx) > Math.abs(dy)) {
      move(game, dx < 0 ? -1 : 1, 0);
    } else if (dy > 0) {
      hardDrop(game);
    } else if (game.paused) {
      togglePause(game);
    } else {
      rotate(game);
    }

    onChange();
  });

  element.addEventListener("pointercancel", () => {
    start = null;
  });
}
