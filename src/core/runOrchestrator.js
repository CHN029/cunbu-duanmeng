import { BLOCK_TYPES, MONSTER_BLOCK_KEYS, NORMAL_BLOCK_KEYS } from "./blockTypes.js?v=20260824-2";
import {
  ENCOUNTER_PHASES,
  MONSTER_BLOCK_CURVE_BASE,
  MONSTER_BLOCK_STRONG_SHIFT_PER_PHASE,
  MONSTER_COUNT_CURVE_BASE,
  MONSTER_COUNT_DOUBLE_SHIFT_PER_PHASE,
  MAX_MONSTER_VALUE_BONUS,
  MONSTER_VALUE_BONUS_PHASE_OFFSET,
  NORMAL_BLOCKS_PER_ROUND,
  NORMAL_BLOCK_PERCENTAGES,
  RUN_LENGTH,
  UPCOMING_BLOCK_PREVIEW_COUNT,
} from "./config.js?v=20260831-3";
import { getNormalBlockWeightMultiplier } from "./blessings.js?v=20260831-6";

export function createRun(roundCount = RUN_LENGTH) {
  return {
    totalRounds: roundCount,
    currentRound: 0,
    rounds: [],
  };
}

export function getNextRound(run, difficultyPhase = 1, player = null) {
  if (run.currentRound >= run.totalRounds) return null;
  ensureGeneratedRounds(run, run.currentRound + 1, difficultyPhase, player);

  const round = run.rounds[run.currentRound];
  run.currentRound += 1;
  return round;
}

export function peekUpcomingBlocks(run, count = UPCOMING_BLOCK_PREVIEW_COUNT, difficultyPhase = 1, player = null) {
  ensureGeneratedRounds(run, run.currentRound + Math.ceil(count / NORMAL_BLOCKS_PER_ROUND), difficultyPhase, player);
  return run.rounds.slice(run.currentRound).flat().slice(0, count);
}

export function getDifficultyPhase(completedEncounters = 0) {
  return ENCOUNTER_PHASES.find((phase) => completedEncounters >= phase.minEncounter && completedEncounters <= phase.maxEncounter)?.phase ?? 1;
}

export function getEffectiveNormalBlockPercentages(player = null) {
  if (!player?.blessingIds?.length) return { ...NORMAL_BLOCK_PERCENTAGES };

  const weights = NORMAL_BLOCK_KEYS.reduce((table, type) => {
    table[type] = Math.max(0, NORMAL_BLOCK_PERCENTAGES[type] ?? 0) * getNormalBlockWeightMultiplier(player ?? { blessingIds: [] }, type);
    return table;
  }, {});
  return normalizePercentages(weights);
}

function ensureGeneratedRounds(run, desiredCount, difficultyPhase, player) {
  const targetCount = Math.min(run.totalRounds, desiredCount);
  while (run.rounds.length < targetCount) {
    run.rounds.push(createRound(difficultyPhase, player));
  }
}

function createRound(difficultyPhase, player) {
  const monsterCountPercentages = getMonsterCountPercentages(difficultyPhase);
  const monsterCount = Number(pickPercentageType(Object.keys(MONSTER_COUNT_CURVE_BASE), monsterCountPercentages));

  return [
    ...Array.from({ length: NORMAL_BLOCKS_PER_ROUND }, () => createNormalBlockTemplate(player)),
    ...Array.from({ length: monsterCount }, () => createMonsterBlockTemplate(difficultyPhase)),
  ];
}

function createNormalBlockTemplate(player) {
  const type = pickPercentageType(NORMAL_BLOCK_KEYS, getEffectiveNormalBlockPercentages(player));

  return {
    ...BLOCK_TYPES[type],
    type,
  };
}

function createMonsterBlockTemplate(difficultyPhase) {
  const type = pickPercentageType(MONSTER_BLOCK_KEYS, getMonsterBlockPercentages(difficultyPhase));
  const valueBonus = getMonsterValueBonus(difficultyPhase);

  return {
    ...BLOCK_TYPES[type],
    type,
    value: BLOCK_TYPES[type].value + valueBonus,
  };
}

function getMonsterCountPercentages(difficultyPhase) {
  const pressure = getPhasePressure(difficultyPhase);
  const doubleShift = pressure * MONSTER_COUNT_DOUBLE_SHIFT_PER_PHASE;
  const empty = Math.max(5, MONSTER_COUNT_CURVE_BASE[0] - doubleShift);
  const double = MONSTER_COUNT_CURVE_BASE[2] + doubleShift;

  return {
    0: empty,
    1: 100 - empty - double,
    2: double,
  };
}

function getMonsterBlockPercentages(difficultyPhase) {
  const pressure = getPhasePressure(difficultyPhase);
  const strongShift = pressure * MONSTER_BLOCK_STRONG_SHIFT_PER_PHASE;
  const brute = MONSTER_BLOCK_CURVE_BASE.G + strongShift;
  const bandit = MONSTER_BLOCK_CURVE_BASE.M + Math.floor(strongShift / 2);

  return {
    R: 100 - bandit - brute,
    M: bandit,
    G: brute,
  };
}

function getMonsterValueBonus(difficultyPhase) {
  return Math.min(MAX_MONSTER_VALUE_BONUS, Math.max(0, difficultyPhase - MONSTER_VALUE_BONUS_PHASE_OFFSET));
}

function getPhasePressure(difficultyPhase) {
  return Math.max(0, difficultyPhase - 1);
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

function normalizePercentages(weights) {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error("At least one normal block weight must be positive.");

  return Object.fromEntries(
    Object.entries(weights).map(([type, weight]) => [type, (weight / total) * 100]),
  );
}
