import { spawnSync } from "node:child_process";

const [file, expectedValue] = process.argv.slice(2);
const expected = Number(expectedValue);
if (!file || !Number.isFinite(expected) || expected <= 0) {
  console.error("Usage: node scripts/compare-export-duration.js <video-file> <expected-seconds>");
  process.exit(2);
}
const result = spawnSync(process.env.FFPROBE_PATH || "ffprobe", [
  "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file,
], { encoding: "utf8", windowsHide: true });
if (result.error || result.status !== 0) {
  console.error(`ffprobe failed: ${result.error?.message || result.stderr}`);
  process.exit(1);
}
const actual = Number(result.stdout.trim());
const difference = actual - expected;
const report = { file, expectedSeconds: expected, actualSeconds: actual, differenceSeconds: difference, withinTolerance: Number.isFinite(actual) && Math.abs(difference) <= 0.5 };
console.log(JSON.stringify(report, null, 2));
if (!report.withinTolerance) process.exit(1);
