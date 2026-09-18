/**
 * Позиционная таблица ortho-5x10-v1: ячейка TOML-сетки → клавиша Windows
 * (docs/05-position-map.md, каноническая таблица; docs/08 — positions.ts).
 *
 * Каждая ячейка (ряд, колонка 1-based) всегда соответствует одному
 * scancode/VK. Cap-зона и Ctrl-колонка берутся из таблицы, а не выводятся
 * из символов — единообразно для всех раскладок (Ctrl как в US: 001b/001c/
 * 001d на OEM_4/OEM_5/OEM_6/OEM_102; в RU-эталоне их нет — расхождение
 * принято как норма, таблица правит). Таблица версионирована: новая
 * геометрия = новая таблица, валидатор и генератор не меняются.
 *
 * CapLock доступен любым клавишам typing-блока (MSKLC это позволяет):
 * SGCap-зона стоит везде, где может оказаться буква — включая r5c2/r5c5/
 * r5c6/r5c8 (OEM_3/OEM_4/OEM_6/OEM_7: ё/х/ъ/э в RU). Отключается CapsLock
 * на не-буквах содержимым схемы: `@Trans` в caps/caps_shift даёт Cap 0.
 * Итого 34 `SGCap` + 16 `Cap0` (Cap0 — только служебные: SPACE, OEM_MINUS,
 * OEM_PLUS, OEM_5, OEM_102, DECIMAL).
 */

export type CapZone = "Cap0" | "SGCap";

export interface KeyPosition {
  /** 1-based ряд TOML-сетки. */
  row: number;
  /** 1-based колонка TOML-сетки. */
  col: number;
  /** Scancode, строчный hex без префикса (как в эталоне: "02", "0a"). */
  sc: string;
  /** Имя виртуального кода для колонки VK (как в эталоне: "Q", "OEM_3"). */
  vk: string;
  /** Cap-зона: "Cap0" без расширения, "SGCap" со строкой-расширением. */
  cap: CapZone;
  /** Ctrl-колонка (col2): "-1" либо константа ("001b", "001c", "001d", "0020"). */
  ctrl: string;
}

/** Версия таблицы (docs/08, раздел 7: новая геометрия = новая таблица). */
export const POSITION_TABLE_VERSION = "ortho-5x10-v1";

/** 50 записей в порядке сетки: r1c1 … r5c10. */
export const POSITIONS: readonly KeyPosition[] = [
  // Ряд 1 — цифровая строка, весь Cap0, Ctrl -1.
  { row: 1, col: 1, sc: "02", vk: "1", cap: "Cap0", ctrl: "-1" },
  { row: 1, col: 2, sc: "03", vk: "2", cap: "Cap0", ctrl: "-1" },
  { row: 1, col: 3, sc: "04", vk: "3", cap: "Cap0", ctrl: "-1" },
  { row: 1, col: 4, sc: "05", vk: "4", cap: "Cap0", ctrl: "-1" },
  { row: 1, col: 5, sc: "06", vk: "5", cap: "Cap0", ctrl: "-1" },
  { row: 1, col: 6, sc: "07", vk: "6", cap: "Cap0", ctrl: "-1" },
  { row: 1, col: 7, sc: "08", vk: "7", cap: "Cap0", ctrl: "-1" },
  { row: 1, col: 8, sc: "09", vk: "8", cap: "Cap0", ctrl: "-1" },
  { row: 1, col: 9, sc: "0a", vk: "9", cap: "Cap0", ctrl: "-1" },
  { row: 1, col: 10, sc: "0b", vk: "0", cap: "Cap0", ctrl: "-1" },
  // Ряд 2 — верхний буквенный, весь SG, Ctrl -1.
  { row: 2, col: 1, sc: "10", vk: "Q", cap: "SGCap", ctrl: "-1" },
  { row: 2, col: 2, sc: "11", vk: "W", cap: "SGCap", ctrl: "-1" },
  { row: 2, col: 3, sc: "12", vk: "E", cap: "SGCap", ctrl: "-1" },
  { row: 2, col: 4, sc: "13", vk: "R", cap: "SGCap", ctrl: "-1" },
  { row: 2, col: 5, sc: "14", vk: "T", cap: "SGCap", ctrl: "-1" },
  { row: 2, col: 6, sc: "15", vk: "Y", cap: "SGCap", ctrl: "-1" },
  { row: 2, col: 7, sc: "16", vk: "U", cap: "SGCap", ctrl: "-1" },
  { row: 2, col: 8, sc: "17", vk: "I", cap: "SGCap", ctrl: "-1" },
  { row: 2, col: 9, sc: "18", vk: "O", cap: "SGCap", ctrl: "-1" },
  { row: 2, col: 10, sc: "19", vk: "P", cap: "SGCap", ctrl: "-1" },
  // Ряд 3 — домашний, весь SG, Ctrl -1 (включая символьную r3c10).
  { row: 3, col: 1, sc: "1e", vk: "A", cap: "SGCap", ctrl: "-1" },
  { row: 3, col: 2, sc: "1f", vk: "S", cap: "SGCap", ctrl: "-1" },
  { row: 3, col: 3, sc: "20", vk: "D", cap: "SGCap", ctrl: "-1" },
  { row: 3, col: 4, sc: "21", vk: "F", cap: "SGCap", ctrl: "-1" },
  { row: 3, col: 5, sc: "22", vk: "G", cap: "SGCap", ctrl: "-1" },
  { row: 3, col: 6, sc: "23", vk: "H", cap: "SGCap", ctrl: "-1" },
  { row: 3, col: 7, sc: "24", vk: "J", cap: "SGCap", ctrl: "-1" },
  { row: 3, col: 8, sc: "25", vk: "K", cap: "SGCap", ctrl: "-1" },
  { row: 3, col: 9, sc: "26", vk: "L", cap: "SGCap", ctrl: "-1" },
  { row: 3, col: 10, sc: "27", vk: "OEM_1", cap: "SGCap", ctrl: "-1" },
  // Ряд 4 — нижний буквенный, весь SG, Ctrl -1.
  { row: 4, col: 1, sc: "2c", vk: "Z", cap: "SGCap", ctrl: "-1" },
  { row: 4, col: 2, sc: "2d", vk: "X", cap: "SGCap", ctrl: "-1" },
  { row: 4, col: 3, sc: "2e", vk: "C", cap: "SGCap", ctrl: "-1" },
  { row: 4, col: 4, sc: "2f", vk: "V", cap: "SGCap", ctrl: "-1" },
  { row: 4, col: 5, sc: "30", vk: "B", cap: "SGCap", ctrl: "-1" },
  { row: 4, col: 6, sc: "31", vk: "N", cap: "SGCap", ctrl: "-1" },
  { row: 4, col: 7, sc: "32", vk: "M", cap: "SGCap", ctrl: "-1" },
  { row: 4, col: 8, sc: "33", vk: "OEM_COMMA", cap: "SGCap", ctrl: "-1" },
  { row: 4, col: 9, sc: "34", vk: "OEM_PERIOD", cap: "SGCap", ctrl: "-1" },
  { row: 4, col: 10, sc: "35", vk: "OEM_2", cap: "SGCap", ctrl: "-1" },
  // Ряд 5 — нижний смешанный: Cap0 только на служебных, SGCap везде,
  // где может стоять буква (r5c2/r5c5/r5c6/r5c8: OEM_3/OEM_4/OEM_6/OEM_7).
  // Ctrl-колонка едина для всех раскладок (как в US-эталоне).
  { row: 5, col: 1, sc: "39", vk: "SPACE", cap: "Cap0", ctrl: "0020" },
  { row: 5, col: 2, sc: "29", vk: "OEM_3", cap: "SGCap", ctrl: "-1" },
  { row: 5, col: 3, sc: "0c", vk: "OEM_MINUS", cap: "Cap0", ctrl: "-1" },
  { row: 5, col: 4, sc: "0d", vk: "OEM_PLUS", cap: "Cap0", ctrl: "-1" },
  { row: 5, col: 5, sc: "1a", vk: "OEM_4", cap: "SGCap", ctrl: "001b" },
  { row: 5, col: 6, sc: "1b", vk: "OEM_6", cap: "SGCap", ctrl: "001d" },
  { row: 5, col: 7, sc: "2b", vk: "OEM_5", cap: "Cap0", ctrl: "001c" },
  { row: 5, col: 8, sc: "28", vk: "OEM_7", cap: "SGCap", ctrl: "-1" },
  { row: 5, col: 9, sc: "56", vk: "OEM_102", cap: "Cap0", ctrl: "001c" },
  { row: 5, col: 10, sc: "53", vk: "DECIMAL", cap: "Cap0", ctrl: "-1" },
];

/**
 * Порядок строк LAYOUT — по reference-раскладкам standard
 * (data/reference/windows): `27, 28, 29, 2b`, т.е. SC 28 (OEM_7)
 * между OEM_1 и OEM_3.
 * Внимание: `56` идёт перед `53`, хотя численно 0x53 < 0x56.
 * Позиция SC 28 в TOML-сетке не меняется (r5c8) — влияет только на output.
 */
export const LAYOUT_SC_ORDER: readonly string[] = [
  "02", "03", "04", "05", "06", "07", "08", "09", "0a", "0b", "0c", "0d",
  "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "1a", "1b",
  "1e", "1f", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "2b",
  "2c", "2d", "2e", "2f", "30", "31", "32", "33", "34", "35", "39", "56", "53",
];

/** Найти позицию по координатам сетки (1-based). */
export function positionAt(row: number, col: number): KeyPosition | undefined {
  return POSITIONS.find((p) => p.row === row && p.col === col);
}

/** Найти позицию по scancode (строчный hex). */
export function positionBySc(sc: string): KeyPosition | undefined {
  return POSITIONS.find((p) => p.sc === sc.toLowerCase());
}
