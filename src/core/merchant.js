import {
  HEAVY_ARMOR_BLOCK_BONUS,
  LOOT_CHANCE_BLESSING_BONUS,
  MERCHANT_OPTION_COUNT,
  MERCHANT_SKIP_COST,
  MERCHANT_THRESHOLD,
  SHARPEN_SWORD_SKILL_GAIN,
  TEMPER_BODY_BODY_GAIN,
  TEMPER_BODY_MAX_BODY_GAIN,
} from "./config.js?v=20260824-3";
import { toChineseNumber } from "../ui/chineseNumbers.js?v=20260821-1";

export const MERCHANT_OPTIONS = [
  { id: "renewal", label: "回春", description: "體魄復滿", path: "general", category: "instant" },
  { id: "sharpen", label: "磨鋒", description: `斬傷加${toChineseNumber(SHARPEN_SWORD_SKILL_GAIN)}`, path: "swordsman", category: "instant" },
  { id: "chainSlash", label: "連斬", description: "多斬增傷", path: "swordsman", category: "modifier" },
  { id: "temperBody", label: "鍊體", description: TEMPER_BODY_MAX_BODY_GAIN === TEMPER_BODY_BODY_GAIN
    ? `根骨體魄加${toChineseNumber(TEMPER_BODY_MAX_BODY_GAIN)}`
    : `根骨加${toChineseNumber(TEMPER_BODY_MAX_BODY_GAIN)}體魄加${toChineseNumber(TEMPER_BODY_BODY_GAIN)}`, path: "ironBody", category: "instant" },
  { id: "heavyArmor", label: "重甲", description: `甲值加${toChineseNumber(HEAVY_ARMOR_BLOCK_BONUS)}`, path: "ironBody", category: "modifier" },
  { id: "lootCraft", label: "斬奪", description: `奪率加百分之${toChineseNumber(Math.round(LOOT_CHANCE_BLESSING_BONUS * 100))}`, path: "general", category: "modifier" },
];

export function isModifierBlessing(blessing) {
  return blessing.category === "modifier";
}

export function shouldOpenMerchant(game) {
  return !game.merchant && !game.active.normal && !game.active.monsters && game.player.treasure >= MERCHANT_THRESHOLD;
}

export function createMerchant(resumeWithNewRound = true, preview = false) {
  return {
    title: "寶至福臨",
    options: chooseMerchantOptions(),
    skipCost: MERCHANT_SKIP_COST,
    resumeWithNewRound,
    preview,
    selectedIndex: 1,
  };
}

export function canSkipMerchant(game) {
  return Boolean(game.merchant?.preview || game.player.treasure >= MERCHANT_SKIP_COST);
}

export function moveMerchantSelectionIndex(merchant, direction) {
  const count = merchant.options.length + 1;
  return (merchant.selectedIndex + direction + count) % count;
}

function chooseMerchantOptions() {
  return [...MERCHANT_OPTIONS]
    .sort(() => Math.random() - 0.5)
    .slice(0, MERCHANT_OPTION_COUNT);
}
