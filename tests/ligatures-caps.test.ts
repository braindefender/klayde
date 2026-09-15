/**
 * Тесты фазы 5: лигатуры и caps (план docs/08 фаза 5).
 *
 * Тесты опираются только на tests/fixtures (каталог layouts/ — user-space
 * и здесь не используется). Параметризованные проверки поверх поведения
 * фаз 2/4:
 * - схемы без caps: все расширения — swap (shift, base);
 * - схемы с caps: все расширения — значения caps/caps_shift из TOML;
 * - @Trans: прозрачность → Cap 0, swap → Cap 1, лигатура через @Trans
 *   переиспользует Mod# из base без G_CAPS_LIGATURE;
 * - лигатуры в base/base_shift/altgr_shift (Mod# 0/1/4), N мест — N строк;
 * - 3- и 4-символьные раскрытия; имя лигатуры не попадает в .klc;
 * - неиспользуемая лигатура — предупреждение и отсутствие в выводе.
 */
import { describe, expect, test } from "bun:test";
import { validateFile } from "../process/layouts/validate.ts";
import { buildLayoutBlock } from "../process/generators/windows/klcLayout.ts";
import { buildKlcText } from "../process/generators/windows/klcWriter.ts";
import type { ValidatedSpec } from "../process/model/spec.ts";

async function loadSpec(file: string): Promise<ValidatedSpec> {
  const r = await validateFile(file);
  expect(r.errors).toEqual([]);
  if (!r.spec) throw new Error(`нет spec для ${file}`);
  return r.spec;
}

/** Разобрать строку данных LAYOUT: колонки + комментарий. */
function parseRow(line: string): { cols: string[]; comment: string } {
  const idx = line.indexOf("\t\t//");
  const left = idx < 0 ? line : line.slice(0, idx);
  return {
    cols: left.split("\t").filter((c) => c !== ""),
    comment: idx < 0 ? "" : line.slice(idx + 2),
  };
}

/** Сырая ячейка TOML → ожидаемый текст колонки (независимый оракул правила). */
function expectedText(raw: string): string {
  const cell = raw.trim();
  if (cell === "@None") return "-1";
  if (cell === "@Space") return "0020";
  if (cell === "@Nbsp") return "00a0";
  if (cell.startsWith("@")) return "%%";
  const cps = Array.from(cell);
  if (cps.length !== 1) throw new Error(`не одиночный символ: ${cell}`);
  const cp = (cps[0] as string).codePointAt(0) as number;
  return /^[A-Za-z0-9]$/.test(cps[0] as string)
    ? (cps[0] as string)
    : cp.toString(16).padStart(4, "0");
}

function gridCell(layout: Record<string, string>, layer: string, row: number, col: number): string {
  const lines = String(layout[layer]).replace(/\r\n/g, "\n").split("\n");
  while (lines[0]?.trim() === "") lines.shift();
  while (lines[lines.length - 1]?.trim() === "") lines.pop();
  return (lines[row - 1] as string).trim().split(/ +/)[col - 1] as string;
}

async function tomlLayout(file: string): Promise<Record<string, string>> {
  const text = await Bun.file(file).text();
  return (Bun.TOML.parse(text) as { layout: Record<string, string> }).layout;
}

describe("caps=shift: все расширения — swap (shift, base)", () => {
  const files = [
    "tests/fixtures/golden-english.toml",
    "tests/fixtures/golden-english-inverted.toml",
    "tests/fixtures/golden-russian.toml",
    "tests/fixtures/golden-russian-inverted.toml",
  ];
  for (const file of files) {
    test(`${file}: 30 swap-расширений`, async () => {
      const spec = await loadSpec(file);
      expect(spec.capsIsShift).toBe(true);
      const { dataRows } = buildLayoutBlock(spec);
      let extCount = 0;
      for (let i = 0; i < dataRows.length; i++) {
        const main = parseRow(dataRows[i] as string);
        if (main.cols[0] === "-1") continue;
        if (main.cols[2] !== "SGCap") continue;
        const ext = parseRow(dataRows[i + 1] as string);
        expect(ext.cols.slice(0, 3)).toEqual(["-1", "-1", "0"]);
        // e0 === c1 (shift), e1 === c0 (base) — строковый уровень.
        expect(ext.cols[3]).toBe(main.cols[4]);
        expect(ext.cols[4]).toBe(main.cols[3]);
        extCount++;
      }
      expect(extCount).toBe(30);
    });
  }
});

describe("явные caps: все расширения — значения слоёв", () => {
  const files = [
    "tests/fixtures/golden-merged.toml",
    "tests/fixtures/golden-merged-inverted.toml",
  ];
  for (const file of files) {
    test(`${file}: 30 расширений из caps/caps_shift`, async () => {
      const spec = await loadSpec(file);
      expect(spec.capsIsShift).toBe(false);
      const layout = await tomlLayout(file);
      const { LAYOUT_SC_ORDER, positionBySc } = await import(
        "../process/generators/windows/positions.ts"
      );
      const want = new Map<string, [string, string]>();
      for (const sc of LAYOUT_SC_ORDER as readonly string[]) {
        const pos = positionBySc(sc);
        if (!pos || pos.row < 2 || pos.row > 4) continue;
        want.set(sc, [
          expectedText(gridCell(layout, "caps", pos.row, pos.col)),
          expectedText(gridCell(layout, "caps_shift", pos.row, pos.col)),
        ]);
      }
      const { dataRows } = buildLayoutBlock(spec);
      let extCount = 0;
      for (let i = 0; i < dataRows.length; i++) {
        const main = parseRow(dataRows[i] as string);
        if (main.cols[0] === "-1" || main.cols[2] !== "SGCap") continue;
        const ext = parseRow(dataRows[i + 1] as string);
        const [e0, e1] = want.get(main.cols[0] as string) as [string, string];
        expect([ext.cols[3], ext.cols[4]]).toEqual([e0, e1]);
        extCount++;
      }
      expect(extCount).toBe(30);
    });
  }
});

describe("лигатуры вне altgr: Mod# 0/1/4, N мест — N строк", () => {
  test("lig-base: 3 места → 3 строки (02/0, 03/4, 04/1)", async () => {
    const spec = await loadSpec("tests/fixtures/lig-base.toml");
    const { dataRows, ligRows } = buildLayoutBlock(spec);
    expect(ligRows.map((r) => parseRow(r).cols.slice(0, 3))).toEqual([
      ["1", "0", "003d"],
      ["2", "4", "003d"],
      ["3", "1", "003d"],
    ]);
    for (const row of ligRows) {
      expect(parseRow(row).cols.slice(2)).toEqual(["003d", "003e"]);
      expect(parseRow(row).comment).toBe("// EQUALS SIGN + GREATER-THAN SIGN");
    }
    // %% в нужных колонках: SC 02 c0, SC 04 c1, SC 03 c7.
    const bySc = new Map(dataRows.filter((r) => !r.startsWith("-1")).map((r) => {
      const c = parseRow(r).cols;
      return [c[0] as string, c.slice(3)];
    }));
    expect(bySc.get("02")?.[0]).toBe("%%");
    expect(bySc.get("04")?.[1]).toBe("%%");
    expect(bySc.get("03")?.[4]).toBe("%%");
    // На K лигатур больше нет.
    expect(ligRows.some((r) => r.startsWith("K\t"))).toBe(false);
  });
});

describe("многосимвольные раскрытия", () => {
  test("lig-multi: Tri (3 кода) и Quad (4 кода)", async () => {
    const spec = await loadSpec("tests/fixtures/lig-multi.toml");
    const { ligRows } = buildLayoutBlock(spec);
    // FatArr на SC 0d ×4 состояния + Tri + Quad.
    expect(ligRows.length).toBe(6);
    const tri = parseRow(ligRows.find((r) => r.startsWith("2\t")) as string);
    expect(tri.cols).toEqual(["2", "0", "002e", "002e", "002e"]);
    expect(tri.comment).toBe("// FULL STOP + FULL STOP + FULL STOP");
    const quad = parseRow(ligRows.find((r) => r.startsWith("3\t")) as string);
    expect(quad.cols).toEqual(["3", "0", "003d", "003d", "003e", "003e"]);
    expect(quad.comment).toBe(
      "// EQUALS SIGN + EQUALS SIGN + GREATER-THAN SIGN + GREATER-THAN SIGN",
    );
  });
});

describe("@Trans: Cap 0/1 без расширений", () => {
  test("valid-trans: swap → Cap 1, прозрачность → Cap 0, distinct → SGCap", async () => {
    const spec = await loadSpec("tests/fixtures/valid-trans.toml");
    expect(spec.capsIsShift).toBe(false);
    const { dataRows, ligRows } = buildLayoutBlock(spec);
    const mains = dataRows.filter((r) => !r.startsWith("-1"));
    const exts = dataRows.filter((r) => r.startsWith("-1"));
    // SC 29 пуст везде (как SC 28 в эталонах) → 49 основных; единственное
    // расширение — distinct-пара r2c3 (SC 12, X/x).
    expect(mains.length).toBe(49);
    expect(exts.length).toBe(1);
    const bySc = new Map(mains.map((r) => [parseRow(r).cols[0] as string, parseRow(r)]));
    // r2c1 (SC 10): caps==shift → Cap 1 без расширения.
    expect(bySc.get("10")?.cols[2]).toBe("1");
    // r2c2 (SC 11): @Trans → Cap 0 без расширения.
    expect(bySc.get("11")?.cols[2]).toBe("0");
    // r2c3 (SC 12): distinct → SGCap с расширением [X, x].
    expect(bySc.get("12")?.cols[2]).toBe("SGCap");
    const qi = dataRows.findIndex((r) => r.startsWith("12\t"));
    expect(parseRow(dataRows[qi + 1] as string).cols.slice(0, 5)).toEqual([
      "-1",
      "-1",
      "0",
      "X",
      "x",
    ]);
    // r2c10 (SC 19, VK P): лигатура base через @Trans → Cap 0, %% в c0,
    // раскрытие — единственная строка P/Mod#0 (без дубля из caps).
    expect(bySc.get("19")?.cols[2]).toBe("0");
    expect(bySc.get("19")?.cols[3]).toBe("%%");
    expect(ligRows.filter((r) => r.startsWith("P\t")).map((r) => parseRow(r).cols.slice(0, 2))).toEqual([
      ["P", "0"],
    ]);
  });
});

describe("имена лигатур не попадают в .klc", () => {
  test("6 схем + фикстуры: ни FatArr/ThinArr/Tri/Quad/Unused", async () => {
    const files = [
      "tests/fixtures/golden-english.toml",
      "tests/fixtures/golden-merged.toml",
      "tests/fixtures/golden-russian.toml",
      "tests/fixtures/valid-trans.toml",
      "tests/fixtures/lig-base.toml",
      "tests/fixtures/lig-multi.toml",
      "tests/fixtures/w_lig_unused.toml",
    ];
    for (const file of files) {
      const text = buildKlcText(await loadSpec(file)).join("\n");
      for (const name of ["FatArr", "ThinArr", "Tri", "Quad", "Unused"]) {
        expect(text.includes(name)).toBe(false);
      }
    }
  });

  test("w_lig_unused: те же строки LIGATURE, что у valid-mini", async () => {
    const a = buildLayoutBlock(await loadSpec("tests/fixtures/w_lig_unused.toml"));
    const b = buildLayoutBlock(await loadSpec("tests/fixtures/valid-mini.toml"));
    expect(a.ligRows).toEqual(b.ligRows);
    expect(a.ligRows.length).toBeGreaterThan(0);
  });
});
