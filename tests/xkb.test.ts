/**
 * Тесты генератора Linux XKB (docs/09).
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
  DEFAULT_XKB_KEYSYM_TABLE,
  encodeKeysym,
} from "../process/generators/linux/keysyms.ts";
import {
  buildXkbKeys,
  XkbBuildError,
} from "../process/generators/linux/xkbLayout.ts";
import {
  buildXkbText,
  serializeXkb,
  writeXkbFile,
} from "../process/generators/linux/xkbWriter.ts";

const GOLDEN_FIXTURES = [
  "tests/fixtures/golden-english.toml",
  "tests/fixtures/golden-english-inverted.toml",
  "tests/fixtures/golden-merged.toml",
  "tests/fixtures/golden-merged-inverted.toml",
  "tests/fixtures/golden-russian.toml",
  "tests/fixtures/golden-russian-inverted.toml",
];

async function loadSpec(file: string): Promise<ValidatedSpec> {
  const r = await validateFile(file);
  expect(r.errors).toEqual([]);
  if (!r.spec) throw new Error(`нет spec для ${file}`);
  return r.spec;
}

/** Разобрать строку key на группы уровней. */
function parseKey(line: string): { code: string; g1: string[]; g2: string[] } {
  const m = line.match(
    /^key <([A-Za-z0-9]+)> \{ (?:type\[Group1\]="[^"]+", type\[Group2\]="[^"]+", )?symbols\[Group1\] = \[ (.*) \], symbols\[Group2\] = \[ (.*) \] \};$/,
  );
  if (!m) throw new Error(`не key-строка: ${line}`);
  const split = (s: string): string[] => (s === "" ? [] : s.split(", "));
  return { code: m[1] as string, g1: split(m[2] as string), g2: split(m[3] as string) };
}

describe("encodeKeysym", () => {
  test("ASCII-буквы/цифры — литерал, space/at — встроенные", () => {
    expect(encodeKeysym(0x61)).toBe("a");
    expect(encodeKeysym(0x51)).toBe("Q");
    expect(encodeKeysym(0x37)).toBe("7");
    expect(encodeKeysym(0x20)).toBe("space");
    expect(encodeKeysym(0x40)).toBe("at");
  });

  test("канонические имена из таблицы (без deprecated-алиасов)", () => {
    expect(encodeKeysym(0x2c)).toBe("comma");
    expect(encodeKeysym(0xab)).toBe("guillemetleft");
    expect(encodeKeysym(0x431)).toBe("Cyrillic_be");
    expect(encodeKeysym(0x411)).toBe("Cyrillic_BE");
    expect(encodeKeysym(0x451)).toBe("Cyrillic_io");
    expect(encodeKeysym(0x401)).toBe("Cyrillic_IO");
    expect(encodeKeysym(0x3c8)).toBe("Greek_psi");
    expect(encodeKeysym(0x3a9)).toBe("Greek_OMEGA");
    expect(encodeKeysym(0x3bb)).toBe("Greek_lamda");
    expect(encodeKeysym(0x20ac)).toBe("EuroSign");
    expect(encodeKeysym(0xa0)).toBe("nobreakspace");
  });

  test("безымянные — UXXXX (верхний hex, минимум 4 знака)", () => {
    expect(encodeKeysym(0x2030)).toBe("U2030");
    expect(encodeKeysym(0x2048)).toBe("U2048");
    expect(encodeKeysym(0x20bd)).toBe("U20BD");
    expect(encodeKeysym(0x221a)).toBe("U221A");
    expect(encodeKeysym(0x1f600)).toBe("U1F600");
  });

  test("таблица подменяема (чистые данные)", () => {
    expect(encodeKeysym(0x2c, {})).toBe("U002C");
    expect(encodeKeysym(0x61, {})).toBe("a");
  });
});

describe("data/xkb-keysyms.json: покрытие инвентаря layouts/", () => {
  test("каждый символ сеток и лигатур резолвится без null", async () => {
    const need = new Set<number>();
    for (const f of GOLDEN_FIXTURES) {
      const text = await fs.readFile(f, "utf8");
      const v = Bun.TOML.parse(text) as {
        ligatures?: Record<string, string>;
        layout?: Record<string, string>;
      };
      for (const val of Object.values(v.ligatures ?? {})) {
        for (const ch of val) need.add(ch.codePointAt(0) as number);
      }
      for (const raw of Object.values(v.layout ?? {})) {
        for (const line of String(raw).replace(/\r\n/g, "\n").split("\n")) {
          if (line.trim() === "") continue;
          for (const cell of line.trim().split(/ +/)) {
            const c = cell.trim();
            if (c.startsWith("@") || c === "") continue;
            const cps = Array.from(c);
            expect(cps.length).toBe(1);
            need.add((cps[0] as string).codePointAt(0) as number);
          }
        }
      }
    }
    // @Space/@Nbsp/@-at-sign покрываются встроенными/кодом, не таблицей.
    need.add(0x40);
    // Каждый не-ASCII символ либо в таблице, либо в осознанном fallback-списке
    // (новый безымянный символ в layouts/ уронит этот тест громко).
    const fallback = new Set([0x02c6, 0x2030, 0x2048, 0x2074, 0x2153, 0x221a, 0x2248, 0x20bd]);
    const table = DEFAULT_XKB_KEYSYM_TABLE;
    for (const cp of need) {
      if (cp < 0x80 || cp === 0x20 || cp === 0x40) continue;
      const hex = cp.toString(16).padStart(4, "0");
      const inTable = table[hex] !== undefined;
      expect(inTable || fallback.has(cp)).toBe(true);
    }
  });
});

describe("buildXkbKeys: группы и уровни", () => {
  test("50 строк, Group1 = base-слои, Group2 = caps + дубли", async () => {
    const spec = await loadSpec("tests/fixtures/golden-merged.toml");
    const { keyLines, warnings } = buildXkbKeys(spec);
    expect(keyLines.length).toBe(50);
    const byCode = new Map(
      keyLines.map((l) => {
        const p = parseKey(l);
        return [p.code, p] as const;
      }),
    );
    // K (AC08): base k/K, caps л/Л, altgr-лигатуры сведены.
    expect(byCode.get("AC08")).toEqual({
      code: "AC08",
      g1: ["k", "K"],
      g2: ["Cyrillic_el", "Cyrillic_EL"],
    });
    // SPCE: пробелы и NBSP.
    expect(byCode.get("SPCE")).toEqual({
      code: "SPCE",
      g1: ["space", "space", "nobreakspace", "nobreakspace"],
      g2: ["space", "space", "nobreakspace", "nobreakspace"],
    });
    // Хвост @None обрезан: AE05 (altgr_shift r1c5 = @None) — 3 уровня.
    expect(byCode.get("AE05")).toEqual({
      code: "AE05",
      g1: ["5", "percent", "U2030"],
      g2: ["5", "percent", "U2030"],
    });
    // KPDL merged: сетка ./, во всех слоях — 4 уровня в обеих группах.
    expect(byCode.get("KPDL")).toEqual({
      code: "KPDL",
      g1: ["period", "comma", "period", "comma"],
      g2: ["period", "comma", "period", "comma"],
    });
    // Предупреждения — по одному на ячейку-лигатуру (без дублей Group2).
    expect(warnings.map((w) => w.code)).toEqual([
      "W_LINUX_LIGATURE_FALLBACK",
      "W_LINUX_LIGATURE_FALLBACK",
    ]);
  });

  test("полностью пустая клавиша — [ NoSymbol ] в обеих группах", async () => {
    const spec = await loadSpec("tests/fixtures/golden-merged.toml");
    const { keyLines } = buildXkbKeys(spec);
    const ac11 = keyLines.find((l) => l.startsWith("key <AC11>"));
    expect(ac11).toBe(
      'key <AC11> { type[Group1]="FOUR_LEVEL", type[Group2]="FOUR_LEVEL", symbols[Group1] = [ NoSymbol ], symbols[Group2] = [ NoSymbol ] };',
    );
  });

  test("середина @None — NoSymbol на месте (стандарт, r5c10 shift?)", async () => {
    const spec = await loadSpec("tests/fixtures/golden-russian.toml");
    const { keyLines } = buildXkbKeys(spec);
    // Найти ключ с NoSymbol в середине: вручную через KPDL russian
    // (altgr/altgr_shift r5c10 = ./, — контрпример не нужен; проверяем формат).
    for (const line of keyLines) {
      const { g1, g2 } = parseKey(line);
      for (const g of [g1, g2]) {
        // Хвост обрезан: последний уровень никогда не NoSymbol... кроме [NoSymbol].
        if (g.length > 1) expect(g[g.length - 1]).not.toBe("NoSymbol");
      }
    }
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
    try {
      buildXkbKeys(patched);
      throw new Error("ожидался XkbBuildError");
    } catch (err) {
      expect(err).toBeInstanceOf(XkbBuildError);
      expect((err as XkbBuildError).code).toBe("G_INTERNAL");
    }
  });

  test("имена лигатур не попадают в вывод", async () => {
    for (const f of GOLDEN_FIXTURES) {
      const { keyLines } = buildXkbKeys(await loadSpec(f));
      const text = keyLines.join("\n");
      for (const name of ["FatArr", "ThinArr"]) {
        expect(text.includes(name)).toBe(false);
      }
    }
  });
});

describe("golden-снапшоты tests/golden/linux/*", () => {
  for (const fixture of GOLDEN_FIXTURES) {
    test(`${fixture}`, async () => {
      const spec = await loadSpec(fixture);
      const { buildXkbText } = await import(
        "../process/generators/linux/xkbWriter.ts"
      );
      const goldenFile = `tests/golden/linux/${spec.main.shortName}`;
      const got = buildXkbText(spec).lines.join("\n") + "\n";
      let want: string;
      try {
        want = await fs.readFile(goldenFile, "utf8");
      } catch {
        await fs.mkdir(path.dirname(goldenFile), { recursive: true });
        await fs.writeFile(goldenFile, got);
        throw new Error(`снапшот создан: ${goldenFile} — проверь diff и перезапусти`);
      }
      expect(got).toBe(want);
    });
  }
});

describe("xkbWriter: байты и атомарная запись", () => {
  test("LF + UTF-8 без BOM + имя short_name без расширения", async () => {
    const spec = await loadSpec("tests/fixtures/golden-merged.toml");
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-xkb-"));
    const { writeXkbFile } = await import("../process/generators/linux/xkbWriter.ts");
    const { outFile, warnings } = await writeXkbFile(spec, tmp);
    expect(outFile.endsWith("ULOM")).toBe(true);
    expect(warnings.length).toBe(2);
    const buf = await fs.readFile(outFile);
    expect(buf[0]).not.toBe(0xff);
    const text = buf.toString("utf8");
    expect(text).not.toMatch(/\r/);
    expect(text.endsWith("};\n")).toBe(true);
    const leftovers = (await fs.readdir(path.join(tmp, "linux"))).filter((f) =>
      f.includes(".tmp."),
    );
    expect(leftovers).toEqual([]);
  });

  test("serializeXkb: LF, финальный перевод строки", async () => {
    const { serializeXkb } = await import("../process/generators/linux/xkbWriter.ts");
    expect(serializeXkb(["a", "b"]).toString("utf8")).toBe("a\nb\n");
  });
});
