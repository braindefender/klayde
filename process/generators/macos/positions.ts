/**
 * Позиционная таблица mac-5x10-v1: ячейка TOML-сетки → macOS keycode (ADB).
 * (docs/10-macos-keylayout.md, раздел 3.)
 *
 * Внимание: цифровой ряд не последователен: `5`→23, `6`→22 —
 * историческая ADB-причуда (сверено с upstream: код 22 несёт `6`,
 * код 23 — `5`). Таблица версионирована: новая геометрия = новая
 * таблица, валидатор и генератор не меняются.
 */

export interface MacKeyPosition {
  /** 1-based ряд TOML-сетки. */
  row: number;
  /** 1-based колонка TOML-сетки. */
  col: number;
  /** macOS virtual keycode (как в эталоне: 18, 40, 49). */
  code: number;
}

/** Версия таблицы (docs/08, раздел 7: новая геометрия = новая таблица). */
export const MAC_POSITION_TABLE_VERSION = "mac-5x10-v1";

/** 50 записей в порядке сетки: r1c1 … r5c10. */
export const MAC_POSITIONS: readonly MacKeyPosition[] = [
  // Ряд 1 — цифровой (5→23, 6→22!).
  { row: 1, col: 1, code: 18 }, { row: 1, col: 2, code: 19 },
  { row: 1, col: 3, code: 20 }, { row: 1, col: 4, code: 21 },
  { row: 1, col: 5, code: 23 }, { row: 1, col: 6, code: 22 },
  { row: 1, col: 7, code: 26 }, { row: 1, col: 8, code: 28 },
  { row: 1, col: 9, code: 25 }, { row: 1, col: 10, code: 29 },
  // Ряд 2 — верхний буквенный.
  { row: 2, col: 1, code: 12 }, { row: 2, col: 2, code: 13 },
  { row: 2, col: 3, code: 14 }, { row: 2, col: 4, code: 15 },
  { row: 2, col: 5, code: 17 }, { row: 2, col: 6, code: 16 },
  { row: 2, col: 7, code: 32 }, { row: 2, col: 8, code: 34 },
  { row: 2, col: 9, code: 31 }, { row: 2, col: 10, code: 35 },
  // Ряд 3 — домашний.
  { row: 3, col: 1, code: 0 }, { row: 3, col: 2, code: 1 },
  { row: 3, col: 3, code: 2 }, { row: 3, col: 4, code: 3 },
  { row: 3, col: 5, code: 5 }, { row: 3, col: 6, code: 4 },
  { row: 3, col: 7, code: 38 }, { row: 3, col: 8, code: 40 },
  { row: 3, col: 9, code: 37 }, { row: 3, col: 10, code: 41 },
  // Ряд 4 — нижний буквенный.
  { row: 4, col: 1, code: 6 }, { row: 4, col: 2, code: 7 },
  { row: 4, col: 3, code: 8 }, { row: 4, col: 4, code: 9 },
  { row: 4, col: 5, code: 11 }, { row: 4, col: 6, code: 45 },
  { row: 4, col: 7, code: 46 }, { row: 4, col: 8, code: 43 },
  { row: 4, col: 9, code: 47 }, { row: 4, col: 10, code: 44 },
  // Ряд 5 — нижний смешанный.
  { row: 5, col: 1, code: 49 }, { row: 5, col: 2, code: 50 },
  { row: 5, col: 3, code: 27 }, { row: 5, col: 4, code: 24 },
  { row: 5, col: 5, code: 33 }, { row: 5, col: 6, code: 30 },
  { row: 5, col: 7, code: 42 }, { row: 5, col: 8, code: 39 },
  { row: 5, col: 9, code: 10 }, { row: 5, col: 10, code: 65 },
];

/** Найти позицию по координатам сетки (1-based). */
export function macPositionAt(row: number, col: number): MacKeyPosition | undefined {
  return MAC_POSITIONS.find((p) => p.row === row && p.col === col);
}

/** Найти позицию по keycode. */
export function macPositionByCode(code: number): MacKeyPosition | undefined {
  return MAC_POSITIONS.find((p) => p.code === code);
}
