import { BLOCK_TYPES, MONSTER_BLOCK_KEYS, NORMAL_BLOCK_KEYS } from "./blockTypes.js?v=20260821-10";
import {
  MONSTER_BLOCK_PERCENTAGES,
  NORMAL_BLOCKS_PER_ROUND,
  NORMAL_BLOCK_PERCENTAGES,
  NO_MONSTER_ROUND_CHANCE,
  ONE_MONSTER_AFTER_SPAWN_CHANCE,
  RUN_LENGTH,
} from "./config.js?v=20260821-40";

export function createRun(roundCount = RUN_LENGTH) {
  return {
    totalRounds: roundCount,
    currentRound: 0,
    rounds: Array.from({ length: roundCount }, createRound),
  };
}

export function getNextRound(run) {
  if (run.currentRound >= run.rounds.length) return null;

  const round = run.rounds[run.currentRound];
  run.currentRound += 1;
  return round;
}

export function peekUpcomingBlocks(run, count = 6) {
  return run.rounds.slice(run.currentRound).flat().slice(0, count);
}

function createRound() {
  const monsterCount = Math.random() < NO_MONSTER_ROUND_CHANCE ? 0 : Math.random() < ONE_MONSTER_AFTER_SPAWN_CHANCE ? 1 : 2;

  return [
    ...Array.from({ length: NORMAL_BLOCKS_PER_ROUND }, createNormalBlockTemplate),
    ...Array.from({ length: monsterCount }, createMonsterBlockTemplate),
  ];
}

function createNormalBlockTemplate() {
  const type = pickPercentageType(NORMAL_BLOCK_KEYS, NORMAL_BLOCK_PERCENTAGES);

  return {
    ...BLOCK_TYPES[type],
    type,
  };
}

function createMonsterBlockTemplate() {
  const type = pickPercentageType(MONSTER_BLOCK_KEYS, MONSTER_BLOCK_PERCENTAGES);

  return {
    ...BLOCK_TYPES[type],
    type,
  };
}

function pickPercentageType(types, percentages) {
  const totalPercentage = types.reduce((sum, type) => sum + Math.max(0, percentages[type] ?? 0), 0);
  if (Math.abs(totalPercentage - 100) > 0.001) {
    throw new Error(`Block percentages must add up to 100, received ${totalPercentage}.`);
  }

  let roll = Math.random() * 100;
  for (const type of types) {
    roll -= Math.max(0, percentages[type] ?? 0);
    if (roll < 0) return type;
  }

  return types[types.length - 1];
}
