/**
 * Тесты фазы 4: генератор KLC (docs/06; план docs/08 фаза 4).
 *
 * Golden-тесты опираются только на tests/fixtures + tests/golden
 * (каталог layouts/ — user-space и здесь не используется): входы —
 * замороженные копии схем `tests/fixtures/golden-*.toml`, эталоны —
 * tests/golden/*.klc. Сгенерированные .klc диффаются с эталонами.
 * Допуски — только зафиксированные:
 * - LANGUAGENAMES = DESCRIPTIONS (решение из docs/02, раздел 4);
 * - COPYRIGHT без пробела после © (TOML `©2026` vs эталон `© 2026`);
 * - KBD inverted-файлов (эталон переставляет суффикс: ULOENI→ULOIEN,
 *   ULOMI→ULOIM, ULORUI→ULOIRU — авторская правка вне TOML);
 * - известный дрейф «сетка новее эталона» (TOML всегда прав, см. фазу 4):
 *   SC 53 (DECIMAL: сетка 002e/002c, эталон -1/-1),
 *   SC 2f c7 (сетка -1, эталон дублирует c6=221a),
 *   english-inverted SC 14/17/32 (сетка с контентом, эталон -1/-1);
 * - Merged DECIMAL: эталон без концевого пробела в комментарии.
 * Расхождения вне допусков — падение с контекстом.
 */
import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateFile } from "../process/validation/validate.ts";
import { buildKlcText, serializeKlc, writeKlcFile } from "../process/generators/windows/klcWriter.ts";
import { KlcBuildError } from "../process/generators/windows/klcLayout.ts";
import type { ValidatedSpec } from "../process/model/spec.ts";

const PAIRS: [string, string][] = [
  ["tests/fixtures/golden-english.toml", "tests/golden/Universal Layout Ortho English.klc"],
  ["tests/fixtures/golden-english-inverted.toml", "tests/golden/Universal Layout Ortho English Inverted.klc"],
  ["tests/fixtures/golden-merged.toml", "tests/golden/Universal Layout Ortho Merged.klc"],
  ["tests/fixtures/golden-merged-inverted.toml", "tests/golden/Universal Layout Ortho Merged Inverted.klc"],
  ["tests/fixtures/golden-russian.toml", "tests/golden/Universal Layout Ortho Russian.klc"],
  ["tests/fixtures/golden-russian-inverted.toml", "tests/golden/Universal Layout Ortho Russian Inverted.klc"],
];

async function loadSpec(layout: string): Promise<ValidatedSpec> {
  const r = await validateFile(layout);
  expect(r.errors).toEqual([]);
  if (!r.spec) throw new Error(`нет spec для ${layout}`);
  return r.spec;
}

async function readGoldenLines(goldenFile: string): Promise<string[]> {
  const bytes = await fs.readFile(goldenFile);
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xfe);
  return bytes.slice(2).toString("utf16le").split("\r\n");
}

interface LineDiff {
  index: number;
  want: string;
  got: string;
}

/** Построчный дифф с допусками; возвращает недопустимые расхождения. */
function diffWithTolerances(goldenFile: string, want: string[], got: string[]): LineDiff[] {
  const bad: LineDiff[] = [];
  const max = Math.max(want.length, got.length);
  for (let i = 0; i < max; i++) {
    const w = want[i] ?? "<нет строки>";
    const g = got[i] ?? "<нет строки>";
    if (w === g) continue;
    if (isTolerated(goldenFile, w, g, want, i)) continue;
    bad.push({ index: i, want: w, got: g });
  }
  return bad;
}

function isTolerated(
  goldenFile: string,
  want: string,
  got: string,
  wantLines: string[],
  index: number,
): boolean {
  // LANGUAGENAMES = DESCRIPTIONS (docs/02, раздел 4).
  if (index > 0 && wantLines[index - 2] === "LANGUAGENAMES") return true;
  // COPYRIGHT: TOML `©2026` vs эталон `© 2026`.
  if (want.startsWith("COPYRIGHT\t\"© 2026 ") && got.startsWith("COPYRIGHT\t\"©2026 ")) {
    return true;
  }
  // KBD inverted-файлов: эталон переставляет суффикс (ULOENI→ULOIEN,
  // ULOMI→ULOIM, ULORUI→ULOIRU) — авторская правка вне TOML.
  if (goldenFile.includes("Inverted") && want.startsWith("KBD\t") && got.startsWith("KBD\t")) {
    return true;
  }
  return isKnownDrift(goldenFile, want, got);
}

/** Разбить строку данных на колонки и комментарий. */
function splitKlcLine(line: string): { cols: string[]; comment: string } {
  const idx = line.indexOf("\t\t//");
  if (idx < 0) return { cols: line.split("\t").filter((c) => c !== ""), comment: "" };
  return {
    cols: line.slice(0, idx).split("\t").filter((c) => c !== ""),
    comment: line.slice(idx + 2),
  };
}

/**
 * Известный дрейф «сетка новее эталона»: сетка (got) всегда права.
 * Allowlist точных ячеек — всё остальное падает громко.
 */
function isKnownDrift(goldenFile: string, want: string, got: string): boolean {
  const w = splitKlcLine(want);
  const g = splitKlcLine(got);
  // Только основные строки LAYOUT: [sc, vk, cap, c0, c1, c2, c6, c7].
  if (w.cols.length !== 8 || g.cols.length !== 8) return false;
  if (w.cols[0] !== g.cols[0]) return false;
  const sc = w.cols[0] as string;
  const sameHead =
    w.cols[1] === g.cols[1] && w.cols[2] === g.cols[2] &&
    w.cols[3] === g.cols[3] && w.cols[4] === g.cols[4] && w.cols[5] === g.cols[5];
  if (!sameHead) return false;
  // SC 53 (DECIMAL): сетка 002e/002c, в эталоне не задано (-1/-1).
  // (Покрывает и merged-вариант без концевого пробела комментария.)
  if (
    sc === "53" && w.cols[6] === "-1" && w.cols[7] === "-1" &&
    g.cols[6] === "002e" && g.cols[7] === "002c"
  ) {
    return true;
  }
  // SC 2f c7: эталон дублирует c6 (221a), сетка права (-1).
  if (
    sc === "2f" && w.cols[6] === "221a" && w.cols[7] === "221a" &&
    g.cols[6] === "221a" && g.cols[7] === "-1"
  ) {
    return true;
  }
  // english-inverted SC 14/17/32: сетка с контентом, в эталоне -1/-1.
  if (
    goldenFile.endsWith("Ortho English Inverted.klc") &&
    (sc === "14" || sc === "17" || sc === "32") &&
    w.cols[6] === "-1" && w.cols[7] === "-1" &&
    g.cols[6] !== "-1" && g.cols[7] !== "-1"
  ) {
    return true;
  }
  return false;
}

describe("golden: 6 схем побайтово в пределах допусков", () => {
  for (const [layout, golden] of PAIRS) {
    test(`${layout}`, async () => {
      const spec = await loadSpec(layout);
      const got = buildKlcText(spec);
      const want = await readGoldenLines(golden);
      const bad = diffWithTolerances(golden, want, got);
      if (bad.length > 0) {
        const shown = bad.slice(0, 10).map(
          (d) => `строка ${d.index + 1}:\n  эталон: ${JSON.stringify(d.want)}\n  у нас:  ${JSON.stringify(d.got)}`,
        );
        throw new Error(
          `расхождений вне допусков: ${bad.length} (показаны ${shown.length}):\n${shown.join("\n")}`,
        );
      }
      // Строк поровну (допуски не скрывают сдвиги).
      expect(got.length).toBe(want.length);
    });
  }
});

describe("klcWriter: байты и атомарная запись", () => {
  test("BOM + CRLF + имя <main.name>.klc в <out>/windows/", async () => {
    const spec = await loadSpec("tests/fixtures/golden-merged.toml");
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-klc-"));
    const outFile = await writeKlcFile(spec, tmp);
    expect(outFile).toBe(path.join(tmp, "windows", "Universal Layout Ortho Merged.klc"));
    const buf = await fs.readFile(outFile);
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xfe);
    const text = buf.slice(2).toString("utf16le");
    expect(text).not.toMatch(/[^\r]\n/);
    expect(text.includes("\r\n")).toBe(true);
    expect(text.endsWith("ENDKBD\r\n")).toBe(true);
    expect(await fs.readdir(path.join(tmp, "windows"))).toEqual([
      "Universal Layout Ortho Merged.klc",
    ]);
  });

  test("serializeKlc: BOM FF FE", () => {
    const buf = serializeKlc(["KBD\tx", "", "ENDKBD", ""]);
    expect([...buf.slice(0, 2)]).toEqual([0xff, 0xfe]);
    expect(buf.slice(2).toString("utf16le")).toBe("KBD\tx\r\n\r\nENDKBD\r\n");
  });
});

describe("структура LAYOUT (без эталона)", () => {
  test("merged: 49 основных + 30 расширений, SC 28 пропущен", async () => {
    const spec = await loadSpec("tests/fixtures/golden-merged.toml");
    const { dataRows, ligRows } = (await import("../process/generators/windows/klcLayout.ts")).buildLayoutBlock(spec);
    const mains = dataRows.filter((r) => !r.startsWith("-1"));
    const exts = dataRows.filter((r) => r.startsWith("-1"));
    expect(mains.length).toBe(49);
    expect(exts.length).toBe(30);
    expect(mains.some((r) => r.startsWith("28\t"))).toBe(false);
    expect(ligRows.length).toBe(2);
  });

  test("явные caps english: буква Q (SC 10) — Cap 1 без расширения", async () => {
    const spec = await loadSpec("tests/fixtures/golden-english.toml");
    const { buildLayoutBlock } = await import("../process/generators/windows/klcLayout.ts");
    const { dataRows } = buildLayoutBlock(spec);
    const qi = dataRows.findIndex((r) => r.startsWith("10\t"));
    expect(dataRows[qi]).toMatch(/^10\tQ\t\t1\tq\tQ\t/);
    // Следующая строка — уже SC 11 (W), а не SGCap-расширение.
    expect(dataRows[qi + 1]).toMatch(/^11\tW\t\t1\t/);
  });

  test("G_CAPS_LIGATURE: лигатура в caps — честная ошибка", async () => {
    const spec = await loadSpec("tests/fixtures/golden-merged.toml");
    const lig: { kind: "ligature"; name: string; codePoints: number[] } = {
      kind: "ligature",
      name: "FatArr",
      codePoints: [0x3d, 0x3e],
    };
    const patched: ValidatedSpec = {
      ...spec,
      layers: {
        ...spec.layers,
        // r2c1 (SC 10, SGCap): лигатура в caps обязана падать.
        caps: spec.layers.caps.map((row, ri) =>
          row.map((c, ci) => (ri === 1 && ci === 0 ? { ...lig } : c)),
        ),
      },
    };
    const { buildLayoutBlock } = await import("../process/generators/windows/klcLayout.ts");
    try {
      buildLayoutBlock(patched);
      throw new Error("ожидался KlcBuildError");
    } catch (err) {
      expect(err).toBeInstanceOf(KlcBuildError);
      expect((err as KlcBuildError).code).toBe("G_CAPS_LIGATURE");
    }
  });

  test("G_CAPS_MODE: независимые caps при caps_is_shift=true — честная ошибка", async () => {
    const spec = await loadSpec("tests/fixtures/golden-english.toml");
    expect(spec.main.capsIsShift).toBe(true);
    const patched: ValidatedSpec = {
      ...spec,
      layers: {
        ...spec.layers,
        // r2c1 (SC 10, SGCap): caps перестаёт совпадать с shift → SGCap,
        // что запрещено режимом caps_is_shift=true.
        caps: spec.layers.caps.map((row, ri) =>
          row.map((c, ci) =>
            ri === 1 && ci === 0
              ? { kind: "char", codePoint: 0x78 } as const
              : c,
          ),
        ),
      },
    };
    const { buildLayoutBlock } = await import("../process/generators/windows/klcLayout.ts");
    try {
      buildLayoutBlock(patched);
      throw new Error("ожидался KlcBuildError");
    } catch (err) {
      expect(err).toBeInstanceOf(KlcBuildError);
      expect((err as KlcBuildError).code).toBe("G_CAPS_MODE");
    }
  });
});
