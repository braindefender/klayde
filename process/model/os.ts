export const OS_LIST = ["windows", "macos", "linux"] as const;

export type OS = (typeof OS_LIST)[number];

export function isKnownOs(value: string): value is OS {
  return (OS_LIST as readonly string[]).includes(value);
}
