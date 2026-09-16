/**
 * Тесты таблицы привязки mac-5x10-v1 (docs/10, раздел 3).
 * Сверка с ADB-кодами; причуда `5`→23 / `6`→22 — отдельным тестом.
 */
import { describe, expect, test } from "bun:test";
import {
  MAC_POSITIONS,
  MAC_POSITION_TABLE_VERSION,
  macPositionAt,
  macPositionByCode,
} from "../process/generators/macos/positions.ts";

describe("mac positions: 50 записей", () => {
  test("версия таблицы", () => {
    expect(MAC_POSITION_TABLE_VERSION).toBe("mac-5x10-v1");
  });

  test("ровно 50 записей, покрытие сетки 5×10 без дублей", () => {
    expect(MAC_POSITIONS.length).toBe(50);
    const cells = new Set(MAC_POSITIONS.map((p) => `${p.row}c${p.col}`));
    expect(cells.size).toBe(50);
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 10; c++) {
        expect(cells.has(`${r}c${c}`)).toBe(true);
      }
    }
  });

  test("keycode уникальны", () => {
    expect(new Set(MAC_POSITIONS.map((p) => p.code)).size).toBe(50);
  });

  test("полная сверка с docs/10 (раздел 3)", () => {
    const want: [number, number, number][] = [
      [1, 1, 18], [1, 2, 19], [1, 3, 20], [1, 4, 21], [1, 5, 23],
      [1, 6, 22], [1, 7, 26], [1, 8, 28], [1, 9, 25], [1, 10, 29],
      [2, 1, 12], [2, 2, 13], [2, 3, 14], [2, 4, 15], [2, 5, 17],
      [2, 6, 16], [2, 7, 32], [2, 8, 34], [2, 9, 31], [2, 10, 35],
      [3, 1, 0], [3, 2, 1], [3, 3, 2], [3, 4, 3], [3, 5, 5],
      [3, 6, 4], [3, 7, 38], [3, 8, 40], [3, 9, 37], [3, 10, 41],
      [4, 1, 6], [4, 2, 7], [4, 3, 8], [4, 4, 9], [4, 5, 11],
      [4, 6, 45], [4, 7, 46], [4, 8, 43], [4, 9, 47], [4, 10, 44],
      [5, 1, 49], [5, 2, 50], [5, 3, 27], [5, 4, 24], [5, 5, 33],
      [5, 6, 30], [5, 7, 42], [5, 8, 39], [5, 9, 10], [5, 10, 65],
    ];
    expect(want.length).toBe(50);
    for (const [row, col, code] of want) {
      expect(macPositionAt(row, col)).toEqual({ row, col, code });
    }
  });

  test("ADB-причуда: `5`→23, `6`→22 (не последовательно)", () => {
    expect(macPositionAt(1, 5)?.code).toBe(23);
    expect(macPositionAt(1, 6)?.code).toBe(22);
  });

  test("macPositionByCode", () => {
    expect(macPositionByCode(40)).toEqual({ row: 3, col: 8, code: 40 });
    expect(macPositionByCode(49)).toEqual({ row: 5, col: 1, code: 49 });
    expect(macPositionByCode(999)).toBeUndefined();
  });
});
