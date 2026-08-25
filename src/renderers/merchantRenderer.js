import { toChineseNumber } from "../ui/chineseNumbers.js?v=20260821-1";
import { COLORS } from "../theme/colors.js?v=20260825-23";

export function drawMerchant(context, canvas, merchant) {
  const layout = getMerchantLayout(canvas, merchant.options.length);
  const scale = canvas.width / 300;

  context.save();
  context.fillStyle = COLORS.paper;
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawVerticalText(context, "福臨", layout.titleLeftX, canvas.height * 0.13, {
    color: COLORS.ink,
    fontSize: 38 * scale,
    weight: 500,
    lineGap: 5 * scale,
  });
  drawVerticalText(context, "寶至", layout.titleRightX, canvas.height * 0.13, {
    color: COLORS.ink,
    fontSize: 38 * scale,
    weight: 500,
    lineGap: 5 * scale,
  });

  merchant.options.forEach((option, index) => {
    drawMerchantChoice(context, layout.options[index].x, layout.optionLabelY, layout.optionDescriptionY, option.label, option.description, merchant.selectedIndex === index);
  });

  drawMerchantChoice(context, layout.skipX, layout.optionLabelY, layout.optionDescriptionY, "且過", `費寶 ${toChineseNumber(merchant.skipCost)}`, merchant.selectedIndex === merchant.options.length, true);
  context.restore();
}

function getMerchantLayout(canvas, optionCount) {
  const scale = canvas.width / 300;
  const titleGap = 34 * scale;
  const columnGap = 48 * scale;
  const skipGap = 64 * scale;
  const startX = canvas.width * 0.7;
  const options = Array.from({ length: optionCount }, (_, index) => ({ x: startX - index * columnGap }));

  return {
    titleLeftX: canvas.width / 2 - titleGap / 2,
    titleRightX: canvas.width / 2 + titleGap / 2,
    options,
    skipX: options[optionCount - 1].x - skipGap,
    optionLabelY: canvas.height * 0.36,
    optionDescriptionY: canvas.height * 0.58,
  };
}

function drawMerchantChoice(context, x, labelY, descriptionY, label, description, selected = false, compact = false) {
  const scale = context.canvas.width / 300;

  drawVerticalText(context, label, x, labelY, {
    color: selected ? COLORS.red : COLORS.glyph,
    fontSize: (compact ? 24 : 32) * scale,
    weight: compact ? 400 : 500,
    lineGap: 4 * scale,
  });

  drawVerticalText(context, description, x, descriptionY, {
    color: COLORS.muted,
    fontSize: (compact ? 14 : 16) * scale,
    weight: 400,
    lineGap: 3 * scale,
  });
}

function drawVerticalText(context, text, x, y, options) {
  const advance = options.fontSize + options.lineGap;

  context.fillStyle = options.color;
  context.font = `${options.weight} ${options.fontSize}px "Huiwen-Fangsong", "STFangsong", "Songti TC", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  Array.from(text).forEach((char, index) => {
    context.fillText(char, x, y + index * advance);
  });
}
