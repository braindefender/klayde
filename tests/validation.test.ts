/**
 * Тесты фазы 2: валидация V0–V9 (docs/03, план docs/08 фаза 2).
 *
 * Тесты опираются только на tests/fixtures (каталог layouts/ — user-space
 * и здесь не используется):
 * - замороженные эталонные схемы `golden-*.toml` (входы golden-тестов,
 *   побайтово соответствуют tests/golden/*.klc) валидны без ошибок
 *   и предупреждений;
 * - сломанные копии фикстур дают ровно ожидаемые коды с координатами;
 * - E_UNICODE/E_IO/V9-предупреждения — прямыми юнит-тестами
 *   (через TOML-текст недостижимы: парсер отклоняет суррогаты
 *   и сырые контроли, а V9 требует пару файлов).
 */
import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { crossCheck } from "../process/validation/crosscheck.ts";
import { validateFile, validateText, checkScalarValue } from "../process/validation/validate.ts";
import type { ValidationCode } from "../process/validation/report.ts";
import { runCli } from "../process/main.ts";

async function validateFixture(name: string) {
  const file = `tests/fixtures/${name}`;
  const text = await fs.readFile(file, "utf8");
  return validateText(file, text);
}

function errorCodes(result: { errors: { code: ValidationCode }[] }): ValidationCode[] {
  return result.errors.map((e) => e.code).sort();
}

function warnCodes(result: { warnings: { code: ValidationCode }[] }): ValidationCode[] {
  return result.warnings.map((w) => w.code).sort();
}

describe("эталонные схемы fixtures/", () => {
  const files = [
    "tests/fixtures/golden-english.toml",
    "tests/fixtures/golden-english-inverted.toml",
    "tests/fixtures/golden-merged.toml",
    "tests/fixtures/golden-merged-inverted.toml",
    "tests/fixtures/golden-russian.toml",
    "tests/fixtures/golden-russian-inverted.toml",
    "tests/fixtures/valid-mini.toml",
    "tests/fixtures/valid-trans.toml",
  ];
  for (const file of files) {
    test(`${file}: без ошибок и предупреждений`, async () => {
      const r = await validateFile(file);
      expect(errorCodes(r)).toEqual([]);
      expect(warnCodes(r)).toEqual([]);
      expect(r.spec).not.toBeNull();
    });
  }

  test("caps обязательны: все golden содержат caps/caps_shift 5×10", async () => {
    for (const file of files.filter((f) => f.includes("golden-"))) {
      const r = await validateFile(file);
      expect(r.spec?.layers.caps.length).toBe(5);
      expect(r.spec?.layers.capsShift.length).toBe(5);
      for (const matrix of [r.spec?.layers.caps, r.spec?.layers.capsShift]) {
        expect(matrix?.length).toBe(5);
        for (const row of matrix ?? []) expect(row.length).toBe(10);
      }
    }
  });
});

describe("@Trans: резолв в base/base_shift", () => {
  test("valid-trans: @Trans раскрыт в копии", async () => {
    const r = await validateFixture("valid-trans.toml");
    expect(errorCodes(r)).toEqual([]);
    expect(warnCodes(r)).toEqual([]);
    const spec = r.spec;
    expect(spec).not.toBeNull();
    // r2c2 caps=@Trans → копия base 'l'; caps_shift=@Trans → копия base_shift 'l'.
    expect(spec?.layers.caps?.[1]?.[1]).toEqual({ kind: "char", codePoint: 0x6c });
    expect(spec?.layers.capsShift?.[1]?.[1]).toEqual({ kind: "char", codePoint: 0x6c });
    // r2c10 caps=@Trans поверх лигатуры base → копия раскрытия FatArr.
    expect(spec?.layers.caps?.[1]?.[9]).toEqual({
      kind: "ligature",
      name: "FatArr",
      codePoints: [0x3d, 0x3e],
    });
    // Копия глубокая: мутация caps не трогает base.
    (spec?.layers.caps?.[1]?.[9] as { codePoints: number[] }).codePoints.push(0x21);
    expect(spec?.layers.base[1]?.[9]).toEqual({
      kind: "ligature",
      name: "FatArr",
      codePoints: [0x3d, 0x3e],
    });
  });
});

describe("valid-mini: структура spec", () => {
  test("матрицы 5×10, лигатуры, обязательные caps", async () => {
    const r = await validateFixture("valid-mini.toml");
    expect(errorCodes(r)).toEqual([]);
    expect(warnCodes(r)).toEqual([]);
    const spec = r.spec;
    expect(spec).not.toBeNull();
    for (const matrix of [
      spec?.layers.base,
      spec?.layers.baseShift,
      spec?.layers.altgr,
      spec?.layers.altgrShift,
      spec?.layers.caps,
      spec?.layers.capsShift,
    ]) {
      expect(matrix?.length).toBe(5);
      for (const row of matrix ?? []) expect(row.length).toBe(10);
    }
    expect([...(spec?.usedLigatures.keys() ?? [])]).toEqual(["FatArr"]);
    expect(spec?.usedLigatures.get("FatArr")).toEqual([0x3d, 0x3e]);
    // Точечные токены: R5 = Space, None, Nbsp, Ligature.
    const r5 = spec?.layers.base[4] ?? [];
    expect(r5[0]).toEqual({ kind: "space" });
    expect(r5[1]).toEqual({ kind: "none" });
    expect(r5[2]).toEqual({ kind: "nbsp" });
    expect(r5[3]?.kind).toBe("ligature");
    // Одиночный @ — at-sign U+0040 (docs/02, 6.3).
    expect(spec?.layers.base[3]?.[7]).toEqual({ kind: "char", codePoint: 0x40 });
  });
});

describe("фикстуры: ровно ожидаемые коды", () => {
  const cases: [string, ValidationCode[]][] = [
    ["e_toml_empty.toml", ["E_TOML_EMPTY"]],
    ["e_toml_syntax.toml", ["E_TOML_SYNTAX"]],
    ["e_schema_unknown_key.toml", ["E_SCHEMA_UNKNOWN_KEY"]],
    ["e_schema_type.toml", ["E_SCHEMA_TYPE"]],
    ["e_main_name.toml", ["E_MAIN_NAME"]],
    ["e_main_short_name.toml", ["E_MAIN_SHORT_NAME"]],
    ["e_msklc_name.toml", ["E_MSKLC_NAME"]],
    ["e_msklc_company.toml", ["E_MSKLC_COMPANY"]],
    ["e_msklc_copyright.toml", ["E_MSKLC_COPYRIGHT"]],
    ["e_msklc_description.toml", ["E_MSKLC_DESCRIPTION"]],
    ["e_lig_name.toml", ["E_LIG_NAME"]],
    ["e_lig_reserved.toml", ["E_LIG_RESERVED"]],
    ["e_lig_length.toml", ["E_LIG_LENGTH"]],
    ["e_lig_control.toml", ["E_LIG_CONTROL"]],
    ["e_grid_geometry.toml", ["E_GRID_GEOMETRY"]],
    ["e_grid_tab.toml", ["E_GRID_TAB"]],
    ["e_grid_empty_cell.toml", ["E_GRID_EMPTY_CELL"]],
    ["e_cell_unknown_ref.toml", ["E_CELL_UNKNOWN_REF"]],
    ["e_cell_length.toml", ["E_CELL_LENGTH"]],
    ["e_cell_control.toml", ["E_CELL_CONTROL"]],
    ["e_cell_at.toml", ["E_CELL_AT"]],
    ["e_trans_layer.toml", ["E_CELL_AT"]],
    // Половинчатый caps без пары — отсутствие обязательного слоя (V2),
    // отдельный код E_CAPS_HALF упразднён: caps/caps_shift обязательны.
    ["e_caps_half.toml", ["E_SCHEMA_UNKNOWN_KEY"]],
    // Открывающий и закрывающий """ — по ошибке на строку (docs/03, V0).
    ["e_quotes_triple_double.toml", ["E_QUOTES_TRIPLE_DOUBLE", "E_QUOTES_TRIPLE_DOUBLE"]],
  ];
  for (const [fixture, want] of cases) {
    test(`${fixture} → ${want.join("+")}`, async () => {
      const r = await validateFixture(fixture);
      expect(errorCodes(r)).toEqual([...want].sort());
      expect(warnCodes(r)).toEqual([]);
      expect(r.spec).toBeNull();
    });
  }
});

describe("координаты и подсказки", () => {
  test("E_CELL_UNKNOWN_REF: строка/колонка сетки + возможное имя", async () => {
    const r = await validateFixture("e_cell_unknown_ref.toml");
    expect(r.errors.length).toBe(1);
    expect(r.errors[0]?.message).toContain("строка 5, колонка 4");
    expect(r.errors[0]?.message).toContain('"@FatArrr"');
    expect(r.errors[0]?.message).toContain('"@FatArr"');
  });

  test("E_GRID_GEOMETRY: сколько получено", async () => {
    const r = await validateFixture("e_grid_geometry.toml");
    expect(r.errors[0]?.message).toContain("[layout].base");
    expect(r.errors[0]?.message).toContain("получено 4 строк");
  });

  test("E_QUOTES_TRIPLE_DOUBLE: номера строк файла", async () => {
    const r = await validateFixture("e_quotes_triple_double.toml");
    const lines = r.errors.map((e) => e.message.match(/строка (\d+)/)?.[1]);
    expect(lines).toEqual(["23", "29"]);
  });

  test("E_CELL_CONTROL: код символа", async () => {
    const r = await validateFixture("e_cell_control.toml");
    expect(r.errors[0]?.message).toContain("U+0007");
    expect(r.errors[0]?.message).toContain("строка 3, колонка 4");
  });
});

describe("предупреждения", () => {
  test("W_LIG_UNUSED: ошибки пусты, spec построен", async () => {
    const r = await validateFixture("w_lig_unused.toml");
    expect(errorCodes(r)).toEqual([]);
    expect(warnCodes(r)).toEqual(["W_LIG_UNUSED"]);
    expect(r.spec).not.toBeNull();
    expect(r.spec?.usedLigatures.has("Unused")).toBe(false);
  });

  test("V9 напрямую: W_DUP_SHORT и W_DUP_NAME", () => {
    const diags = crossCheck([
      { file: "a.toml", mainName: "N", mainShortName: "S", msklcName: "A" },
      { file: "b.toml", mainName: "N", mainShortName: "S", msklcName: "B" },
    ]);
    expect(diags.map((d) => d.code).sort()).toEqual(["W_DUP_NAME", "W_DUP_SHORT"]);
    expect(diags.every((d) => d.severity === "warning")).toBe(true);
  });
});

describe("V9 через файлы: E_MSKLC_DUP_NAME", () => {
  test("второй файл ссылается на первый", async () => {
    const a = await validateFile("tests/fixtures/dup_name_a.toml");
    const b = await validateFile("tests/fixtures/dup_name_b.toml");
    expect(errorCodes(a)).toEqual([]);
    expect(errorCodes(b)).toEqual([]);
    const diags = crossCheck(
      [a, b].flatMap((r) =>
        r.spec
          ? [{
              file: r.file,
              mainName: r.spec.main.name,
              mainShortName: r.spec.main.shortName,
              msklcName: r.spec.msklc.name,
            }]
          : [],
      ),
    );
    expect(diags.length).toBe(1);
    expect(diags[0]?.code).toBe("E_MSKLC_DUP_NAME");
    expect(diags[0]?.file).toBe("tests/fixtures/dup_name_b.toml");
    expect(diags[0]?.message).toContain("tests/fixtures/dup_name_a.toml");
  });
});

describe("недостижимое через TOML", () => {
  test("E_UNICODE: суррогат — прямое unit-покрытие checkScalarValue", () => {
    expect(checkScalarValue(0xd800)).toBe("E_UNICODE");
    expect(checkScalarValue(0xdfff)).toBe("E_UNICODE");
    expect(checkScalarValue(0x110000)).toBe("E_UNICODE");
    expect(checkScalarValue(0x20bd)).toBeNull();
    expect(checkScalarValue(0x40)).toBeNull();
  });

  test("E_IO: несуществующий файл", async () => {
    const r = await validateFile("tests/fixtures/does-not-exist.toml");
    expect(errorCodes(r)).toEqual(["E_IO"]);
    expect(r.spec).toBeNull();
  });
});

describe("runCli с валидацией", () => {
  test("сломанная схема → выход 1, генерации нет", async () => {
    const code = await runCli([
      "bun",
      "index.ts",
      "--",
      "--layout=tests/fixtures/e_cell_at.toml",
      "--os=windows",
    ]);
    expect(code).toBe(1);
  });

  test("валидная схема → выход 0", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-valid-"));
    const code = await runCli([
      "bun",
      "index.ts",
      "--",
      "--layout=tests/fixtures/valid-mini.toml",
      "--os=windows",
      `--out=${tmp}`,
    ]);
    expect(code).toBe(0);
    expect(await fs.readdir(path.join(tmp, "windows"))).toEqual(["Fixture Valid Mini.klc"]);
  });
});
