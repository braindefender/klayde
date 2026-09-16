/**
 * Позиционная таблица xkb-5x10-v1: ячейка TOML-сетки → XKB-код
 * (docs/09-linux-xkb.md, раздел 3).
 *
 * Таблица версионирована: новая геометрия = новая таблица,
 * валидатор и генератор не меняются.
 */

export interface XkbKeyPosition {
  /** 1-based ряд TOML-сетки. */
  row: number;
  /** 1-based колонка TOML-сетки. */
  col: number;
  /** XKB-код клавиши (как в upstream: AE01, AC11, LSGT). */
  code: string;
}

/** Версия таблицы (docs/08, раздел 7: новая геометрия = новая таблица). */
export const XKB_POSITION_TABLE_VERSION = "xkb-5x10-v1";

/** 50 записей в порядке сетки: r1c1 … r5c10. */
export const XKB_POSITIONS: readonly XkbKeyPosition[] = [
  // Ряд 1 — цифровой.
  { row: 1, col: 1, code: "AE01" }, { row: 1, col: 2, code: "AE02" },
  { row: 1, col: 3, code: "AE03" }, { row: 1, col: 4, code: "AE04" },
  { row: 1, col: 5, code: "AE05" }, { row: 1, col: 6, code: "AE06" },
  { row: 1, col: 7, code: "AE07" }, { row: 1, col: 8, code: "AE08" },
  { row: 1, col: 9, code: "AE09" }, { row: 1, col: 10, code: "AE10" },
  // Ряд 2 — верхний буквенный.
  { row: 2, col: 1, code: "AD01" }, { row: 2, col: 2, code: "AD02" },
  { row: 2, col: 3, code: "AD03" }, { row: 2, col: 4, code: "AD04" },
  { row: 2, col: 5, code: "AD05" }, { row: 2, col: 6, code: "AD06" },
  { row: 2, col: 7, code: "AD07" }, { row: 2, col: 8, code: "AD08" },
  { row: 2, col: 9, code: "AD09" }, { row: 2, col: 10, code: "AD10" },
  // Ряд 3 — домашний.
  { row: 3, col: 1, code: "AC01" }, { row: 3, col: 2, code: "AC02" },
  { row: 3, col: 3, code: "AC03" }, { row: 3, col: 4, code: "AC04" },
  { row: 3, col: 5, code: "AC05" }, { row: 3, col: 6, code: "AC06" },
  { row: 3, col: 7, code: "AC07" }, { row: 3, col: 8, code: "AC08" },
  { row: 3, col: 9, code: "AC09" }, { row: 3, col: 10, code: "AC10" },
  // Ряд 4 — нижний буквенный.
  { row: 4, col: 1, code: "AB01" }, { row: 4, col: 2, code: "AB02" },
  { row: 4, col: 3, code: "AB03" }, { row: 4, col: 4, code: "AB04" },
  { row: 4, col: 5, code: "AB05" }, { row: 4, col: 6, code: "AB06" },
  { row: 4, col: 7, code: "AB07" }, { row: 4, col: 8, code: "AB08" },
  { row: 4, col: 9, code: "AB09" }, { row: 4, col: 10, code: "AB10" },
  // Ряд 5 — нижний смешанный.
  { row: 5, col: 1, code: "SPCE" }, { row: 5, col: 2, code: "TLDE" },
  { row: 5, col: 3, code: "AE11" }, { row: 5, col: 4, code: "AE12" },
  { row: 5, col: 5, code: "AD11" }, { row: 5, col: 6, code: "AD12" },
  { row: 5, col: 7, code: "BKSL" }, { row: 5, col: 8, code: "AC11" },
  { row: 5, col: 9, code: "LSGT" }, { row: 5, col: 10, code: "KPDL" },
];

/** Найти позицию по координатам сетки (1-based). */
export function xkbPositionAt(row: number, col: number): XkbKeyPosition | undefined {
  return XKB_POSITIONS.find((p) => p.row === row && p.col === col);
}

/** Найти позицию по XKB-коду. */
export function xkbPositionByCode(code: string): XkbKeyPosition | undefined {
  return XKB_POSITIONS.find((p) => p.code === code);
}
