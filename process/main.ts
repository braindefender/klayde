/**
 * Оркестрация фаз A→B→C (docs/08, раздел 3; контракт docs/01, раздел 3).
 *
 * Фаза A: parseArgs + discoverInputs (ошибки — выход 2).
 * Фаза B: validateFile() V0–V8 по каждому файлу + crossCheck() V9;
 * вся диагностика печатается сразу, при хотя бы одной ошибке генерация
 * не запускается ни для одного файла — выход 1 (fail-closed).
 * Фаза C: генераторы по парам (spec, os); в фазе 2 это заглушки
 * (skip: not implemented, выход 0).
 *
 * Обычные сообщения и сводка — stdout; ошибки — stderr (docs/01, раздел 5).
 * Возвращает код выхода, process.exit выполняет bootstrap (index.ts).
 */
import { extractProgramArgs, hasHelpFlag, parseArgs } from "./cli/args.ts";
import {
  CliError,
  EXIT_ARGS,
  EXIT_INTERNAL,
  EXIT_OK,
  EXIT_VALIDATION,
  formatCliError,
} from "./cli/errors.ts";
import { discoverInputs } from "./cli/discover.ts";
import { validateFile } from "./validation/validate.ts";
import { crossCheck } from "./validation/check-name-intersections.ts";
import {
  hasErrors,
  printDiagnostics,
  type Diagnostic,
} from "./validation/report.ts";
import { getGenerator } from "./generators/registry.ts";
import { USAGE_FULL } from "./cli/const.ts";
import { OS_LIST } from "./model";

export async function runCli(argv: string[]): Promise<number> {
  const programArgs = extractProgramArgs(argv);

  if (hasHelpFlag(programArgs)) {
    console.log(USAGE_FULL);
    return EXIT_OK;
  }

  let opts;
  try {
    opts = parseArgs(programArgs);
  } catch (err) {
    return reportArgsError(err);
  }

  let inputFiles: string[];
  try {
    inputFiles = await discoverInputs(opts.layoutInputs);
  } catch (err) {
    return reportArgsError(err);
  }

  if (opts.verbose) {
    console.log(
      `verbose: os=[${opts.osList.join(",")}] inputs=[${inputFiles.join(", ")}] out=${opts.outDir}`,
    );
  }

  // Фаза B: валидация V0–V8 по каждому файлу, затем V9 кросс-проверка.
  // Ошибки собираются по всем файлам и печатаются все сразу (docs/01).
  const results = [];
  for (const file of inputFiles) {
    const res = await validateFile(file);
    results.push(res);
    if (opts.verbose) {
      console.log(
        `verbose: validate ${file} — ошибок ${res.errors.length}, предупреждений ${res.warnings.length}`,
      );
    }
  }
  const diagnostics: Diagnostic[] = results.flatMap((r) => [
    ...r.errors,
    ...r.warnings,
  ]);
  const validSpecs = results.flatMap((r) => (r.spec !== null ? [r.spec] : []));
  diagnostics.push(
    ...crossCheck(
      validSpecs.map((spec) => ({
        file: spec.file,
        mainName: spec.main.name,
        mainShortName: spec.main.shortName,
        msklcName: spec.msklc.name,
      })),
    ),
  );
  if (diagnostics.length > 0) {
    printDiagnostics(diagnostics);
  }
  if (hasErrors(diagnostics)) {
    return EXIT_VALIDATION;
  }
  const specs = validSpecs;

  // Фаза C: для каждой пары (spec, os) в фиксированном порядке ОС.
  const requested = OS_LIST.filter((os) => opts.osList.includes(os));
  let okCount = 0;
  let skipCount = 0;

  for (const os of requested) {
    const generator = getGenerator(os);
    for (const spec of specs) {
      if (opts.verbose) {
        console.log(
          `verbose: generate os=${os} file=${spec.file} out=${opts.outDir}`,
        );
      }
      let result;
      try {
        result = await generator.generate(spec, opts.outDir);
      } catch (err) {
        console.error(
          `error[E_GENERATE] ${spec.file} :: генератор ${os}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return EXIT_INTERNAL;
      }
      if (result.status === "ok" && result.outFile) {
        okCount++;
        console.log(`ok: ${spec.file} -> ${result.outFile}`);
      } else {
        skipCount++;
        console.log(`skip: ${spec.file} — генератор ${os} ещё не реализован`);
      }
    }
  }

  if (okCount === 0) {
    console.log(
      `done: входов ${specs.length}, артефактов создано 0 (всё пропущено как not implemented), пропусков ${skipCount}`,
    );
  } else {
    console.log(
      `done: входов ${specs.length}, артефактов ${okCount}, пропусков ${skipCount}`,
    );
  }
  return EXIT_OK;
}

function reportArgsError(err: unknown): number {
  if (err instanceof CliError) {
    console.error(formatCliError(err));
    console.error(USAGE_FULL);
    return EXIT_ARGS;
  }
  console.error(
    `error[E_INTERNAL] ${err instanceof Error ? err.message : String(err)}`,
  );
  return EXIT_INTERNAL;
}
