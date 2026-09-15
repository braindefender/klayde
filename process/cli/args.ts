/**
 * Парсинг аргументов CLI (docs/01-cli.md, раздел 2).
 *
 * Поддерживаемые формы:
 *   --os=windows,macos  |  --os windows,macos
 *   --layout=a.toml     |  --layout a.toml      (повторяемый)
 *   --out=build         |  --out build
 *   --verbose           |  --verbose=true|false
 *   --help | -h
 *
 * Правила --os:
 * - запятая — разделитель,
 * - пробелы вокруг допустимы,
 * - регистр не важен,
 * - дубликаты игнорируются;
 * - отсутствие флага — все известные ОС;
 * - пустое значение — E_OS_EMPTY;
 * - неизвестное — E_OS_UNKNOWN.
 * Порядок ОС нормализуется к фиксированному
 * "windows,macos,linux" ради детерминизма логов.
 *
 * Пайплайн:
 *   1. collectRaw — линейный скан токенов в сырую структуру RawCli.
 *      Любая синтаксическая ошибка (неизвестный флаг, позиционный
 *      аргумент, отсутствие значения) сразу бросает CliError —
 *      дальше не идём.
 *   2. resolve* — проверка значений и подстановка дефолтов.
 *      Любая семантическая ошибка (пустой/неизвестный --os и т.п.)
 *      сразу бросает CliError.
 *   3. parseArgs собирает валидный CliOptions: после возврата
 *      структура гарантированно пригодна к использованию.
 */

import { isStringEmpty, normalize } from "../helpers";
import { isKnownOs, OS_LIST, type OS } from "../model";
import { DEFAULT_OUT_DIR, KNOWN_FLAGS, USAGE_HINT } from "./const.ts";
import { CliError } from "./errors.ts";
import { parseBooleanValue, readFlagValue, splitFlag } from "./helpers.ts";

export interface CliOptions {
  osList: OS[];
  /** Сырые значения --layout (резолвятся в discoverInputs). */
  layoutInputs: string[];
  outDir: string;
  verbose: boolean;
}

/** Сырой результат скана: значения как есть, без проверки содержимого. */
interface RawCli {
  osRaws: string[];
  layoutInputs: string[];
  outRaw: string | undefined;
  verboseRaw: string | undefined;
  hasVerbose: boolean;
}

// --- Стадия 1: скан ---

/** Линейный скан токенов в RawCli. Первая же ошибка — бросок, дальше не идём. */
function collectRaw(programArgs: string[]): RawCli {
  const raw: RawCli = {
    osRaws: [],
    layoutInputs: [],
    outRaw: undefined,
    verboseRaw: undefined,
    hasVerbose: false,
  };

  let i = 0;
  while (i < programArgs.length) {
    const token = programArgs[i] as string;
    const { head, inlineValue } = splitFlag(token);

    if (!head.startsWith("-")) {
      throw new CliError(
        "E_ARGS_UNKNOWN",
        `неизвестный аргумент "${token}". ${USAGE_HINT}`,
      );
    }
    if (!KNOWN_FLAGS.has(head)) {
      throw new CliError(
        "E_ARGS_UNKNOWN",
        `неизвестный флаг "${head}". ${USAGE_HINT}`,
      );
    }

    switch (head) {
      case "--os": {
        const { value, nextIndex } = readFlagValue(programArgs, i, inlineValue);
        i = nextIndex;
        if (value === undefined) {
          throw new CliError(
            "E_OS_EMPTY",
            `--os: отсутствует значение; укажите одну или несколько ОС: ${OS_LIST.join(", ")}`,
          );
        }
        raw.osRaws.push(value);
        break;
      }
      case "--layout": {
        const { value, nextIndex } = readFlagValue(programArgs, i, inlineValue);
        i = nextIndex;
        if (value === undefined || value.trim() === "") {
          throw new CliError(
            "E_ARGS_UNKNOWN",
            `--layout: отсутствует значение; укажите путь к .toml-файлу или каталогу. ${USAGE_HINT}`,
          );
        }
        raw.layoutInputs.push(value);
        break;
      }
      case "--out": {
        const { value, nextIndex } = readFlagValue(programArgs, i, inlineValue);
        i = nextIndex;
        if (isStringEmpty(value)) {
          throw new CliError(
            "E_ARGS_UNKNOWN",
            `--out: отсутствует значение; укажите каталог (по умолчанию: ${DEFAULT_OUT_DIR}). ${USAGE_HINT}`,
          );
        }
        raw.outRaw = value;
        break;
      }
      case "--verbose": {
        // --verbose значение через пробел не принимает: только инлайн
        // (`--verbose=false`); следующий токен не забираем.
        raw.hasVerbose = true;
        raw.verboseRaw = inlineValue;
        i += 1;
        break;
      }
      case "--help":
      case "-h": {
        // Обрабатывается в runCli до парсинга (hasHelpFlag);
        // здесь игнорируем, чтобы parseArgs оставалась чистой.
        i += 1;
        break;
      }
    }
  }

  return raw;
}

// --- Стадия 2: проверка значений + дефолты ---

/** Разобрать склеенные значения --os. Пусто/неизвестно — бросок. Чистая. */
function resolveOsList(osRaws: string[]): OS[] {
  if (osRaws.length === 0) return [...OS_LIST];
  return parseOsValueOrThrow(osRaws.join(","));
}

/** Разобрать одно значение --os (запятые, пробелы, регистр). Бросок при проблеме. Чистая. */
function parseOsValueOrThrow(raw: string | undefined): OS[] {
  if (isStringEmpty(raw)) {
    throw new CliError(
      "E_OS_EMPTY",
      `--os: пустое значение; укажите одну или несколько ОС: ${OS_LIST.join(", ")}`,
    );
  }

  const parts = (raw as string)
    .split(",")
    .map(normalize)
    .filter((p) => p.length > 0);

  if (parts.length === 0) {
    throw new CliError(
      "E_OS_EMPTY",
      `--os: пустое значение; укажите одну или несколько ОС: ${OS_LIST.join(", ")}`,
    );
  }
  const unknown = parts.filter((p) => !isKnownOs(p));
  if (unknown.length > 0) {
    throw new CliError(
      "E_OS_UNKNOWN",
      `--os: неизвестная ОС "${unknown.join(", ")}"; допустимые: ${OS_LIST.join(", ")}`,
    );
  }
  const deduped = [...new Set(parts as OS[])];
  deduped.sort((a, b) => OS_LIST.indexOf(a) - OS_LIST.indexOf(b));
  return deduped;
}

/** Дефолт выхода — DEFAULT_OUT_DIR. Чистая. */
function resolveOutDir(outRaw: string | undefined): string {
  return outRaw ?? DEFAULT_OUT_DIR;
}

/** Дефолт verbose — false; флаг без значения — true. Чистая. */
function resolveVerbose(raw: RawCli): boolean {
  if (!raw.hasVerbose) return false;
  return parseBooleanValue(raw.verboseRaw);
}

// --- Стадия 3: сборка ---

/**
 * Отделить аргументы программы от аргументов Bun.
 * Bun может как оставить `--` в argv, так и отрезать его, а пресеты
 * package.json (`bun run windows -- --layout=...`) дают вложенные `--`.
 * Поэтому правило простое и устойчивое: отбросить первые два элемента
 * (исполняемый файл + скрипт) и все одиночные `--`.
 */
export function extractProgramArgs(argv: string[]): string[] {
  return argv.slice(2).filter((a) => a !== "--");
}

/**
 * Пайплайн: скан → проверка + дефолты → валидный CliOptions.
 * Первая же ошибка бросает CliError; успешный возврат означает,
 * что структуру можно использовать без дополнительных проверок.
 */
export function parseArgs(programArgs: string[]): CliOptions {
  const raw = collectRaw(programArgs);
  return {
    osList: resolveOsList(raw.osRaws),
    layoutInputs: raw.layoutInputs,
    outDir: resolveOutDir(raw.outRaw),
    verbose: resolveVerbose(raw),
  };
}

export function hasHelpFlag(programArgs: string[]): boolean {
  return programArgs.some((a) => {
    const { head } = splitFlag(a);
    return head === "--help" || head === "-h";
  });
}
