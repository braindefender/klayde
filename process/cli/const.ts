import { OS_LIST } from "../model";

export const DEFAULT_OUT_DIR = "build";

export const DEFAULT_LAYOUTS_DIR = "layouts";

export const USAGE_HINT = "См. usage: bun run start -- --help";

/** Флаги, известные парсеру (всё остальное — E_ARGS_UNKNOWN). */
export const KNOWN_FLAGS = new Set([
  "--os",
  "--layout",
  "--out",
  "--verbose",
  "--help",
  "-h",
]);

export const USAGE_FULL = [
  "Использование:",
  "  bun run start -- [--os=<os,...>] [--layout=<путь>...] [--out=<каталог>] [--verbose]",
  "",
  "Примеры:",
  '  bun run start -- --os="windows,macos,linux" --layout="layout.toml"',
  '  bun run windows -- --layout="layouts/foo.toml"',
  "  bun run all",
  "",
  "Флаги:",
  `  --os=<list>        ОС для генерации (по умолчанию: ${OS_LIST.join(",")});`,
  `  --layout=<path>    Одна или несколько TOML-схем или каталог (по умолчанию: ${DEFAULT_LAYOUTS_DIR}/)`,
  `  --out=<каталог>    корень выхода (по умолчанию: ${DEFAULT_OUT_DIR})`,
  "  --verbose          подробные логи по каждой стадии",
  "  --help, -h         показать эту подсказку",
].join("\n");
