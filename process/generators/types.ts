/** Общий интерфейс генераторов ОС (docs/08, раздел 2). */
import type { OsId, ValidatedSpec } from "../model/spec.ts";

export type GenerateStatus = "ok" | "skip";

export interface GenerateResult {
  status: GenerateStatus;
  /** Созданный артефакт (только при status "ok"). */
  outFile?: string;
  /** Причина пропуска (только при status "skip", напр. "not implemented"). */
  reason?: string;
}

export interface OsGenerator {
  readonly os: OsId;
  generate(spec: ValidatedSpec, outDir: string): Promise<GenerateResult>;
}
