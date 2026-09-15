/**
 * V9. Кросс-файловые проверки (docs/03, стадия V9).
 *
 * Выполняется один раз после цикла по файлам, только по успешно
 * провалидированным схемам (данные битых файлов ненадёжны).
 * Дубликат `msklc.name` — ошибка E_MSKLC_DUP_NAME (второй файл ссылается
 * на первый; из него же следует коллизия выходного `.klc`).
 * Дубликаты `main.short_name` / `main.name` — предупреждения
 * W_DUP_SHORT / W_DUP_NAME (на генерацию не влияют, но сбивают с толку).
 */

import { errorDiag, warnDiag, type Diagnostic } from "./report.ts";

export interface CrossCheckInput {
  file: string;
  mainName: string;
  mainShortName: string;
  msklcName: string;
}

/** Проверить уникальность имён между файлами (первое вхождение — эталон). */
export function crossCheck(inputs: CrossCheckInput[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const msklcSeen = new Map<string, string>();
  const shortSeen = new Map<string, string>();
  const nameSeen = new Map<string, string>();

  for (const input of inputs) {
    const firstMsklc = msklcSeen.get(input.msklcName);
    if (firstMsklc !== undefined) {
      out.push(
        errorDiag(
          "E_MSKLC_DUP_NAME",
          input.file,
          `[msklc].name "${input.msklcName}" уже использован в ${firstMsklc}`,
        ),
      );
    } else {
      msklcSeen.set(input.msklcName, input.file);
    }

    const firstShort = shortSeen.get(input.mainShortName);
    if (firstShort !== undefined) {
      out.push(
        warnDiag(
          "W_DUP_SHORT",
          input.file,
          `[main].short_name "${input.mainShortName}" уже использован в ${firstShort}`,
        ),
      );
    } else {
      shortSeen.set(input.mainShortName, input.file);
    }

    const firstName = nameSeen.get(input.mainName);
    if (firstName !== undefined) {
      out.push(
        warnDiag(
          "W_DUP_NAME",
          input.file,
          `[main].name "${input.mainName}" уже использован в ${firstName}; выходной .klc-файл будет перезаписан`,
        ),
      );
    } else {
      nameSeen.set(input.mainName, input.file);
    }
  }
  return out;
}
