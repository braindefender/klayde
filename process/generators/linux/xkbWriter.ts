/**
 * Сборка и атомарная запись `xkb_symbols` (docs/09, §2 и §9).
 *
 * Структура — минимальная самодостаточная секция: includes,
 * имена групп, `key <CAPS>`, 50 строк `key`. LF-переводы строк,
 * UTF-8 без BOM. Без actions/terminators (dead keys отсутствуют,
 * элементы опциональны по DTD-производной практике upstream).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ValidatedSpec } from "../../model/spec.ts";
import { resolveOsOutDir } from "../paths.ts";
import { buildXkbKeys, type XkbBuildResult } from "./xkbLayout.ts";
import type { XkbKeysymTable } from "./keysyms.ts";
import { DEFAULT_XKB_KEYSYM_TABLE } from "./keysyms.ts";
import type { Diagnostic } from "../../validation/report.ts";

export interface XkbFileResult {
  /** Строки файла (без завершающего перевода; ставит сериализатор). */
  lines: string[];
  /** Предупреждения сборки (fallback лигатур). */
  warnings: Diagnostic[];
}

/** Собрать полный текст `xkb_symbols`. */
export function buildXkbText(
  spec: ValidatedSpec,
  table: XkbKeysymTable = DEFAULT_XKB_KEYSYM_TABLE,
): XkbFileResult {
  const { keyLines, warnings }: XkbBuildResult = buildXkbKeys(spec, table);
  const section = spec.main.shortName;
  const lines = [
    "default partial alphanumeric_keys",
    `xkb_symbols "${section}" {`,
    '    include "pc+inet(evdev)";',
    '    include "level3(ralt_switch)";',
    `    name[Group1]= "${spec.main.name}";`,
    `    name[Group2]= "${spec.main.name} (caps)";`,
    "    key <CAPS> { [ ISO_Next_Group ] };",
    ...keyLines.map((l) => `    ${l}`),
    "};",
  ];
  return { lines, warnings };
}

/** Сериализовать строки в байты: LF + UTF-8 без BOM. */
export function serializeXkb(lines: string[]): Buffer {
  return Buffer.from(lines.join("\n") + "\n", "utf8");
}

/**
 * Собрать, закодировать и атомарно записать symbols-файл.
 * Имя — short_name без расширения (требование XKB-утилит).
 */
export async function writeXkbFile(
  spec: ValidatedSpec,
  outDir: string,
  table: XkbKeysymTable = DEFAULT_XKB_KEYSYM_TABLE,
): Promise<XkbFileResult & { outFile: string }> {
  const { lines, warnings } = buildXkbText(spec, table);
  const dir = resolveOsOutDir(outDir, "linux", spec.file);
  await fs.mkdir(dir, { recursive: true });
  const outFile = path.join(dir, spec.main.shortName);
  const tmpFile = `${outFile}.tmp.${process.pid}`;
  await fs.writeFile(tmpFile, serializeXkb(lines));
  await fs.rename(tmpFile, outFile);
  return { lines, warnings, outFile };
}
