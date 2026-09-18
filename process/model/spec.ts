/**
 * Каноническая внутренняя модель (эскиз из docs/08, раздел 2).
 *
 * Матрицы слоёв — всегда 5×10 после валидации (фаза 2).
 * Генератор не проверяет размеры.
 */

export type CellValue =
  | { kind: "none" }
  | { kind: "space" }
  | { kind: "nbsp" }
  | { kind: "trans" }
  | { kind: "char"; codePoint: number }
  | { kind: "ligature"; name: string; codePoints: number[] };

export interface ValidatedSpec {
  file: string;
  main: { name: string; shortName: string; capsIsShift: boolean };
  msklc: {
    name: string;
    company: string;
    copyright: string;
    description: string;
    languageNames: string;
    localeName: string;
    localeId: string;
  };
  macos: {
    bundleId: string;
    bundleName: string;
    bundleVersion: string;
    keyboardName: string;
    capslockLanguageSwitchCapable: boolean;
    iconIsTemplate: boolean;
    inputSourceId: string;
    intendedLanguage: string;
    buildVersion: string;
    projectName: string;
    sourceVersion: string;
    /** Сырое значение [macos].icon_path (путь к .icns относительно каталога схемы); undefined — иконки нет. */
    iconPath: string | undefined;
  };
  layers: {
    base: CellValue[][];
    baseShift: CellValue[][];
    altgr: CellValue[][];
    altgrShift: CellValue[][];
    caps: CellValue[][];
    capsShift: CellValue[][];
  };
  usedLigatures: Map<string, number[]>;
}
