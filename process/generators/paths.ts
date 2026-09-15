/**
 * Маппинг `spec.file` → каталог выхода с сохранением структуры `layouts/`.
 *
 * `layouts/universal-layout/ortho/x.toml` + out=`build` + os=`windows`
 * даёт `build/universal-layout/ortho/windows`. Файлы в корне `layouts/`
 * (без подкаталога) по-прежнему дают `<out>/<os>/` (обратная совместимость).
 * Файлы вне `layouts/` (явный --layout в другом месте) также маппятся
 * плоско в `<out>/<os>/`.
 */
import path from "node:path";
import { DEFAULT_LAYOUTS_DIR } from "../cli/const.ts";
import type { OS } from "../model";

export function resolveOsOutDir(
  outDir: string,
  os: OS,
  specFile: string,
  layoutsDir: string = DEFAULT_LAYOUTS_DIR,
): string {
  const rel = path.relative(
    path.normalize(layoutsDir),
    path.normalize(path.dirname(specFile)),
  );
  if (
    rel === "" ||
    rel === "." ||
    rel.startsWith("..") ||
    path.isAbsolute(rel)
  ) {
    return path.join(outDir, os);
  }
  return path.join(outDir, rel, os);
}
