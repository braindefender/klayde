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

/** Короткий идентификатор: латиница/цифры, дефис только внутри (MSKLC принимает дефис, напр. EN-US). */
export const SHORT_ID_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,6}[A-Za-z0-9])?$/;
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

/** Дефолты опциональных [msklc].locale_name / locale_id (docs/02, раздел 4). */
export const MSKLC_LOCALE_NAME_DEFAULT = "en-US";
export const MSKLC_LOCALE_ID_DEFAULT = "00000409";

/** BCP47 вида en-US / ru-RU: 2–8 букв, затем дефис-группы. */
export const LOCALE_NAME_RE = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{2,8})*$/;
/** LOCALEID: ровно 8 hex-цифр (напр. 00000409, 00000419). */
export const LOCALE_ID_RE = /^[0-9a-fA-F]{8}$/;

/** Текстовые поля [msklc] с кодами пустого значения (docs/03, V3). */
export const MSKLC_TEXT_FIELDS: readonly (readonly [string, MsklcErrorCode])[] = [
  ["company", "E_MSKLC_COMPANY"],
  ["copyright", "E_MSKLC_COPYRIGHT"],
  ["description", "E_MSKLC_DESCRIPTION"],
  ["language_names", "E_MSKLC_LANGUAGE_NAMES"],
];

// --- V1–V2: структура TOML-документа (docs/03) ---

/** Секции, обязанные присутствовать. */
export const REQUIRED_SECTIONS = ["main", "msklc", "layout"] as const;
/** Секции, которые могут отсутствовать. */
export const OPTIONAL_SECTIONS = ["ligatures"] as const;

/** Допустимые ключи [main] / [msklc]. */
export const MAIN_KEYS = new Set(["name", "short_name", "caps_is_shift"]);
export const MSKLC_KEYS = new Set([
  "name",
  "company",
  "copyright",
  "description",
  "language_names",
  "locale_name",
  "locale_id",
]);
