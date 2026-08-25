import { ARMOR_BLOCK_VALUE, BANDIT_VALUE, BEAST_VALUE, BRUTE_VALUE } from "./config.js?v=20260824-3";

export const BLOCK_TYPES = {
  B: { label: "藥", name: "Medicine", lane: "normal" },
  D: { label: "劍", name: "Sword Skill", lane: "normal" },
  L: { label: "斬", name: "Slash", lane: "normal" },
  C: { label: "呪", name: "Curse", lane: "normal" },
  T: { label: "寶", name: "Treasure", lane: "normal" },
  O: { label: "機", name: "Opening", lane: "normal" },
  E: { label: "甲", name: "Shield", lane: "normal", value: ARMOR_BLOCK_VALUE },
  R: { label: "獸", name: "Beast", lane: "monster", value: BEAST_VALUE },
  M: { label: "賊", name: "Bandit", lane: "monster", value: BANDIT_VALUE },
  G: { label: "兇", name: "Brute", lane: "monster", value: BRUTE_VALUE },
};

export const BLOCK_TYPE_KEYS = Object.keys(BLOCK_TYPES);
export const NORMAL_BLOCK_KEYS = BLOCK_TYPE_KEYS.filter((type) => BLOCK_TYPES[type].lane === "normal");
export const MONSTER_BLOCK_KEYS = BLOCK_TYPE_KEYS.filter((type) => BLOCK_TYPES[type].lane === "monster");
