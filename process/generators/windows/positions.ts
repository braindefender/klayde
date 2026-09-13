/**
 * Позиционная таблица ortho-5x10-v1: ячейка TOML-сетки → клавиша Windows
 * (docs/05-position-map.md, каноническая таблица; docs/08 — positions.ts).
 *
 * Каждая ячейка (ряд, колонка 1-based) всегда соответствует одному
 * scancode/VK. Cap-зона и Ctrl-колонка берутся из таблицы, а не выводятся
 * из символов. Таблица версионирована: новая геометрия = новая таблица,
 * валидатор и генератор не меняются.
 *
 * Примечание по `r5c8` (SC 28, OEM_7): docs/05:91 приписывает ей зону `SG`,
 * а заголовок ряда 5 (docs/05:81) гласит «весь `Cap0`». `r5c8` — обычная
 * клавиша typing-блока, поэтому здесь `SGCap` (как у всего основного блока);
 * итого 31 `SGCap`-расширение, а не 30 из docs/04/docs/06 (те считают только
 * ряды 2–4). Golden-тест фазы 4 сверит с эталоном окончательно.
 * (Опечатка `VK_OEM_7` в docs/05:91 прочитана как `VK OEM_7`.)
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
  // Ряд 5 — нижний смешанный: весь Cap0, кроме r5c8 (SGCap — обычная
  // клавиша typing-блока, см. примечание выше).
  { row: 5, col: 1, sc: "39", vk: "SPACE", cap: "Cap0", ctrl: "0020" },
  { row: 5, col: 2, sc: "29", vk: "OEM_3", cap: "Cap0", ctrl: "-1" },
  { row: 5, col: 3, sc: "0c", vk: "OEM_MINUS", cap: "Cap0", ctrl: "-1" },
  { row: 5, col: 4, sc: "0d", vk: "OEM_PLUS", cap: "Cap0", ctrl: "-1" },
  { row: 5, col: 5, sc: "1a", vk: "OEM_4", cap: "Cap0", ctrl: "001b" },
  { row: 5, col: 6, sc: "1b", vk: "OEM_6", cap: "Cap0", ctrl: "001d" },
  { row: 5, col: 7, sc: "2b", vk: "OEM_5", cap: "Cap0", ctrl: "001c" },
  { row: 5, col: 8, sc: "28", vk: "OEM_7", cap: "SGCap", ctrl: "-1" },
  { row: 5, col: 9, sc: "56", vk: "OEM_102", cap: "Cap0", ctrl: "001c" },
  { row: 5, col: 10, sc: "53", vk: "DECIMAL", cap: "Cap0", ctrl: "-1" },
];

/**
 * Порядок строк LAYOUT — дословно из эталона (docs/05, раздел 3).
 * Внимание: `56` идёт перед `53`, хотя численно 0x53 < 0x56.
 */
export const LAYOUT_SC_ORDER: readonly string[] = [
  "02", "03", "04", "05", "06", "07", "08", "09", "0a", "0b", "0c", "0d",
  "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "1a", "1b",
  "1e", "1f", "20", "21", "22", "23", "24", "25", "26", "27", "29", "2b", "28",
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
