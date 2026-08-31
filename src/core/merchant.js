import {
  MERCHANT_OPTION_COUNT,
  MERCHANT_SKIP_COST,
  MERCHANT_THRESHOLD,
} from "./config.js?v=20260831-2";
import { getEligibleBlessingOptions, isModifierBlessing } from "./blessings.js?v=20260831-5";

export { isModifierBlessing };

export function shouldOpenMerchant(game) {
  return !game.merchant && !game.active.normal && !game.active.monsters && game.player.treasure >= MERCHANT_THRESHOLD;
}

export function createMerchant(player, resumeWithNewRound = true, preview = false) {
  const options = chooseMerchantOptions(player);
  return {
    title: "寶至福臨",
    options,
    skipCost: MERCHANT_SKIP_COST,
    resumeWithNewRound,
    preview,
    selectedIndex: options.length ? Math.min(1, options.length - 1) : 0,
  };
}

export function canSkipMerchant(game) {
  return Boolean(game.merchant?.preview || game.player.treasure >= MERCHANT_SKIP_COST);
}

export function moveMerchantSelectionIndex(merchant, direction) {
  const count = merchant.options.length + 1;
  return (merchant.selectedIndex + direction + count) % count;
}

function chooseMerchantOptions(player) {
  return [...getEligibleBlessingOptions(player)]
    .sort(() => Math.random() - 0.5)
    .slice(0, MERCHANT_OPTION_COUNT);
}
