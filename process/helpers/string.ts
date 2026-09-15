export const normalize = (value: string): string => value.trim().toLowerCase();

export const isStringNotEmpty = (value: string | undefined): value is string =>
  (value ?? "").trim() !== "";

export const isStringEmpty = (value: string | undefined): value is undefined =>
  !isStringNotEmpty(value);
