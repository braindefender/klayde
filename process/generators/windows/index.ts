/** Заглушка Windows-генератора (фаза 1). Реализация — фаза 4. */
import type { ValidatedSpec } from "../../model/spec.ts";
import type { GenerateResult, OsGenerator } from "../types.ts";

export class WindowsKlcGenerator implements OsGenerator {
  readonly os = "windows" as const;

  async generate(spec: ValidatedSpec, _outDir: string): Promise<GenerateResult> {
    void spec;
    return { status: "skip", reason: "генератор windows ещё не реализован (фаза 4)" };
  }
}
