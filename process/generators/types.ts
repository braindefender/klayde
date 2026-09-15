import type { OS } from "../model";
import type { ValidatedSpec } from "../model/spec.ts";

export type GenerateStatus = "ok" | "skip";

export interface GenerateResult {
  status: GenerateStatus;
  /** Созданный артефакт (только при status "ok"). */
  outFile?: string;
  /** Причина пропуска (только при status "skip", напр. "not implemented"). */
  reason?: string;
}

export interface OsGenerator {
  readonly os: OS;
  generate(spec: ValidatedSpec, outDir: string): Promise<GenerateResult>;
}
