# klayde

Keyboard Layout Definition Emitter

Генератор раскладок клавиатуры из декларативных TOML-схем.

Вход: один или несколько файлов из `layouts/`.
Выход: файлы раскладок под Windows (`.klc`), macOS (`.keylayout`), Linux (XKB)

## Документация

[TOML Схема](./docs/toml-schema.md)

## Требования

[Bun](https://bun.com) ≥ 1.4.

```bash
bun install
```

## Запуск

```bash
# Для всех ОС
bun run start

# Для конкретной ОС
`bun run windows # or macos/linux`

# Одна схема
bun run start -- --os=windows --layout="layouts/universal-layout-ortho-merged.toml"

# Несколько схем, свой каталог выхода, подробные логи
bun run start -- --layout="layouts/a.toml" --layout="layouts/b.toml" --out="build" --verbose

Двойной дефис `--` обязателен: всё, что после него, Bun передаёт программе.

Флаги:

| Флаг        | По умолчанию          | Описание                                                |
| ----------- | --------------------- | ------------------------------------------------------- |
| `--os`      | `windows,macos,linux` | Список ОС через запятую, регистр не важен               |
| `--layout`  | `layouts/`            | TOML-схема, каталог с TOML или несколько `--layout`     |
| `--out`     | `build`               | Корень выхода (подкаталог ОС добавляется автоматически) |
| `--verbose` | —                     | Подробные логи по каждой стадии                         |
| `--help`    | —                     | Подсказка по синтаксису                                 |

Коды выхода:
- `0` — успех,
- `1` — ошибки валидации схемы,
- `2` — ошибка аргументов или входов,
- `3` — внутренняя ошибка записи.

## Разработка

```bash
bun test           # все тесты (валидаторы, таблицы, golden-дифф с эталонами)
bun x tsc --noEmit # проверка типов
```
