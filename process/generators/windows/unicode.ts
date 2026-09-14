/**
 * Таблица Unicode + encodeCell() (docs/07, docs/06 раздел 2; docs/08 — unicode.ts).
 *
 * Прямое кодирование символа в hex таблице не требует:
 * hex вычисляется в рантайме. Таблица `data/unicode.json` (код ->
 * UPPER_ENGLISH_NAME) нужна только для имён в KLC-комментариях.
 * Таблица — чистые данные без логики, подменяемые в тестах (docs/08, §3):
 * все функции принимают таблицу параметром, дефолт — data/unicode.json.
 *
 * Правила (docs/07):
 * - поиск имени — по коду без учёта регистра; отсутствие — `<null>`;
 * - имена хранятся без звёздочки; генератор добавляет ` *` для кодов
 *   `00ab`/`00bb` (единственные случаи в эталонах);
 * - символы вне BMP (`codePoint > 0xFFFF`) непредставимы как одна колонка
 *   KLC (исторически UCS-2): encodeCell отвергает их ошибкой
 *   G_UNICODE_ASTRAL, чтобы не писать неверные суррогаты молча;
 * - встроенные токены обрабатываются раньше таблицы: @None → `-1`/`<none>`,
 *   @Space → `0020`/`SPACE`, @Nbsp → `00a0`/`NO-BREAK SPACE`.
 *   @Trans до генератора не доходит (валидатор резолвит в копию
 *   base/base_shift); встреча в encodeCell — внутренняя ошибка.
 */

import type { CellValue } from "../../model/spec.ts";
import DEFAULT_TABLE_JSON from "../../../data/unicode.json";

export type UnicodeTable = Record<string, string>;

/** Таблица по умолчанию — data/unicode.json (код -> UPPER_ENGLISH_NAME). */
export const DEFAULT_UNICODE_TABLE: UnicodeTable = DEFAULT_TABLE_JSON as UnicodeTable;

/** Коды, чей комментарий в эталонах несёт суффикс ` *` (docs/07, правило 2). */
export const STAR_SUFFIX_CODES: ReadonlySet<string> = new Set(["00ab", "00bb"]);

/** Ошибка генерации: символ вне BMP непредставим в колонке KLC. */
export class AstralCodeError extends Error {
  readonly code = "G_UNICODE_ASTRAL";
  readonly codePoint: number;

  constructor(codePoint: number) {
    super(
      `G_UNICODE_ASTRAL: U+${codePoint.toString(16).toUpperCase()} вне BMP — KLC хранит одну колонку как UCS-2`,
    );
    this.name = "AstralCodeError";
    this.codePoint = codePoint;
  }
}

/** Кодпоинт → строчный hex без префикса ("002d", "00ab", "2014"). */
export function hexOf(codePoint: number): string {
  return codePoint.toString(16).padStart(4, "0");
}

/** Имя символа по коду (без учёта регистра ключа); null, если нет в таблице. */
export function lookupName(table: UnicodeTable, codePoint: number): string | null {
  return table[hexOf(codePoint).toLowerCase()] ?? null;
}

/**
 * Имя для KLC-комментария: имя из таблицы (+ ` *` для 00ab/00bb)
 * либо `<null>` при отсутствии (как `₽` в эталоне).
 */
export function commentFor(table: UnicodeTable, codePoint: number): string {
  const name = lookupName(table, codePoint);
  if (name === null) return "<null>";
  const suffix = STAR_SUFFIX_CODES.has(hexOf(codePoint).toLowerCase()) ? " *" : "";
  return `${name}${suffix}`;
}

export interface EncodedCell {
  /** Текст колонки LAYOUT: "-1", "0020", "00a0", hex либо "%%". */
  text: string;
  /** Имя для комментария: "<none>", имя символа либо имена раскрытия. */
  comment: string;
}

/**
 * Закодировать одно значение ячейки в колонку LAYOUT (docs/06, раздел 2).
 * LigatureRef → `%%` (раскрытие уходит в секцию LIGATURE, фаза 4).
 * Бросает AstralCodeError (G_UNICODE_ASTRAL) для кодов вне BMP.
 */
export function encodeCell(
  value: CellValue,
  table: UnicodeTable = DEFAULT_UNICODE_TABLE,
): EncodedCell {
  switch (value.kind) {
    case "none":
      return { text: "-1", comment: "<none>" };
    case "space":
      return { text: "0020", comment: "SPACE" };
    case "nbsp":
      return { text: "00a0", comment: "NO-BREAK SPACE" };
    case "trans":
      throw new Error(
        "G_INTERNAL: @Trans достиг encodeCell без резолва — валидатор обязан раскрыть его в копию base/base_shift",
      );
    case "char": {
      if (value.codePoint > 0xffff) throw new AstralCodeError(value.codePoint);
      return { text: hexOf(value.codePoint), comment: commentFor(table, value.codePoint) };
    }
    case "ligature": {
      for (const cp of value.codePoints) {
        if (cp > 0xffff) throw new AstralCodeError(cp);
      }
      return {
        text: "%%",
        comment: value.codePoints.map((cp) => commentFor(table, cp)).join(" + "),
      };
    }
  }
}
