/** Linux-генератор `xkb_symbols`: ValidatedSpec → <out>/<rel>/linux/<short_name>. */
import type { ValidatedSpec } from "../../model/spec.ts";
import { printDiagnostics } from "../../validation/report.ts";
import type { GenerateResult, OsGenerator } from "../types.ts";
import { writeXkbFile } from "./xkbWriter.ts";

export class LinuxGenerator implements OsGenerator {
  readonly os = "linux" as const;

  async generate(spec: ValidatedSpec, outDir: string): Promise<GenerateResult> {
    const { warnings, outFile } = await writeXkbFile(spec, outDir);
    // Предупреждения сборки (fallback лигатур) — в stderr, генерация успешна.
    if (warnings.length > 0) printDiagnostics(warnings);
    return { status: "ok", outFile };
  }
}
