/**
 * Сборка и атомарная запись .klc (docs/06, раздел 5; docs/08 — klcWriter.ts).
 *
 * Порядок секций и дословные шаблоны — из docs/04. Весь текст собирается
 * с `\n`, затем join в `\r\n`; кодирование UTF-16LE с BOM (`FF FE`).
 * Имя файла: `<main.name>.klc` в `<out>/windows/`. Запись атомарная
 * (временный файл рядом + rename), чтобы прерванный прогон не оставлял
 * половинчатый `.klc` (docs/06, раздел 6).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ValidatedSpec } from "../../model/spec.ts";
import {
  KEYNAME_EXT_LINES,
  KEYNAME_LINES,
  SHIFTSTATE_LINES,
  buildFooterLines,
  buildHeaderLines,
} from "./klcHeader.ts";
import { buildLayoutBlock } from "./klcLayout.ts";
import type { UnicodeTable } from "./unicode.ts";
import { DEFAULT_UNICODE_TABLE } from "./unicode.ts";

export const LAYOUT_HEAD_LINES: readonly string[] = [
  "LAYOUT\t\t;an extra '@' at the end is a dead key",
  "",
  "//SC\tVK_\t\tCap\t0\t1\t2\t6\t7",
  "//--\t----\t\t----\t----\t----\t----\t----\t----",
  "",
];

export const LIGATURE_HEAD_LINES: readonly string[] = [
  "LIGATURE",
  "",
  "//VK_\tMod#\tChar0\tChar1\tChar2\tChar3",
  "//----\t\t----\t----\t----\t----\t----",
];

/** Собрать полный текст .klc (строки с \n; CRLF ставит сериализатор). */
export function buildKlcText(
  spec: ValidatedSpec,
  table: UnicodeTable = DEFAULT_UNICODE_TABLE,
): string[] {
  const { dataRows, ligRows } = buildLayoutBlock(spec, table);
  return [
    ...buildHeaderLines(spec),
    "",
    ...SHIFTSTATE_LINES,
    "",
    ...LAYOUT_HEAD_LINES,
    ...dataRows,
    "",
    ...LIGATURE_HEAD_LINES,
    "",
    ...ligRows,
    "",
    ...KEYNAME_LINES,
    "",
    ...KEYNAME_EXT_LINES,
    "",
    ...buildFooterLines(spec),
    "",
  ];
}

/** Сериализовать строки в байты: CRLF + UTF-16LE с BOM. */
export function serializeKlc(lines: string[]): Buffer {
  const body = Buffer.from(lines.join("\r\n"), "utf16le");
  return Buffer.concat([Buffer.from([0xff, 0xfe]), body]);
}

/**
 * Собрать, закодировать и атомарно записать .klc.
 * Возвращает путь записанного файла.
 */
export async function writeKlcFile(
  spec: ValidatedSpec,
  outDir: string,
  table: UnicodeTable = DEFAULT_UNICODE_TABLE,
): Promise<string> {
  const dir = path.join(outDir, "windows");
  await fs.mkdir(dir, { recursive: true });
  const outFile = path.join(dir, `${spec.main.name}.klc`);
  const tmpFile = `${outFile}.tmp.${process.pid}`;
  await fs.writeFile(tmpFile, serializeKlc(buildKlcText(spec, table)));
  await fs.rename(tmpFile, outFile);
  return outFile;
}
