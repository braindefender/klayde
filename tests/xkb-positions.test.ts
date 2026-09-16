/**
 * Тесты таблицы привязки xkb-5x10-v1 (docs/09, раздел 3).
 */
import { describe, expect, test } from "bun:test";
import {
  XKB_POSITIONS,
  XKB_POSITION_TABLE_VERSION,
  xkbPositionAt,
  xkbPositionByCode,
} from "../process/generators/linux/positions.ts";

describe("xkb positions: 50 записей", () => {
  test("версия таблицы", () => {
    expect(XKB_POSITION_TABLE_VERSION).toBe("xkb-5x10-v1");
  });

  test("ровно 50 записей, покрытие сетки 5×10 без дублей", () => {
    expect(XKB_POSITIONS.length).toBe(50);
    const cells = new Set(XKB_POSITIONS.map((p) => `${p.row}c${p.col}`));
    expect(cells.size).toBe(50);
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 10; c++) {
        expect(cells.has(`${r}c${c}`)).toBe(true);
      }
    }
  });

  test("коды уникальны", () => {
    expect(new Set(XKB_POSITIONS.map((p) => p.code)).size).toBe(50);
  });

  test("полная сверка с docs/09 (раздел 3)", () => {
    const want: [number, number, string][] = [
      [1, 1, "AE01"], [1, 2, "AE02"], [1, 3, "AE03"], [1, 4, "AE04"],
      [1, 5, "AE05"], [1, 6, "AE06"], [1, 7, "AE07"], [1, 8, "AE08"],
      [1, 9, "AE09"], [1, 10, "AE10"],
      [2, 1, "AD01"], [2, 2, "AD02"], [2, 3, "AD03"], [2, 4, "AD04"],
      [2, 5, "AD05"], [2, 6, "AD06"], [2, 7, "AD07"], [2, 8, "AD08"],
      [2, 9, "AD09"], [2, 10, "AD10"],
      [3, 1, "AC01"], [3, 2, "AC02"], [3, 3, "AC03"], [3, 4, "AC04"],
      [3, 5, "AC05"], [3, 6, "AC06"], [3, 7, "AC07"], [3, 8, "AC08"],
      [3, 9, "AC09"], [3, 10, "AC10"],
      [4, 1, "AB01"], [4, 2, "AB02"], [4, 3, "AB03"], [4, 4, "AB04"],
      [4, 5, "AB05"], [4, 6, "AB06"], [4, 7, "AB07"], [4, 8, "AB08"],
      [4, 9, "AB09"], [4, 10, "AB10"],
      [5, 1, "SPCE"], [5, 2, "TLDE"], [5, 3, "AE11"], [5, 4, "AE12"],
      [5, 5, "AD11"], [5, 6, "AD12"], [5, 7, "BKSL"], [5, 8, "AC11"],
      [5, 9, "LSGT"], [5, 10, "KPDL"],
    ];
    expect(want.length).toBe(50);
    for (const [row, col, code] of want) {
      expect(xkbPositionAt(row, col)).toEqual({ row, col, code });
    }
  });

  test("особые клавиши нижнего ряда", () => {
    expect(xkbPositionAt(5, 1)?.code).toBe("SPCE");
    expect(xkbPositionAt(5, 8)?.code).toBe("AC11");
    expect(xkbPositionAt(5, 9)?.code).toBe("LSGT");
    expect(xkbPositionAt(5, 10)?.code).toBe("KPDL");
  });

  test("xkbPositionByCode", () => {
    expect(xkbPositionByCode("AC08")).toEqual({ row: 3, col: 8, code: "AC08" });
    expect(xkbPositionByCode("SPCE")).toEqual({ row: 5, col: 1, code: "SPCE" });
    expect(xkbPositionByCode("NOPE")).toBeUndefined();
  });
});
