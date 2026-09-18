# Архитектура приложения и план внедрения

## 1. Структура каталогов (предлагаемая)

```text
klayde/
  index.ts            # существующая точка входа (bootstrap → src/main.ts)
  package.json        # скрипт "start": "bun run index.ts" (уже добавлен)
  layouts/            # входные TOML-схемы (существуют, 6 файлов)
  data/
    unicode.json      # код -> UPPER_ENGLISH_NAME (см. docs/07)
  process/
    main.ts           # runCli(argv): оркестрация фаз A→B→C
    cli/
      args.ts         # парсинг --os/--layout/--out/--verbose + usage
      const.ts        # дефолты, KNOWN_FLAGS
      helpers.ts      # splitFlag/readFlagValue/parseBooleanValue/isTomlFile
      errors.ts       # коды E_* / exit codes
      discover.ts     # резолв входов в список файлов
    model/
      spec.ts         # типы LayoutSpec, CellValue, ValidatedSpec
    validation/
      const.ts        # слои, геометрия, шаблоны, лимиты, таблицы секций
      helpers.ts      # чистые утилиты: ячейки, сетки, Левенштейн, Unicode
      rawcheck.ts     # V0: поиск """ по сырому тексту
      parse.ts        # V1–V2: TOML-парсинг + структура
      validate.ts     # V3–V8: валидаторы одного файла
      crosscheck.ts   # V9: дубли между файлами
      report.ts       # формат error[E_...]/warn[W_...], печать в stderr
    generators/
      types.ts        # интерфейс OsGenerator { os, generate(spec, outDir) }
      registry.ts     # карта os -> генератор; unknown → not implemented
      windows/
        positions.ts  # таблица ortho-5x10-v1 (docs/05)
        unicode.ts    # загрузка data/unicode.json + encodeCell()
        klcHeader.ts  # шапка + SHIFTSTATE + KEYNAME* + DESCRIPTIONS/LANGUAGENAMES
        klcLayout.ts  # секции LAYOUT + LIGATURE
        klcWriter.ts  # сборка, CRLF, UTF-16LE+BOM, атомарная запись
        index.ts      # WindowsKlcGenerator implements OsGenerator
      macos/
        index.ts      # заглушка: skip not implemented
      linux/
        index.ts      # заглушка: skip not implemented
  build/              # выход (gitignore): build/windows/*.klc
  docs/               # эта документация
  tests/
    fixtures/         # валидные + по одному на каждый E_*-код
    golden/           # эталонные .klc из universal-layout для сравнения
    *.test.ts         # тесты валидаторов, позиционной таблицы, golden-дифф
```

## 2. Ключевые типы (эскиз)

```ts
type OsId = "windows" | "macos" | "linux";

interface CliOptions {
  osList: OsId[]; inputFiles: string[];
  outDir: string; failFast: boolean; verbose: boolean;
}

type CellValue =
  | { kind: "none" } | { kind: "space" } | { kind: "nbsp" }
  | { kind: "char"; codePoint: number }
  | { kind: "ligature"; name: string; codePoints: number[] };

interface ValidatedSpec {
  file: string;
  main: { name: string; shortName: string; capsIsShift: boolean };
  msklc: { name: string; company: string; copyright: string; description: string; languageNames: string };
  layers: { base: CellValue[][]; baseShift: CellValue[][];
            altgr: CellValue[][]; altgrShift: CellValue[][];
            caps: CellValue[][]; capsShift: CellValue[][] };
  usedLigatures: Map<string, number[]>;
}

interface OsGenerator {
  readonly os: OsId;
  generate(spec: ValidatedSpec, outDir: string): Promise<GenerateResult>;
}
```

Матрицы — всегда 5×10 после валидации. Генератор не проверяет размеры.

## 3. Поток данных

Описывается словами. `main()` вызывает `parseArgs()` → `discoverInputs()` →
для каждого файла `validateFile()` (стадии V0–V8 из `docs/03`) →
`crossCheck()` (V9) → если ошибок нет, для каждой пары
`(spec, os)` вызывает `registry.get(os).generate()` → пишет файлы →
печатает сводку. Ошибки валидации печатаются все сразу; генерация либо
для всех файлов, либо ни для одного. Частичная генерация запрещена.

Зависимости текут в одну сторону: `generators/windows/*` зависит от
`model` и `validation/*` (читает `ValidatedSpec`), но не наоборот. `cli`
не знает про KLC. Таблица позиций и таблица Unicode — чистые данные
без логики, подменяемые в тестах.

## 4. Решения, принятые в этом плане (сводка)

1. Вход — только TOML; сетки — только `'''`; геометрия — только 5×10.
2. `Cap`-зона — по позиции (ряды 2–4 + r5c8 `SGCap`, ряды 1/5 `Cap=0`),
   а эффект CapsLock — по содержимому явных `caps`/`caps_shift`
   (`@Trans` — без эффекта; системный CapsLock затрагивает только буквы,
   поэтому неявный SGCap для пунктуации/цифр запрещён — слои обязательны).
   Режим выбирает `[main].caps_is_shift` (см.
   `docs/toml-schema.md`, по умолчанию `true`): `true` — стандарт (caps связаны с base;
   Windows — только `Cap 0`/`Cap 1`, иначе `G_CAPS_MODE`; Linux — одна
   группа без `ISO_Next_Group`), `false` — независимые caps (Windows —
   `SGCap`-расширения; Linux — две группы с `ISO_Next_Group`).
3. Лигатуры — только `@Имя` + `%%`/`LIGATURE`; встроенные `@None/@Space/@Nbsp`, `@Trans` только в caps.
5. `Ctrl`-колонка и `SPACE.col7=-1` — константы таблицы позиций.
6. Выход Windows — UTF-16LE+BOM+CRLF, имя `<main.name>.klc` в `<out>/windows/`.
7. macOS/Linux — заглушки за тем же интерфейсом; `--os` принимает их уже сейчас.
8. Кодировка вне BMP и лигатуры в `caps` — честные ошибки генерации,
   а не молчаливые искажения.
9. Открытые вопросы с дефолтами: `LOCALEID/LOCALENAME` (`00000409/en-US`),
   `LANGUAGENAMES` (`[msklc].language_names`, fallback `= DESCRIPTIONS`), точная граница
   `short_name` (8). Каждый помечен кодом и тестом как известный риск.

## 5. План внедрения (по фазам, без кода)

**Фаза 1 — каркас.** `src/main.ts`, парсинг аргументов, discovery входов,
реестр генераторов с Windows-заглушкой, коды выхода, тесты CLI-парсинга.
Критерий готовности: `bun run start -- --os=windows` печатает usage-ошибки
корректно, несуществующий layout даёт `E_LAYOUT_NOT_FOUND`.

**Фаза 2 — валидация.** V0–V9 по `docs/03`, фикстуры на каждый код ошибки,
тест «замороженные схемы `tests/fixtures/golden-*.toml` валидны без ошибок»
(каталог `layouts/` — user-space и в тестах не используется). Критерий:
сломанные копии фикстур дают ровно ожидаемые коды с координатами.

**Фаза 3 — данные Windows.** Таблица позиций (`positions.ts`) с юнит-тестом
«50 записей», таблица Unicode (`unicode.json` минимум для всех
символов из `tests/fixtures/` + `*` для `00ab/00bb`), тест `encodeCell`.

**Фаза 4 — генератор KLC.** `klcHeader/klcLayout/klcWriter`, golden-тесты:
сгенерированные `.klc` для merged/english/russian диффаются с эталонами
из `universal-layout` (допуски: только `LANGUAGENAMES`, если решение
ещё не принято). Проверка открытия результата в MSKLC вручную —
единственный ручной шаг; всё остальное автоматизировано. Критерий:
MSKLC открывает файлы без ошибок, golden-дифф в пределах допусков.

**Фаза 5 — лигатуры и caps.** Параметризованные тесты: english-схемы
дают `Cap 1` для букв и `Cap 0` для не-букв без расширений;
merged/russian — `SGCap`-расширения из явных слоёв; `@FatArr/@ThinArr` дают `%%` + `K 3/4`; неиспользуемая
лигатура — `W_LIG_UNUSED` и отсутствие в выводе;

**Фаза 6 — полировка.** `--out`, `--verbose`, атомарная запись,
сводка, README с примерами запуска. Регресс: полный прогон
`bun run start` даёт `dist/windows/*.klc` для всех 6 схем.

## 6. Тестовая стратегия

Тесты опираются только на `tests/fixtures/` (входы, включая замороженные
копии схем `golden-*.toml`) и `tests/golden/` (эталонные `.klc`); каталог
`layouts/` — user-space и в тестах не используется (кроме проверки, что
дефолтный discovery резолвится в скан каталога по умолчанию без привязки
к его содержимому).

- Юнит-тесты валидаторов: по одному минимальному TOML на каждый `E_*`.
- Юнит-тесты таблицы позиций: каждая из 49 записей сверена с эталоном
  (sc, vk, cap-зона, ctrl).
- Golden-тесты: побайтовое сравнение (после нормализации CRLF) с тремя
  эталонами; расхождения вне допусков — падение.
- Ручной acceptance: открыть каждый `.klc` в MSKLC, убедиться в отсутствии
  ошибок, визуально сверить caps (буквы — `Cap 1`/`SGCap`, не-буквы — `Cap 0`) и лигатуры.

## 7. Риски и mitigations

- Недокументированность KLC: mitigated — три эталона + системные KLC
  покрывают все используемые конструкции; неизвестное проявляется как
  ошибка MSKLC на acceptance и фиксируется точечно.
- `SPACE.col7` и `LANGUAGENAMES`: mitigated — дефолты + тесты фиксируют
  отличие от эталона как известное, решение принимается отдельно без
  переделки архитектуры.
- Расширение на standard-раскладки: mitigated — таблица позиций
  версионирована (`ortho-5x10-v1`); новая геометрия = новая таблица,
  валидатор и генератор не меняются.
