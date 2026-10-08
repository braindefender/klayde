/**
 * Сборка и атомарная запись `.keylayout` (docs/10, разделы 2 и 9).
 *
 * Структура — как upstream (CRLF-переводы строк, как в эталонах):
 * шапка, keyboard-тег, layouts, modifierMap, keyMapSet (карты 0–7),
 * stub-сетка, закрывающий тег. Без actions/terminators (dead keys
 * отсутствуют, элементы опциональны по DTD).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ValidatedSpec } from "../../model/spec.ts";
import { resolveOsOutDir } from "../paths.ts";
import {
  MAC_MAIN_SET_ID,
  MAC_MODIFIERS_ID,
  MAC_STUB_SET_ID,
  MAP6_ROWS,
  MAP7_ROWS,
  XML_HEAD_LINES,
  buildLayoutsBlock,
  buildModifierMap,
  buildStubSet,
} from "./keylayoutHeader.ts";
import { buildKeyMaps, computeMaxOut, escapeXmlAttr } from "./keylayoutLayout.ts";

export { MAC_MAIN_SET_ID, MAC_MODIFIERS_ID, MAC_STUB_SET_ID };

/**
 * id раскладки: детерминированный FNV-1a от имени → маленький
 * отрицательный int (диапазон −1…−32000, как у Ukelele:
 * upstream `-24174`, `-15810`, эталон `-17950`).
 * Раньше был полный int32 (до −2e9) — macOS/Ukelele ждут маленькое число.
 */
export function computeKeyboardId(name: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return -((hash >>> 0) % 32000 + 1);
}

/**
 * mapSet id — константа upstream `16c` (едина для всех раскладок,
 * как в обоих `Universal Layout *.keylayout`).
 * Оставлена функцией для совместимости тестов/вызывателей.
 */
export function mapSetId(_spec: ValidatedSpec): string {
  return MAC_MAIN_SET_ID;
}

/** stub keyMapSet id — константа upstream `994`. */
export function stubSetId(_spec?: ValidatedSpec): string {
  return MAC_STUB_SET_ID;
}

/** Собрать полный текст `.keylayout` (строки; CRLF ставит сериализатор). */
export function buildKeylayoutText(spec: ValidatedSpec): string[] {
  const setId = mapSetId(spec);
  const stubId = stubSetId(spec);
  const maps = buildKeyMaps(spec);
  // Имя клавиатуры — [macos].keyboard_name (в bundle: имя файла
  // Resources/<keyboard_name>.keylayout и ключ KLInfo_<keyboard_name>);
  // id — детерминированный хэш [main].name (стабилен, маленький, как у Ukelele).
  const out: string[] = [
    ...XML_HEAD_LINES,
    `<keyboard group="126" id="${computeKeyboardId(spec.main.name)}" name="${escapeXmlAttr(spec.macos.keyboardName)}" maxout="${computeMaxOut(spec)}">`,
    ...indent(buildLayoutsBlock(setId, stubId, MAC_MODIFIERS_ID), 1),
    ...indent(buildModifierMap(MAC_MODIFIERS_ID), 1),
    `<keyMapSet id="${setId}">`,
  ];
  const staticMaps: Record<number, readonly string[]> = { 6: MAP6_ROWS, 7: MAP7_ROWS };
  for (let index = 0; index < 8; index++) {
    out.push(indentLine(`<keyMap index="${index}">`, 2));
    const rows = staticMaps[index] ?? (maps[index] as string[]);
    for (const row of rows) out.push(indentLine(row, 3));
    out.push(indentLine("</keyMap>", 2));
  }
  out.push(`</keyMapSet>`);
  out.push(...indent(buildStubSet(setId, stubId), 1));
  out.push("</keyboard>");
  return out;
}

function indent(lines: string[], level: number): string[] {
  return lines.map((l) => indentLine(l, level));
}

function indentLine(line: string, level: number): string {
  return `${"    ".repeat(level)}${line}`;
}

/** Сериализовать строки в байты: CRLF + UTF-8 без BOM. */
export function serializeKeylayout(lines: string[]): Buffer {
  return Buffer.from(lines.join("\r\n") + "\r\n", "utf8");
}

/**
 * Собрать и атомарно записать `.keylayout`.
 * Возвращает путь записанного файла.
 */
export async function writeKeylayoutFile(
  spec: ValidatedSpec,
  outDir: string,
): Promise<string> {
  const dir = resolveOsOutDir(outDir, "macos", spec.file);
  await fs.mkdir(dir, { recursive: true });
  const outFile = path.join(dir, `${spec.main.name}.keylayout`);
  const tmpFile = `${outFile}.tmp.${process.pid}`;
  await fs.writeFile(tmpFile, serializeKeylayout(buildKeylayoutText(spec)));
  await fs.rename(tmpFile, outFile);
  return outFile;
}
