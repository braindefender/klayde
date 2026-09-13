/** Заглушка macOS-генератора: skip not implemented (docs/01, раздел 2). */
import type { ValidatedSpec } from "../../model/spec.ts";
import type { GenerateResult, OsGenerator } from "../types.ts";

export class MacosGenerator implements OsGenerator {
  readonly os = "macos" as const;

  async generate(spec: ValidatedSpec, _outDir: string): Promise<GenerateResult> {
    void spec;
    return { status: "skip", reason: "генератор macos ещё не реализован" };
  }
}
