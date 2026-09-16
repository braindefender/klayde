/**
 * Тесты генератора macOS `.keylayout` (docs/10).
 *
 * Тесты опираются только на tests/fixtures (каталог layouts/ —
 * user-space и здесь не используется).
 */
import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateFile } from "../process/validation/validate.ts";
import type { ValidatedSpec } from "../process/model/spec.ts";
import {
  buildKeyElement,
  buildKeyMaps,
  computeMaxOut,
  encodeOutput,
  escapeXmlAttr,
  KeylayoutBuildError,
} from "../process/generators/macos/keylayoutLayout.ts";
import {
  buildKeylayoutText,
  computeKeyboardId,
  mapSetId,
  serializeKeylayout,
  writeKeylayoutFile,
} from "../process/generators/macos/keylayoutWriter.ts";

const GOLDEN_FIXTURES = [
  "tests/fixtures/golden-english.toml",
  "tests/fixtures/golden-english-inverted.toml",
  "tests/fixtures/golden-merged.toml",
  "tests/fixtures/golden-merged-inverted.toml",
  "tests/fixtures/golden-russian.toml",
  "tests/fixtures/golden-russian-inverted.toml",
];

const OUR_CODES = new Set([
  18, 19, 20, 21, 23, 22, 26, 28, 25, 29,
  12, 13, 14, 15, 17, 16, 32, 34, 31, 35,
  0, 1, 2, 3, 5, 4, 38, 40, 37, 41,
  6, 7, 8, 9, 11, 45, 46, 43, 47, 44,
  49, 50, 27, 24, 33, 30, 42, 39, 10, 65,
]);

async function loadSpec(file: string): Promise<ValidatedSpec> {
  const r = await validateFile(file);
  expect(r.errors).toEqual([]);
  if (!r.spec) throw new Error(`нет spec для ${file}`);
  return r.spec;
}

/** Разобрать строку <key code output/> на (code, output-сырец). */
function parseKey(line: string): [number, string] {
  const m = line.match(/<key code="(\d+)" output="(.*)"\/>/);
  if (!m) throw new Error(`не <key>-строка: ${line}`);
  return [Number(m[1]), m[2] as string];
}

describe("encodeOutput", () => {
  test("токены: none→пусто, space/nb sp — литералы", () => {
    expect(encodeOutput({ kind: "none" })).toBe("");
    expect(encodeOutput({ kind: "space" })).toBe(" ");
    const nbsp = encodeOutput({ kind: "nbsp" });
    expect(nbsp.codePointAt(0)).toBe(0xa0);
  });
  test("char — сырым символом, лигатура — строкой раскрытия", () => {
    expect(encodeOutput({ kind: "char", codePoint: 0x41 })).toBe("A");
    expect(encodeOutput({ kind: "char", codePoint: 0x22 })).toBe('"');
    expect(encodeOutput({ kind: "char", codePoint: 0x431 })).toBe("б");
    expect(encodeOutput({ kind: "ligature", name: "FatArr", codePoints: [0x3d, 0x3e] })).toBe("=>");
  });
});

describe("escapeXmlAttr", () => {
  test("экранирует спецсимволы, остальное — сырым UTF-8", () => {
    expect(escapeXmlAttr('"a&b<c>d\'e')).toBe("&quot;a&amp;b&lt;c&gt;d'e");
    expect(escapeXmlAttr("бе")).toBe("бе");
    expect(escapeXmlAttr(String.fromCodePoint(0xa0))).toBe(String.fromCodePoint(0xa0));
    expect(escapeXmlAttr("ab")).toBe("a&#x0007;b");
  });
});

describe("buildKeyMaps: карты 0–5", () => {
  test("все 50 кодов в каждой карте, сортировка по коду", async () => {
    const spec = await loadSpec("tests/fixtures/golden-merged.toml");
    const maps = buildKeyMaps(spec);
    expect(maps.length).toBe(6);
    for (const rows of maps) {
      const codes = rows
        .map((r) => Number((r.match(/<key code="(\d+)"/) as RegExpMatchArray)[1]))
        .filter((c) => OUR_CODES.has(c));
      expect(codes.length).toBe(50);
      expect([...codes].sort((a, b) => a - b)).toEqual(codes);
    }
  });

  test("caps-карты 2/3 — значения слоёв caps/caps_shift", async () => {
    const spec = await loadSpec("tests/fixtures/golden-merged.toml");
    const maps = buildKeyMaps(spec);
    const byCode = (rows: string[], code: number): string => {
      const line = rows.find((r) => r.includes(`code="${code}"`));
      if (!line) throw new Error(`нет кода ${code}`);
      return parseKey(line)[1];
    };
    // K (код 40): caps л/Л.
    expect(byCode(maps[2] as string[], 40)).toBe("л");
    expect(byCode(maps[3] as string[], 40)).toBe("Л");
  });

  test("лигатуры — строками в своих картах (код 40, карты 4/5)", async () => {
    const spec = await loadSpec("tests/fixtures/golden-merged.toml");
    const maps = buildKeyMaps(spec);
    const byCode = (rows: string[], code: number): string => {
      const line = rows.find((r) => r.includes(`code="${code}"`));
      if (!line) throw new Error(`нет кода ${code}`);
      return parseKey(line)[1];
    };
    expect(byCode(maps[4] as string[], 40)).toBe("=&gt;");
    expect(byCode(maps[5] as string[], 40)).toBe("-&gt;");
  });

  test("@None → output=\"\", код 10 и 65 из сетки", async () => {
    const spec = await loadSpec("tests/fixtures/golden-merged.toml");
    const maps = buildKeyMaps(spec);
    for (let i = 0; i < 6; i++) {
      const line = (maps[i] as string[]).find((r) => r.includes('code="39"'));
      expect(parseKey(line as string)[1]).toBe("");
    }
    const map0 = maps[0] as string[];
    expect(parseKey(map0.find((r) => r.includes('code="10"')) as string)[1]).toBe("/");
    expect(parseKey(map0.find((r) => r.includes('code="65"')) as string)[1]).toBe(".");
  });

  test("trans без резолва — G_INTERNAL", async () => {
    const spec = await loadSpec("tests/fixtures/valid-mini.toml");
    const patched: ValidatedSpec = {
      ...spec,
      layers: {
        ...spec.layers,
        base: spec.layers.base.map((row, ri) =>
          row.map((c, ci) => (ri === 0 && ci === 0 ? { kind: "trans" } : c)),
        ),
      },
    };
    expect(() => buildKeyMaps(patched)).toThrow(KeylayoutBuildError);
    try {
      buildKeyMaps(patched);
      throw new Error("ожидался KeylayoutBuildError");
    } catch (err) {
      expect((err as KeylayoutBuildError).code).toBe("G_INTERNAL");
    }
  });
});

describe("keyboard-тег: id, maxout, mapSet", () => {
  test("id детерминирован, отрицательный int32, ненулевой, разный", () => {
    const a = computeKeyboardId("Universal Layout Ortho Merged");
    expect(computeKeyboardId("Universal Layout Ortho Merged")).toBe(a);
    expect(a < 0 && a !== 0 && Number.isInteger(a)).toBe(true);
    expect(computeKeyboardId("Universal Layout Ortho English")).not.toBe(a);
  });
  test("maxout: merged — 2, lig-multi — 4", async () => {
    expect(computeMaxOut(await loadSpec("tests/fixtures/golden-merged.toml"))).toBe(2);
    expect(computeMaxOut(await loadSpec("tests/fixtures/lig-multi.toml"))).toBe(4);
  });
  test("mapSet id — short_name в нижнем регистре", async () => {
    expect(mapSetId(await loadSpec("tests/fixtures/golden-merged.toml"))).toBe("ulom");
  });
  test("buildKeyElement экранирует кавычки", () => {
    expect(buildKeyElement(50, { kind: "char", codePoint: 0x22 })).toBe(
      '<key code="50" output="&quot;"/>',
    );
  });
});

describe("golden-снапшоты tests/golden/*.keylayout", () => {
  for (const fixture of GOLDEN_FIXTURES) {
    test(`${fixture}`, async () => {
      const spec = await loadSpec(fixture);
      const goldenFile = `tests/golden/${spec.main.name}.keylayout`;
      const got = buildKeylayoutText(spec).join("\r\n") + "\r\n";
      let want: string;
      try {
        want = await fs.readFile(goldenFile, "utf8");
      } catch {
        await fs.writeFile(goldenFile, got);
        throw new Error(`снапшот создан: ${goldenFile} — проверь diff и перезапусти`);
      }
      expect(got).toBe(want);
    });
  }
});

describe("XML-инварианты вывода", () => {
  test("баланс тегов, нет голых спецсимволов, CRLF, финал </keyboard>", async () => {
    for (const fixture of GOLDEN_FIXTURES) {
      const text = buildKeylayoutText(await loadSpec(fixture)).join("\r\n") + "\r\n";
      expect(text).not.toMatch(/[^\r]\n/);
      expect(text.endsWith("</keyboard>\r\n")).toBe(true);
      for (const tag of ["keyboard", "layouts", "modifierMap", "keyMapSet", "keyMap"]) {
        const open = text.match(new RegExp(`<${tag}[\\s>]`, "g"))?.length ?? 0;
        const close = text.match(new RegExp(`</${tag}>`, "g"))?.length ?? 0;
        expect([tag, open, close]).toEqual([tag, open, open]);
        expect(close).toBe(open);
      }
      // Внутри output="..." — только сущности, не голые & < ".
      // (бэкслэш НЕ escape-символ XML: output="\" валиден как есть).
      for (const m of text.matchAll(/output="([^"]*)"/g)) {
        const v = m[1] as string;
        expect(v.replace(/&(amp|lt|gt|quot|#x[0-9A-Fa-f]+);/g, "")).not.toContain("&");
        expect(v).not.toContain("<");
      }
    }
  });

  test("имена лигатур не попадают в вывод", async () => {
    for (const fixture of [...GOLDEN_FIXTURES, "tests/fixtures/lig-multi.toml"]) {
      const text = buildKeylayoutText(await loadSpec(fixture)).join("\n");
      for (const name of ["FatArr", "ThinArr", "Tri", "Quad"]) {
        expect(text.includes(name)).toBe(false);
      }
    }
  });
});

describe("keylayoutWriter: байты и атомарная запись", () => {
  test("UTF-8 без BOM + CRLF + имя <main.name>.keylayout", async () => {
    const spec = await loadSpec("tests/fixtures/golden-merged.toml");
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-mac-"));
    const outFile = await writeKeylayoutFile(spec, tmp);
    expect(outFile.endsWith("Universal Layout Ortho Merged.keylayout")).toBe(true);
    const buf = await fs.readFile(outFile);
    expect(buf[0]).not.toBe(0xff);
    const text = buf.toString("utf8");
    expect(text).not.toMatch(/[^\r]\n/);
    expect(text.endsWith("</keyboard>\r\n")).toBe(true);
    const leftovers = (await fs.readdir(path.join(tmp, "macos"))).filter((f) =>
      f.includes(".tmp."),
    );
    expect(leftovers).toEqual([]);
  });
});
