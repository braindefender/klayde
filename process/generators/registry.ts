import type { OS } from "../model";
import type { OsGenerator } from "./types.ts";
import { WindowsKlcGenerator } from "./windows/index.ts";
import { MacosGenerator } from "./macos/index.ts";
import { LinuxGenerator } from "./linux/index.ts";

const registry = new Map<OS, OsGenerator>([
  ["windows", new WindowsKlcGenerator()],
  ["macos", new MacosGenerator()],
  ["linux", new LinuxGenerator()],
]);

export function getGenerator(os: OS): OsGenerator {
  const gen = registry.get(os);
  if (!gen) throw new Error(`unknown os generator: ${os}`);
  return gen;
}
