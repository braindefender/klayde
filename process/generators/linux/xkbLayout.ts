/**
 * Тело `xkb_symbols`: строки `key` для групп Group1/Group2 (docs/09, §4–5, §7).
 *
 * - Group1 = [base, base_shift, altgr, altgr_shift];
 *   Group2 = [caps, caps_shift, altgr, altgr_shift] (дубли 3–4, как в
 *   `ulo_combo`: иначе переключение группы убило бы AltGr);
 * - лигатура → fallback: уровень опускается + `W_LINUX_LIGATURE_FALLBACK`
 *   на ячейку (XKB: одно нажатие — один keysym, раздел 5);
 * - `@None` в хвосте опускается, в середине/начале — `NoSymbol`;
 *   полностью пустая клавиша — `[ NoSymbol ]` (защита от наследования);
 * - типы — всегда явно на группу (`FOUR_LEVEL_ALPHABETIC` ряды 2–4,
 *   `FOUR_LEVEL` ряд 1/5), дефолтов нет;
 * - `trans` в матрицах невозможен (валидатор резолвит/отклоняет) —
 *   встреча → G_INTERNAL (defense in depth, как в klcLayout.ts).
 */

import type { CellValue, ValidatedSpec } from "../../model/spec.ts";
import {
  warnDiag,
  type Diagnostic,
  type ValidationWarningCode,
} from "../../validation/report.ts";
import { XKB_POSITIONS } from "./positions.ts";
import {
  DEFAULT_XKB_KEYSYM_TABLE,
  encodeKeysym,
  type XkbKeysymTable,
} from "./keysyms.ts";

/** Ошибка сборки XKB (defense in depth, ср. docs/06 раздел 6). */
export class XkbBuildError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "XkbBuildError";
    this.code = code;
  }
}

export const LINUX_LIGATURE_FALLBACK: ValidationWarningCode = "W_LINUX_LIGATURE_FALLBACK";

export interface XkbBuildResult {
  /** Строки `key …` в порядке таблицы (50 штук). */
  keyLines: string[];
  /** Предупреждения fallback'а (по одному на ячейку-лигатуру). */
  warnings: Diagnostic[];
}

/** Ячейка → keysym уровня (null = пустой уровень). */
function encodeLevel(
  value: CellValue,
  ctx: { file: string; layer: string; row: number; col: number },
  warnings: Diagnostic[],
  table: XkbKeysymTable,
): string | null {
  switch (value.kind) {
    case "none":
      return null;
    case "space":
      return encodeKeysym(0x20, table);
    case "nbsp":
      return encodeKeysym(0xa0, table);
    case "char":
      return encodeKeysym(value.codePoint, table);
    case "ligature": {
      warnings.push(
        warnDiag(
          LINUX_LIGATURE_FALLBACK,
          ctx.file,
          `[layout].${ctx.layer} строка ${ctx.row}, колонка ${ctx.col}: "@${value.name}" → fallback @None (XKB: одно нажатие — один keysym)`,
        ),
      );
      return null;
    }
    case "trans":
      throw new XkbBuildError(
        "G_INTERNAL",
        `@Trans достиг генератора без резолва (${ctx.layer} ${ctx.row},${ctx.col})`,
      );
  }
}

/** Обрезать хвостовые пустые; пусто всё → [NoSymbol]. */
function packLevels(levels: (string | null)[]): string[] {
  const out = [...levels];
  while (out.length > 0 && out[out.length - 1] === null) out.pop();
  if (out.length === 0) return ["NoSymbol"];
  return out.map((s) => (s === null ? "NoSymbol" : s));
}

function typeName(row: number): string {
  return row >= 2 && row <= 4 ? "FOUR_LEVEL_ALPHABETIC" : "FOUR_LEVEL";
}

export function buildXkbKeys(
  spec: ValidatedSpec,
  table: XkbKeysymTable = DEFAULT_XKB_KEYSYM_TABLE,
): XkbBuildResult {
  const warnings: Diagnostic[] = [];
  // Каждый слой кодируется один раз: предупреждения fallback'а —
  // ровно по одному на ячейку сетки (дубли Group2 их не повторяют).
  const enc = (layer: CellValue[][], layerName: string): (string | null)[][] =>
    layer.map((row, r) =>
      row.map((cell, c) =>
        encodeLevel(
          cell,
          { file: spec.file, layer: layerName, row: r + 1, col: c + 1 },
          warnings,
          table,
        ),
      ),
    );
  const base = enc(spec.layers.base, "base");
  const baseShift = enc(spec.layers.baseShift, "base_shift");
  const altgr = enc(spec.layers.altgr, "altgr");
  const altgrShift = enc(spec.layers.altgrShift, "altgr_shift");
  const caps = enc(spec.layers.caps, "caps");
  const capsShift = enc(spec.layers.capsShift, "caps_shift");

  const keyLines = XKB_POSITIONS.map((pos) => {
    const at = (matrix: (string | null)[][]): string | null =>
      (matrix[pos.row - 1] as (string | null)[])[pos.col - 1] as string | null;
    const g1 = [at(base), at(baseShift), at(altgr), at(altgrShift)];
    const g2 = [at(caps), at(capsShift), at(altgr), at(altgrShift)];
    const l1 = packLevels(g1);
    const l2 = packLevels(g2);
    const t = typeName(pos.row);
    return `key <${pos.code}> { type[Group1]="${t}", type[Group2]="${t}", symbols[Group1] = [ ${l1.join(", ")} ], symbols[Group2] = [ ${l2.join(", ")} ] };`;
  });

  // Defense in depth: ровно 50 строк, обе группы непусты.
  if (keyLines.length !== 50) {
    throw new XkbBuildError("G_INTERNAL", `ожидалось 50 строк key, получено ${keyLines.length}`);
  }
  return { keyLines, warnings };
}
