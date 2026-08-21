const UI_EFFECT_MS = 720;
const UI_SHAKE_MS = 420;

export function addUiEffect(game, effect) {
  game.uiEffects.push({
    ...effect,
    elapsed: 0,
    duration: effect.type === "shake" ? UI_SHAKE_MS : UI_EFFECT_MS,
  });
}

export function updateUiEffects(game, delta) {
  game.uiEffects.forEach((effect) => {
    effect.elapsed += delta;
  });
  game.uiEffects = game.uiEffects.filter((effect) => effect.elapsed < effect.duration);
}
