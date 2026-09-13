/**
 * Тесты фазы 3: таблица Unicode + encodeCell() (docs/07, docs/06 раздел 2).
 */
import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import {
  AstralCodeError,
  DEFAULT_UNICODE_TABLE,
  commentFor,
  encodeCell,
  hexOf,
  lookupName,
} from "../process/generators/windows/unicode.ts";

describe("encodeCell", () => {
  test("встроенные токены — раньше таблицы", () => {
    expect(encodeCell({ kind: "none" })).toEqual({ text: "-1", comment: "<none>" });
    expect(encodeCell({ kind: "space" })).toEqual({ text: "0020", comment: "SPACE" });
    expect(encodeCell({ kind: "nbsp" })).toEqual({ text: "00a0", comment: "NO-BREAK SPACE" });
  });

  test("char: hex строчный + имя из таблицы", () => {
    expect(encodeCell({ kind: "char", codePoint: 0x2d })).toEqual({
      text: "002d",
      comment: "HYPHEN-MINUS",
    });
    expect(encodeCell({ kind: "char", codePoint: 0x2014 })).toEqual({
      text: "2014",
      comment: "EM DASH",
    });
    expect(encodeCell({ kind: "char", codePoint: 0x20bd })).toEqual({
      text: "20bd",
      comment: "RUBLE SIGN",
    });
    expect(encodeCell({ kind: "char", codePoint: 0x40 })).toEqual({
      text: "0040",
      comment: "COMMERCIAL AT",
    });
  });

  test("00ab/00bb: суффикс ` *` как в эталоне (docs/07, правило 2)", () => {
    expect(encodeCell({ kind: "char", codePoint: 0xab }).comment).toBe(
      "LEFT-POINTING DOUBLE ANGLE QUOTATION MARK *",
    );
    expect(encodeCell({ kind: "char", codePoint: 0xbb }).comment).toBe(
      "RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK *",
    );
    // В таблице имена хранятся без звёздочки.
    expect(lookupName(DEFAULT_UNICODE_TABLE, 0xab)).toBe(
      "LEFT-POINTING DOUBLE ANGLE QUOTATION MARK",
    );
  });

  test("неизвестный код — `<null>` (таблица подменена пустой)", () => {
    expect(encodeCell({ kind: "char", codePoint: 0x2d }, {})).toEqual({
      text: "002d",
      comment: "<null>",
    });
  });

  test("ligature → `%%`, комментарий — имена раскрытия через ` + `", () => {
    expect(
      encodeCell({ kind: "ligature", name: "FatArr", codePoints: [0x3d, 0x3e] }),
    ).toEqual({ text: "%%", comment: "EQUALS SIGN + GREATER-THAN SIGN" });
    expect(
      encodeCell({ kind: "ligature", name: "ThinArr", codePoints: [0x2d, 0x3e] }),
    ).toEqual({ text: "%%", comment: "HYPHEN-MINUS + GREATER-THAN SIGN" });
  });

  test("вне BMP — G_UNICODE_ASTRAL (docs/07, правило 3)", () => {
    try {
      encodeCell({ kind: "char", codePoint: 0x1f600 });
      throw new Error("ожидался AstralCodeError");
    } catch (err) {
      expect(err).toBeInstanceOf(AstralCodeError);
      expect((err as AstralCodeError).code).toBe("G_UNICODE_ASTRAL");
    }
    expect(() =>
      encodeCell({ kind: "ligature", name: "X", codePoints: [0x41, 0x1f600] }),
    ).toThrow(AstralCodeError);
    // Граница BMP — ок.
    expect(encodeCell({ kind: "char", codePoint: 0xffff }).text).toBe("ffff");
  });
});

describe("hexOf/commentFor", () => {
  test("дополнение нулями до 4 знаков", () => {
    expect(hexOf(0x41)).toBe("0041");
    expect(hexOf(0x20bd)).toBe("20bd");
  });

  test("commentFor: регистр ключа не важен", () => {
    expect(commentFor({ ABCD: "NAME" } as never, 0xabcd)).toBe("<null>"); // ключ верхний — мимо
    expect(commentFor({ abcd: "NAME" }, 0xabcd)).toBe("NAME");
  });
});

describe("data/unicode.json: минимум для всех символов layouts/", () => {
  test("каждый символ сеток и значений лигатур имеет имя", async () => {
    const need = new Set<string>(["0020", "0040", "00a0"]);
    for (const f of (await fs.readdir("layouts")).filter((f) => f.endsWith(".toml"))) {
      const v = Bun.TOML.parse(await fs.readFile(`layouts/${f}`, "utf8")) as {
        ligatures: Record<string, string>;
        layout: Record<string, string>;
      };
      const lig = v.ligatures as Record<string, string>;
      for (const val of Object.values(lig)) {
        for (const ch of val) need.add(hexOf(ch.codePointAt(0) as number));
      }
      const layout = v.layout as Record<string, string>;
      for (const raw of Object.values(layout)) {
        for (const line of String(raw).replace(/\r\n/g, "\n").split("\n")) {
          if (line.trim() === "") continue;
          for (const cell of line.trim().split(/ +/)) {
            const c = cell.trim();
            if (c.startsWith("@") || c === "") continue;
            const cps = Array.from(c);
            expect(cps.length).toBe(1);
            need.add(hexOf((cps[0] as string).codePointAt(0) as number));
          }
        }
      }
    }
    const missing = [...need].filter((hex) => lookupName(DEFAULT_UNICODE_TABLE, Number.parseInt(hex, 16)) === null);
    expect(missing).toEqual([]);
  });
});
