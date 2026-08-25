import { UI_EFFECT_MS, UI_EXPAND_MS, UI_SHAKE_MS } from "./config.js?v=20260824-3";

export function addUiEffect(game, effect) {
  game.uiEffects.push({
    ...effect,
    elapsed: -(effect.delay ?? 0),
    applied: false,
    duration: getDuration(effect),
  });
}

export function updateUiEffects(game, delta) {
  game.uiEffects.forEach((effect) => {
    effect.elapsed += delta;
  });
  game.uiEffects = game.uiEffects.filter((effect) => effect.elapsed < effect.duration);
}

function getDuration(effect) {
  if (effect.type === "shake") return UI_SHAKE_MS;
  if (effect.type === "expand") return UI_EXPAND_MS;
  return UI_EFFECT_MS;
}
