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
 * Правила --os: запятая — разделитель, пробелы вокруг допустимы,
 * регистр не важен, дубликаты игнорируются; отсутствие флага —
 * все известные ОС; пустое значение — E_OS_EMPTY; неизвестное —
 * E_OS_UNKNOWN. Порядок ОС нормализуется к фиксированному
 * windows,macos,linux ради детерминизма логов.
 */

import { CliError } from "./errors.ts";
import type { OsId } from "../model/spec.ts";

export interface CliOptions {
  osList: OsId[];
  /** Сырые значения --layout (резолвятся в discoverInputs). */
  layoutInputs: string[];
  outDir: string;
  verbose: boolean;
}

export const KNOWN_OS: readonly OsId[] = ["windows", "macos", "linux"];

/** Фиксированный порядок запуска генераторов (docs/01, раздел 2). */
export const OS_RUN_ORDER: readonly OsId[] = ["windows", "macos", "linux"];

export const DEFAULT_OUT_DIR = "build";

const KNOWN_FLAGS = new Set(["--os", "--layout", "--out", "--verbose", "--help", "-h"]);

function isKnownOs(value: string): value is OsId {
  return (KNOWN_OS as readonly string[]).includes(value);
}

function parseOsValue(raw: string | undefined): OsId[] | { error: CliError } {
  if (raw === undefined || raw.trim() === "") {
    return {
      error: new CliError(
        "E_OS_EMPTY",
        `--os: пустое значение; укажите одну или несколько ОС: ${KNOWN_OS.join(", ")}`,
      ),
    };
  }
  const parts = raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0);
  if (parts.length === 0) {
    return {
      error: new CliError(
        "E_OS_EMPTY",
        `--os: пустое значение; укажите одну или несколько ОС: ${KNOWN_OS.join(", ")}`,
      ),
    };
  }
  const unknown = parts.filter((p) => !isKnownOs(p));
  if (unknown.length > 0) {
    return {
      error: new CliError(
        "E_OS_UNKNOWN",
        `--os: неизвестная ОС "${unknown.join(", ")}"; допустимые: ${KNOWN_OS.join(", ")}`,
      ),
    };
  }
  const deduped = [...new Set(parts as OsId[])];
  deduped.sort((a, b) => OS_RUN_ORDER.indexOf(a) - OS_RUN_ORDER.indexOf(b));
  return deduped;
}

function parseVerboseValue(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") return true;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return true;
}

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

export function printUsage(): string {
  return [
    "Использование:",
    "  bun run start -- [--os=<os,...>] [--layout=<путь>...] [--out=<каталог>] [--verbose]",
    "",
    "Примеры:",
    '  bun run start -- --os="windows,macos,linux" --layout="layouts/universal-layout-ortho-merged.toml"',
    "  bun run windows -- --layout=\"layouts/foo.toml\"",
    "  bun run all",
    "",
    "Флаги:",
    `  --os=<список>      ОС для генерации (по умолчанию: ${KNOWN_OS.join(",")});`,
    "                     разделитель — запятая, регистр не важен, дубликаты игнорируются",
    "  --layout=<путь>    TOML-схема, каталог с TOML (рекурсивно) или несколько --layout (по умолчанию: layouts/)",
    "  --out=<каталог>    корень выхода (по умолчанию: build; структура layouts/ сохраняется, подкаталог ОС добавляется автоматически)",
    "  --verbose          подробные логи по каждой стадии",
    "  --help, -h         показать эту подсказку",
  ].join("\n");
}

export function parseArgs(programArgs: string[]): CliOptions {
  const osRaws: string[] = [];
  const layoutInputs: string[] = [];
  let outDir: string | undefined;
  let verbose = false;

  for (let i = 0; i < programArgs.length; i++) {
    const token = programArgs[i] as string;

    // Флаг в форме --name=value
    const eq = token.indexOf("=");
    const head = eq >= 0 ? token.slice(0, eq) : token;
    const inlineValue = eq >= 0 ? token.slice(eq + 1) : undefined;

    if (!head.startsWith("-")) {
      throw new CliError(
        "E_ARGS_UNKNOWN",
        `неизвестный аргумент "${token}". ${usageHint()}`,
      );
    }
    if (!KNOWN_FLAGS.has(head)) {
      throw new CliError("E_ARGS_UNKNOWN", `неизвестный флаг "${head}". ${usageHint()}`);
    }

    const takeValue = (flag: string): string | undefined => {
      if (inlineValue !== undefined) return inlineValue;
      const next = programArgs[i + 1];
      if (next === undefined || next.startsWith("-")) return undefined;
      i++;
      return next;
    };

    switch (head) {
      case "--os": {
        const v = takeValue("--os");
        if (v === undefined) {
          throw new CliError(
            "E_OS_EMPTY",
            `--os: отсутствует значение; укажите одну или несколько ОС: ${KNOWN_OS.join(", ")}`,
          );
        }
        osRaws.push(v);
        break;
      }
      case "--layout": {
        const v = takeValue("--layout");
        if (v === undefined || v.trim() === "") {
          throw new CliError(
            "E_ARGS_UNKNOWN",
            `--layout: отсутствует значение; укажите путь к .toml-файлу или каталогу. ${usageHint()}`,
          );
        }
        layoutInputs.push(v);
        break;
      }
      case "--out": {
        const v = takeValue("--out");
        if (v === undefined || v.trim() === "") {
          throw new CliError(
            "E_ARGS_UNKNOWN",
            `--out: отсутствует значение; укажите каталог (по умолчанию: ${DEFAULT_OUT_DIR}). ${usageHint()}`,
          );
        }
        outDir = v;
        break;
      }
      case "--verbose": {
        verbose = parseVerboseValue(inlineValue);
        break;
      }
      case "--help":
      case "-h": {
        // Обрабатывается в runCli до/после парсинга; здесь помечаем
        // специальным флагом через исключение с печатью usage в stdout.
        // parseArgs остаётся чистой, поэтому просто игнорируем:
        // runCli проверяет наличие --help заранее.
        break;
      }
    }
  }

  let osList: OsId[];
  if (osRaws.length === 0) {
    osList = [...KNOWN_OS];
  } else {
    const merged = osRaws.join(",");
    const parsed = parseOsValue(merged);
    if ("error" in parsed) throw parsed.error;
    osList = parsed;
  }

  return {
    osList,
    layoutInputs,
    outDir: outDir ?? DEFAULT_OUT_DIR,
    verbose,
  };
}

export function hasHelpFlag(programArgs: string[]): boolean {
  return programArgs.some((a) => {
    const head = a.split("=")[0];
    return head === "--help" || head === "-h";
  });
}

function usageHint(): string {
  return "См. usage: bun run start -- --help";
}
