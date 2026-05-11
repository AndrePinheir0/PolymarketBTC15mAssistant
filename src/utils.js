import fs from "node:fs";
import path from "node:path";

export function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatNumber(x, digits = 0) {
  if (x === null || x === undefined || Number.isNaN(x)) return "-";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(x);
}

export function formatPct(x, digits = 2) {
  if (x === null || x === undefined || Number.isNaN(x)) return "-";
  return `${(x * 100).toFixed(digits)}%`;
}

export function getCandleWindowTiming(windowMinutes) {
  const nowMs = Date.now();
  const windowMs = windowMinutes * 60_000;
  const startMs = Math.floor(nowMs / windowMs) * windowMs;
  const endMs = startMs + windowMs;
  const elapsedMs = nowMs - startMs;
  const remainingMs = endMs - nowMs;
  return {
    startMs,
    endMs,
    elapsedMs,
    remainingMs,
    elapsedMinutes: elapsedMs / 60_000,
    remainingMinutes: remainingMs / 60_000
  };
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function appendCsvRow(filePath, header, row) {
  ensureDir(path.dirname(filePath));
  const exists = fs.existsSync(filePath);
  const line = row
    .map((v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes(",") || s.includes("\n") || s.includes('"')) {
        return `"${s.replaceAll('"', '""')}"`;
      }
      return s;
    })
    .join(",");

  if (!exists) {
    fs.writeFileSync(filePath, `${header.join(",")}\n${line}\n`, "utf8");
    return;
  }

  fs.appendFileSync(filePath, `${line}\n`, "utf8");
}

// Patch the last occurrence of a row matching `matchField=matchValue` in a CSV,
// setting `patchField` to `patchValue`. Reads the whole file, rewrites in-place.
export function patchCsvRow(filePath, matchField, matchValue, patchField, patchValue) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  if (lines.length < 2) return;

  const headers = lines[0].split(",");
  const matchIdx = headers.indexOf(matchField);
  const patchIdx = headers.indexOf(patchField);
  if (matchIdx === -1 || patchIdx === -1) return;

  // Find last matching row (search from end)
  let found = -1;
  for (let i = lines.length - 1; i >= 1; i--) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(",");
    if (cols[matchIdx] === String(matchValue)) { found = i; break; }
  }
  if (found === -1) return;

  const cols = lines[found].split(",");
  cols[patchIdx] = String(patchValue);
  lines[found] = cols.join(",");
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}
