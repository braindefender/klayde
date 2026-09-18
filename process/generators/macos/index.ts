/** macOS-генератор `.bundle`: ValidatedSpec → build/macos/<bundle_name>.bundle/. */
import type { ValidatedSpec } from "../../model/spec.ts";
import type { GenerateResult, OsGenerator } from "../types.ts";
import { writeBundle } from "./bundle.ts";

export class MacosGenerator implements OsGenerator {
  readonly os = "macos" as const;

  async generate(spec: ValidatedSpec, outDir: string): Promise<GenerateResult> {
    const outFile = await writeBundle(spec, outDir);
    return { status: "ok", outFile };
  }
}
