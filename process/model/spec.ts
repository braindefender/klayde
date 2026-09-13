/**
 * Каноническая внутренняя модель (эскиз из docs/08, раздел 2).
 *
 * Матрицы слоёв — всегда 5×10 после валидации (фаза 2).
 * Генератор не проверяет размеры.
 */

export type OsId = "windows" | "macos" | "linux";

export type CellValue =
  | { kind: "none" }
  | { kind: "space" }
  | { kind: "nbsp" }
  | { kind: "char"; codePoint: number }
  | { kind: "ligature"; name: string; codePoints: number[] };

export interface ValidatedSpec {
  file: string;
  main: { name: string; shortName: string };
  msklc: { name: string; company: string; copyright: string; description: string };
  layers: {
    base: CellValue[][];
    baseShift: CellValue[][];
    altgr: CellValue[][];
    altgrShift: CellValue[][];
    caps: CellValue[][] | null;
    capsShift: CellValue[][] | null;
  };
  capsIsShift: boolean;
  usedLigatures: Map<string, number[]>;
}
