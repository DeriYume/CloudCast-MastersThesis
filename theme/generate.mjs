#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const T = JSON.parse(readFileSync(join(ROOT, "theme", "colors.json"), "utf8"));
const logo = JSON.parse(readFileSync(join(ROOT, "theme", "logo.json"), "utf8"));

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const toRgb = (hex) => { const h = hex.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const toHex = (rgb) => "#" + rgb.map((c) => clamp(c).toString(16).padStart(2, "0")).join("").toUpperCase();
const mix = (a, b, r) => { const [ar, ag, ab] = toRgb(a); const [br, bg, bb] = toRgb(b); return toHex([ar + (br - ar) * r, ag + (bg - ag) * r, ab + (bb - ab) * r]); };
const darken = (hex, r) => mix(hex, "#000000", r);
const lighten = (hex, r) => mix(hex, "#FFFFFF", r);
const argb = (hex, alpha = 1) => { const a = clamp(alpha * 255).toString(16).padStart(2, "0"); return "0x" + (a + hex.replace("#", "")).toUpperCase(); };
const rgba = (hex, alpha) => `rgba(${toRgb(hex).join(",")},${alpha})`;

const { brand, palette, accents, extra, shadowInk, selectionAlpha, overlays } = T;

palette.dark.muted = palette.dark.muted ?? palette.dark.secondary;

extra.hatchDark1 = palette.dark.aiBg;

extra.hoverRowAlt = extra.dropOverlay.hex;

const derived = {
  successText: darken(accents.success, 0.16),
  successTextDark: lighten(accents.success, 0.10),
  successBgLight: mix(accents.success, palette.light.surface, 0.93),
  successBgDark: mix(accents.success, palette.dark.page, 0.85),
  warningBgLight: mix(accents.warning, palette.light.surface, 0.93),
  warningBgDark: mix(accents.warning, palette.dark.page, 0.85),
};

const cardShadow = (ink, alpha) => `0 1px 3px rgba(${ink.replace(/\s/g, "")},${alpha})`;
const DROP = rgba(extra.dropOverlay.hex, extra.dropOverlay.alpha);

const modeColors = (m, hoverKey, shadowAlpha) => {
  const p = palette[m];
  return {
    primary: brand.primary, primaryHover: brand[hoverKey], primaryTint: p.primaryTint,
    page: p.page, surface: p.surface, inputBg: p.inputBg, border: p.border, divider: p.border,
    inkHeading: p.inkHeading, strong: p.strong, body: p.body, secondary: p.secondary,
    muted: p.muted, faint: p.faint, navActiveBg: p.primaryTint,
    cardShadow: cardShadow(shadowInk[m], shadowAlpha),
    aiBorder: p.aiBorder, aiDivider: p.aiDivider, aiBg: p.aiBg, aiHeading: p.aiHeading,
    aiIcon: p.aiIcon, selectedBorder: p.selectedBorder,
    unreadRowBg: m === "light" ? extra.hoverRowAlt : rgba(brand.primary, overlays.unreadRowDark),
    rowHoverBg: m === "light" ? extra.hoverRow : rgba(brand.primary, overlays.rowHoverDark),
    dropVeil: m === "light" ? DROP : rgba(p.page, overlays.dropVeilDark),
    moveHoverBg: m === "light" ? p.inputBg : rgba("#FFFFFF", overlays.moveHoverDark),
  };
};

const COLORS = { light: modeColors("light", "primaryHoverLight", ".08"), dark: modeColors("dark", "primaryHoverDark", ".4") };

const ACCENTS = {
  success: accents.success, successText: derived.successText, successTextDark: derived.successTextDark,
  successBgLight: derived.successBgLight, successBgDark: derived.successBgDark,
  warning: accents.warning, warningBgLight: derived.warningBgLight, warningBgDark: derived.warningBgDark,
  favorite: accents.favorite, secondaryLight: palette.light.inkHeading, secondaryDark: palette.dark.accentOnDark,
  dangerBorderLight: extra.dangerBorder.light, dangerBorderDark: extra.dangerBorder.dark,
  aiMetaLight: extra.aiMeta.light, aiMetaDark: extra.aiMeta.dark,
};

const logoGeom = Object.fromEntries(Object.entries(logo).filter(([k]) => k !== "_comment"));

const L = logoGeom;

const n = (v) => Number(v.toFixed(3)).toString();

function cloudPath(scale = 1, dx = 0, dy = 0) {
  const X = (v) => n(v * scale + dx);
  const Y = (v) => n(v * scale + dy);
  const D = (v) => n(v * scale);
  const parts = L.puffs.map((p) =>
    `M${X(p.cx - p.r)},${Y(p.cy)}` +
    `a${D(p.r)},${D(p.r)} 0 1 1 ${D(p.r * 2)},0` +
    `a${D(p.r)},${D(p.r)} 0 1 1 ${D(-p.r * 2)},0z`,
  );
  const b = L.base;
  parts.push(
    `M${X(b.x)},${Y(b.y + b.r)}` +
    `a${D(b.r)},${D(b.r)} 0 0 1 ${D(b.r)},${D(-b.r)}` +
    `h${D(b.w - 2 * b.r)}` +
    `a${D(b.r)},${D(b.r)} 0 0 1 ${D(b.r)},${D(b.r)}` +
    `v${D(b.h - 2 * b.r)}` +
    `a${D(b.r)},${D(b.r)} 0 0 1 ${D(-b.r)},${D(b.r)}` +
    `h${D(-(b.w - 2 * b.r))}` +
    `a${D(b.r)},${D(b.r)} 0 0 1 ${D(-b.r)},${D(-b.r)}z`,
  );
  return parts.join(" ");
}

const MARK_PATH = cloudPath();
const LAUNCH = L.launcher;
const launchScale = LAUNCH.safe / L.unit;
const launchOffset = (LAUNCH.viewport - LAUNCH.safe) / 2;
const LAUNCH_PATH = cloudPath(launchScale, launchOffset, launchOffset);

const MARK_LIGHT = brand.primaryHoverLight;
const MARK_DARK = brand.primaryHoverDark;


const strKeys = Object.keys(modeColors("light", "primaryHoverLight", ".08"));
const iface =
  "export interface ModeColors {\n" + strKeys.map((k) => `  ${k}: string;`).join("\n") + "\n}\n\n" +
  "export interface ThemeColors extends ModeColors {\n" +
  `  accents: { ${Object.keys(ACCENTS).map((k) => `${k}: string`).join("; ")} };\n` +
  "  selectionTint: string;\n  selectionBorder: string;\n}\n";

const tsBody =
  "// AUTO-GENERATED by theme/generate.mjs from theme/colors.json - DO NOT EDIT.\n" +
  "// Run `npm run tokens` (or `node theme/generate.mjs`) to regenerate.\n\n" +
  iface + "\n" +
  `export const COLORS: Record<"light" | "dark", ModeColors> = ${JSON.stringify(COLORS, null, 2)};\n\n` +
  `export const ACCENTS = ${JSON.stringify(ACCENTS, null, 2)} as const;\n\n` +
  `export const SELECTION_TINT = "${rgba(brand.primary, selectionAlpha)}";\n` +
  `export const SELECTION_BORDER = "${brand.primary}";\n` +
  `export const PRIMARY = "${brand.primary}";\n` +
  `export const WARNING = "${accents.warning}";\n` +
  `export const SUCCESS = "${accents.success}";\n` +
  `export const FAVORITE = "${accents.favorite}";\n` +
  `export const STRONG = "${palette.light.strong}";\n` +
  `export const SECONDARY = "${palette.light.secondary}";\n` +
  `export const LOGO_DOT = "${brand.logoDot}";\n` +
  `export const GRADIENT_END = "${extra.gradientEnd}";\n` +
  `export const HOVER_ROW = "${extra.hoverRow}";\n` +
  `export const HOVER_ROW_ALT = "${extra.hoverRowAlt}";\n` +
  `export const DROP_OVERLAY = "${DROP}";\n` +
  `export const HATCH = ${JSON.stringify({ light1: extra.hatchLight1, light2: extra.hatchLight2, dark1: extra.hatchDark1, dark2: extra.hatchDark2 })} as const;\n` +
  `export const WHITE = "#FFFFFF";\n` +
  `export const BLACK = "#000000";\n` +
  `export const OVERLAY_PRIMARY_HOVER = "${rgba(brand.primary, overlays.primaryHover)}";\n` +
  `export const OVERLAY_PRIMARY_DRAG = "${rgba(brand.primary, overlays.primaryDragOver)}";\n` +
  `export const OVERLAY_WARNING_HOVER = "${rgba(accents.warning, overlays.warningHover)}";\n` +
  `export const ON_PRIMARY_BORDER = "${rgba("#FFFFFF", overlays.onPrimaryBorder)}";\n` +
  `export const SCRIM = "${rgba("#000000", overlays.scrim)}";\n` +
  `export const GLASS = "${rgba("#FFFFFF", overlays.glass)}";\n` +
  `export const SHADOW_INK = ${JSON.stringify(shadowInk)} as const;\n` +  `export const LOGO = ${JSON.stringify(logoGeom, null, 2)} as const;\n` +
  `export const LOGO_PATH = "${MARK_PATH}";\n` +
  `export const LOGO_MARK = ${JSON.stringify({ light: MARK_LIGHT, dark: MARK_DARK })} as const;\n`;

mkdirSync(join(ROOT, "web", "src", "theme"), { recursive: true });
writeFileSync(join(ROOT, "web", "src", "theme", "colors.generated.ts"), tsBody);

const c = (name, hex, alpha = 1) => `val ${name} = Color(${argb(hex, alpha)})`;
const ktBody =
  "// AUTO-GENERATED by theme/generate.mjs from theme/colors.json - DO NOT EDIT.\n" +
  "// Run `node theme/generate.mjs` (also runs as a Gradle preBuild task) to regenerate.\n\n" +
  "package com.cloudcast.app.ui.theme\n\n" +
  "import androidx.compose.ui.graphics.Color\n\n" +
  c("Purple", brand.primary) + "\n" +
  c("PurpleHover", brand.primaryHoverLight) + "\n" +
  c("AccentOnDark", palette.dark.accentOnDark) + "\n" +
  c("LogoDot", brand.logoDot) + "\n" +
  c("White", "#FFFFFF") + "\n" +
  c("Black", "#000000") + "\n" +
  c("DarkPlum", palette.light.inkHeading) + "\n" +
  c("Lavender", palette.light.page) + "\n" +
  c("SurfaceWhite", palette.light.surface) + "\n" +
  c("MutedText", palette.light.secondary) + "\n" +
  c("OutlineLight", palette.light.border) + "\n" +
  c("PrimaryContainerLight", palette.light.primaryTint) + "\n" +
  c("DarkBackground", palette.dark.page) + "\n" +
  c("DarkSurface", palette.dark.surface) + "\n" +
  c("DarkOnSurface", palette.dark.inkHeading) + "\n" +
  c("DarkSecondaryText", palette.dark.body) + "\n" +
  c("OutlineDark", palette.dark.border) + "\n" +
  c("PrimaryContainerDark", palette.dark.primaryTint) + "\n" +
  c("InputBgLight", palette.light.inputBg) + "\n" +
  c("StrongLight", palette.light.strong) + "\n" +
  c("BodyLight", palette.light.body) + "\n" +
  c("MutedLight", palette.light.muted) + "\n" +
  c("FaintLight", palette.light.faint) + "\n" +
  c("PurpleHoverDark", brand.primaryHoverDark) + "\n" +
  c("InputBgDark", palette.dark.inputBg) + "\n" +
  c("StrongDark", palette.dark.strong) + "\n" +
  c("SecondaryDark", palette.dark.secondary) + "\n" +
  c("FaintDark", palette.dark.faint) + "\n" +
  c("SuccessGreen", accents.success) + "\n" +
  c("SuccessGreenText", derived.successText) + "\n" +
  c("SuccessGreenTextDark", derived.successTextDark) + "\n" +
  c("SuccessGreenBg", derived.successBgLight) + "\n" +
  c("SuccessGreenBgDark", derived.successBgDark) + "\n" +
  c("ExpiryOrange", accents.warning) + "\n" +
  c("ExpiryOrangeBg", derived.warningBgLight) + "\n" +
  c("ExpiryOrangeBgDark", derived.warningBgDark) + "\n" +
  c("FavoriteAmber", accents.favorite) + "\n" +
  c("AiBorderLight", palette.light.aiBorder) + "\n" +
  c("AiBorderDark", palette.dark.aiBorder) + "\n" +
  c("AiDividerLight", palette.light.aiDivider) + "\n" +
  c("AiDividerDark", palette.dark.aiDivider) + "\n" +
  c("AiBgLight", palette.light.aiBg) + "\n" +
  c("AiBgDark", palette.dark.aiBg) + "\n" +
  c("AiHeadingLight", palette.light.aiHeading) + "\n" +
  c("AiHeadingDark", palette.dark.aiHeading) + "\n" +
  c("AiIconLight", palette.light.aiIcon) + "\n" +
  c("AiIconDark", palette.dark.aiIcon) + "\n" +
  c("SelectedBorderLight", palette.light.selectedBorder) + "\n" +
  c("SelectedBorderDark", palette.dark.selectedBorder) + "\n" +
  c("GradientEnd", extra.gradientEnd) + "\n" +
  c("AiMetaLight", extra.aiMeta.light) + "\n" +
  c("AiMetaDark", extra.aiMeta.dark) + "\n" +
  c("DangerBorderLight", extra.dangerBorder.light) + "\n" +
  c("DangerBorderDark", extra.dangerBorder.dark) + "\n" +
  c("HoverRow", extra.hoverRow) + "\n" +
  c("HoverRowAlt", extra.hoverRowAlt) + "\n" +
  c("DropOverlay", extra.dropOverlay.hex, extra.dropOverlay.alpha) + "\n" +
  c("HatchLight1", extra.hatchLight1) + "\n" +
  c("HatchLight2", extra.hatchLight2) + "\n" +
  c("HatchDark1", extra.hatchDark1) + "\n" +
  c("HatchDark2", extra.hatchDark2) + "\n" +
  c("OverlayPrimaryHover", brand.primary, overlays.primaryHover) + "\n" +
  c("OverlayPrimaryDragOver", brand.primary, overlays.primaryDragOver) + "\n" +
  c("OverlayWarningHover", accents.warning, overlays.warningHover) + "\n" +
  c("OnPrimaryBorder", "#FFFFFF", overlays.onPrimaryBorder) + "\n" +
  c("Scrim", "#000000", overlays.scrim) + "\n" +
  c("Glass", "#FFFFFF", overlays.glass) + "\n" +
  c("UnreadRowBg", extra.hoverRowAlt) + "\n" +
  c("UnreadRowBgDark", brand.primary, overlays.unreadRowDark) + "\n" +
  c("RowHoverBg", extra.hoverRow) + "\n" +
  c("RowHoverBgDark", brand.primary, overlays.rowHoverDark) + "\n" +
  c("DropVeil", extra.dropOverlay.hex, extra.dropOverlay.alpha) + "\n" +
  c("DropVeilDark", palette.dark.page, overlays.dropVeilDark) + "\n" +
  c("MoveHoverBg", palette.light.inputBg) + "\n" +
  c("MoveHoverBgDark", "#FFFFFF", overlays.moveHoverDark) + "\n" +
  c("SelectionTint", brand.primary, selectionAlpha) + "\n" +
  "val SelectionBorder = Purple\n" +
  c("SelectionBarBg", palette.light.primaryTint) + "\n";

const KT_THEME = join(ROOT, "app", "app", "src", "main", "java", "com", "cloudcast", "app", "ui", "theme");
mkdirSync(KT_THEME, { recursive: true });
writeFileSync(join(KT_THEME, "Color.kt"), ktBody);

const RES = join(ROOT, "app", "app", "src", "main", "res");
const windowBg = (hex) =>
  "<!-- AUTO-GENERATED by theme/generate.mjs from theme/colors.json - DO NOT EDIT. -->\n" +
  "<resources>\n" +
  `    <color name="window_background">${hex}</color>\n` +
  "</resources>\n";
mkdirSync(join(RES, "values"), { recursive: true });
mkdirSync(join(RES, "values-night"), { recursive: true });
writeFileSync(join(RES, "values", "colors.xml"), windowBg(palette.light.page));
writeFileSync(join(RES, "values-night", "colors.xml"), windowBg(palette.dark.page));
console.log("colors: generated res/values/colors.xml and res/values-night/colors.xml.");
console.log("colors: generated web/src/theme/colors.generated.ts and ui/theme/Color.kt.");

const vector = (viewport, body) =>
  "<!-- AUTO-GENERATED by theme/generate.mjs from theme/logo.json - DO NOT EDIT. -->\n" +
  `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n` +
  `    android:width="${viewport}dp" android:height="${viewport}dp"\n` +
  `    android:viewportWidth="${viewport}" android:viewportHeight="${viewport}">\n` +
  body +
  "</vector>\n";

const DRAWABLE = join(ROOT, "app", "app", "src", "main", "res", "drawable");
mkdirSync(DRAWABLE, { recursive: true });

writeFileSync(
  join(DRAWABLE, "logo_mark.xml"),
  vector(L.unit, `    <path android:fillColor="${brand.primary}" android:fillType="nonZero"\n        android:pathData="${MARK_PATH}" />\n`),
);

writeFileSync(
  join(DRAWABLE, "ic_launcher_foreground.xml"),
  vector(LAUNCH.viewport, `    <path android:fillColor="${brand.primary}" android:fillType="nonZero"\n        android:pathData="${LAUNCH_PATH}" />\n`),
);

writeFileSync(
  join(DRAWABLE, "ic_launcher_background.xml"),
  vector(LAUNCH.viewport, `    <path android:fillColor="${LAUNCH.background}"\n        android:pathData="M0,0h${LAUNCH.viewport}v${LAUNCH.viewport}h-${LAUNCH.viewport}z" />\n`),
);

const favicon =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.unit} ${L.unit}">\n` +
  `  <style>path{fill:${MARK_LIGHT}}@media(prefers-color-scheme:dark){path{fill:${MARK_DARK}}}</style>\n` +
  `  <path fill-rule="nonzero" d="${MARK_PATH}"/>\n` +
  `</svg>\n`;
mkdirSync(join(ROOT, "web", "public"), { recursive: true });
writeFileSync(join(ROOT, "web", "public", "favicon.svg"), favicon);

console.log("logo: generated logo_mark.xml, ic_launcher_foreground.xml, ic_launcher_background.xml, favicon.svg.");

const ICONS = JSON.parse(readFileSync(join(ROOT, "theme", "icons.json"), "utf8"));
const iconKeys = Object.keys(ICONS).filter((k) => k !== "_comment");

const iconsTs =
  "// AUTO-GENERATED by theme/generate.mjs from theme/icons.json - DO NOT EDIT.\n" +
  "// Run `npm run tokens` (or `node theme/generate.mjs`) to regenerate.\n\n" +
  `export const ICONS = {\n${iconKeys.map((k) => `  ${k}: "${ICONS[k]}",`).join("\n")}\n} as const;\n\n` +
  "export type IconName = keyof typeof ICONS;\n";
writeFileSync(join(ROOT, "web", "src", "theme", "icons.generated.ts"), iconsTs);

const kIcon = (k) => `    const val ${k} = "${ICONS[k]}"`;
const iconsKt =
  "// AUTO-GENERATED by theme/generate.mjs from theme/icons.json - DO NOT EDIT.\n" +
  "// Run `node theme/generate.mjs` (also runs as a Gradle preBuild task) to regenerate.\n\n" +
  "package com.cloudcast.app.ui.theme\n\n" +
  "object AppIcons {\n" +
  iconKeys.map(kIcon).join("\n") + "\n" +
  "}\n";
writeFileSync(join(ROOT, "app", "app", "src", "main", "java", "com", "cloudcast", "app", "ui", "theme", "AppIcons.kt"), iconsKt);
console.log("icons: generated web/src/theme/icons.generated.ts and ui/theme/AppIcons.kt.");
