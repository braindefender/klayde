/**
 * V1–V2. TOML-парсинг и проверка структуры секций/ключей (docs/03).
 *
 * V1: строгий парсинг (Bun.TOML). Ошибка синтаксиса — E_TOML_SYNTAX
 * с сообщением парсера, дальше файл не обрабатывается.
 * Пустой файл (только пробелы) — E_TOML_EMPTY.
 *
 * V2: наличие `[main]`, `[msklc]`, `[layout]` (`[ligatures]` опциональна).
 * Неизвестные секции/ключи — E_SCHEMA_UNKNOWN_KEY с путём
 * (`[layout].base_shfit`); отсутствие обязательных секций/ключей/слоёв —
 * тот же код (в docs/03 отдельный код отсутствия не введён).
 * Значения, которые должны быть строками, но пришли числом/массивом/
 * таблицей — E_SCHEMA_TYPE. Зависимые стадии пропускаются для
 * отсутствующего (docs/03, стадия V2).
 */

import { errorDiag, type Diagnostic } from "./report.ts";

/** Ошибка синтаксиса TOML с сообщением парсера. */
export class TomlSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TomlSyntaxError";
  }
}

/** Файл без значимого содержимого (проверяется до парсинга). */
export function isEmptyDocument(text: string): boolean {
  return text.trim() === "";
}

/** Строгий парсинг TOML-документа; бросает TomlSyntaxError. */
export function parseTomlDocument(text: string): unknown {
  try {
    return Bun.TOML.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new TomlSyntaxError(`TOML-парсинг: ${detail}`);
  }
}

const REQUIRED_SECTIONS = ["main", "msklc", "layout"] as const;
const OPTIONAL_SECTIONS = ["ligatures"] as const;

const MAIN_KEYS = new Set(["name", "short_name"]);
const MSKLC_KEYS = new Set(["name", "company", "copyright", "description"]);
const LAYOUT_KEYS = new Set([
  "base",
  "base_shift",
  "altgr",
  "altgr_shift",
  "caps",
  "caps_shift",
]);
const REQUIRED_LAYOUT_KEYS = ["base", "base_shift", "altgr", "altgr_shift"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface StructuredDoc {
  /** Строковые значения [main] (только корректные по типу). */
  main: Record<string, string>;
  /** Строковые значения [msklc]. */
  msklc: Record<string, string>;
  /** Строковые значения [ligatures] (имена — любые ключи; шаблон — V4). */
  ligatures: Record<string, string>;
  /** Сырые значения [layout] (строки уходят в V5; не-строки уже отклонены). */
  layout: Record<string, string>;
  /** Ключи [layout] в сыром виде (для V7: caps/caps_shift по факту наличия). */
  layoutKeys: Set<string>;
  /** Секция присутствует и является таблицей. */
  hasSection: Record<string, boolean>;
}

/**
 * Проверить структуру документа; вернуть частично нормализованный вид.
 * Невалидные по типу значения отбрасываются (об уже сообщено),
 * зависимые стадии их пропускают.
 */
export function checkStructure(doc: unknown, file: string): {
  structured: StructuredDoc;
  diagnostics: Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const structured: StructuredDoc = {
    main: {},
    msklc: {},
    ligatures: {},
    layout: {},
    layoutKeys: new Set(),
    hasSection: {},
  };

  if (!isRecord(doc)) {
    diagnostics.push(
      errorDiag("E_SCHEMA_TYPE", file, `корень документа: ожидалась таблица TOML-секций`),
    );
    return { structured, diagnostics };
  }

  const knownSections = new Set<string>([...REQUIRED_SECTIONS, ...OPTIONAL_SECTIONS]);
  for (const key of Object.keys(doc)) {
    if (!knownSections.has(key)) {
      diagnostics.push(
        errorDiag("E_SCHEMA_UNKNOWN_KEY", file, `неизвестная секция [${key}]`),
      );
    }
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!(section in doc)) {
      diagnostics.push(
        errorDiag(
          "E_SCHEMA_UNKNOWN_KEY",
          file,
          `отсутствует обязательная секция [${section}]`,
        ),
      );
    }
  }

  checkStringSection(doc, "main", MAIN_KEYS, ["name", "short_name"], structured, diagnostics, file);
  checkStringSection(
    doc,
    "msklc",
    MSKLC_KEYS,
    ["name", "company", "copyright", "description"],
    structured,
    diagnostics,
    file,
  );

  // [ligatures]: ключи произвольные (шаблон имени — V4), значения — строки.
  const ligRaw = (doc as Record<string, unknown>)["ligatures"];
  if (ligRaw !== undefined) {
    if (!isRecord(ligRaw)) {
      diagnostics.push(
        errorDiag("E_SCHEMA_TYPE", file, `[ligatures]: ожидалась таблица`),
      );
      structured.hasSection["ligatures"] = false;
    } else {
      structured.hasSection["ligatures"] = true;
      for (const [key, value] of Object.entries(ligRaw)) {
        if (typeof value !== "string") {
          diagnostics.push(
            errorDiag(
              "E_SCHEMA_TYPE",
              file,
              `[ligatures].${key}: ожидалась строка, получено ${describeType(value)}`,
            ),
          );
        } else {
          structured.ligatures[key] = value;
        }
      }
    }
  }

  // [layout]: фиксированный набор слоёв, значения — строки (сетки — V5).
  const layoutRaw = (doc as Record<string, unknown>)["layout"];
  if (layoutRaw !== undefined && isRecord(layoutRaw)) {
    structured.hasSection["layout"] = true;
    for (const key of Object.keys(layoutRaw)) {
      structured.layoutKeys.add(key);
      if (!LAYOUT_KEYS.has(key)) {
        diagnostics.push(
          errorDiag("E_SCHEMA_UNKNOWN_KEY", file, `[layout].${key}: неизвестный ключ слоя`),
        );
        continue;
      }
      const value = layoutRaw[key];
      if (typeof value !== "string") {
        diagnostics.push(
          errorDiag(
            "E_SCHEMA_TYPE",
            file,
            `[layout].${key}: ожидалась строка-сетка в '''...''', получено ${describeType(value)}`,
          ),
        );
      } else {
        structured.layout[key] = value;
      }
    }
    for (const layer of REQUIRED_LAYOUT_KEYS) {
      if (!(layer in layoutRaw)) {
        diagnostics.push(
          errorDiag(
            "E_SCHEMA_UNKNOWN_KEY",
            file,
            `[layout].${layer}: отсутствует обязательный слой`,
          ),
        );
      }
    }
  } else if (layoutRaw !== undefined) {
    structured.hasSection["layout"] = false;
    diagnostics.push(errorDiag("E_SCHEMA_TYPE", file, `[layout]: ожидалась таблица`));
  }

  return { structured, diagnostics };
}

function checkStringSection(
  doc: Record<string, unknown>,
  section: string,
  allowedKeys: Set<string>,
  requiredKeys: string[],
  structured: StructuredDoc,
  diagnostics: Diagnostic[],
  file: string,
): void {
  const raw = doc[section];
  if (raw === undefined) {
    structured.hasSection[section] = false;
    return;
  }
  if (!isRecord(raw)) {
    structured.hasSection[section] = false;
    diagnostics.push(errorDiag("E_SCHEMA_TYPE", file, `[${section}]: ожидалась таблица`));
    return;
  }
  structured.hasSection[section] = true;
  const target = structured[section as "main" | "msklc"];
  for (const [key, value] of Object.entries(raw)) {
    if (!allowedKeys.has(key)) {
      diagnostics.push(
        errorDiag("E_SCHEMA_UNKNOWN_KEY", file, `[${section}].${key}: неизвестный ключ`),
      );
      continue;
    }
    if (typeof value !== "string") {
      diagnostics.push(
        errorDiag(
          "E_SCHEMA_TYPE",
          file,
          `[${section}].${key}: ожидалась строка, получено ${describeType(value)}`,
        ),
      );
      continue;
    }
    target[key] = value;
  }
  for (const key of requiredKeys) {
    if (!(key in raw)) {
      diagnostics.push(
        errorDiag(
          "E_SCHEMA_UNKNOWN_KEY",
          file,
          `[${section}].${key}: отсутствует обязательный ключ`,
        ),
      );
    }
  }
}

function describeType(value: unknown): string {
  if (Array.isArray(value)) return "массив";
  if (value === null) return "null";
  if (typeof value === "object") return "таблица";
  return typeof value;
}
