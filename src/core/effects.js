import { EFFECT_MS } from "./config.js?v=20260822-15";

export function addEffect(game, effect) {
  game.effects.push({
    ...effect,
    elapsed: -(effect.delay ?? 0),
    duration: effect.duration ?? EFFECT_MS,
  });
}

export function updateEffects(game, delta) {
  game.effects.forEach((effect) => {
    effect.elapsed += delta;
  });
  game.effects = game.effects.filter((effect) => effect.elapsed < effect.duration);
}
