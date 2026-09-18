/**
 * Секции LAYOUT и LIGATURE (docs/06, разделы 2–4; docs/08 — klcLayout.ts).
 *
 * Правила, обратный инжиниринг по 6 эталонам universal-layout +
 * reference-раскладкам standard (data/reference/windows):
 * - порядок строк — LAYOUT_SC_ORDER (27, 28, 29, 2b по reference);
 * - набор колонок динамический: 0/1/2 всегда, 6 — только если слой
 *   altgr содержит хотя бы одну не-@None ячейку, 7 — только если слой
 *   altgr_shift содержит хотя бы одну не-@None ячейку (иначе в них
 *   всё равно лежали бы одни "-1");
 * - строка: `SC\tVK\t\tCap\t<c0>\t<c1>\t<c2>[\t<c6>[\t<c7>]\t\t// <имена>`;
 *   после VK две табуляции при длине имени ≤ 5, иначе одна;
 * - `SC 39` (SPACE): c7 всегда `-1` (docs/06, раздел 3);
 * - клавиша, у которой c0/c1 и все присутствующие c6/c7, а также пара
 *   caps — все `-1`, пропускается целиком (так в эталонах отсутствует
 *   SC 28: все слои `@None`);
 * - комментарий основной строки — имена присутствующих колонок через `, `:
 *   `-1` → `<none>`, `%%` → `<null>` (эталон не раскрывает лигатуры
 *   в комментариях основных строк), `20bd` → `<null>` (таблица MSKLC
 *   старше ₽); особый случай DECIMAL (SC 53, все c2/c6/c7 — `-1`)
 *   — пустые имена вместо `<none>` (концевой пробел подрезается);
 * - расширение SGCap: `-1\t-1\t0\tcaps\tcapsShift\t\t// <n1>, <n2>`;
 *   лигатура в SGCap-расширении — G_CAPS_LIGATURE (docs/06, раздел 3);
 * - Cap-оптимизация для caps (включая @Trans, уже резолвленный
 *   в caps←base, caps_shift←base_shift): прозрачный
 *   (caps==base && caps_shift==base_shift) → Cap 0 без расширения
 *   (CapsLock без эффекта — для не-букв с @Trans), swap
 *   (caps==shift && caps_shift==base) → Cap 1 без расширения
 *   (нативный caps=shift MSKLC); иначе SGCap с расширением —
 *   только при caps_is_shift=false (независимые caps, виртуальное
 *   переключение раскладки). При caps_is_shift=true независимый
 *   контент запрещён: генератор падает с G_CAPS_MODE (системный
 *   CapsLock затрагивает только буквы, слои обязаны быть связаны
 *   с base — swap/@Trans).
 * - строка LIGATURE: `VK\\t\\tMod#\\tкоды\\t\\t// <имена через " + ">`;
 *   Mod# — индекс состояния в SHIFTSTATE (при полных колонках 0/1/3/4).
 */

import type { CellValue, ValidatedSpec } from "../../model/spec.ts";
import { LAYOUT_SC_ORDER, positionBySc } from "./positions.ts";
import {
  DEFAULT_UNICODE_TABLE,
  AstralCodeError,
  commentFor,
  hexOf,
  type UnicodeTable,
} from "./unicode.ts";

/** Ошибка сборки KLC (defense in depth, docs/06 раздел 6). */
export class KlcBuildError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "KlcBuildError";
    this.code = code;
  }
}

/**
 * Имена MSKLC для комментариев основных строк.
 * - null = `<null>`: MSKLC не знает ₽ (его таблица старше), поэтому
 *   20bd → `<null>`, хотя data/unicode.json содержит RUBLE SIGN.
 * - строка = подмена имени: MSKLC называет U+2048
 *   "QUESTION EXCLAMATION MARK" (в UCD — "QUESTION EXCLAMATION").
 */
const MAIN_ROW_NAME_OVERRIDES: Readonly<Record<string, string | null>> = {
  "20bd": null,
  "2048": "QUESTION EXCLAMATION MARK",
};

interface LigatureEntry {
  vk: string;
  mod: number;
  codes: string[];
  comment: string;
}

export interface LayoutBlock {
  /** Строки данных LAYOUT (основные + расширения, без заголовка). */
  dataRows: string[];
  /** Строки данных LIGATURE (без заголовка). */
  ligRows: string[];
}

/** Паддинг после VK: две табуляции при длине ≤ 5, иначе одна (по эталонам). */
function vkPad(vk: string): string {
  return vk.length <= 5 ? "\t\t" : "\t";
}

/** Слой состоит только из @None (все ячейки kind "none"). */
export function isLayerEmpty(layer: CellValue[][]): boolean {
  return layer.every((row) => row.every((cell) => cell.kind === "none"));
}

/**
 * Какие AltGr-колонки реально нужны в LAYOUT/SHIFTSTATE.
 * Пустой слой (весь @None) колонку не получает — в ней всё равно
 * лежали бы одни "-1" (правило по reference-раскладкам standard).
 */
export function altgrPresence(spec: ValidatedSpec): {
  hasAltgr: boolean;
  hasAltgrShift: boolean;
} {
  return {
    hasAltgr: !isLayerEmpty(spec.layers.altgr),
    hasAltgrShift: !isLayerEmpty(spec.layers.altgrShift),
  };
}

/** Состояния SHIFTSTATE для схемы: 0/1/2 всегда + 6/7 при непустых слоях. */
export function shiftStateIds(spec: ValidatedSpec): number[] {
  const { hasAltgr, hasAltgrShift } = altgrPresence(spec);
  const ids = [0, 1, 2];
  if (hasAltgr) ids.push(6);
  if (hasAltgrShift) ids.push(7);
  return ids;
}

/**
 * Текст колонки LAYOUT. Причуда MSKLC (подтверждена проверкой всех 1476
 * значений колонок в 6 эталонах, нарушений 0): одиночный ASCII
 * `[A-Za-z0-9]` пишется литералом (`q`, `1`), всё остальное — 4-hex.
 * Комментарии при этом всегда идут по именам (см. mainCellName).
 * `trans` сюда попадать не должен (валидатор резолвит до spec);
 * встреча — G_INTERNAL (defense in depth).
 */
function layoutValueText(value: CellValue, table: UnicodeTable): string {
  switch (value.kind) {
    case "none":
      return "-1";
    case "space":
      return "0020";
    case "nbsp":
      return "00a0";
    case "trans":
      throw new KlcBuildError(
        "G_INTERNAL",
        `@Trans достиг генератора без резолва — валидатор обязан раскрыть его в копию base/base_shift`,
      );
    case "ligature":
      return "%%";
    case "char": {
      if (value.codePoint > 0xffff) throw new AstralCodeError(value.codePoint);
      const ch = String.fromCodePoint(value.codePoint);
      if (/^[A-Za-z0-9]$/.test(ch)) return ch;
      return hexOf(value.codePoint);
    }
  }
}

/**
 * Равенство ячеек по содержимому (для вывода Cap 0/1).
 * Лигатуры сравниваются по кодам раскрытия (имена в .klc не попадают);
 * `trans` — никогда не равен (до сюда он не доходит, см. guard в
 * buildLayoutBlock).
 */
function cellsEqual(a: CellValue, b: CellValue): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "none":
    case "space":
    case "nbsp":
      return true;
    case "trans":
      return false;
    case "char":
      return a.codePoint === (b as { codePoint: number }).codePoint;
    case "ligature": {
      const bc = b as { codePoints: number[] };
      if (a.codePoints.length !== bc.codePoints.length) return false;
      return a.codePoints.every((cp, i) => cp === bc.codePoints[i]);
    }
  }
}

export function buildLayoutBlock(
  spec: ValidatedSpec,
  table: UnicodeTable = DEFAULT_UNICODE_TABLE,
): LayoutBlock {
  const dataRows: string[] = [];
  const ligatures: LigatureEntry[] = [];
  const { hasAltgr, hasAltgrShift } = altgrPresence(spec);
  // Mod# — индекс состояния в динамическом SHIFTSTATE.
  const modOf = (stateId: number): number => shiftStateIds(spec).indexOf(stateId);

  for (const sc of LAYOUT_SC_ORDER) {
    const pos = positionBySc(sc);
    if (!pos) throw new KlcBuildError("G_INTERNAL", `нет позиции для sc ${sc}`);
    const at = (layer: CellValue[][], col: number): CellValue =>
      (layer[pos.row - 1] as CellValue[])[col - 1] as CellValue;

    const s0 = at(spec.layers.base, pos.col);
    const s1 = at(spec.layers.baseShift, pos.col);
    const s6 = at(spec.layers.altgr, pos.col);
    const s7 = at(spec.layers.altgrShift, pos.col);
    for (const v of [s0, s1, s6, s7]) {
      if (v.kind === "trans") {
        throw new KlcBuildError(
          "G_INTERNAL",
          `sc ${sc}: @Trans вне caps-слоёв — валидатор обязан отклонить (E_CELL_AT) или резолвить`,
        );
      }
    }

    if (sc === "39" && s7.kind === "ligature") {
      throw new KlcBuildError(
        "G_INTERNAL",
        `sc 39: лигатура @${s7.name} в c7 — колонка SPACE.c7 форсирована в -1, раскрытие некуда записать`,
      );
    }

    const t0 = layoutValueText(s0, table);
    const t1 = layoutValueText(s1, table);
    const t2 = pos.ctrl;
    const t6 = layoutValueText(s6, table);
    // SC 39 (SPACE): c7 всегда -1, независимо от сетки.
    const t7raw = layoutValueText(s7, table);
    const t7 = sc === "39" ? "-1" : t7raw;

    // Cap-колонка и пара caps для SGCap-позиций.
    // Слои caps/caps_shift обязательны (включая @Trans, уже резолвленный
    // в caps←base, caps_shift←base_shift): оптимизация без расширения —
    // прозрачный (caps==base && caps_shift==base_shift) → Cap 0
    // (CapsLock без эффекта — сюда попадают не-буквенные клавиши
    // с @Trans, т.к. системный CapsLock затрагивает только буквы);
    // swap (caps==shift && caps_shift==base) → Cap 1
    // (нативный caps=shift MSKLC, см. caps_shift_test.klc: H с Cap 1),
    // иначе SGCap с расширением — только при caps_is_shift=false.
    // При caps_is_shift=true независимый контент — ошибка G_CAPS_MODE
    // (слои обязаны быть связаны с base: swap/@Trans).
    // Лигатура в caps допустима только при Cap 0/1 (переиспользует
    // Mod# 0/1 из base); при SGCap — G_CAPS_LIGATURE, т.к. MSKLC не
    // предоставляет Mod# для caps-расширений.
    let cap = pos.cap === "SGCap" ? "SGCap" : "0";
    let capsPair: [CellValue, CellValue] | null = null;
    if (pos.cap === "SGCap") {
      const c0 = at(spec.layers.caps, pos.col);
      const c1 = at(spec.layers.capsShift, pos.col);
      for (const v of [c0, c1]) {
        if (v.kind === "trans") {
          throw new KlcBuildError(
            "G_INTERNAL",
            `sc ${sc}: @Trans в caps достиг генератора без резолва`,
          );
        }
      }
      if (cellsEqual(c0, s0) && cellsEqual(c1, s1)) {
        cap = "0";
        capsPair = null;
      } else if (!cellsEqual(s0, s1) && cellsEqual(c0, s1) && cellsEqual(c1, s0)) {
        cap = "1";
        capsPair = null;
      } else {
        cap = "SGCap";
        capsPair = [c0, c1];
      }
      if (capsPair !== null && spec.main.capsIsShift) {
        throw new KlcBuildError(
          "G_CAPS_MODE",
          `sc ${sc}: caps_is_shift=true требует caps, связанные с base (swap → Cap 1, @Trans → Cap 0), но ячейка независима — исправьте слои caps/caps_shift или укажите caps_is_shift=false`,
        );
      }
      if (capsPair !== null) {
        for (const v of capsPair) {
          if (v.kind === "ligature") {
            throw new KlcBuildError(
              "G_CAPS_LIGATURE",
              `sc ${sc}: лигатура @${v.name} в caps-слое — MSKLC не предоставляет Mod# для caps-расширений`,
            );
          }
        }
      }
    }
    const capsTexts: [string, string] = capsPair
      ? [layoutValueText(capsPair[0], table), layoutValueText(capsPair[1], table)]
      : ["-1", "-1"];

    // Полностью пустая клавиша — пропустить, как SC 28 в universal-эталонах:
    // все -1 в base и присутствующих c6/c7, а caps либо отсутствует
    // (Cap 0/1), либо тоже -1.
    if (
      t0 === "-1" && t1 === "-1" && (!hasAltgr || t6 === "-1") && (!hasAltgrShift || t7 === "-1") &&
      (capsPair === null || (capsTexts[0] === "-1" && capsTexts[1] === "-1"))
    ) {
      continue;
    }

    // Записи LIGATURE. Порядок обхода (scancode, затем Mod# по
    // возрастанию) уже совпадает с эталоном.
    const stateCells: [CellValue, string, number][] = [
      [s0, t0, modOf(0)],
      [s1, t1, modOf(1)],
      [s6, t6, modOf(6)],
      [s7, t7, modOf(7)],
    ];
    for (const [value, text, mod] of stateCells) {
      if (value.kind !== "ligature" || text !== "%%") continue;
      ligatures.push({
        vk: pos.vk,
        mod,
        codes: value.codePoints.map((cp) => hexOf(cp)),
        comment: value.codePoints.map((cp) => commentFor(table, cp)).join(" + "),
      });
    }

    const valueCols = [t0, t1, t2];
    if (hasAltgr) valueCols.push(t6);
    if (hasAltgrShift) valueCols.push(t7);
    dataRows.push(
      `${sc}\t${pos.vk}${vkPad(pos.vk)}${cap}\t${valueCols.join("\t")}\t\t// ${mainRowComment(sc, table, [s0, s1], t2, [s6, s7], t7, hasAltgr, hasAltgrShift)}`,
    );
    if (capsPair !== null) {
      const [c0, c1] = capsTexts;
      dataRows.push(
        `-1\t-1\t0\t${c0}\t${c1}\t\t// ${capsCellName(table, capsPair[0])}, ${capsCellName(table, capsPair[1])}`,
      );
    }
  }

  // Defense in depth: каждая %% обязана иметь парную запись LIGATURE.
  const emittedPercents = dataRows
    .filter((r) => !r.startsWith("-1"))
    .reduce((n, r) => n + r.split("\t").filter((c) => c === "%%").length, 0);
  if (emittedPercents !== ligatures.length) {
    throw new KlcBuildError(
      "G_INTERNAL",
      `рассинхрон %% (${emittedPercents}) и записей LIGATURE (${ligatures.length})`,
    );
  }

  return {
    dataRows,
    ligRows: ligatures.map(
      (e) => `${e.vk}${vkPad(e.vk)}${e.mod}\t${e.codes.join("\t")}\t\t// ${e.comment}`,
    ),
  };
}

/** Комментарий основной строки: имена присутствующих колонок через ", ". */
function mainRowComment(
  sc: string,
  table: UnicodeTable,
  base: [CellValue, CellValue],
  ctrlText: string,
  altgr: [CellValue, CellValue],
  t7: string,
  hasAltgr: boolean,
  hasAltgrShift: boolean,
): string {
  const names = [
    mainCellName(table, base[0]),
    mainCellName(table, base[1]),
    ctrlText === "-1" ? "<none>" : ctrlName(ctrlText),
  ];
  if (hasAltgr) names.push(mainCellName(table, altgr[0]));
  // t7 === "-1": естественный (@None) или форсированный (SPACE) — оба <none>.
  if (hasAltgrShift) names.push(t7 === "-1" ? "<none>" : mainCellName(table, altgr[1]));
  // Особый случай DECIMAL (SC 53, эталон): все присутствующие c2/c6/c7 — "-1"
  // → пустые имена вместо `<none>` (концевой пробел подрезается,
  // reference хранит комментарий без хвостового пробела).
  if (sc === "53" && names.slice(2).every((n) => n === "<none>")) {
    return [names[0], names[1], ...names.slice(2).map(() => "")].join(", ").trimEnd();
  }
  return names.join(", ");
}

function mainCellName(table: UnicodeTable, value: CellValue): string {
  if (value.kind === "ligature") return "<null>";
  if (value.kind === "none") return "<none>";
  if (value.kind === "space") return "SPACE";
  if (value.kind === "nbsp") return "NO-BREAK SPACE";
  if (value.kind === "trans") {
    throw new KlcBuildError("G_INTERNAL", `@Trans в base/altgr достиг генератора без резолва`);
  }
  const override = MAIN_ROW_NAME_OVERRIDES[hexOf(value.codePoint)];
  if (override === null) return "<null>";
  if (override !== undefined) return override;
  return commentFor(table, value.codePoint);
}

function ctrlName(ctrl: string): string {
  // Управляющие коды MSKLC именует по-своему (эталон): 001b ESCAPE,
  // 001c INFORMATION SEPARATOR FOUR, 001d INFORMATION SEPARATOR THREE.
  if (ctrl === "001b") return "ESCAPE";
  if (ctrl === "001c") return "INFORMATION SEPARATOR FOUR";
  if (ctrl === "001d") return "INFORMATION SEPARATOR THREE";
  return commentFor(DEFAULT_UNICODE_TABLE, Number.parseInt(ctrl, 16));
}

/** Имя ячейки caps-расширения: -1 → <none>, иначе имя символа. */
function capsCellName(table: UnicodeTable, value: CellValue): string {
  if (value.kind === "none") return "<none>";
  if (value.kind === "space") return "SPACE";
  if (value.kind === "nbsp") return "NO-BREAK SPACE";
  if (value.kind === "ligature") return "<null>";
  if (value.kind === "trans") {
    throw new KlcBuildError("G_INTERNAL", `@Trans в caps достиг генератора без резолва`);
  }
  return commentFor(table, value.codePoint);
}
