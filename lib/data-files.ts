import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BUNDLED_DATA_DIR = path.join(process.cwd(), "data");

export function getWritableDataDir() {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.VERCEL) {
    return path.join("/tmp", "asteria-data");
  }

  return BUNDLED_DATA_DIR;
}

export function resolveDataFile(name: string) {
  const dir = getWritableDataDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const target = path.join(dir, name);
  const bundled = path.join(BUNDLED_DATA_DIR, name);

  if (!existsSync(target) && existsSync(bundled) && bundled !== target) {
    copyFileSync(bundled, target);
  }

  return target;
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) {
    return fallback;
  }

  try {
    const raw = readFileSync(filePath, "utf8").trim();
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
