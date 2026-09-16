/**
 * Карты 0–5 из слоёв TOML (docs/10, разделы 4–5 и 7).
 *
 * - map 0 = base, 1 = base_shift, 2 = caps, 3 = caps_shift,
 *   4 = altgr, 5 = altgr_shift (слои caps/caps_shift обязательны,
 *   swap-логики нет: на macOS caps представляются напрямую);
 * - `@None` → `output=""`; лигатура → строка раскрытия как есть
 *   (многосимвольный вывод нативен, maxout покрывает длину);
 * - `@Trans` вне caps — G_INTERNAL (валидатор отклоняет E_CELL_AT);
 *   в caps валидатор уже раскрыл его в копии base/base_shift;
 * - каждая карта 0–5: наши 50 кодов + статический passthrough,
 *   сортировка по коду по возрастанию (как upstream).
 */

import type { CellValue, ValidatedSpec } from "../../model/spec.ts";
import { MAC_POSITIONS } from "./positions.ts";
import { PASSTHROUGH_ROWS } from "./keylayoutHeader.ts";

/** Ошибка сборки keylayout (defense in depth). */
export class KeylayoutBuildError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "KeylayoutBuildError";
    this.code = code;
  }
}

/** Сырое значение ячейки: пробелы — литералами, лигатура — строкой. */
export function encodeOutput(value: CellValue): string {
  switch (value.kind) {
    case "none":
      return "";
    case "space":
      return " ";
    case "nbsp":
      return " "; // U+00A0, см. тест encodeOutput
    case "char":
      return String.fromCodePoint(value.codePoint);
    case "ligature":
      return String.fromCodePoint(...value.codePoints);
    case "trans":
      throw new KeylayoutBuildError(
        "G_INTERNAL",
        "@Trans достиг генератора без резолва — валидатор обязан отклонить (E_CELL_AT) или раскрыть",
      );
  }
}

/**
 * Экранирование для XML-атрибута в двойных кавычках.
 * `"` встречается в сетках (base_shift r5c2), `&` — тоже (r4c8 base),
 * `<`/`>` — в altgr. Остальной Unicode — сырым UTF-8 (как upstream).
 */
export function escapeXmlAttr(raw: string): string {
  return raw.replace(/[\u0026\u003C\u003E\u0022\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return `&#x${(ch.codePointAt(0) as number).toString(16).toUpperCase().padStart(4, "0")};`;
    }
  });
}

/** Полный элемент <key> для кода и значения. */
export function buildKeyElement(code: number, value: CellValue): string {
  return `<key code="${code}" output="${escapeXmlAttr(encodeOutput(value))}"/>`;
}

function cellAt(layer: CellValue[][], row: number, col: number): CellValue {
  return (layer[row - 1] as CellValue[])[col - 1] as CellValue;
}

/**
 * Построить карты 0–5: по массиву полных строк `<key …/>` на карту
 * (наши 50 кодов + passthrough, сортировка по коду).
 */
export function buildKeyMaps(spec: ValidatedSpec): string[][] {
  const layers: CellValue[][][] = [
    spec.layers.base,
    spec.layers.baseShift,
    spec.layers.caps,
    spec.layers.capsShift,
    spec.layers.altgr,
    spec.layers.altgrShift,
  ];
  for (const [li, layer] of layers.entries()) {
    for (const row of layer) {
      for (const v of row) {
        if (v.kind === "trans") {
          throw new KeylayoutBuildError(
            "G_INTERNAL",
            `карта ${li}: @Trans без резолва (вне caps — E_CELL_AT, в caps — копия base)`,
          );
        }
      }
    }
  }
  return layers.map((layer) => {
    const rows = MAC_POSITIONS.map((pos) =>
      buildKeyElement(pos.code, cellAt(layer, pos.row, pos.col)),
    );
    const merged = [...rows, ...PASSTHROUGH_ROWS];
    merged.sort(
      (a, b) =>
        (Number(a.match(/code="(\d+)"/)?.[1]) as number) -
        (Number(b.match(/code="(\d+)"/)?.[1]) as number),
    );
    return merged;
  });
}

/** maxout: максимум UTF-16 единиц used-лигатур, минимум 1. */
export function computeMaxOut(spec: ValidatedSpec): number {
  let max = 1;
  for (const codePoints of spec.usedLigatures.values()) {
    const len = String.fromCodePoint(...codePoints).length;
    if (len > max) max = len;
  }
  return max;
}
