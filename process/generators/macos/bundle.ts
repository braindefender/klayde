/**
 * macOS `.bundle`: ValidatedSpec → `<main.name>.bundle/Contents/...`.
 *
 * Маппинг полей [macos] на эталон
 * (`data/reference/macos/Layouts.bundle/Contents`, Ukelele):
 *
 * - `Contents/Info.plist`:
 *   CFBundleIdentifier ← bundle_id,
 *   CFBundleName ← bundle_name,
 *   CFBundleVersion ← bundle_version,
 *   KLInfo_<keyboard_name> ← единственная запись (1 TOML = 1 bundle = 1
 *   раскладка; в эталоне их две — ENKbName + RUKbName — т.к. эталонный
 *   bundle содержит сразу две раскладки):
 *     TICapsLockLanguageSwitchCapable ← capslock_language_switch_capable,
 *     TISIconIsTemplate ← icon_is_template,
 *     TISInputSourceID ← input_source_id,
 *     TISIntendedLanguage ← intended_language;
 * - `Contents/version.plist`:
 *   BuildVersion ← build_version,
 *   ProjectName ← project_name,
 *   SourceVersion ← source_version;
 * - `Contents/Resources/<keyboard_name>.keylayout`:
 *   имя файла и `<keyboard name="">` ← keyboard_name;
 * - `Contents/Resources/en.lproj/InfoPlist.strings`:
 *   `"keyboard_name" = "keyboard_name";` (как в эталоне);
 * - `Contents/Resources/<keyboard_name>.icns`:
 *   байт-копия `[macos].icon_path` (путь относительно каталога TOML-схемы);
 *   отдельная plist-ссылка не нужна — в эталоне её тоже нет, macOS находит
 *   иконку по совпадению имени с .keylayout. Без icon_path иконки нет.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ValidatedSpec } from "../../model/spec.ts";
import { resolveIconPath } from "../../validation/helpers.ts";
import { resolveOsOutDir } from "../paths.ts";
import {
  buildKeylayoutText,
  serializeKeylayout,
} from "./keylayoutWriter.ts";

/** Корень bundle: `<out>/<rel>/macos/<bundle_name>.bundle` (дефолт bundle_name — [main].name). */
export function resolveBundleDir(spec: ValidatedSpec, outDir: string): string {
  return path.join(
    resolveOsOutDir(outDir, "macos", spec.file),
    `${spec.macos.bundleName}.bundle`,
  );
}

/** Escape для текстового содержимого plist (`<string>`): &, <, >. */
export function escapePlist(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape для .strings: backslash, кавычки, переводы строк. */
export function escapeStringsValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

/** Собрать текст Contents/Info.plist (строки; сериализатор ставит LF). */
export function buildInfoPlistText(spec: ValidatedSpec): string[] {
  const m = spec.macos;
  const boolTag = (v: boolean): string => (v ? "<true/>" : "<false/>");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    "\t<key>CFBundleIdentifier</key>",
    `\t<string>${escapePlist(m.bundleId)}</string>`,
    "\t<key>CFBundleName</key>",
    `\t<string>${escapePlist(m.bundleName)}</string>`,
    "\t<key>CFBundleVersion</key>",
    `\t<string>${escapePlist(m.bundleVersion)}</string>`,
    `\t<key>KLInfo_${escapePlist(m.keyboardName)}</key>`,
    "\t<dict>",
    "\t\t<key>TICapsLockLanguageSwitchCapable</key>",
    `\t\t${boolTag(m.capslockLanguageSwitchCapable)}`,
    "\t\t<key>TISIconIsTemplate</key>",
    `\t\t${boolTag(m.iconIsTemplate)}`,
    "\t\t<key>TISInputSourceID</key>",
    `\t\t<string>${escapePlist(m.inputSourceId)}</string>`,
    "\t\t<key>TISIntendedLanguage</key>",
    `\t\t<string>${escapePlist(m.intendedLanguage)}</string>`,
    "\t</dict>",
    "</dict>",
    "</plist>",
  ];
}

/** Собрать текст Contents/version.plist. */
export function buildVersionPlistText(spec: ValidatedSpec): string[] {
  const m = spec.macos;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    "\t<key>BuildVersion</key>",
    `\t<string>${escapePlist(m.buildVersion)}</string>`,
    "\t<key>ProjectName</key>",
    `\t<string>${escapePlist(m.projectName)}</string>`,
    "\t<key>SourceVersion</key>",
    `\t<string>${escapePlist(m.sourceVersion)}</string>`,
    "</dict>",
    "</plist>",
  ];
}

/** Собрать текст Contents/Resources/en.lproj/InfoPlist.strings. */
export function buildInfoPlistStringsText(spec: ValidatedSpec): string {
  const kb = escapeStringsValue(spec.macos.keyboardName);
  return `"${kb}" = "${kb}";\n`;
}

/** Сериализовать plist-строки: LF + UTF-8 без BOM. */
export function serializePlist(lines: string[]): Buffer {
  return Buffer.from(lines.join("\n") + "\n", "utf8");
}

/** Атомарно записать файл (tmp + rename). */
async function writeAtomic(file: string, data: Buffer | string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

export interface BundleLayout {
  bundleDir: string;
  infoPlist: string;
  versionPlist: string;
  keylayoutFile: string;
  stringsFile: string;
  /** Resources/<keyboard_name>.icns (как у .keylayout; файл пишется только при заданном icon_path). */
  iconFile: string;
}

/** Разложить spec на пути файлов bundle. */
export function bundlePaths(spec: ValidatedSpec, outDir: string): BundleLayout {
  const bundleDir = resolveBundleDir(spec, outDir);
  const contents = path.join(bundleDir, "Contents");
  return {
    bundleDir,
    infoPlist: path.join(contents, "Info.plist"),
    versionPlist: path.join(contents, "version.plist"),
    keylayoutFile: path.join(
      contents,
      "Resources",
      `${spec.macos.keyboardName}.keylayout`,
    ),
    stringsFile: path.join(
      contents,
      "Resources",
      "en.lproj",
      "InfoPlist.strings",
    ),
    iconFile: path.join(
      contents,
      "Resources",
      `${spec.macos.keyboardName}.icns`,
    ),
  };
}

/**
 * Собрать и атомарно записать весь `.bundle`.
 * Иконка ([macos].icon_path) копируется байт-в-байт в
 * Resources/<keyboard_name>.icns; без icon_path иконки в bundle нет.
 * Возвращает путь корня bundle.
 */
export async function writeBundle(spec: ValidatedSpec, outDir: string): Promise<string> {
  const p = bundlePaths(spec, outDir);
  await writeAtomic(p.infoPlist, serializePlist(buildInfoPlistText(spec)));
  await writeAtomic(p.versionPlist, serializePlist(buildVersionPlistText(spec)));
  await writeAtomic(
    p.keylayoutFile,
    serializeKeylayout(buildKeylayoutText(spec)),
  );
  await writeAtomic(
    p.stringsFile,
    Buffer.from(buildInfoPlistStringsText(spec), "utf8"),
  );
  if (spec.macos.iconPath !== undefined) {
    const src = resolveIconPath(spec.file, spec.macos.iconPath);
    let data: Buffer;
    try {
      data = await fs.readFile(src);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[macos].icon_path ${JSON.stringify(spec.macos.iconPath)}: не удалось прочитать ${src}: ${reason}`,
      );
    }
    await writeAtomic(p.iconFile, data);
  }
  return p.bundleDir;
}
