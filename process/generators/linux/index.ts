/** Заглушка Linux-генератора: skip not implemented (docs/01, раздел 2). */
import type { ValidatedSpec } from "../../model/spec.ts";
import type { GenerateResult, OsGenerator } from "../types.ts";

export class LinuxGenerator implements OsGenerator {
  readonly os = "linux" as const;

  async generate(spec: ValidatedSpec, _outDir: string): Promise<GenerateResult> {
    void spec;
    return { status: "skip", reason: "генератор linux ещё не реализован" };
  }
}
