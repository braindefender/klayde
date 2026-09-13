import type { OsId } from "../model/spec.ts";
import type { OsGenerator } from "./types.ts";
import { WindowsKlcGenerator } from "./windows/index.ts";
import { MacosGenerator } from "./macos/index.ts";
import { LinuxGenerator } from "./linux/index.ts";

export const GENERATOR_RUN_ORDER: readonly OsId[] = [
  "windows",
  "macos",
  "linux",
];

const registry = new Map<OsId, OsGenerator>([
  ["windows", new WindowsKlcGenerator()],
  ["macos", new MacosGenerator()],
  ["linux", new LinuxGenerator()],
]);

export function getGenerator(os: OsId): OsGenerator {
  const gen = registry.get(os);
  if (!gen) throw new Error(`unknown os generator: ${os}`);
  return gen;
}
