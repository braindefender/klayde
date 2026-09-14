/**
 * Тесты фазы 1: CLI-парсинг, discovery входов, реестр генераторов.
 * Контракт: docs/01-cli.md; план: docs/08-architecture.md (фаза 1).
 */
import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractProgramArgs, parseArgs } from "../process/cli/args.ts";
import { CliError, type ErrorCode } from "../process/cli/errors.ts";
import { discoverInputs } from "../process/layouts/discover.ts";
import { GENERATOR_RUN_ORDER, getGenerator } from "../process/generators/registry.ts";
import { runCli } from "../process/main.ts";

function expectCliError(fn: () => unknown, code: ErrorCode) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).code).toBe(code);
    return;
  }
  throw new Error(`ожидалась ошибка ${code}, но исключения не было`);
}

describe("extractProgramArgs", () => {
  test("берёт всё после --", () => {
    expect(extractProgramArgs(["bun", "index.ts", "--", "--os=windows"])).toEqual([
      "--os=windows",
    ]);
  });
  test("без -- отрезает первые два argv", () => {
    expect(extractProgramArgs(["bun", "index.ts", "--os=windows"])).toEqual([
      "--os=windows",
    ]);
  });
  test("фильтрует вложенные -- от пресетов package.json", () => {
    expect(
      extractProgramArgs(["bun", "index.ts", "--", "--os=windows", "--", "--layout=a.toml"]),
    ).toEqual(["--os=windows", "--layout=a.toml"]);
  });
});

describe("parseArgs --os", () => {
  test("по умолчанию — все ОС", () => {
    expect(parseArgs([]).osList).toEqual(["windows", "macos", "linux"]);
  });
  test("одно значение", () => {
    expect(parseArgs(["--os=windows"]).osList).toEqual(["windows"]);
  });
  test("список, пробелы, регистр, дубликаты; порядок нормализуется", () => {
    expect(parseArgs(["--os=Linux, WINDOWS ,linux"]).osList).toEqual([
      "windows",
      "linux",
    ]);
  });
  test("форма через пробел", () => {
    expect(parseArgs(["--os", "macos"]).osList).toEqual(["macos"]);
  });
  test("пустое значение — E_OS_EMPTY", () => {
    expectCliError(() => parseArgs(["--os="]), "E_OS_EMPTY");
    expectCliError(() => parseArgs(["--os", "--verbose"]), "E_OS_EMPTY");
  });
  test("неизвестная ОС — E_OS_UNKNOWN", () => {
    expectCliError(() => parseArgs(["--os=windows,amiga"]), "E_OS_UNKNOWN");
  });
});

describe("parseArgs прочие флаги", () => {
  test("дефолты out/verbose/layout", () => {
    const opts = parseArgs([]);
    expect(opts.outDir).toBe("build");
    expect(opts.verbose).toBe(false);
    expect(opts.layoutInputs).toEqual([]);
  });
  test("--layout собирается и повторяется, --out и --verbose", () => {
    const opts = parseArgs(["--layout=a.toml", "--layout=b.toml", "--out=dist", "--verbose"]);
    expect(opts.layoutInputs).toEqual(["a.toml", "b.toml"]);
    expect(opts.outDir).toBe("dist");
    expect(opts.verbose).toBe(true);
  });
  test("неизвестный флаг — E_ARGS_UNKNOWN", () => {
    expectCliError(() => parseArgs(["--foo=1"]), "E_ARGS_UNKNOWN");
  });
  test("позиционный аргумент — E_ARGS_UNKNOWN", () => {
    expectCliError(() => parseArgs(["layouts/a.toml"]), "E_ARGS_UNKNOWN");
  });
  test("--layout без значения — E_ARGS_UNKNOWN", () => {
    expectCliError(() => parseArgs(["--layout"]), "E_ARGS_UNKNOWN");
  });
});

describe("discoverInputs", () => {
  async function makeTmp(files: Record<string, string>): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-"));
    for (const [name, content] of Object.entries(files)) {
      await fs.writeFile(path.join(dir, name), content);
    }
    return dir;
  }

  test("несуществующий файл — E_LAYOUT_NOT_FOUND", async () => {
    try {
      await discoverInputs(["layouts/no-such-file.toml"]);
      throw new Error("ожидалась E_LAYOUT_NOT_FOUND");
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).code).toBe("E_LAYOUT_NOT_FOUND");
    }
  });

  test("явный не-TOML — E_LAYOUT_EXTENSION", async () => {
    const dir = await makeTmp({ "a.txt": "x" });
    try {
      await discoverInputs([path.join(dir, "a.txt")]);
      throw new Error("ожидалась E_LAYOUT_EXTENSION");
    } catch (err) {
      expect((err as CliError).code).toBe("E_LAYOUT_EXTENSION");
    }
  });

  test("каталог: рекурсивно, *.toml, сортировка, игнор прочих", async () => {
    // Имена строчные и различные: Windows-ФС case-insensitive,
    // поэтому a.toml + A.TOML были бы одним файлом.
    const dir = await makeTmp({ "b.toml": "x", "a.toml": "x", "note.txt": "x", "c.TOML": "x" });
    await fs.mkdir(path.join(dir, "sub", "nested"), { recursive: true });
    await fs.writeFile(path.join(dir, "sub", "d.toml"), "x");
    await fs.writeFile(path.join(dir, "sub", "nested", "e.toml"), "x");
    await fs.writeFile(path.join(dir, "sub", "ignore.txt"), "x");
    const found = await discoverInputs([dir]);
    expect(found).toEqual(
      ["a.toml", "b.toml", "c.TOML", path.join("sub", "d.toml"), path.join("sub", "nested", "e.toml")].map(
        (n) => path.join(dir, n),
      ),
    );
  });

  test("несколько --layout: объединение и дедуп", async () => {
    const dir = await makeTmp({ "a.toml": "x", "b.toml": "x" });
    const a = path.join(dir, "a.toml");
    const found = await discoverInputs([a, dir, a]);
    expect(found).toEqual([a, path.join(dir, "b.toml")]);
  });

  test("пустой каталог — E_NO_INPUTS", async () => {
    const dir = await makeTmp({ "note.txt": "x" });
    try {
      await discoverInputs([dir]);
      throw new Error("ожидалась E_NO_INPUTS");
    } catch (err) {
      expect((err as CliError).code).toBe("E_NO_INPUTS");
    }
  });

  test("дефолт layouts/: рекурсивно все схемы отсортированы", async () => {
    const found = await discoverInputs([]);
    expect(found.length).toBe(12);
    expect(found).toEqual([...found].sort());
    expect(found.some((f) => f.includes(path.join("universal-layout", "ortho")))).toBe(true);
    expect(found.some((f) => f.includes(path.join("universal-layout", "standard")))).toBe(true);
  });
});

describe("registry", () => {
  test("все ОС зарегистрированы, порядок фиксирован", () => {
    expect(GENERATOR_RUN_ORDER).toEqual(["windows", "macos", "linux"]);
    for (const osId of GENERATOR_RUN_ORDER) {
      expect(getGenerator(osId).os).toBe(osId);
    }
  });
  test("windows реализован, macos/linux — заглушки skip (фаза 4)", async () => {
    const { validateFile } = await import("../process/layouts/validate.ts");
    const r = await validateFile("tests/fixtures/valid-mini.toml");
    if (!r.spec) throw new Error("valid-mini обязан валидироваться");
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-reg-"));
    const win = await getGenerator("windows").generate(r.spec, tmp);
    expect(win.status).toBe("ok");
    expect(win.outFile?.endsWith(".klc")).toBe(true);
    for (const osId of ["macos", "linux"] as const) {
      const res = await getGenerator(osId).generate(r.spec, tmp);
      expect(res.status).toBe("skip");
    }
  });
});

describe("runCli коды выхода", () => {
  test("несуществующий layout → 2 (E_LAYOUT_NOT_FOUND)", async () => {
    const code = await runCli(["bun", "index.ts", "--", "--layout=layouts/no-such.toml"]);
    expect(code).toBe(2);
  });
  test("неизвестный флаг → 2", async () => {
    const code = await runCli(["bun", "index.ts", "--", "--frobnicate=1"]);
    expect(code).toBe(2);
  });
  test("--help → 0", async () => {
    const code = await runCli(["bun", "index.ts", "--", "--help"]);
    expect(code).toBe(0);
  });
});
