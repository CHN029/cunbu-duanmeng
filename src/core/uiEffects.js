import { UI_EFFECT_MS, UI_EXPAND_MS, UI_SHAKE_MS } from "./config.js?v=20260822-9";

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
    if (!effect.applied && effect.applyAt != null && effect.elapsed >= effect.applyAt) {
      applyUiEffect(game, effect);
      effect.applied = true;
    }
  });
  game.uiEffects = game.uiEffects.filter((effect) => effect.elapsed < effect.duration);
}

function getDuration(effect) {
  if (effect.type === "shake") return UI_SHAKE_MS;
  if (effect.type === "expand") return UI_EXPAND_MS;
  return UI_EFFECT_MS;
}

function applyUiEffect(game, effect) {
  if (effect.stat === "body") {
    game.player.body = Math.min(game.player.maxBody, game.player.body + effect.amount);
  }

  if (effect.stat === "sword") {
    game.player.swordSkill += effect.amount;
  }

  if (effect.stat === "treasure") {
    game.player.treasure += effect.amount;
  }

  if (effect.stat === "shield" && game.encounter) {
    game.encounter.shield += effect.amount;
  }
}
