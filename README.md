# klayde

Keyboard Layout Definition Emitter

Генератор раскладок клавиатуры из декларативных TOML-схем.

Вход: один или несколько файлов из `layouts/`.
Выход: файлы раскладок под Windows (`.klc`, UTF-16LE с BOM и CRLF),
которые открываются в [MSKLC](https://www.microsoft.com/en-us/download/details.aspx?id=102134)
без ошибок. Сборку `.dll`/`.exe`/`.msi` из `.klc` выполняет сам MSKLC вручную.
Linux и macOS — out of scope для генерации: CLI принимает их в `--os`,
но генераторы пока отвечают `skip: not implemented` и не падают.

## Требования

[Bun](https://bun.com) ≥ 1.4.

```bash
bun install
```

## Запуск

```bash
# Все схемы для всех ОС (выход — build/windows/*.klc)
bun run start

# Только Windows
bun run start -- --os=windows
# или пресет:
bun run windows

# Одна схема
bun run start -- --os=windows --layout="layouts/universal-layout-ortho-merged.toml"

# Несколько схем, свой каталог выхода, подробные логи
bun run start -- --layout="layouts/a.toml" --layout="layouts/b.toml" --out="build" --verbose

# Пресеты под каждую ОС и все сразу
bun run macos
bun run linux
bun run all
```

Двойной дефис `--` обязателен: всё, что после него, Bun передаёт программе.

Флаги:

| Флаг        | По умолчанию          | Описание                                                |
| ----------- | --------------------- | ------------------------------------------------------- |
| `--os`      | `windows,macos,linux` | Список ОС через запятую, регистр не важен               |
| `--layout`  | `layouts/`            | TOML-схема, каталог с TOML или несколько `--layout`     |
| `--out`     | `build`               | Корень выхода (подкаталог ОС добавляется автоматически) |
| `--verbose` | —                     | Подробные логи по каждой стадии                         |
| `--help`    | —                     | Подсказка по синтаксису                                 |

Коды выхода: `0` — успех (включая «всё пропущено как not implemented»),
`1` — ошибки валидации схемы (генерация не выполнялась),
`2` — ошибка аргументов или входов, `3` — внутренняя ошибка записи.

Обычные сообщения и сводка (`ok: <вход> -> <выход>`, `done: ...`) — в stdout,
ошибки (`error[E_...]`, usage) — в stderr.

## Конвейер

1. **A.** Разбор аргументов и поиск входов.
2. **B.** Валидация V0–V9 (сырые кавычки, TOML, структура, скаляры, лигатуры,
   геометрия 5×10, ячейки, `caps`, Unicode, кросс-проверки). Любая ошибка
   блокирует генерацию для всех файлов (fail-closed).
3. **C.** Генерация: каждая схема × каждая ОС; запись атомарная
   (временный файл + rename).

## Разработка

```bash
bun test          # все тесты (валидаторы, таблицы, golden-дифф с эталонами)
bunx tsc --noEmit # проверка типов
```

Golden-эталоны лежат в `tests/golden/` (копии `.klc` из `universal-layout`).
Известные допуски диффа зафиксированы в `tests/klc.test.ts`
(`LANGUAGENAMES`, `COPYRIGHT`, KBD inverted-файлов, дрейф «сетка новее эталона»).

## Документация

- `docs/00-overview.md` — обзор и конвейер
- `docs/01-cli.md` — контракт CLI, аргументы, коды выхода
- `docs/02-toml-schema.md` — схема TOML-файла
- `docs/03-validation.md` — стадии валидации V0–V9
- `docs/04-klc-format.md` — исследование формата `.klc` по эталонам
- `docs/05-position-map.md` — таблица привязки сетки к scancode/VK
- `docs/06-generation-windows.md` — алгоритм генерации `.klc`
- `docs/07-unicode-ligatures.md` — символы, коды, имена, лигатуры
- `docs/08-architecture.md` — модули, структуры данных, план внедрения

## Ручной acceptance

Единственный ручной шаг: открыть каждый `.klc` из `build/windows/` в MSKLC,
убедиться в отсутствии ошибок, визуально сверить `caps=shift`
(для english/russian) и лигатуры (`=>`/`->` на клавише K).
