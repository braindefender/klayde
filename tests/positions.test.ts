/**
 * Тесты фазы 3: позиционная таблица ortho-5x10-v1 (docs/05).
 * Каждая запись сверена с канонической таблицей из документации.
 */
import { describe, expect, test } from "bun:test";
import {
  LAYOUT_SC_ORDER,
  POSITIONS,
  POSITION_TABLE_VERSION,
  positionAt,
  positionBySc,
  type KeyPosition,
} from "../process/generators/windows/positions.ts";

describe("positions: 50 записей", () => {
  test("версия таблицы", () => {
    expect(POSITION_TABLE_VERSION).toBe("ortho-5x10-v1");
  });

  test("ровно 50 записей, покрытие сетки 5×10 без дублей", () => {
    expect(POSITIONS.length).toBe(50);
    const cells = new Set(POSITIONS.map((p) => `${p.row}c${p.col}`));
    expect(cells.size).toBe(50);
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 10; c++) {
        expect(cells.has(`${r}c${c}`)).toBe(true);
      }
    }
  });

  test("scancode уникальны", () => {
    expect(new Set(POSITIONS.map((p) => p.sc)).size).toBe(50);
  });

  test("баланс зон: 34 SGCap + 16 Cap0 (r5c2/c5/c6/c8 — SGCap, буквы ё/х/ъ/э)", () => {
    expect(POSITIONS.filter((p) => p.cap === "SGCap").length).toBe(34);
    expect(POSITIONS.filter((p) => p.cap === "Cap0").length).toBe(16);
  });

  test("Ctrl-константы: только -1/001b/001c/001d/0020", () => {
    const ctrls = new Map<string, string>();
    for (const p of POSITIONS) {
      expect(["-1", "001b", "001c", "001d", "0020"]).toContain(p.ctrl);
      ctrls.set(`${p.row}c${p.col}`, p.ctrl);
    }
    expect(ctrls.get("5c1")).toBe("0020"); // SPACE — особый случай
    expect(ctrls.get("5c5")).toBe("001b"); // OEM_4
    expect(ctrls.get("5c6")).toBe("001d"); // OEM_6
    expect(ctrls.get("5c7")).toBe("001c"); // OEM_5
    expect(ctrls.get("5c9")).toBe("001c"); // OEM_102 (второй слэш)
  });

  test("полная сверка с docs/05 (sc, vk, cap-зона, ctrl)", () => {
    const want: [number, number, string, string, KeyPosition["cap"], string][] = [
      [1, 1, "02", "1", "Cap0", "-1"], [1, 2, "03", "2", "Cap0", "-1"],
      [1, 3, "04", "3", "Cap0", "-1"], [1, 4, "05", "4", "Cap0", "-1"],
      [1, 5, "06", "5", "Cap0", "-1"], [1, 6, "07", "6", "Cap0", "-1"],
      [1, 7, "08", "7", "Cap0", "-1"], [1, 8, "09", "8", "Cap0", "-1"],
      [1, 9, "0a", "9", "Cap0", "-1"], [1, 10, "0b", "0", "Cap0", "-1"],
      [2, 1, "10", "Q", "SGCap", "-1"], [2, 2, "11", "W", "SGCap", "-1"],
      [2, 3, "12", "E", "SGCap", "-1"], [2, 4, "13", "R", "SGCap", "-1"],
      [2, 5, "14", "T", "SGCap", "-1"], [2, 6, "15", "Y", "SGCap", "-1"],
      [2, 7, "16", "U", "SGCap", "-1"], [2, 8, "17", "I", "SGCap", "-1"],
      [2, 9, "18", "O", "SGCap", "-1"], [2, 10, "19", "P", "SGCap", "-1"],
      [3, 1, "1e", "A", "SGCap", "-1"], [3, 2, "1f", "S", "SGCap", "-1"],
      [3, 3, "20", "D", "SGCap", "-1"], [3, 4, "21", "F", "SGCap", "-1"],
      [3, 5, "22", "G", "SGCap", "-1"], [3, 6, "23", "H", "SGCap", "-1"],
      [3, 7, "24", "J", "SGCap", "-1"], [3, 8, "25", "K", "SGCap", "-1"],
      [3, 9, "26", "L", "SGCap", "-1"], [3, 10, "27", "OEM_1", "SGCap", "-1"],
      [4, 1, "2c", "Z", "SGCap", "-1"], [4, 2, "2d", "X", "SGCap", "-1"],
      [4, 3, "2e", "C", "SGCap", "-1"], [4, 4, "2f", "V", "SGCap", "-1"],
      [4, 5, "30", "B", "SGCap", "-1"], [4, 6, "31", "N", "SGCap", "-1"],
      [4, 7, "32", "M", "SGCap", "-1"], [4, 8, "33", "OEM_COMMA", "SGCap", "-1"],
      [4, 9, "34", "OEM_PERIOD", "SGCap", "-1"], [4, 10, "35", "OEM_2", "SGCap", "-1"],
      [5, 1, "39", "SPACE", "Cap0", "0020"], [5, 2, "29", "OEM_3", "SGCap", "-1"],
      [5, 3, "0c", "OEM_MINUS", "Cap0", "-1"], [5, 4, "0d", "OEM_PLUS", "Cap0", "-1"],
      [5, 5, "1a", "OEM_4", "SGCap", "001b"], [5, 6, "1b", "OEM_6", "SGCap", "001d"],
      [5, 7, "2b", "OEM_5", "Cap0", "001c"], [5, 8, "28", "OEM_7", "SGCap", "-1"],
      [5, 9, "56", "OEM_102", "Cap0", "001c"], [5, 10, "53", "DECIMAL", "Cap0", "-1"],
    ];
    expect(want.length).toBe(50);
    for (const [row, col, sc, vk, cap, ctrl] of want) {
      expect(positionAt(row, col)).toEqual({ row, col, sc, vk, cap, ctrl });
    }
  });

  test("r5c8 = SGCap: обычная клавиша typing-блока (см. комментарий в positions.ts)", () => {
    expect(positionAt(5, 8)?.cap).toBe("SGCap");
    expect(positionAt(5, 8)?.vk).toBe("OEM_7");
  });

  test("positionBySc: регистр не важен", () => {
    expect(positionBySc("0A")).toEqual(positionAt(1, 9));
    expect(positionBySc("25")).toEqual(positionAt(3, 8));
    expect(positionBySc("ff")).toBeUndefined();
  });
});

describe("LAYOUT_SC_ORDER (docs/05, раздел 3)", () => {
  test("50 уникальных sc, покрывают таблицу; 56 перед 53", () => {
    expect(LAYOUT_SC_ORDER.length).toBe(50);
    expect(new Set(LAYOUT_SC_ORDER).size).toBe(50);
    expect(new Set(LAYOUT_SC_ORDER)).toEqual(new Set(POSITIONS.map((p) => p.sc)));
    expect(LAYOUT_SC_ORDER.indexOf("56")).toBeLessThan(LAYOUT_SC_ORDER.indexOf("53"));
  });

  test("дословный порядок reference (27,28,29,2b; 56 перед 53)", () => {
    expect(LAYOUT_SC_ORDER.join(",")).toBe(
      "02,03,04,05,06,07,08,09,0a,0b,0c,0d," +
        "10,11,12,13,14,15,16,17,18,19,1a,1b," +
        "1e,1f,20,21,22,23,24,25,26,27,28,29,2b," +
        "2c,2d,2e,2f,30,31,32,33,34,35,39,56,53",
    );
  });
});
