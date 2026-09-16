/**
 * Кодирование кодпоинта в XKB-keysym (docs/09-linux-xkb.md, раздел 6).
 *
 * - ASCII-буквы/цифры — литерал (`a`, `Q`, `7`); `space`/`at` — встроенные;
 * - остальное — каноническое имя из `data/xkb-keysyms.json`
 *   (транскрибировано из `keysymdef.h`, строго первоперечисленные имена);
 * - безымянные — форма `UXXXX` (верхний hex, минимум 4 знака;
 *   astral — 5+ знаков, принимаются `xkbcomp` по построению).
 * Таблица — чистые данные без логики, подменяемые в тестах (docs/08, §3).
 */

import TABLE_JSON from "../../../data/xkb-keysyms.json";

export type XkbKeysymTable = Record<string, string>;

/** Таблица по умолчанию — data/xkb-keysyms.json (hex -> имя keysym). */
export const DEFAULT_XKB_KEYSYM_TABLE: XkbKeysymTable =
  TABLE_JSON as XkbKeysymTable;

function hexOf(codePoint: number): string {
  return codePoint.toString(16).padStart(4, "0");
}

/**
 * Кодпоинт → имя keysym для массива `symbols[]`.
 * Лигатуры сюда не попадают (fallback раньше, см. xkbLayout.ts).
 */
export function encodeKeysym(
  codePoint: number,
  table: XkbKeysymTable = DEFAULT_XKB_KEYSYM_TABLE,
): string {
  if (codePoint === 0x20) return "space";
  if (codePoint === 0x40) return "at";
  if (codePoint < 0x80) {
    const ch = String.fromCodePoint(codePoint);
    if (/^[A-Za-z0-9]$/.test(ch)) return ch;
  }
  const named = table[hexOf(codePoint).toLowerCase()];
  if (named !== undefined) return named;
  return `U${hexOf(codePoint).toUpperCase()}`;
}
