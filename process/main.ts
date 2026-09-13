/**
 * Оркестрация фаз A→B→C (docs/08, раздел 3; контракт docs/01, раздел 3).
 *
 * Фаза 1: реализованы фазы A (parseArgs + discoverInputs) и каркас C
 * (реестр генераторов-заглушек). Валидация V0–V9 (фаза B, фаза 2 плана)
 * отсутствует: все обнаруженные файлы считаются условно валидными
 * (createStubSpec). Частичная генерация запрещена — в фазе 1 это
 * тривиально выполнено, т.к. заглушки ничего не пишут.
 *
 * Обычные сообщения и сводка — stdout; ошибки — stderr (docs/01, раздел 5).
 * Возвращает код выхода, process.exit выполняет bootstrap (index.ts).
 */
import {
  extractProgramArgs,
  hasHelpFlag,
  parseArgs,
  printUsage,
} from "./cli/args.ts";
import { CliError, EXIT_ARGS, EXIT_INTERNAL, EXIT_OK, formatCliError } from "./cli/errors.ts";
import { createStubSpec } from "./model/spec.ts";
import { discoverInputs } from "./layouts/discover.ts";
import { GENERATOR_RUN_ORDER, getGenerator } from "./generators/registry.ts";

export async function runCli(argv: string[]): Promise<number> {
  const programArgs = extractProgramArgs(argv);

  if (hasHelpFlag(programArgs)) {
    console.log(printUsage());
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

  // Фаза B (TODO, план фаза 2): validateFile() V0–V8 + crossCheck() V9.
  // Пока — заглушка: все входы условно валидны.
  const specs = inputFiles.map((file) => createStubSpec(file));

  // Фаза C: для каждой пары (spec, os) в фиксированном порядке ОС.
  const requested = GENERATOR_RUN_ORDER.filter((os) => opts.osList.includes(os));
  let okCount = 0;
  let skipCount = 0;

  for (const os of requested) {
    const generator = getGenerator(os);
    for (const spec of specs) {
      if (opts.verbose) {
        console.log(`verbose: generate os=${os} file=${spec.file} out=${opts.outDir}`);
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
    console.log(`done: входов ${specs.length}, артефактов ${okCount}, пропусков ${skipCount}`);
  }
  return EXIT_OK;
}

function reportArgsError(err: unknown): number {
  if (err instanceof CliError) {
    console.error(formatCliError(err));
    console.error(printUsage());
    return EXIT_ARGS;
  }
  console.error(`error[E_INTERNAL] ${err instanceof Error ? err.message : String(err)}`);
  return EXIT_INTERNAL;
}
