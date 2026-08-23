import { CHAIN_SLASH_DAMAGE_PER_SLASH, MAX_CHAIN_SLASH_BONUS, SLASH_INTRINSIC_DAMAGE } from "./config.js?v=20260822-19";

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
  if (!encounter || event?.block?.type !== "L" || (encounter.instantSlashCount ?? 0) <= 0) return false;

  const slashEvents = getEncounterEvents(encounter)
    .filter((item) => item?.type === "normal" && item.block.type === "L")
    .sort((a, b) => a.x - b.x);
  const index = slashEvents.findIndex((item) => item.block === event.block && item.x === event.x && item.y === event.y);
  return index >= 0 && index < encounter.instantSlashCount;
}

export function getEncounterEvents(encounter) {
  return [
    ...(encounter?.current?.events ?? []),
    ...(encounter?.queue ?? []).flatMap((group) => group.events),
  ];
}
