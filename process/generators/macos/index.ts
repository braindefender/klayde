/** macOS-генератор `.keylayout`: ValidatedSpec → build/macos/<main.name>.keylayout. */
import type { ValidatedSpec } from "../../model/spec.ts";
import type { GenerateResult, OsGenerator } from "../types.ts";
import { writeKeylayoutFile } from "./keylayoutWriter.ts";

export class MacosGenerator implements OsGenerator {
  readonly os = "macos" as const;

  async generate(spec: ValidatedSpec, outDir: string): Promise<GenerateResult> {
    const outFile = await writeKeylayoutFile(spec, outDir);
    return { status: "ok", outFile };
  }
}
