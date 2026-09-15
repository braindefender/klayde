/**
 * Магические значения валидации схем (docs/02, docs/03).
 *
 * Здесь только данные без логики: порядок слоёв, геометрия сеток,
 * шаблоны имён, лимиты длин, зарезервированные имена. Вся проверка —
 * в validate.ts / parse.ts, чистые предикаты — в helpers.ts.
 */

import type { MsklcErrorCode } from "./report.ts";

/**
 * Слои сетки (docs/02, раздел 6; docs/03, V2/V5) — единый источник.
 * Это одновременно допустимые ключи [layout] (все обязательны,
 * отдельного списка отсутствия нет) и порядок их обхода при валидации.
 * LAYOUT_KEY_SET — то же множество для проверки «известный ли ключ».
 */
export const LAYOUT_KEYS = [
  "base",
  "base_shift",
  "altgr",
  "altgr_shift",
  "caps",
  "caps_shift",
] as const;
export type LayerName = (typeof LAYOUT_KEYS)[number];
export const LAYOUT_KEY_SET: ReadonlySet<string> = new Set(LAYOUT_KEYS);

/** Геометрия сетки слоя: строк × ячеек (docs/03, V5). */
export const GRID_ROWS = 5;
export const GRID_COLS = 10;

/** Короткий идентификатор: латиница/цифры без пробелов. */
export const SHORT_ID_RE = /^[A-Za-z0-9]+$/;
export const SHORT_ID_MIN_LENGTH = 1;
export const SHORT_ID_MAX_LENGTH = 8;

/** Длина [main].name в символах (docs/03, V3). */
export const MAIN_NAME_MIN_LENGTH = 1;
export const MAIN_NAME_MAX_LENGTH = 64;

/** Длина лигатуры в кодпоинтах: колонки Char0..Char3 KLC */
export const LIG_MIN_CODES = 2;
export const LIG_MAX_CODES = 4;

/** Имя лигатуры: [A-Za-z][A-Za-z0-9_]*, 1–32 символа */
export const LIG_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;

/** Управляющие/форматные/суррогатные категории + разделители строк/абзацев. */
export const CONTROL_RE = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;

/** Встроенные токены ячеек (строго по регистру, без @). */
export const BUILTIN_TOKENS = ["None", "Space", "Nbsp", "Trans"] as const;

/**
 * Имена, зарезервированные под встроенные токены: те же токены
 * в нижнем регистре (проверка в V4 case-insensitive через toLowerCase).
 */
export const RESERVED_LIG: ReadonlySet<string> = new Set(
  BUILTIN_TOKENS.map((t) => t.toLowerCase()),
);

/** Порог подсказки «возможно, имелось в виду» (расстояние Левенштейна). */
export const SUGGEST_MAX_DISTANCE = 2;

export const TRANS_PAIRS = [
  ["caps", "base"],
  ["caps_shift", "base_shift"],
] as const;

/** Текстовые поля [msklc] с кодами пустого значения (docs/03, V3). */
export const MSKLC_TEXT_FIELDS: readonly (readonly [string, MsklcErrorCode])[] = [
  ["company", "E_MSKLC_COMPANY"],
  ["copyright", "E_MSKLC_COPYRIGHT"],
  ["description", "E_MSKLC_DESCRIPTION"],
];

// --- V1–V2: структура TOML-документа (docs/03) ---

/** Секции, обязанные присутствовать. */
export const REQUIRED_SECTIONS = ["main", "msklc", "layout"] as const;
/** Секции, которые могут отсутствовать. */
export const OPTIONAL_SECTIONS = ["ligatures"] as const;

/** Допустимые ключи [main] / [msklc]. */
export const MAIN_KEYS = new Set(["name", "short_name"]);
export const MSKLC_KEYS = new Set([
  "name",
  "company",
  "copyright",
  "description",
]);
