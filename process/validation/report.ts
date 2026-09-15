/**
 * Диагностика валидации: коды, формат, печать (docs/03, раздел 2).
 *
 * Формат — одна строка на диагностику:
 *   error[E_CODE] <файл> :: <сообщение>
 *   warn[W_CODE] <файл> :: <сообщение>
 * Координаты всегда внутри сообщения: для V0 — «строка L, колонка C»
 * файла, для сеток — «строка R, колонка C» TOML-сетки (1-based).
 * (В docs/03 пример V0 показан без `::`; здесь формат унифицирован,
 * чтобы код был стабильно грепабелен.)
 * Ошибки и предупреждения валидации печатаются в stderr (docs/01, раздел 5).
 */

/** Коды ошибок валидации одного файла (V0–V8) и кросс-проверки (V9). */
export type ValidationErrorCode =
  | "E_IO"
  | "E_QUOTES_TRIPLE_DOUBLE"
  | "E_TOML_SYNTAX"
  | "E_TOML_EMPTY"
  | "E_SCHEMA_UNKNOWN_KEY"
  | "E_SCHEMA_TYPE"
  | "E_MAIN_NAME"
  | "E_MAIN_SHORT_NAME"
  | "E_MSKLC_NAME"
  | "E_MSKLC_COMPANY"
  | "E_MSKLC_COPYRIGHT"
  | "E_MSKLC_DESCRIPTION"
  | "E_LIG_NAME"
  | "E_LIG_RESERVED"
  | "E_LIG_LENGTH"
  | "E_LIG_CONTROL"
  | "E_GRID_GEOMETRY"
  | "E_GRID_TAB"
  | "E_GRID_EMPTY_CELL"
  | "E_CELL_UNKNOWN_REF"
  | "E_CELL_LENGTH"
  | "E_CELL_CONTROL"
  | "E_CELL_AT"
  | "E_UNICODE"
  | "E_MSKLC_DUP_NAME";

/** Коды предупреждений (не блокируют генерацию). */
export type ValidationWarningCode =
  | "W_LIG_UNUSED"
  | "W_DUP_SHORT"
  | "W_DUP_NAME"
  // TODO (фаза 3): Doris/`unicode.json` — имя для KLC-комментария.
  | "W_UNICODE_NONAME";

export type ValidationCode = ValidationErrorCode | ValidationWarningCode;

export interface Diagnostic {
  severity: "error" | "warning";
  code: ValidationCode;
  file: string;
  message: string;
}

export function errorDiag(
  code: ValidationErrorCode,
  file: string,
  message: string,
): Diagnostic {
  return { severity: "error", code, file, message };
}

export function warnDiag(
  code: ValidationWarningCode,
  file: string,
  message: string,
): Diagnostic {
  return { severity: "warning", code, file, message };
}

/** Одна строка stderr для диагностики валидации. */
export function formatDiagnostic(d: Diagnostic): string {
  const tag = d.severity === "error" ? "error" : "warn";
  return `${tag}[${d.code}] ${d.file} :: ${d.message}`;
}

/** Печать всей диагностики в stderr (ошибки и предупреждения). */
export function printDiagnostics(diagnostics: Diagnostic[]): void {
  for (const d of diagnostics) {
    console.error(formatDiagnostic(d));
  }
}

export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}
