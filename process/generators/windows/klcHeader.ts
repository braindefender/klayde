/**
 * Шапка и подвал .klc (docs/04, разделы 2–3 и 6; docs/08 — klcHeader.ts).
 *
 * Шапка собирается из метаданных spec ([msklc], [main]); локаль —
 * из опциональных [msklc].locale_name / locale_id с дефолтами
 * en-US / 00000409 (docs/02, раздел 4).
 * SHIFTSTATE динамический: 0/1/2 всегда, 6 — только при непустом слое
 * altgr, 7 — только при непустом слое altgr_shift (в пустых слоях всё
 * равно лежали бы одни "-1"; правило по reference-раскладкам standard).
 * KEYNAME, KEYNAME_EXT — дословные константы: побайтово
 * идентичны во всех 6 эталонах universal-layout (проверено sha1).
 * DESCRIPTIONS — `<суффикс LOCALEID>\t<main.name>` (суффикс = последние
 * 4 символа locale_id, напр. 00000409 → 0409).
 * LANGUAGENAMES — `[msklc].language_names`, если задано, иначе fallback
 * на `main.name` (историческое LANGUAGENAMES = DESCRIPTIONS, docs/02, раздел 4).
 */

import type { ValidatedSpec } from "../../model/spec.ts";
import { altgrPresence } from "./klcLayout.ts";

export const KLC_LOCALEID = "00000409";
export const KLC_LOCALENAME = "en-US";
export const KLC_LOCALE_SUFFIX = "0409";
export const KLC_VERSION = "1.0";

/** Шапка KBD..VERSION (без завершающей пустой строки — её добавит сборщик). */
export function buildHeaderLines(spec: ValidatedSpec): string[] {
  const localeName = spec.msklc.localeName ?? KLC_LOCALENAME;
  const localeId = spec.msklc.localeId ?? KLC_LOCALEID;
  return [
    `KBD\t${spec.msklc.name}\t"${spec.msklc.description}"`,
    "",
    `COPYRIGHT\t"${spec.msklc.copyright}"`,
    "",
    `COMPANY\t"${spec.msklc.company}"`,
    "",
    `LOCALENAME\t"${localeName}"`,
    "",
    `LOCALEID\t"${localeId}"`,
    "",
    `VERSION\t${KLC_VERSION}`,
  ];
}

/** SHIFTSTATE для universal-эталонов (полные колонки 0/1/2/6/7). */
export const SHIFTSTATE_LINES: readonly string[] = [
  "SHIFTSTATE",
  "",
  "0\t//Column 4",
  "1\t//Column 5 : Shft",
  "2\t//Column 6 :       Ctrl",
  "6\t//Column 7 :       Ctrl Alt",
  "7\t//Column 8 : Shft  Ctrl Alt",
];

/** SHIFTSTATE под конкретную схему: 6/7 только при непустых altgr-слоях. */
export function buildShiftStateLines(spec: ValidatedSpec): string[] {
  const { hasAltgr, hasAltgrShift } = altgrPresence(spec);
  const lines = [
    "SHIFTSTATE",
    "",
    "0\t//Column 4",
    "1\t//Column 5 : Shft",
    "2\t//Column 6 :       Ctrl",
  ];
  if (hasAltgr) lines.push("6\t//Column 7 :       Ctrl Alt");
  if (hasAltgrShift) lines.push("7\t//Column 8 : Shft  Ctrl Alt");
  return lines;
}

/** KEYNAME — дословная константа (идентична в 6 эталонах). */
export const KEYNAME_LINES: readonly string[] = [
  "KEYNAME",
  "",
  "01\tEsc",
  "0e\tBackspace",
  "0f\tTab",
  "1c\tEnter",
  "1d\tCtrl",
  "2a\tShift",
  "36\t\"Right Shift\"",
  "37\t\"Num *\"",
  "38\tAlt",
  "39\tSpace",
  "3a\t\"Caps Lock\"",
  "3b\tF1",
  "3c\tF2",
  "3d\tF3",
  "3e\tF4",
  "3f\tF5",
  "40\tF6",
  "41\tF7",
  "42\tF8",
  "43\tF9",
  "44\tF10",
  "45\tPause",
  "46\t\"Scroll Lock\"",
  "47\t\"Num 7\"",
  "48\t\"Num 8\"",
  "49\t\"Num 9\"",
  "4a\t\"Num -\"",
  "4b\t\"Num 4\"",
  "4c\t\"Num 5\"",
  "4d\t\"Num 6\"",
  "4e\t\"Num +\"",
  "4f\t\"Num 1\"",
  "50\t\"Num 2\"",
  "51\t\"Num 3\"",
  "52\t\"Num 0\"",
  "53\t\"Num Del\"",
  "54\t\"Sys Req\"",
  "57\tF11",
  "58\tF12",
  "7c\tF13",
  "7d\tF14",
  "7e\tF15",
  "7f\tF16",
  "80\tF17",
  "81\tF18",
  "82\tF19",
  "83\tF20",
  "84\tF21",
  "85\tF22",
  "86\tF23",
  "87\tF24",
];

/** KEYNAME_EXT — дословная константа (идентична в 6 эталонах). */
export const KEYNAME_EXT_LINES: readonly string[] = [
  "KEYNAME_EXT",
  "",
  "1c\t\"Num Enter\"",
  "1d\t\"Right Ctrl\"",
  "35\t\"Num /\"",
  "37\t\"Prnt Scrn\"",
  "38\t\"Right Alt\"",
  "45\t\"Num Lock\"",
  "46\tBreak",
  "47\tHome",
  "48\tUp",
  "49\t\"Page Up\"",
  "4b\tLeft",
  "4d\tRight",
  "4f\tEnd",
  "50\tDown",
  "51\t\"Page Down\"",
  "52\tInsert",
  "53\tDelete",
  "54\t<00>",
  "56\tHelp",
  "5b\t\"Left Windows\"",
  "5c\t\"Right Windows\"",
  "5d\tApplication",
];

/**
 * Подвал DESCRIPTIONS..ENDKBD (без финальной пустой строки —
 * завершающий CRLF добавит сборщик через пустую строку).
 */
export function buildFooterLines(spec: ValidatedSpec): string[] {
  const localeId = spec.msklc.localeId ?? KLC_LOCALEID;
  const suffix = localeId.slice(-4);
  return [
    "DESCRIPTIONS",
    "",
    `${suffix}\t${spec.main.name}`,
    "",
    "LANGUAGENAMES",
    "",
    `${suffix}\t${spec.msklc.languageNames}`,
    "",
    "ENDKBD",
  ];
}
