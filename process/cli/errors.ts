/**
 * Коды ошибок CLI/входов (фаза 1) и коды выхода процесса.
 *
 * Контракт: docs/01-cli.md (разделы 2–4), план: docs/08-architecture.md (фаза 1).
 * Формат печати: `error[E_CODE] сообщение` в stderr (см. docs/01, раздел 5).
 */

/** Стабильные коды ошибок фазы A (аргументы + входы). */
export type ErrorCode =
  | "E_OS_EMPTY"
  | "E_OS_UNKNOWN"
  | "E_NO_INPUTS"
  | "E_LAYOUT_NOT_FOUND"
  | "E_LAYOUT_EXTENSION"
  | "E_ARGS_UNKNOWN";

/** Коды выхода процесса (docs/01, раздел 4). */
export const EXIT_OK = 0;
/** Есть ошибки валидации схемы; генерация не выполнялась (фаза 2). */
export const EXIT_VALIDATION = 1;
/** Ошибка аргументов или входов (нечего валидировать). */
export const EXIT_ARGS = 2;
/** Внутренняя ошибка генерации/записи. */
export const EXIT_INTERNAL = 3;

/** Ошибка фазы A: всегда ведёт к выходу с кодом 2. */
export class CliError extends Error {
  readonly code: ErrorCode;
  readonly exitCode: number = EXIT_ARGS;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "CliError";
    this.code = code;
  }
}

/** Одна строка stderr для ошибки фазы A. */
export function formatCliError(err: CliError): string {
  return `error[${err.code}] ${err.message}`;
}
