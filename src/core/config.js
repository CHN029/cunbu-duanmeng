// --- Board and pacing ---

// Total board columns across normal and monster lanes.
export const BOARD_WIDTH = 6;

// Total board rows; also controls the visual board height.
export const BOARD_HEIGHT = 9;

// Player-controlled columns on the left side of the board.
export const NORMAL_COLUMNS = 4;

// Automatic monster columns on the right side of the board.
export const MONSTER_COLUMNS = 2;

// First monster column index, derived from the normal lane width.
export const MONSTER_START_X = NORMAL_COLUMNS;

// --- Presentation timing ---

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
export const SLASH_BEAM_EFFECT_MS = 240;

// Milliseconds a monster block shakes when crossed by a slash blade.
export const MONSTER_HIT_SHAKE_MS = 220;

// Milliseconds after the slash line starts before monster damage is revealed.
export const SLASH_DAMAGE_REVEAL_DELAY_MS = SLASH_BEAM_EFFECT_MS + 240;

// Milliseconds used for the red slain mark to fade onto a cut monster.
export const SLAY_MARK_FADE_MS = 420;

// Milliseconds used to reveal a Momentum-boosted Slash as 必殺.
export const INSTANT_SLASH_REVEAL_MS = 360;

// Milliseconds used to reveal a Cursed Monster as 鬼 after the curse arrives.
export const CURSED_MONSTER_REVEAL_MS = 360;

// Milliseconds to wait before showing 奪 after a monster slay effect starts.
export const LOOT_EFFECT_DELAY_MS = 260;

// Milliseconds to hold after a slay so 斬 and possible 奪 can read as one event.
export const ENCOUNTER_SLAY_EFFECT_WAIT_MS = EFFECT_MS + LOOT_EFFECT_DELAY_MS + 80;

// Milliseconds to hold after attack effects without loot.
export const ENCOUNTER_ATTACK_EFFECT_WAIT_MS = SLASH_DAMAGE_REVEAL_DELAY_MS + SLAY_MARK_FADE_MS + 120;

// Milliseconds stat-change glyphs travel before disappearing.
export const UI_EFFECT_MS = 520;

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

// --- Run generation and occurrence rates ---

// Number of pregenerated rounds in a full run.
export const RUN_LENGTH = 80;

// Number of normal blocks generated each round.
export const NORMAL_BLOCKS_PER_ROUND = 2;

// Number of future blocks shown to the player.
export const UPCOMING_BLOCK_PREVIEW_COUNT = 6;

// Percentage chance that a round contains 0, 1, or 2 monsters; values should add up to 100.
export const MONSTER_COUNT_PERCENTAGES = {
  0: 30,
  1: 50,
  2: 20,
};

// Percentage chance for each normal block type; values should add up to 100.
export const NORMAL_BLOCK_PERCENTAGES = {
  B: 12,
  L: 44,
  C: 9,
  T: 13,
  O: 8,
  E: 14,
};

// Percentage chance for each monster block type; values should add up to 100.
export const MONSTER_BLOCK_PERCENTAGES = {
  R: 45,
  M: 38,
  G: 17,
};

// Encounter counts that define the four difficulty phases.
export const ENCOUNTER_PHASES = [
  { phase: 1, minEncounter: 0, maxEncounter: 6 },
  { phase: 2, minEncounter: 7, maxEncounter: 14 },
  { phase: 3, minEncounter: 15, maxEncounter: 23 },
  { phase: 4, minEncounter: 24, maxEncounter: Infinity },
];

// Base monster-count table before phase pressure is applied.
export const MONSTER_COUNT_CURVE_BASE = {
  0: 40,
  1: 50,
  2: 10,
};

// Per-phase shift from empty monster rounds into double-monster rounds.
export const MONSTER_COUNT_DOUBLE_SHIFT_PER_PHASE = 10;

// Base monster-tier table before phase pressure is applied.
export const MONSTER_BLOCK_CURVE_BASE = {
  R: 60,
  M: 32,
  G: 8,
};

// Per-phase shift from weak monsters into stronger monsters.
export const MONSTER_BLOCK_STRONG_SHIFT_PER_PHASE = 8;

// Monster value bonus formula: min(maximum, max(0, phase - offset)).
export const MONSTER_VALUE_BONUS_PHASE_OFFSET = 2;

// Maximum value added to a monster by difficulty phases.
export const MAX_MONSTER_VALUE_BONUS = 1;

// --- Starting player stats ---

// Starting player health.
export const INITIAL_BODY = 3;

// Starting maximum player health.
export const INITIAL_MAX_BODY = 6;

// Starting bounded sword blessing bonus added to Slash damage.
export const INITIAL_SWORD_SKILL = 0;

// Starting shop currency.
export const INITIAL_TREASURE = 0;

// Pending Curse charges at the start of a run.
export const INITIAL_PENDING_CURSES = 0;

// Persistent bonus added to each Armor block at the start of a run.
export const INITIAL_ARMOR_VALUE_BONUS = 0;

// Persistent Guard at the start of a run.
export const INITIAL_GUARD = 0;

// --- Block and combat values ---

// Healing gained when 藥 resolves.
export const HEAL_BLOCK_BODY_GAIN = 1;

// Pending Curse charges gained when 呪 resolves.
export const CURSE_BLOCK_PENDING_GAIN = 1;

// Value added to the next monster that receives a pending Curse.
export const CURSED_MONSTER_VALUE_BONUS = 1;

// Treasure gained when a Cursed Monster is slain before it attacks.
export const CURSED_MONSTER_TREASURE_GAIN = 2;

// Treasure gained when 寶 resolves.
export const TREASURE_BLOCK_GAIN = 1;

// Intrinsic damage dealt by each ordinary 斬 before local or blessing bonuses.
export const SLASH_INTRINSIC_DAMAGE = 1;

// Maximum persistent Guard that can be banked.
export const MAX_GUARD = 6;

// Temporary shield value of the 甲 block.
export const ARMOR_BLOCK_VALUE = 1;

// Monster health and damage value for 獸.
export const BEAST_VALUE = 1;

// Monster health and damage value for 賊.
export const BANDIT_VALUE = 2;

// Monster health and damage value for 兇.
export const BRUTE_VALUE = 3;

// --- Blessing and loot values ---

// Whether slain monsters can trigger 奪 loot rewards after slash damage.
export const SLASH_LOOT_ENABLED = false;

// Base chance that 奪 triggers when a monster is slain.
export const LOOT_CHANCE = 0.1;

// Maximum total 奪 trigger chance after blessings.
export const MAX_LOOT_CHANCE = 1;

// Chance that triggered 奪 grants treasure instead of healing.
export const LOOT_TREASURE_CHANCE = 0.5;

// Treasure gained when 奪 grants treasure.
export const LOOT_TREASURE_GAIN = 1;

// Body gained when 奪 grants healing.
export const LOOT_BODY_GAIN = 1;

// Maximum Slash bonus from Sword blessings.
export const MAX_SWORD_SKILL = 2;

// Extra damage per 斬 when 連斬 sees more than one 斬 in an encounter.
export const CHAIN_SLASH_DAMAGE_PER_SLASH = 1;

// Number of 斬 required in one encounter to activate 連斬.
export const CHAIN_SLASH_MINIMUM_SLASHES = 2;

// Maximum local bonus from 連斬.
export const MAX_CHAIN_SLASH_BONUS = 1;

// --- Merchant values ---

// Treasure required to open the merchant after a round or encounter.
export const MERCHANT_THRESHOLD = 10;

// Treasure paid for a blessing. null preserves the current rule: spend all treasure.
export const MERCHANT_PURCHASE_COST = null;

// Treasure paid to skip the merchant without buying a boon.
export const MERCHANT_SKIP_COST = 5;

// Number of random blessings shown in each merchant visit.
export const MERCHANT_OPTION_COUNT = 3;
