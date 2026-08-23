import { ARMOR_BLOCK_VALUE, BANDIT_VALUE, GENERAL_VALUE, GHOST_VALUE } from "./config.js?v=20260822-9";

export const BLOCK_TYPES = {
  B: { label: "藥", name: "Medicine", lane: "normal" },
  D: { label: "劍", name: "Sword Skill", lane: "normal" },
  L: { label: "斬", name: "Slash", lane: "normal" },
  C: { label: "咒", name: "Curse", lane: "normal" },
  T: { label: "寶", name: "Treasure", lane: "normal" },
  O: { label: "勢", name: "Momentum", lane: "normal" },
  E: { label: "甲", name: "Shield", lane: "normal", value: ARMOR_BLOCK_VALUE },
  R: { label: "賊", name: "Bandit", lane: "monster", value: BANDIT_VALUE },
  M: { label: "鬼", name: "Ghost", lane: "monster", value: GHOST_VALUE },
  G: { label: "將", name: "General", lane: "monster", value: GENERAL_VALUE },
};

export const BLOCK_TYPE_KEYS = Object.keys(BLOCK_TYPES);
export const NORMAL_BLOCK_KEYS = BLOCK_TYPE_KEYS.filter((type) => BLOCK_TYPES[type].lane === "normal");
export const MONSTER_BLOCK_KEYS = BLOCK_TYPE_KEYS.filter((type) => BLOCK_TYPES[type].lane === "monster");
