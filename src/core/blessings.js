import { MAX_SWORD_SKILL } from "./config.js?v=20260831-2";

const FALLBACK_BLESSINGS = [
  { id: "renewal", label: "回春", description: "體魄復滿", path: "general", category: "instant", effects: [{ type: "restoreBody" }] },
  { id: "sharpen", label: "磨鋒", description: "斬傷加一", path: "swordsman", category: "instant", effects: [{ type: "increaseSwordSkill", amount: 1 }] },
  { id: "chainSlash", label: "連斬", description: "多斬增傷", path: "swordsman", category: "modifier", effects: [{ type: "enableChainSlash" }] },
  { id: "temperBody", label: "鍊體", description: "根骨體魄加二", path: "ironBody", category: "instant", effects: [{ type: "increaseMaxBody", amount: 2 }, { type: "healBody", amount: 2 }] },
  { id: "heavyArmor", label: "重甲", description: "甲值加一", path: "ironBody", category: "modifier", effects: [{ type: "increaseArmorValueBonus", amount: 1 }] },
  { id: "lootCraft", label: "斬奪", description: "奪率加百分之十", path: "general", category: "modifier", effects: [{ type: "increaseLootChance", amount: 0.1 }] },
  { id: "arsenal", label: "兵庫", description: "斬較易出現", path: "general", category: "modifier", maxStacks: 1, effects: [{ type: "multiplyNormalBlockWeight", blockType: "L", multiplier: 1.25 }] },
  { id: "armoury", label: "甲庫", description: "甲較易出現", path: "ironBody", category: "modifier", maxStacks: 1, effects: [{ type: "multiplyNormalBlockWeight", blockType: "E", multiplier: 1.5 }] },
  { id: "herbGarden", label: "藥圃", description: "藥較易出現", path: "general", category: "modifier", maxStacks: 1, effects: [{ type: "multiplyNormalBlockWeight", blockType: "B", multiplier: 1.5 }] },
  { id: "fortune", label: "招財", description: "寶較易出現", path: "general", category: "modifier", maxStacks: 1, effects: [{ type: "multiplyNormalBlockWeight", blockType: "T", multiplier: 1.5 }] },
  { id: "summonCalamity", label: "招煞", description: "呪較易出現", path: "general", category: "modifier", maxStacks: 1, effects: [{ type: "multiplyNormalBlockWeight", blockType: "C", multiplier: 1.75 }] },
  { id: "seekOpenings", label: "洞機", description: "機較易出現", path: "swordsman", category: "modifier", maxStacks: 1, effects: [{ type: "multiplyNormalBlockWeight", blockType: "O", multiplier: 1.75 }] },
  { id: "bounty", label: "懸賞", description: "斬鬼多得一寶", path: "general", category: "modifier", maxStacks: 1, effects: [{ type: "increaseCursedMonsterTreasure", amount: 1 }] },
  { id: "banishEvil", label: "破邪", description: "遇鬼斬傷加一", path: "swordsman", category: "modifier", maxStacks: 1, effects: [{ type: "increaseSlashDamageInCursedEncounter", amount: 1 }] },
];

let blessings = FALLBACK_BLESSINGS;
const EFFECT_TYPES_WITH_AMOUNT = new Set([
  "increaseArmorValueBonus",
  "increaseCursedMonsterTreasure",
  "increaseLootChance",
  "increaseSlashDamageInCursedEncounter",
  "increaseMaxBody",
  "increaseSwordSkill",
  "healBody",
]);
const EFFECT_TYPES_WITHOUT_VALUE = new Set([
  "enableChainSlash",
  "restoreBody",
]);

export async function loadBlessings(url = new URL("../data/blessings.json", import.meta.url)) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load blessings: ${response.status}`);
    blessings = validateBlessings(await response.json());
  } catch (error) {
    console.warn("Using built-in blessings because the JSON catalogue could not be loaded.", error);
  }

  return blessings;
}

export function getBlessingOptions() {
  return blessings;
}

export function getBlessingById(id) {
  return blessings.find((blessing) => blessing.id === id) ?? null;
}

export function getEligibleBlessingOptions(player) {
  return blessings.filter((blessing) => canReceiveBlessing(player, blessing));
}

export function isModifierBlessing(blessing) {
  return blessing.category === "modifier";
}

export function canReceiveBlessing(player, blessing) {
  const maxStacks = blessing.maxStacks;
  if (!Number.isFinite(maxStacks)) return true;

  return getBlessingStackCount(player, blessing.id) < maxStacks;
}

export function applyBlessingEffects(game, blessing) {
  getBlessingEffects(blessing).forEach((effect) => {
    if (effect.type === "restoreBody") {
      game.player.body = game.player.maxBody;
    }

    if (effect.type === "increaseSwordSkill") {
      game.player.swordSkill = Math.min(MAX_SWORD_SKILL, game.player.swordSkill + getEffectAmount(effect));
    }

    if (effect.type === "increaseMaxBody") {
      game.player.maxBody += getEffectAmount(effect);
    }

    if (effect.type === "healBody") {
      game.player.body = Math.min(game.player.maxBody, game.player.body + getEffectAmount(effect));
    }

    if (effect.type === "increaseArmorValueBonus") {
      game.player.armorValueBonus += getEffectAmount(effect);
    }
  });
}

export function hasBlessingEffect(player, effectType) {
  return player.blessingIds.some((id) => getBlessingEffects(id).some((effect) => effect.type === effectType));
}

export function getStackedBlessingEffectTotal(player, effectType) {
  return player.blessingIds.reduce((total, id) => {
    return total + getBlessingEffects(id)
      .filter((effect) => effect.type === effectType)
      .reduce((sum, effect) => sum + getEffectAmount(effect), 0);
  }, 0);
}

export function getNormalBlockWeightMultiplier(player, blockType) {
  return player.blessingIds.reduce((multiplier, id) => {
    return multiplier * getBlessingEffects(id)
      .filter((effect) => effect.type === "multiplyNormalBlockWeight" && effect.blockType === blockType)
      .reduce((product, effect) => product * effect.multiplier, 1);
  }, 1);
}

function getBlessingStackCount(player, id) {
  return player.blessingIds.filter((blessingId) => blessingId === id).length;
}

function getBlessingEffects(blessingOrId) {
  const blessing = typeof blessingOrId === "string" ? getBlessingById(blessingOrId) : blessingOrId;
  return blessing?.effects ?? [];
}

function getEffectAmount(effect) {
  return Number(effect.amount ?? 0);
}

function validateBlessings(value) {
  if (!Array.isArray(value)) throw new Error("Blessing catalogue must be an array.");

  value.forEach((blessing) => {
    if (!blessing.id || !blessing.label || !blessing.category) {
      throw new Error("Every blessing needs id, label, and category.");
    }
    if (!Array.isArray(blessing.effects)) {
      throw new Error(`Blessing ${blessing.id} needs an effects array.`);
    }

    if (blessing.maxStacks !== undefined && (!Number.isInteger(blessing.maxStacks) || blessing.maxStacks < 1)) {
      throw new Error(`Blessing ${blessing.id} maxStacks must be a positive integer.`);
    }

    blessing.effects.forEach((effect) => validateBlessingEffect(blessing, effect));
  });

  return value;
}

function validateBlessingEffect(blessing, effect) {
  if (!effect.type) throw new Error(`Blessing ${blessing.id} has an effect without a type.`);

  if (!EFFECT_TYPES_WITH_AMOUNT.has(effect.type) && !EFFECT_TYPES_WITHOUT_VALUE.has(effect.type) && effect.type !== "multiplyNormalBlockWeight") {
    throw new Error(`Blessing ${blessing.id} has unsupported effect type ${effect.type}.`);
  }

  if (effect.type === "multiplyNormalBlockWeight") {
    if (!effect.blockType) throw new Error(`Blessing ${blessing.id} needs blockType for drop-weight effects.`);
    if (!Number.isFinite(effect.multiplier) || effect.multiplier <= 0) {
      throw new Error(`Blessing ${blessing.id} needs a positive finite multiplier.`);
    }
  }

  if (EFFECT_TYPES_WITH_AMOUNT.has(effect.type)) {
    if (!Number.isFinite(effect.amount) || effect.amount <= 0) {
      throw new Error(`Blessing ${blessing.id} needs a positive finite amount for ${effect.type}.`);
    }
  }
}
