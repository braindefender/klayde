/** Windows-генератор .klc: ValidatedSpec → build/windows/<main.name>.klc. */
import type { ValidatedSpec } from "../../model/spec.ts";
import type { GenerateResult, OsGenerator } from "../types.ts";
import { writeKlcFile } from "./klcWriter.ts";

export class WindowsKlcGenerator implements OsGenerator {
  readonly os = "windows" as const;

  async generate(spec: ValidatedSpec, outDir: string): Promise<GenerateResult> {
    const outFile = await writeKlcFile(spec, outDir);
    return { status: "ok", outFile };
  }
}
