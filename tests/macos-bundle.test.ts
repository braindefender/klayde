/**
 * Тесты секции [macos] и генерации `.bundle` (1 TOML = 1 bundle).
 *
 * Маппинг сверен с эталоном data/reference/macos/Layouts.bundle/Contents:
 * Info.plist (CFBundle* + единственный KLInfo_<keyboard_name>),
 * version.plist, Resources/<keyboard_name>.keylayout,
 * Resources/en.lproj/InfoPlist.strings. В эталоне записей KLInfo две,
 * т.к. эталонный bundle содержит сразу две раскладки; мы всегда эмитим одну.
 */
import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateFile, validateText } from "../process/validation/validate.ts";
import { runCli } from "../process/main.ts";
import type { ValidationCode } from "../process/validation/report.ts";
import {
  buildInfoPlistText,
  buildVersionPlistText,
  buildInfoPlistStringsText,
  bundlePaths,
  writeBundle,
} from "../process/generators/macos/bundle.ts";
import type { ValidatedSpec } from "../process/model/spec.ts";

async function miniText(): Promise<string> {
  return fs.readFile("tests/fixtures/valid-mini.toml", "utf8");
}

function errorCodes(r: { errors: { code: ValidationCode }[] }): ValidationCode[] {
  return r.errors.map((e) => e.code).sort();
}

function withMacos(base: string, body: string): string {
  return `${base}\n[macos]\n${body}\n`;
}

async function loadSpec(file: string): Promise<ValidatedSpec> {
  const r = await validateFile(file);
  expect(r.errors).toEqual([]);
  if (!r.spec) throw new Error(`нет spec для ${file}`);
  return r.spec;
}

describe("[macos]: дефолты без секции", () => {
  test("valid-mini: все поля по умолчанию", async () => {
    const spec = await loadSpec("tests/fixtures/valid-mini.toml");
    expect(spec.macos).toEqual({
      bundleId: "com.clayde.layout",
      bundleName: "Fixture Valid Mini",
      bundleVersion: "1.0",
      keyboardName: "FIXV",
      capslockLanguageSwitchCapable: false,
      iconIsTemplate: false,
      inputSourceId: "com.clayde.layout.fixv",
      intendedLanguage: "en",
      buildVersion: "1.0",
      projectName: "Fixture Valid Mini",
      sourceVersion: "1.0",
      iconPath: undefined,
    });
  });

  test("keyboard_name: EN-US → ENUS, input_source_id lowercase", async () => {
    const base = await miniText();
    const text = base.replace('short_name = "FIXV"', 'short_name = "EN-US"');
    expect(text).not.toContain('short_name = "FIXV"');
    const r = validateText("en-us-derive.toml", text);
    expect(errorCodes(r)).toEqual([]);
    expect(r.spec?.macos.keyboardName).toBe("ENUS");
    expect(r.spec?.macos.inputSourceId).toBe("com.clayde.layout.enus");
  });

  test("short_name без букв → E_MACOS_KEYBOARD_NAME", async () => {
    const base = await miniText();
    const text = base.replace('short_name = "FIXV"', 'short_name = "123"');
    const r = validateText("digits.toml", text);
    expect(errorCodes(r)).toEqual(["E_MACOS_KEYBOARD_NAME"]);
    expect(r.spec).toBeNull();
  });
});

describe("[macos]: явные значения", () => {
  test("все поля из TOML попадают в spec как есть", async () => {
    const base = await miniText();
    const r = validateText(
      "explicit.toml",
      withMacos(
        base,
        `bundle_id = "com.example.test"
bundle_name = "Test Bundle"
bundle_version = "2.3.4"
keyboard_name = "TestKB"
capslock_language_switch_capable = true
icon_is_template = true
input_source_id = "com.example.test.custom"
intended_language = "ru"
build_version = "3"
project_name = "Test Project"
source_version = "4.5.6"`,
      ),
    );
    expect(errorCodes(r)).toEqual([]);
    expect(r.spec?.macos).toEqual({
      bundleId: "com.example.test",
      bundleName: "Test Bundle",
      bundleVersion: "2.3.4",
      keyboardName: "TestKB",
      capslockLanguageSwitchCapable: true,
      iconIsTemplate: true,
      inputSourceId: "com.example.test.custom",
      intendedLanguage: "ru",
      buildVersion: "3",
      projectName: "Test Project",
      sourceVersion: "4.5.6",
      iconPath: undefined,
    });
  });
});

describe("[macos]: ошибки формата", () => {
  const cases: [string, string, ValidationCode][] = [
    ["bundle_version", 'bundle_version = "1.0-beta"', "E_MACOS_BUNDLE_VERSION"],
    ["build_version", 'build_version = "x"', "E_MACOS_BUILD_VERSION"],
    ["source_version", 'source_version = "1..0"', "E_MACOS_SOURCE_VERSION"],
    ["intended_language 3 буквы", 'intended_language = "eng"', "E_MACOS_INTENDED_LANGUAGE"],
    ["intended_language с цифрой", 'intended_language = "e1"', "E_MACOS_INTENDED_LANGUAGE"],
    ["keyboard_name с дефисом", 'keyboard_name = "EN-US"', "E_MACOS_KEYBOARD_NAME"],
    ["bundle_name пустое", 'bundle_name = "  "', "E_MACOS_BUNDLE_NAME"],
    ["project_name пустое", 'project_name = ""', "E_MACOS_PROJECT_NAME"],
    ["bundle_id пустое", 'bundle_id = ""', "E_MACOS_BUNDLE_ID"],
    ["input_source_id пустое", 'input_source_id = ""', "E_MACOS_INPUT_SOURCE_ID"],
  ];
  for (const [label, body, want] of cases) {
    test(`${label} → ${want}`, async () => {
      const r = validateText("bad.toml", withMacos(await miniText(), body));
      expect(errorCodes(r)).toEqual([want]);
      expect(r.spec).toBeNull();
    });
  }

  test("не-строка и не-boolean → E_SCHEMA_TYPE", async () => {
    const base = await miniText();
    for (const body of ['bundle_id = 123', 'capslock_language_switch_capable = "yes"', "icon_is_template = 1"]) {
      const r = validateText("bad-type.toml", withMacos(base, body));
      expect(errorCodes(r)).toEqual(["E_SCHEMA_TYPE"]);
    }
  });

  test("неизвестный ключ → E_SCHEMA_UNKNOWN_KEY", async () => {
    const r = validateText(
      "bad-key.toml",
      withMacos(await miniText(), 'bundle_icns = "x.icns"'),
    );
    expect(errorCodes(r)).toEqual(["E_SCHEMA_UNKNOWN_KEY"]);
  });
});

describe("[macos].icon_path", () => {
  test("пустое и не-.icns → E_MACOS_ICON_PATH (validateText, без fs)", async () => {
    const base = await miniText();
    for (const body of ['icon_path = "  "', 'icon_path = "icon.png"']) {
      const r = validateText("bad-icon.toml", withMacos(base, body));
      expect(errorCodes(r)).toEqual(["E_MACOS_ICON_PATH"]);
      expect(r.spec).toBeNull();
    }
  });

  test("не-строка → E_SCHEMA_TYPE", async () => {
    const r = validateText(
      "bad-icon-type.toml",
      withMacos(await miniText(), "icon_path = 123"),
    );
    expect(errorCodes(r)).toEqual(["E_SCHEMA_TYPE"]);
  });

  test("файл отсутствует → E_MACOS_ICON_PATH (validateFile)", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-icon-miss-"));
    const file = path.join(dir, "layout.toml");
    await fs.writeFile(file, withMacos(await miniText(), 'icon_path = "missing.icns"'));
    const r = await validateFile(file);
    expect(errorCodes(r)).toEqual(["E_MACOS_ICON_PATH"]);
    expect(r.errors[0]?.message).toContain("missing.icns");
    expect(r.spec).toBeNull();
  });

  test("копирование: байты 1-в-1, имя = <keyboard_name>.icns", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-icon-ok-"));
    const iconBytes = Buffer.from("ICNS-DUMMY-BYTES-0123456789");
    await fs.writeFile(path.join(dir, "myicon.icns"), iconBytes);
    const file = path.join(dir, "layout.toml");
    await fs.writeFile(file, withMacos(await miniText(), 'icon_path = "myicon.icns"'));
    const r = await validateFile(file);
    expect(errorCodes(r)).toEqual([]);
    expect(r.spec?.macos.iconPath).toBe("myicon.icns");

    const spec = r.spec as ValidatedSpec;
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-icon-out-"));
    await writeBundle(spec, out);
    const p = bundlePaths(spec, out);
    expect(path.basename(p.iconFile)).toBe("FIXV.icns");
    expect(path.basename(p.keylayoutFile)).toBe("FIXV.keylayout");
    expect(await fs.readFile(p.iconFile)).toEqual(iconBytes);
  });

  test("resolveIconPath: относительный — от каталога схемы", async () => {
    const { resolveIconPath } = await import("../process/validation/helpers.ts");
    expect(resolveIconPath(path.join("a", "b", "c.toml"), "i.icns")).toBe(
      path.join("a", "b", "i.icns"),
    );
  });
});

describe("bundle: структура и маппинг", () => {
  test("4 файла, имена и содержимое по эталону, KLInfo ровно один", async () => {
    const spec = await loadSpec("tests/fixtures/valid-mini.toml");
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-bundle-"));
    const bundleDir = await writeBundle(spec, tmp);
    expect(bundleDir.endsWith("Fixture Valid Mini.bundle")).toBe(true);

    const p = bundlePaths(spec, tmp);
    expect(p.keylayoutFile.endsWith(path.join("Resources", "FIXV.keylayout"))).toBe(true);
    for (const f of [p.infoPlist, p.versionPlist, p.keylayoutFile, p.stringsFile]) {
      expect((await fs.stat(f)).isFile()).toBe(true);
    }

    const info = await fs.readFile(p.infoPlist, "utf8");
    expect(info).toContain("<key>CFBundleIdentifier</key>");
    expect(info).toContain("<string>com.clayde.layout</string>");
    expect(info).toContain("<key>CFBundleName</key>");
    expect(info).toContain("<string>Fixture Valid Mini</string>");
    expect(info).toContain("<key>CFBundleVersion</key>");
    expect(info.match(/<key>KLInfo_/g)?.length ?? 0).toBe(1);
    expect(info).toContain("<key>KLInfo_FIXV</key>");
    expect(info).toContain("<string>com.clayde.layout.fixv</string>");
    expect(info).toContain("<string>en</string>");

    const version = await fs.readFile(p.versionPlist, "utf8");
    expect(version).toContain("<key>ProjectName</key>");
    expect(version).toContain("<string>Fixture Valid Mini</string>");

    const keylayout = await fs.readFile(p.keylayoutFile, "utf8");
    expect(keylayout).toContain('name="FIXV"');

    const strings = await fs.readFile(p.stringsFile, "utf8");
    expect(strings).toBe('"FIXV" = "FIXV";\n');

    // Иконки пока нет (следующая итерация).
    const resources = await fs.readdir(path.dirname(p.keylayoutFile));
    expect(resources.some((f) => f.endsWith(".icns"))).toBe(false);

    const leftovers = (await fs.readdir(path.dirname(p.infoPlist), { recursive: true })).filter(
      (f) => f.includes(".tmp."),
    );
    expect(leftovers).toEqual([]);
  });

  test("явный [macos] меняет plist и имена файлов", async () => {
    const base = await miniText();
    const r = validateText(
      "explicit.toml",
      withMacos(
        base,
        `bundle_id = "com.example.test"
bundle_name = "Custom Bundle"
keyboard_name = "TestKB"
input_source_id = "com.example.test.custom"
intended_language = "ru"`,
      ),
    );
    expect(errorCodes(r)).toEqual([]);
    const spec = r.spec as ValidatedSpec;
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-bundle-exp-"));
    const bundleDir = await writeBundle(spec, tmp);
    // Корень bundle — из bundle_name, внутренности — из keyboard_name.
    expect(bundleDir.endsWith("Custom Bundle.bundle")).toBe(true);
    const p = bundlePaths(spec, tmp);
    expect(p.keylayoutFile.endsWith("TestKB.keylayout")).toBe(true);
    const info = await fs.readFile(p.infoPlist, "utf8");
    expect(info).toContain("<key>KLInfo_TestKB</key>");
    expect(info).toContain("<string>com.example.test.custom</string>");
    expect(info).toContain("<string>ru</string>");
  });

  test("build*-тексты: LF, без BOM, escape спецсимволов", async () => {
    const base = await miniText();
    const r = validateText(
      "esc.toml",
      withMacos(base, 'bundle_name = "A&B<C>"'),
    );
    expect(errorCodes(r)).toEqual([]);
    const lines = buildInfoPlistText(r.spec as ValidatedSpec);
    expect(lines.some((l) => l.includes("A&amp;B&lt;C&gt;"))).toBe(true);
    const buf = Buffer.from(lines.join("\n") + "\n", "utf8");
    expect(buf[0]).not.toBe(0xff);
    expect(buf.toString("utf8")).not.toMatch(/[^\n]\r\n/);
    expect(buildVersionPlistText(r.spec as ValidatedSpec).join("\n")).toContain("ProjectName");
    expect(buildInfoPlistStringsText(r.spec as ValidatedSpec)).toBe('"FIXV" = "FIXV";\n');
  });
});

describe("E_MACOS_DUP_BUNDLE через CLI: fail-closed", () => {
  test("один bundle_name в одном каталоге → выход 1, артефактов нет", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-dup-bundle-"));
    for (const [toml, main, short, msklc] of [
      ["one.toml", "Dup One", "DUP1", "M1"],
      ["two.toml", "Dup Two", "DUP2", "M2"],
    ] as const) {
      const text = (await miniText())
        .replace('name = "Fixture Valid Mini"', `name = "${main}"`)
        .replace('short_name = "FIXV"', `short_name = "${short}"`)
        .replace('name = "FIXV"', `name = "${msklc}"`);
      await fs.writeFile(
        path.join(dir, toml),
        withMacos(text, 'bundle_name = "Same Bundle"'),
      );
    }
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-dup-out-"));
    const code = await runCli([
      "bun",
      "index.ts",
      "--",
      "--os=macos",
      `--layout=${path.join(dir, "one.toml")}`,
      `--layout=${path.join(dir, "two.toml")}`,
      `--out=${out}`,
    ]);
    expect(code).toBe(1);
    // Fail-closed: генерация не запускалась ни для одного файла.
    expect(await fs.readdir(out)).toEqual([]);
  });
});
