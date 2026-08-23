// Total board columns across normal and monster lanes.
export const BOARD_WIDTH = 6;

// Total board rows; also controls the visual board height.
export const BOARD_HEIGHT = 12;

// Player-controlled columns on the left side of the board.
export const NORMAL_COLUMNS = 4;

// Automatic monster columns on the right side of the board.
export const MONSTER_COLUMNS = 2;

// First monster column index, derived from the normal lane width.
export const MONSTER_START_X = NORMAL_COLUMNS;

// Milliseconds between automatic normal-piece drops.
export const DROP_MS = 800;

// Milliseconds used to visually move a normal piece from one grid slot to the next.
export const FALL_STEP_ANIMATION_MS = 180;

// Milliseconds between automatic monster-piece drops.
export const MONSTER_DROP_MS = 115;

// Milliseconds used to visually move a monster piece from one grid slot to the next.
export const MONSTER_FALL_STEP_ANIMATION_MS = 115;

// Milliseconds each encounter event stays visible before applying.
export const ENCOUNTER_STEP_MS = 380;

// Milliseconds to hold after a simple encounter effect applies.
export const ENCOUNTER_MINOR_EFFECT_WAIT_MS = 160;

// Milliseconds to pause on a focused bottom row before encounter resolution starts.
export const ENCOUNTER_INTRO_MS = 450;

// Milliseconds used for the encounter gate line to retreat after resolution.
export const ENCOUNTER_GATE_EXIT_MS = 360;

// Milliseconds used to animate settled board blocks falling into newly opened gaps.
export const BOARD_SETTLE_ANIMATION_MS = 180;

// Milliseconds floating glyph effects stay alive.
export const EFFECT_MS = 520;

// Milliseconds slash blade-line effects stay alive.
export const SLASH_BEAM_EFFECT_MS = 260;

// Milliseconds after the slash line starts before monster damage is revealed.
export const SLASH_DAMAGE_REVEAL_DELAY_MS = SLASH_BEAM_EFFECT_MS + 180;

// Milliseconds used for the red slain mark to fade onto a cut monster.
export const SLAY_MARK_FADE_MS = 180;

// Whether slain monsters can trigger 奪 loot rewards after slash damage.
export const SLASH_LOOT_ENABLED = false;

// Milliseconds to wait before showing 奪 after a monster slay effect starts.
export const LOOT_EFFECT_DELAY_MS = 260;

// Milliseconds to hold after a slay so 斬 and possible 奪 can read as one event.
export const ENCOUNTER_SLAY_EFFECT_WAIT_MS = EFFECT_MS + LOOT_EFFECT_DELAY_MS + 80;

// Milliseconds to hold after attack effects without loot.
export const ENCOUNTER_ATTACK_EFFECT_WAIT_MS = SLASH_DAMAGE_REVEAL_DELAY_MS + SLAY_MARK_FADE_MS + 120;

// Milliseconds stat-change glyphs travel before disappearing.
export const UI_EFFECT_MS = 520;

// Milliseconds before a traveling glyph applies its stat change.
export const UI_EFFECT_APPLY_MS = 420;

// Milliseconds between support glyph launches in the same encounter category.
export const UI_EFFECT_STAGGER_MS = 85;

// Milliseconds stat-shake effects stay visible.
export const UI_SHAKE_MS = 420;

// Milliseconds stat expansion effects stay visible.
export const UI_EXPAND_MS = 440;

// Milliseconds to hold after a stat-changing encounter block resolves.
export const ENCOUNTER_UI_EFFECT_WAIT_MS = UI_EFFECT_MS + 80;

// Milliseconds to hold after a monster attack resolves.
export const ENCOUNTER_DAMAGE_EFFECT_WAIT_MS = UI_SHAKE_MS + 80;

// Number of pregenerated rounds in a full run.
export const RUN_LENGTH = 80;

// Number of normal blocks generated each round.
export const NORMAL_BLOCKS_PER_ROUND = 2;

// Probability that a round has no monster blocks.
export const NO_MONSTER_ROUND_CHANCE = 0.45;

// Conditional probability for one monster after the no-monster roll fails.
export const ONE_MONSTER_AFTER_SPAWN_CHANCE = 0.75;

// Percentage chance for each normal block type; values should add up to 100.
export const NORMAL_BLOCK_PERCENTAGES = {
  B: 18,
  D: 6,
  L: 31,
  C: 5,
  T: 14,
  O: 12,
  E: 14,
};

// Percentage chance for each monster block type; values should add up to 100.
export const MONSTER_BLOCK_PERCENTAGES = {
  R: 55,
  M: 33,
  G: 12,
};

// Starting player health.
export const INITIAL_BODY = 3;

// Starting maximum player health.
export const INITIAL_MAX_BODY = 6;

// Starting sword-skill damage.
export const INITIAL_SWORD_SKILL = 1;

// Starting shop currency.
export const INITIAL_TREASURE = 0;

// Healing gained when 藥 resolves.
export const HEAL_BLOCK_BODY_GAIN = 1;

// Sword skill gained when 劍 resolves.
export const SWORD_BLOCK_SKILL_GAIN = 1;

// Curse damage added to the next surviving monster attack.
export const CURSE_BLOCK_DAMAGE_BONUS = 1;

// Treasure gained when 寶 resolves.
export const TREASURE_BLOCK_GAIN = 1;

// Multiplier applied by each 勢 block to later slashes in the encounter.
export const MOMENTUM_BLOCK_SLASH_MULTIPLIER = 2;

// Slash multiplier at the start of each encounter.
export const INITIAL_ENCOUNTER_SLASH_MULTIPLIER = 1;

// Curse bonus at the start of each encounter.
export const INITIAL_ENCOUNTER_CURSE_BONUS = 0;

// Temporary shield at the start of each encounter.
export const INITIAL_ENCOUNTER_SHIELD = 0;

// Temporary shield value of the 甲 block.
export const ARMOR_BLOCK_VALUE = 1;

// Monster health and damage value for 賊.
export const BANDIT_VALUE = 1;

// Monster health and damage value for 鬼.
export const GHOST_VALUE = 2;

// Monster health and damage value for 將.
export const GENERAL_VALUE = 3;

// Base chance that 奪 triggers when a monster is slain.
export const LOOT_CHANCE = 0.1;

// Additional 奪 chance gained from each 斬奪 blessing.
export const LOOT_CHANCE_BLESSING_BONUS = 0.1;

// Chance that triggered 奪 grants treasure instead of healing.
export const LOOT_TREASURE_CHANCE = 0.5;

// Treasure gained when 奪 grants treasure.
export const LOOT_TREASURE_GAIN = 1;

// Body gained when 奪 grants healing.
export const LOOT_BODY_GAIN = 1;

// 劍法 gained when buying 磨鋒.
export const SHARPEN_SWORD_SKILL_GAIN = 2;

// 根骨 gained when buying 鍊體.
export const TEMPER_BODY_MAX_BODY_GAIN = 2;

// 體魄 gained when buying 鍊體.
export const TEMPER_BODY_BODY_GAIN = 2;

// Extra 甲 value gained from 重甲.
export const HEAVY_ARMOR_BLOCK_BONUS = 1;

// Extra damage per 斬 when 連斬 sees more than one 斬 in an encounter.
export const CHAIN_SLASH_DAMAGE_PER_SLASH = 1;

// Treasure required to open the merchant after a round or encounter.
export const MERCHANT_THRESHOLD = 10;

// Treasure paid to skip the merchant without buying a boon.
export const MERCHANT_SKIP_COST = 5;

// Number of random blessings shown in each merchant visit.
export const MERCHANT_OPTION_COUNT = 3;
