import { isStringEmpty, normalize } from "../helpers";

/** Имя флага и инлайн-значение (`--name=value`). */
export interface SplitFlag {
  head: string;
  inlineValue: string | undefined;
}

/** Разобрать токен на имя флага и инлайн-значение. Чистая. */
export function splitFlag(token: string): SplitFlag {
  const eq = token.indexOf("=");
  if (eq < 0) return { head: token, inlineValue: undefined };
  return { head: token.slice(0, eq), inlineValue: token.slice(eq + 1) };
}

/** Значение флага и индекс следующего необработанного токена. */
export interface FlagValue {
  value: string | undefined;
  nextIndex: number;
}

/**
 * Взять значение флага: инлайн (`--flag=value`) либо следующий токен
 * (`--flag value`). Следующий токен, похожий на флаг, значением не
 * считается. Ничего не мутирует. Чистая.
 */
export function readFlagValue(
  programArgs: string[],
  index: number,
  inlineValue: string | undefined,
): FlagValue {
  if (inlineValue !== undefined)
    return { value: inlineValue, nextIndex: index + 1 };
  const next = programArgs[index + 1];
  if (next === undefined || next.startsWith("-")) {
    return { value: undefined, nextIndex: index + 1 };
  }
  return { value: next, nextIndex: index + 2 };
}

export function parseBooleanValue(raw: string | undefined): boolean {
  if (isStringEmpty(raw)) return true;

  const v = normalize(raw);

  if (["1", "true", "yes", "on"].includes(v)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(v)) {
    return false;
  }

  return false;
}

export function isTomlFile(name: string): boolean {
  return name.toLowerCase().endsWith(".toml");
}
