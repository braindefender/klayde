/**
 * Резолв входов в упорядоченный список файлов (docs/01-cli.md, раздел 2).
 *
 * Правила:
 * 1. Флаг отсутствует — все `*.toml` в каталоге `layouts/`
 *    (только верхний уровень, без рекурсии, сортировка по имени).
 * 2. Каталог `layouts/` пуст/отсутствует — E_NO_INPUTS.
 * 3. Несуществующий файл — E_LAYOUT_NOT_FOUND.
 * 4. Путь-каталог — все `*.toml` внутри (верхний уровень, сортировка).
 * 5. Несколько --layout — один список, дубликаты убираются.
 * 6. Расширение строго `.toml` (регистр не важен). Другие файлы
 *    игнорируются при сканировании каталога, но явный не-TOML —
 *    E_LAYOUT_EXTENSION.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { CliError } from "../cli/errors.ts";

export const DEFAULT_LAYOUTS_DIR = "layouts";

function isTomlFile(name: string): boolean {
  return name.toLowerCase().endsWith(".toml");
}

async function scanTomlDir(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    throw new CliError(
      "E_NO_INPUTS",
      `нет входов: каталог "${dir}" отсутствует или недоступен; укажите --layout=<путь к .toml>`,
    );
  }
  return entries
    .filter((e) => e.isFile() && isTomlFile(e.name))
    .map((e) => path.join(dir, e.name))
    .sort();
}

export async function discoverInputs(
  layoutInputs: string[],
  opts: { layoutsDir?: string } = {},
): Promise<string[]> {
  const layoutsDir = opts.layoutsDir ?? DEFAULT_LAYOUTS_DIR;
  const collected: string[] = [];

  if (layoutInputs.length === 0) {
    const found = await scanTomlDir(layoutsDir);
    if (found.length === 0) {
      throw new CliError(
        "E_NO_INPUTS",
        `нет входов: в каталоге "${layoutsDir}" нет *.toml; укажите --layout=<путь к .toml>`,
      );
    }
    return found;
  }

  for (const input of layoutInputs) {
    let stat;
    try {
      stat = await fs.stat(input);
    } catch {
      throw new CliError(
        "E_LAYOUT_NOT_FOUND",
        `схема не найдена: "${input}" (путь не существует)`,
      );
    }

    if (stat.isDirectory()) {
      const found = await scanTomlDir(input);
      collected.push(...found);
    } else if (stat.isFile()) {
      if (!isTomlFile(input)) {
        throw new CliError(
          "E_LAYOUT_EXTENSION",
          `схема "${input}": расширение должно быть .toml (регистр не важен)`,
        );
      }
      collected.push(input);
    } else {
      throw new CliError("E_LAYOUT_NOT_FOUND", `схема не найдена: "${input}"`);
    }
  }

  const deduped = [...new Set(collected)];
  if (deduped.length === 0) {
    throw new CliError(
      "E_NO_INPUTS",
      `нет входов: указанные --layout не дали ни одного .toml-файла`,
    );
  }
  return deduped;
}
