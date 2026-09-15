/**
 * Чистые утилиты валидации без зависимости от файлов и диагностики.
 *
 * Общее (isRecord, describeType), проверки строк (isLengthIn, isShortId),
 * разбор сеток и ячеек (splitGrid, parseCell, cloneCell), нечёткий поиск
 * (levenshtein, suggestLigature), проверка Unicode (checkScalarValue).
 * Все функции детерминированы и тестируемы изолированно.
 */

import type { CellValue } from "../model/spec.ts";
import {
  CONTROL_RE,
  SHORT_ID_MAX_LENGTH,
  SHORT_ID_MIN_LENGTH,
  SHORT_ID_RE,
  SUGGEST_MAX_DISTANCE,
} from "./const.ts";
import type { UnicodeErrorCode } from "./report.ts";

/** TOML-таблица (объект без массива/null). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Человекочитаемое имя TOML-типа для E_SCHEMA_TYPE. */
export function describeType(value: unknown): string {
  if (Array.isArray(value)) return "массив";
  if (value === null) return "null";
  if (typeof value === "object") return "таблица";
  return typeof value;
}

export function isLengthIn(value: string, min: number, max: number): boolean {
  const len = Array.from(value).length;
  return len >= min && len <= max;
}

export function isShortId(value: string): boolean {
  return (
    value.length >= SHORT_ID_MIN_LENGTH &&
    value.length <= SHORT_ID_MAX_LENGTH &&
    SHORT_ID_RE.test(value)
  );
}

/** Нормализовать CRLF, отбросить ведущую/конечную пустые строки. */
export function splitGrid(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  while (lines.length > 0 && (lines[0] as string).trim() === "") lines.shift();
  while (lines.length > 0 && (lines[lines.length - 1] as string).trim() === "") lines.pop();
  return lines;
}

/** Глубокая копия ячейки (для резолва @Trans; у лигатур свой массив кодов). */
export function cloneCell(cell: CellValue): CellValue {
  switch (cell.kind) {
    case "none":
    case "space":
    case "nbsp":
    case "trans":
      return { kind: cell.kind };
    case "char":
      return { kind: "char", codePoint: cell.codePoint };
    case "ligature":
      return { kind: "ligature", name: cell.name, codePoints: [...cell.codePoints] };
  }
}

export type CellParse =
  | { value: CellValue; usedLig?: string; error?: undefined }
  | { value?: undefined; usedLig?: undefined; error: "unknown-ref" | "length" | "control" | "at" };

/** Разобрать одну ячейку (чистая функция; координаты добавляет вызывающий).
 * `@Trans` возвращается как есть; допустимость слоя (только caps/caps_shift)
 * и резолв в копию base/base_shift — в validateLayer/resolveTransCells.
 */
export function parseCell(raw: string, ligMap: Map<string, number[]>): CellParse {
  const cell = raw.trim();
  if (cell === "@None") return { value: { kind: "none" } };
  if (cell === "@Space") return { value: { kind: "space" } };
  if (cell === "@Nbsp") return { value: { kind: "nbsp" } };
  if (cell === "@Trans") return { value: { kind: "trans" } };
  if (cell === "@") return { value: { kind: "char", codePoint: 0x40 } };
  if (cell.startsWith("@")) {
    if (/^@[A-Za-z][A-Za-z0-9_]*$/.test(cell)) {
      const name = cell.slice(1);
      const codePoints = ligMap.get(name);
      if (codePoints === undefined) return { error: "unknown-ref" };
      return { value: { kind: "ligature", name, codePoints: [...codePoints] }, usedLig: name };
    }
    return { error: "at" };
  }
  const chars = Array.from(cell);
  if (chars.length > 1) return { error: "length" };
  if (chars.length === 1 && CONTROL_RE.test(cell)) return { error: "control" };
  return { value: { kind: "char", codePoint: (chars[0] as string).codePointAt(0) as number } };
}

/** Ближайшее имя при расстоянии Левенштейна ≤ SUGGEST_MAX_DISTANCE, иначе null. */
export function suggestLigature(want: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const cand of candidates) {
    const d = levenshtein(want, cand);
    if (d < bestDist) {
      bestDist = d;
      best = cand;
    }
  }
  return bestDist <= SUGGEST_MAX_DISTANCE && best !== null ? best : null;
}

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] as number;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j] as number;
      prev[j] = Math.min(
        (prev[j] as number) + 1,
        (prev[j - 1] as number) + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = temp;
    }
  }
  return prev[b.length] as number;
}

/** Проверить, что кодпоинт — Unicode scalar value. */
export function checkScalarValue(codePoint: number): UnicodeErrorCode | null {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return "E_UNICODE";
  }
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return "E_UNICODE";
  return null;
}
