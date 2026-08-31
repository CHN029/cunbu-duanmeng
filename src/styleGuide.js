import { BLOCK_TYPES } from "./core/blockTypes.js?v=20260831-1";
import { getBlessingOptions, loadBlessings } from "./core/blessings.js?v=20260831-6";
import { CURSED_MONSTER_REVEAL_MS, INSTANT_SLASH_REVEAL_MS } from "./core/config.js?v=20260824-3";
import { createBlockStyleRenderer } from "./renderers/canvasRenderer.js?v=20260831-7";

const canvas = document.querySelector("#block-specimens");
const coloredCanvas = document.querySelector("#colored-block-specimens");
const blessingContainer = document.querySelector("#style-blessings");
const renderer = createBlockStyleRenderer(canvas);
const coloredRenderer = createBlockStyleRenderer(coloredCanvas);
const huiwenGlyphFamily = `"Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
const blocks = Object.entries(BLOCK_TYPES).map(([type, block]) => ({ type, ...block }));
const transformedMonster = { type: "R", ...BLOCK_TYPES.R, cursedMonster: true };
const instantSlash = { type: "L", ...BLOCK_TYPES.L, instantSlash: true };
const blessingTagLabelMap = new Map([
  ["磨鋒", "磨锋"],
  ["鍊體", "炼体"],
  ["斬奪", "斩夺"],
  ["連斬", "连斩"],
  ["兵庫", "兵库"],
  ["甲庫", "甲库"],
  ["藥圃", "药圃"],
  ["招財", "招财"],
  ["呪", "咒"],
  ["洞機", "动机"],
  ["懸賞", "悬赏"],
]);
const sampleGlyphColors = {
  B: "#445d17",
  L: "#941d3d",
  C: "#2f536c",
  T: "#825029",
  O: "#427367",
  E: "#465d83",
  R: "#222222",
  M: "#222222",
  G: "#222222",
};

await loadBlessings();
const blessingLabels = [...getBlessingOptions().map((blessing) => getBlessingTagDisplayLabel(blessing.label)), "咒"];

await Promise.all([
  document.fonts.load(`400 48px "Huiwen-Fangsong"`, "藥斬呪寶機甲獸賊兇鬼"),
  document.fonts.load(`400 48px "Lishu"`, blessingLabels.join("")),
]).catch(() => {});
renderBlessings();
document.body.classList.remove("fonts-loading");

function draw(time) {
  const hold = 600;
  const morph = CURSED_MONSTER_REVEAL_MS;
  const elapsed = time % (hold * 2 + morph * 2);
  const progress = elapsed < hold ? 0
    : elapsed < hold + morph ? (elapsed - hold) / morph
    : elapsed < hold * 2 + morph ? 1
    : 1 - (elapsed - hold * 2 - morph) / morph;

  transformedMonster.curseRevealFade = {
    elapsed: progress * CURSED_MONSTER_REVEAL_MS,
    duration: CURSED_MONSTER_REVEAL_MS,
  };
  instantSlash.instantRevealFade = {
    elapsed: progress * INSTANT_SLASH_REVEAL_MS,
    duration: INSTANT_SLASH_REVEAL_MS,
  };
  renderer.draw([...blocks, transformedMonster, instantSlash], 2, null, huiwenGlyphFamily);
  coloredRenderer.draw(
    [...blocks, transformedMonster, instantSlash],
    2,
    (block) => block.cursedMonster ? sampleGlyphColors.C : sampleGlyphColors[block.type],
    huiwenGlyphFamily,
  );
  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);

function renderBlessings() {
  blessingContainer.replaceChildren(
    ...blessingLabels.map((label, index) => {
      const tag = document.createElement("span");
      tag.className = `blessing-tag${label.startsWith("咒") ? " curse-tag" : ""}`;
      tag.textContent = label;
      tag.style.animationDelay = `${60 + index * 90}ms`;
      return tag;
    }),
  );
}

function getBlessingTagDisplayLabel(label) {
  return Array.from(blessingTagLabelMap.entries()).reduce(
    (text, [from, to]) => text.replaceAll(from, to),
    label,
  );
}
