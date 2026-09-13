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

/**
 * Заглушка фазы 1: настоящего валидатора (V0–V9, фаза 2) ещё нет,
 * поэтому оркестратор помечает каждый обнаруженный файл как
 * «условно валидный» с пустыми слоями. Генераторы-заглушки фазы 1
 * всё равно отвечают `skip: not implemented` и не трогают слои,
 * так что пустые матрицы безопасны. Удалить при реализации фазы 2.
 */
export function createStubSpec(file: string): ValidatedSpec {
  const empty = (): CellValue[][] => [];
  return {
    file,
    main: { name: file, shortName: "" },
    msklc: { name: "", company: "", copyright: "", description: "" },
    layers: {
      base: empty(),
      baseShift: empty(),
      altgr: empty(),
      altgrShift: empty(),
      caps: null,
      capsShift: null,
    },
    capsIsShift: true,
    usedLigatures: new Map(),
  };
}
