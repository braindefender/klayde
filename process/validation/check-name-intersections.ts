/**
 * V9. Кросс-файловые проверки.
 *
 * Выполняется один раз после цикла по файлам, только по успешно
 * провалидированным схемам (данные битых файлов ненадёжны).

 * Дубликат `msklc.name` — ошибка E_MSKLC_DUP_NAME (второй файл ссылается
 * на первый; из него же следует коллизия выходного `.klc`).
 *
 * Дубликаты `main.short_name` / `main.name` — предупреждения
 * W_DUP_SHORT / W_DUP_NAME (на генерацию не влияют, но сбивают с толку).
 *
 * Коллизия выходного macOS-каталога — ошибка E_MACOS_DUP_BUNDLE
 * (второй файл ссылается на первый). Ключ — полный путь
 * `<out>/<rel>/macos/<bundle_name>.bundle`: одинаковый `bundle_name`
 * в разных подкаталогах `layouts/` коллизией не считается, одинаковый
 * в одном каталоге — тихая перезапись, запрещена (fail-closed).
 */

import { errorDiag, warnDiag, type Diagnostic } from "./report.ts";

export interface CrossCheckInput {
  file: string;
  mainName: string;
  mainShortName: string;
  msklcName: string;
  /**
   * Выходной каталог macOS-bundle (resolveBundleDir); чем точнее ключ,
   * тем меньше ложных срабатываний. Опционален ради совместимости:
   * без него проверка E_MACOS_DUP_BUNDLE пропускается.
   */
  macosBundleDir?: string;
}

/** Проверить уникальность имён между файлами (первое вхождение — эталон). */
export function crossCheck(inputs: CrossCheckInput[]): Diagnostic[] {
  const out: Diagnostic[] = [];

  const msklcSeen = new Map<string, string>();
  const shortSeen = new Map<string, string>();
  const nameSeen = new Map<string, string>();
  const bundleSeen = new Map<string, string>();

  for (const input of inputs) {
    const firstMsklcName = msklcSeen.get(input.msklcName);
    if (firstMsklcName !== undefined) {
      out.push(
        errorDiag(
          "E_MSKLC_DUP_NAME",
          input.file,
          `[msklc].name "${input.msklcName}" уже использован в ${firstMsklcName}`,
        ),
      );
    } else {
      msklcSeen.set(input.msklcName, input.file);
    }

    const firstShortName = shortSeen.get(input.mainShortName);
    if (firstShortName !== undefined) {
      out.push(
        warnDiag(
          "W_DUP_SHORT",
          input.file,
          `[main].short_name "${input.mainShortName}" уже использован в ${firstShortName}`,
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

    if (input.macosBundleDir !== undefined) {
      const firstBundle = bundleSeen.get(input.macosBundleDir);
      if (firstBundle !== undefined) {
        out.push(
          errorDiag(
            "E_MACOS_DUP_BUNDLE",
            input.file,
            `выходной каталог ${input.macosBundleDir} уже занят ${firstBundle} (одинаковый [macos].bundle_name в одном каталоге схем); тихая перезапись запрещена`,
          ),
        );
      } else {
        bundleSeen.set(input.macosBundleDir, input.file);
      }
    }
  }

  return out;
}
