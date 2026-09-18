/**
 * V3–V8. Валидация одного файла поверх структуры V2 (docs/02, docs/03).
 *
 * V3: скаляры [main]/[msklc] — непустота, длины, шаблоны.
 * V4: словарь [ligatures] — имя по шаблону, резерв, длина 2–4,
 *     без переводов строки/таба (значение с ведущим `@` — тоже
 *     E_LIG_CONTROL: решение принято здесь, т.к. docs/03 относит
 *     всё содержимое к паре кодов E_LIG_LENGTH/E_LIG_CONTROL).
 * V5: геометрия сеток — 5 строк по 10 ячеек; таб — E_GRID_TAB;
 *     внутренняя пустая строка — E_GRID_EMPTY_CELL.
 * V6: содержимое ячеек — @None/@Space/@Nbsp/@Trans строго по регистру,
 *     `@Имя` с резолвом (неизвестное — E_CELL_UNKNOWN_REF с подсказкой
 *     при расстоянии Левенштейна ≤ 2), одиночный `@` — at-sign U+0040
 *     (docs/02, раздел 6.3), иначе E_CELL_AT; многосимвольная ячейка
 *     без `@` — E_CELL_LENGTH; управляющий символ — E_CELL_CONTROL.
 *     `@Trans` разрешён только в caps/caps_shift (иначе E_CELL_AT)
 *     и резолвится в копию base/base_shift (caps←base,
 *     caps_shift←base_shift) до V8/spec.
 * V7: удалён — слои caps/caps_shift обязательные (V2 требует все 6
 *     слоёв; отсутствие — E_SCHEMA_UNKNOWN_KEY). Отдельного кода
 *     E_CAPS_HALF больше нет: половинчатый набор невозможен без
 *     ошибки V2. Генератор всегда использует явные caps/caps_shift;
 *     какие клавиши реагируют на CapsLock определяется их содержимым
 *     (@Trans — без эффекта, CapsLock затрагивает только те позиции,
 *     где caps отличается от base).
 * V8: маппируемость в Unicode — суррогаты/не-scalar — E_UNICODE
 *     (после TOML-парсинга практически недостижимо; покрыто юнит-тестом).
 *     Проверка английских имён (W_UNICODE_NONAME) — фаза 3 (нет таблицы).
 *
 * Инварианты генератора (docs/03, раздел 3): при отсутствии ошибок
 * spec содержит матрицы 5×10 нормализованных токенов, резолвимые
 * ссылки, уникальные значения лигатур 2–4 кода.
 */

import { promises as fs } from "node:fs";
import type { CellValue, ValidatedSpec } from "../model/spec.ts";
import { findTripleDoubleQuotes } from "./check-literal-strings.ts";
import {
  checkStructure,
  isEmptyDocument,
  parseTomlDocument,
  TomlSyntaxError,
} from "./parse.ts";
import {
  BUILTIN_TOKENS,
  GRID_COLS,
  GRID_ROWS,
  LAYOUT_KEYS,
  LIG_MAX_CODES,
  LIG_MIN_CODES,
  LIG_NAME_RE,
  LOCALE_ID_RE,
  LOCALE_NAME_RE,
  MAIN_NAME_MAX_LENGTH,
  MAIN_NAME_MIN_LENGTH,
  MSKLC_LOCALE_ID_DEFAULT,
  MSKLC_LOCALE_NAME_DEFAULT,
  MSKLC_TEXT_FIELDS,
  RESERVED_LIG,
  TRANS_PAIRS,
  type LayerName,
} from "./const.ts";
import {
  checkScalarValue,
  cloneCell,
  isLengthIn,
  isShortId,
  parseCell,
  splitGrid,
  suggestLigature,
  type CellParse,
} from "./helpers.ts";
import { errorDiag, warnDiag, type Diagnostic } from "./report.ts";

export interface FileValidation {
  file: string;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  /** null, если есть хотя бы одна ошибка. */
  spec: ValidatedSpec | null;
}

/** Прочитать файл и провалидировать (V0–V8). Ошибка чтения — E_IO. */
export async function validateFile(file: string): Promise<FileValidation> {
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      file,
      errors: [errorDiag("E_IO", file, `не удалось прочитать файл: ${reason}`)],
      warnings: [],
      spec: null,
    };
  }
  return validateText(file, text);
}

/** Провалидировать текст схемы (чистая функция, без fs). */
export function validateText(file: string, text: string): FileValidation {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];

  // V0: сырые кавычки — по одной ошибке на строку.
  for (const hit of findTripleDoubleQuotes(text)) {
    errors.push(
      errorDiag(
        "E_QUOTES_TRIPLE_DOUBLE",
        file,
        `строка ${hit.line}, колонка ${hit.column}: найдены тройные двойные кавычки ("""); все сетки и лигатуры со слэшем должны использовать '''...'''`,
      ),
    );
  }

  // V1: парсинг.
  if (isEmptyDocument(text)) {
    errors.push(
      errorDiag(
        "E_TOML_EMPTY",
        file,
        `файл пуст: ожидался TOML-документ схемы`,
      ),
    );
    return { file, errors, warnings, spec: null };
  }
  let doc: unknown;
  try {
    doc = parseTomlDocument(text);
  } catch (err) {
    const detail = err instanceof TomlSyntaxError ? err.message : String(err);
    errors.push(errorDiag("E_TOML_SYNTAX", file, detail));
    return { file, errors, warnings, spec: null };
  }

  // V2: структура.
  const { structured, diagnostics } = checkStructure(doc, file);
  errors.push(...diagnostics);

  // V3: скаляры.
  errors.push(...validateScalars(structured, file));

  // V4: лигатуры → карта имя -> кодпоинты.
  const { ligMap, diagnostics: ligDiags } = validateLigatures(structured, file);
  errors.push(...ligDiags);

  // V5–V6: слои → матрицы токенов (null-строки/целые слои при фатальном).
  const usedLigatures = new Set<string>();
  const matrices = new Map<LayerName, CellValue[][] | null>();
  for (const layer of LAYOUT_KEYS) {
    const raw = structured.layout[layer];
    if (raw === undefined) continue; // отсутствие уже сообщено в V2
    matrices.set(
      layer,
      validateLayer(
        structured,
        layer,
        raw,
        ligMap,
        usedLigatures,
        file,
        errors,
      ),
    );
  }

  // V6b: резолв @Trans (caps←base, caps_shift←base_shift).
  // Выполняется до V8/spec, чтобы скалярные проверки и spec видели
  // уже раскрытые копии (включая лигатуры из base).
  resolveTransCells(matrices, file, errors);

  // V7: зарезервирована (caps/caps_shift обязательны через V2).
  // Отдельной проверки пары больше нет.

  // V8: скалярная валидность всех кодпоинтов.
  errors.push(...checkUnicodeScalars(matrices, ligMap, file));

  // W_LIG_UNUSED: определена, но нигде не referenced.
  for (const name of ligMap.keys()) {
    if (!usedLigatures.has(name)) {
      warnings.push(
        warnDiag(
          "W_LIG_UNUSED",
          file,
          `[ligatures].${name}: определена, но не используется ни в одной сетке; в вывод KLC не попадёт`,
        ),
      );
    }
  }

  if (errors.length > 0) {
    return { file, errors, warnings, spec: null };
  }

  const getMatrix = (layer: LayerName): CellValue[][] =>
    (matrices.get(layer) ?? []) as CellValue[][];
  const spec: ValidatedSpec = {
    file,
    main: {
      name: structured.main["name"] as string,
      shortName: structured.main["short_name"] as string,
      // undefined возможен только при ошибке типа V2 — тогда spec null выше.
      capsIsShift: structured.capsIsShift ?? true,
    },
    msklc: {
      name: structured.msklc["name"] as string,
      company: structured.msklc["company"] as string,
      copyright: structured.msklc["copyright"] as string,
      description: structured.msklc["description"] as string,
      // Опциональное [msklc].language_names: если не задано — fallback
      // на [main].name (историческое LANGUAGENAMES = DESCRIPTIONS).
      languageNames:
        (structured.msklc["language_names"] as string | undefined) ??
        (structured.main["name"] as string),
      // Опциональные [msklc].locale_name / locale_id с дефолтами
      // en-US / 00000409 (docs/02, раздел 4).
      localeName:
        (structured.msklc["locale_name"] as string | undefined) ??
        MSKLC_LOCALE_NAME_DEFAULT,
      localeId:
        (structured.msklc["locale_id"] as string | undefined) ??
        MSKLC_LOCALE_ID_DEFAULT,
    },
    layers: {
      base: getMatrix("base"),
      baseShift: getMatrix("base_shift"),
      altgr: getMatrix("altgr"),
      altgrShift: getMatrix("altgr_shift"),
      caps: getMatrix("caps"),
      capsShift: getMatrix("caps_shift"),
    },
    usedLigatures: new Map(
      [...usedLigatures].map((name) => [name, ligMap.get(name) as number[]]),
    ),
  };
  return { file, errors, warnings, spec };
}

// --- V3 ---

function validateScalars(
  structured: { main: Record<string, string>; msklc: Record<string, string> },
  file: string,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const { main, msklc } = structured;

  if (
    main["name"] !== undefined &&
    !isLengthIn(main["name"].trim(), MAIN_NAME_MIN_LENGTH, MAIN_NAME_MAX_LENGTH)
  ) {
    out.push(
      errorDiag(
        "E_MAIN_NAME",
        file,
        `[main].name ${JSON.stringify(main["name"])}: ожидалась непустая строка 1–64 символа`,
      ),
    );
  }
  if (main["short_name"] !== undefined && !isShortId(main["short_name"])) {
    out.push(
      errorDiag(
        "E_MAIN_SHORT_NAME",
        file,
        `[main].short_name ${JSON.stringify(main["short_name"])}: ожидались латиница/цифры/дефис без пробелов, 1–8 символов (дефис только внутри)`,
      ),
    );
  }
  if (msklc["name"] !== undefined && !isShortId(msklc["name"])) {
    out.push(
      errorDiag(
        "E_MSKLC_NAME",
        file,
        `[msklc].name ${JSON.stringify(msklc["name"])}: ожидались латиница/цифры/дефис без пробелов, 1–8 символов (дефис только внутри)`,
      ),
    );
  }
  for (const [key, code] of MSKLC_TEXT_FIELDS) {
    if (msklc[key] !== undefined && msklc[key].trim() === "") {
      out.push(
        errorDiag(code, file, `[msklc].${key}: ожидалась непустая строка`),
      );
    }
  }
  if (msklc["locale_name"] !== undefined && !LOCALE_NAME_RE.test(msklc["locale_name"].trim())) {
    out.push(
      errorDiag(
        "E_MSKLC_LOCALE_NAME",
        file,
        `[msklc].locale_name ${JSON.stringify(msklc["locale_name"])}: ожидался BCP47-тег вида en-US / ru-RU (латиница, дефис-группы)`,
      ),
    );
  }
  if (msklc["locale_id"] !== undefined && !LOCALE_ID_RE.test(msklc["locale_id"].trim())) {
    out.push(
      errorDiag(
        "E_MSKLC_LOCALE_ID",
        file,
        `[msklc].locale_id ${JSON.stringify(msklc["locale_id"])}: ожидались ровно 8 hex-цифр (напр. 00000409, 00000419)`,
      ),
    );
  }
  return out;
}

// --- V4 ---

function validateLigatures(
  structured: { ligatures: Record<string, string> },
  file: string,
): { ligMap: Map<string, number[]>; diagnostics: Diagnostic[] } {
  const errors: Diagnostic[] = [];
  const ligMap = new Map<string, number[]>();

  for (const [name, value] of Object.entries(structured.ligatures)) {
    if (!LIG_NAME_RE.test(name)) {
      errors.push(
        errorDiag(
          "E_LIG_NAME",
          file,
          `[ligatures].${name}: имя должно подходить под [A-Za-z][A-Za-z0-9_]*, 1–32 символа`,
        ),
      );
      continue;
    }
    if (RESERVED_LIG.has(name.toLowerCase())) {
      errors.push(
        errorDiag(
          "E_LIG_RESERVED",
          file,
          `[ligatures].${name}: имя зарезервировано (встроены @None/@Space/@Nbsp/@Trans)`,
        ),
      );
      continue;
    }
    if (/[\n\r\t]/.test(value) || value.startsWith("@")) {
      const why =
        value.startsWith("@") && !/[\n\r\t]/.test(value)
          ? "значение начинается с @ (резерв ссылок)"
          : "значение содержит перевод строки или таб";
      errors.push(
        errorDiag("E_LIG_CONTROL", file, `[ligatures].${name}: ${why}`),
      );
      continue;
    }
    const codePoints = Array.from(value).map(
      (ch) => ch.codePointAt(0) as number,
    );
    if (
      codePoints.length < LIG_MIN_CODES ||
      codePoints.length > LIG_MAX_CODES
    ) {
      const hint =
        codePoints.length < LIG_MIN_CODES
          ? "одиночный символ пишется прямо в сетку, а не в лигатуры"
          : "в KLC-секции LIGATURE ровно колонки Char0..Char3";
      errors.push(
        errorDiag(
          "E_LIG_LENGTH",
          file,
          `[ligatures].${name}: лигатура из ${codePoints.length} символов; ожидалось ${LIG_MIN_CODES}–${LIG_MAX_CODES} (${hint})`,
        ),
      );
      continue;
    }
    ligMap.set(name, codePoints);
  }
  return { ligMap, diagnostics: errors };
}

// --- V5–V6 ---

/**
 * Проверить слой: геометрия (V5), затем ячейки (V6).
 * Возвращает матрицу 5×10 токенов либо null (слой фатально сломан —
 * диагностика уже добавлена; зависимые проверки пропущены).
 */
function validateLayer(
  structured: { ligatures: Record<string, string> },
  layer: LayerName,
  raw: string,
  ligMap: Map<string, number[]>,
  usedLigatures: Set<string>,
  file: string,
  errors: Diagnostic[],
): CellValue[][] | null {
  const grid = splitGrid(raw);
  // Внутренние пустые строки — E_GRID_EMPTY_CELL, слой дальше не идёт.
  for (let i = 0; i < grid.length; i++) {
    if ((grid[i] as string).trim() === "") {
      errors.push(
        errorDiag(
          "E_GRID_EMPTY_CELL",
          file,
          `[layout].${layer}: строка ${i + 1} пуста; пустые строки внутри сетки запрещены`,
        ),
      );
      return null;
    }
    if ((grid[i] as string).includes("\t")) {
      errors.push(
        errorDiag(
          "E_GRID_TAB",
          file,
          `[layout].${layer}: строка ${i + 1} содержит табуляцию; ячейки разделяются только пробелами`,
        ),
      );
      return null;
    }
  }
  if (grid.length !== GRID_ROWS) {
    errors.push(
      errorDiag(
        "E_GRID_GEOMETRY",
        file,
        `[layout].${layer}: ожидалось 5 строк по 10 ячеек, получено ${grid.length} строк`,
      ),
    );
    return null;
  }

  const ligNames = [...ligMap.keys()];
  const matrix: (CellValue[] | null)[] = [];
  for (let r = 0; r < grid.length; r++) {
    const cells = (grid[r] as string).trim().split(/ +/);
    if (cells.length !== GRID_COLS) {
      errors.push(
        errorDiag(
          "E_GRID_GEOMETRY",
          file,
          `[layout].${layer}: ожидалось 5 строк по 10 ячеек; строка ${r + 1} содержит ${cells.length} ячеек вместо 10`,
        ),
      );
      matrix.push(null);
      continue;
    }
    const row: CellValue[] = [];
    for (let c = 0; c < cells.length; c++) {
      const cell = (cells[c] as string).trim();
      const parsed = parseCell(cell, ligMap);
      if (parsed.error === undefined) {
        const value = parsed.value as CellValue;
        // @Trans — только в caps/caps_shift, иначе E_CELL_AT.
        if (
          value.kind === "trans" &&
          layer !== "caps" &&
          layer !== "caps_shift"
        ) {
          errors.push(
            errorDiag(
              "E_CELL_AT",
              file,
              `[layout].${layer} строка ${r + 1}, колонка ${c + 1}: "@Trans" разрешён только в слоях caps/caps_shift (наследование из base/base_shift)`,
            ),
          );
          row.push({ kind: "none" });
          continue;
        }
        if (parsed.usedLig !== undefined) usedLigatures.add(parsed.usedLig);
        row.push(value);
        continue;
      }
      errors.push(cellError(layer, r + 1, c + 1, cell, parsed, ligNames, file));
      row.push({ kind: "none" });
    }
    matrix.push(row);
  }
  if (matrix.some((row) => row === null)) return null;
  return matrix as CellValue[][];
}

/**
 * Резолв @Trans: caps[r][c] ← клон base[r][c],
 * caps_shift[r][c] ← клон base_shift[r][c].
 * Вызывается до V8/spec; после резолва trans в матрицах не остаётся.
 * Если base-слой фатально сломан (null) — пропустить (ошибки уже есть,
 * spec всё равно будет null).
 */
function resolveTransCells(
  matrices: Map<LayerName, CellValue[][] | null>,
  file: string,
  errors: Diagnostic[],
): void {
  for (const [dst, src] of TRANS_PAIRS) {
    const dstM = matrices.get(dst);
    if (dstM === undefined || dstM === null) continue;
    const srcM = matrices.get(src);
    if (srcM === undefined || srcM === null) continue;
    for (let r = 0; r < dstM.length; r++) {
      const dstRow = dstM[r] as CellValue[];
      const srcRow = srcM[r] as CellValue[] | undefined;
      if (srcRow === undefined) {
        errors.push(
          errorDiag(
            "E_GRID_GEOMETRY",
            file,
            `[layout].${dst}: строка ${r + 1} без пары в [layout].${src} для резолва @Trans`,
          ),
        );
        continue;
      }
      for (let c = 0; c < dstRow.length; c++) {
        if ((dstRow[c] as CellValue).kind !== "trans") continue;
        const srcCell = srcRow[c] as CellValue | undefined;
        if (srcCell === undefined) {
          errors.push(
            errorDiag(
              "E_GRID_GEOMETRY",
              file,
              `[layout].${dst} строка ${r + 1}, колонка ${c + 1}: нет ячейки [layout].${src} для @Trans`,
            ),
          );
          dstRow[c] = { kind: "none" };
          continue;
        }
        if (srcCell.kind === "trans") {
          // В base/base_shift trans невозможен (отклонён в V6),
          // defense in depth на случай ручной сборки матриц.
          errors.push(
            errorDiag(
              "E_CELL_AT",
              file,
              `[layout].${dst} строка ${r + 1}, колонка ${c + 1}: @Trans в [layout].${src} недопустим`,
            ),
          );
          dstRow[c] = { kind: "none" };
          continue;
        }
        dstRow[c] = cloneCell(srcCell);
      }
    }
  }
}

function cellError(
  layer: LayerName,
  row: number,
  col: number,
  cell: string,
  parsed: Extract<CellParse, { error: string }>,
  ligNames: string[],
  file: string,
): Diagnostic {
  const where = `[layout].${layer} строка ${row}, колонка ${col}`;
  switch (parsed.error) {
    case "unknown-ref": {
      const suggestion = suggestLigature(cell.slice(1), [
        ...ligNames,
        ...BUILTIN_TOKENS,
      ]);
      const hint =
        suggestion !== null
          ? `; возможно, имелось в виду "@${suggestion}"`
          : "";
      return errorDiag(
        "E_CELL_UNKNOWN_REF",
        file,
        `${where}: "${cell}" не определено в [ligatures]${hint}`,
      );
    }
    case "length":
      return errorDiag(
        "E_CELL_LENGTH",
        file,
        `${where}: "${cell}" — больше одного символа без @; вынесите последовательность в [ligatures]`,
      );
    case "control": {
      const cp = (Array.from(cell)[0] as string).codePointAt(0) as number;
      return errorDiag(
        "E_CELL_CONTROL",
        file,
        `${where}: символ U+${cp.toString(16).toUpperCase().padStart(4, "0")} — управляющий, запрещён`,
      );
    }
    case "at":
      return errorDiag(
        "E_CELL_AT",
        file,
        `${where}: "${cell}" начинается с @, но не является ссылкой (@Имя) или встроенным токеном (@None/@Space/@Nbsp/@Trans)`,
      );
  }
}

// --- V8 ---

function checkUnicodeScalars(
  matrices: Map<LayerName, CellValue[][] | null>,
  ligMap: Map<string, number[]>,
  file: string,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Set<number>();
  const check = (cp: number, origin: string): void => {
    if (seen.has(cp)) return;
    seen.add(cp);
    const code = checkScalarValue(cp);
    if (code !== null) {
      out.push(
        errorDiag(
          code,
          file,
          `${origin}: код U+${cp.toString(16).toUpperCase()} — не Unicode scalar value`,
        ),
      );
    }
  };
  for (const codePoints of ligMap.values()) {
    for (const cp of codePoints) check(cp, `[ligatures]`);
  }
  for (const [layer, matrix] of matrices) {
    if (matrix === null) continue;
    for (let r = 0; r < matrix.length; r++) {
      const row = matrix[r] as CellValue[];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c] as CellValue;
        if (cell.kind === "char") {
          check(
            cell.codePoint,
            `[layout].${layer} строка ${r + 1}, колонка ${c + 1}`,
          );
        } else if (cell.kind === "ligature") {
          for (const cp of cell.codePoints)
            check(cp, `[layout].${layer} строка ${r + 1}, колонка ${c + 1}`);
        }
      }
    }
  }
  return out;
}
