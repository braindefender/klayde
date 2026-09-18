/**
 * Тесты фазы 6: полировка (--out, --verbose, сводка, атомарность, регресс).
 */
import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCli } from "../process/main.ts";
import { writeKlcFile } from "../process/generators/windows/klcWriter.ts";
import { validateFile } from "../process/validation/validate.ts";

/** Перехватить console.log/error на время fn; вернуть собранные строки. */
async function capture(fn: () => Promise<number>): Promise<{
  code: number;
  out: string[];
  err: string[];
}> {
  const out: string[] = [];
  const err: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args: unknown[]) => void out.push(args.join(" "));
  console.error = (...args: unknown[]) => void err.push(args.join(" "));
  try {
    const code = await fn();
    return { code, out, err };
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

/**
 * Прогоны CLI опираются только на tests/fixtures (каталог layouts/ —
 * user-space и здесь не используется): все схемы передаются явными
 * `--layout`, дефолтное сканирование каталога не задействовано.
 */
const GOLDEN_LAYOUTS = [
  "tests/fixtures/golden-english.toml",
  "tests/fixtures/golden-english-inverted.toml",
  "tests/fixtures/golden-merged.toml",
  "tests/fixtures/golden-merged-inverted.toml",
  "tests/fixtures/golden-russian.toml",
  "tests/fixtures/golden-russian-inverted.toml",
];

function layoutArgs(): string[] {
  return GOLDEN_LAYOUTS.map((f) => `--layout=${f}`);
}

describe("--out: артефакты ложатся в заданный корень", () => {
  test("6 схем → <out>/windows/*.klc, выход 0", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-out-"));
    const { code, out } = await capture(() =>
      runCli(["bun", "index.ts", "--", "--os=windows", `--out=${tmp}`, ...layoutArgs()]),
    );
    expect(code).toBe(0);
    const files = (await fs.readdir(path.join(tmp, "windows"))).sort();
    expect(files.length).toBe(6);
    expect(files.every((f) => f.endsWith(".klc"))).toBe(true);
    expect(out.filter((l) => l.startsWith("ok:")).length).toBe(6);
  });
});

describe("сводка", () => {
  test("успех: done с числом входов/артефактов/пропусков", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-sum-"));
    const { code, out } = await capture(() =>
      runCli(["bun", "index.ts", "--", "--os=windows", `--out=${tmp}`, ...layoutArgs()]),
    );
    expect(code).toBe(0);
    expect(out[out.length - 1]).toBe("done: входов 6, артефактов 6, пропусков 0");
  });

  test("только macos: 6 .bundle, выход 0", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-mac-"));
    const { code, out } = await capture(() =>
      runCli(["bun", "index.ts", "--", "--os=macos", `--out=${tmp}`, ...layoutArgs()]),
    );
    expect(code).toBe(0);
    const files = (await fs.readdir(path.join(tmp, "macos"))).sort();
    expect(files.length).toBe(6);
    expect(files.every((f) => f.endsWith(".bundle"))).toBe(true);
    expect(out.filter((l) => l.startsWith("ok:")).length).toBe(6);
  });

  test("только linux: 6 symbols-файлов, выход 0", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-lin-"));
    const { code, out } = await capture(() =>
      runCli(["bun", "index.ts", "--", "--os=linux", `--out=${tmp}`, ...layoutArgs()]),
    );
    expect(code).toBe(0);
    expect((await fs.readdir(path.join(tmp, "linux"))).length).toBe(6);
    expect(out.filter((l) => l.startsWith("ok:")).length).toBe(6);
  });

  test("ошибка валидации: сводки нет, диагностика — в stderr", async () => {
    const { code, out, err } = await capture(() =>
      runCli(["bun", "index.ts", "--", "--layout=tests/fixtures/e_cell_at.toml"]),
    );
    expect(code).toBe(1);
    expect(out.length).toBe(0);
    expect(err.some((l) => l.includes("E_CELL_AT"))).toBe(true);
  });
});

describe("--verbose", () => {
  test("подробные логи по стадиям", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-verb-"));
    const { code, out } = await capture(() =>
      runCli([
        "bun",
        "index.ts",
        "--",
        "--os=windows",
        "--layout=tests/fixtures/valid-mini.toml",
        `--out=${tmp}`,
        "--verbose",
      ]),
    );
    expect(code).toBe(0);
    expect(out.some((l) => l.startsWith("verbose: os="))).toBe(true);
    expect(out.some((l) => l.startsWith("verbose: validate "))).toBe(true);
    expect(out.some((l) => l.startsWith("verbose: generate "))).toBe(true);
  });
});

describe("атомарная запись", () => {
  test("после записи временных файлов не остаётся", async () => {
    const r = await validateFile("tests/fixtures/valid-mini.toml");
    if (!r.spec) throw new Error("valid-mini обязан валидироваться");
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-atom-"));
    await writeKlcFile(r.spec, tmp);
    const leftovers: string[] = [];
    for (const f of await fs.readdir(path.join(tmp, "windows"))) {
      if (f.includes(".tmp.")) leftovers.push(f);
    }
    expect(leftovers).toEqual([]);
  });
});

describe("регресс: полный прогон по всем ОС", () => {
  test("все ОС: windows, macos и linux пишут, выход 0", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "klayde-all-"));
    const { code, out } = await capture(() =>
      runCli(["bun", "index.ts", "--", `--out=${tmp}`, ...layoutArgs()]),
    );
    expect(code).toBe(0);
    expect((await fs.readdir(path.join(tmp, "windows"))).length).toBe(6);
    expect((await fs.readdir(path.join(tmp, "macos"))).length).toBe(6);
    expect((await fs.readdir(path.join(tmp, "linux"))).length).toBe(6);
    expect(out.filter((l) => l.startsWith("ok:")).length).toBe(18);
    expect(out.filter((l) => l.startsWith("skip:")).length).toBe(0);
    expect(out[out.length - 1]).toBe("done: входов 6, артефактов 18, пропусков 0");
  });
});
