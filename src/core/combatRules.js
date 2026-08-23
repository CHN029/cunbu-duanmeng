import { CHAIN_SLASH_DAMAGE_PER_SLASH, MAX_CHAIN_SLASH_BONUS, SLASH_INTRINSIC_DAMAGE } from "./config.js?v=20260822-24";

export function getSlashDamage(game, encounter = game.encounter, slashBlock = null) {
  return SLASH_INTRINSIC_DAMAGE + getLocalSlashBonus(game, encounter) + getSwordBlessingBonus(game);
}

export function getLocalSlashBonus(game, encounter = game.encounter) {
  if (!game.player.blessingIds.includes("chainSlash")) return 0;
  if ((encounter?.slashCount ?? 0) <= 1) return 0;

  return Math.min(MAX_CHAIN_SLASH_BONUS, CHAIN_SLASH_DAMAGE_PER_SLASH);
}

export function getSwordBlessingBonus(game) {
  return game.player.swordSkill;
}

export function isInstantSlashEvent(encounter, event) {
  return Boolean(event?.block?.type === "L" && event.block.instantSlash);
}

export function getEncounterEvents(encounter) {
  return [
    ...(encounter?.current?.events ?? []),
    ...(encounter?.queue ?? []).flatMap((group) => group.events),
  ];
}
