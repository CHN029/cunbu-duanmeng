import { MONSTER_COLUMNS, MONSTER_START_X, NORMAL_COLUMNS } from "./config.js?v=20260822-15";

export function createNormalPiece(blocks) {
  const startX = Math.floor((NORMAL_COLUMNS - blocks.length) / 2);

  return {
    blocks: blocks.map((block, index) => ({
      ...block,
      x: startX + index,
      y: -1,
    })),
  };
}

export function createMonsterPiece(blocks) {
  return {
    blocks: blocks.map((block, index) => ({
      ...block,
      value: block.value,
      x: MONSTER_START_X + (blocks.length === 1 ? Math.floor(Math.random() * MONSTER_COLUMNS) : index),
      y: -1,
    })),
  };
}
