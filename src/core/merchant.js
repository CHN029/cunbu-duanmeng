import { MERCHANT_OPTION_COUNT, MERCHANT_SKIP_COST, MERCHANT_THRESHOLD } from "./config.js?v=20260822-9";

export const MERCHANT_OPTIONS = [
  { id: "renewal", label: "回春", description: "體魄復滿", path: "general", category: "instant" },
  { id: "sharpen", label: "磨鋒", description: "劍法加二", path: "swordsman", category: "instant" },
  { id: "chainSlash", label: "連斬", description: "多斬增傷", path: "swordsman", category: "modifier" },
  { id: "temperBody", label: "鍊體", description: "根骨體魄加二", path: "ironBody", category: "instant" },
  { id: "heavyArmor", label: "重甲", description: "甲值加一", path: "ironBody", category: "modifier" },
  { id: "lootCraft", label: "斬奪", description: "奪率加一成", path: "general", category: "modifier" },
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
