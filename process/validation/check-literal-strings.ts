/**
 * V0. Сырая проверка кавычек до TOML-парсинга.
 *
 * Все строковые поля `[layout]` и значения `[ligatures]` обязаны быть literal-строками `'''`,
 * т.к. в basic-строках `\` — escape-символ и раскладки со слэшем были бы искажены.
 *
 * TOML-парсер к моменту проверки уже исказил бы слэши, поэтому сканируем сырой
 * текст построчно: наличие подстроки `"""` — ошибка `E_QUOTES_TRIPLE_DOUBLE`.
 */

export interface RawQuoteHit {
  /** 1-based номер строки файла. */
  line: number;
  /** 1-based колонка первого вхождения `"""` в строке. */
  column: number;
}

/** Найти все строки сырого текста, содержащие `"""`. */
export function findTripleDoubleQuotes(text: string): RawQuoteHit[] {
  const hits: RawQuoteHit[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const idx = (lines[i] as string).indexOf('"""');
    if (idx >= 0) {
      hits.push({ line: i + 1, column: idx + 1 });
    }
  }

  return hits;
}
