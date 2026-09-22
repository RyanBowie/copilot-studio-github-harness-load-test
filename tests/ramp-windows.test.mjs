import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateReport } from "../src/validate.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const getRamp = (data) => data.runs.find((run) => run.runKey === "hour-ramp-25-to-50").rampMeasurement;
const ramp = getRamp(report), evidence = ramp.dispatchWindowEvidence;
const reject = (change, expected) => {
  const data = structuredClone(report);
  change(getRamp(data).dispatchWindowEvidence, getRamp(data));
  assert.match(validateReport(data, schema).join("\n"), expected);
};

test("separate ramp windows preserve all fifteen primary records and the seven-cohort scope", async () => {
  assert.deepEqual(validateReport(report, schema), []);
  const primary = structuredClone(report);
  primary.runs = primary.runs.slice(0, 15);
  delete getRamp(primary).dispatchWindowEvidence;
  assert.equal(createHash("sha256").update(JSON.stringify(primary)).digest("hex"), "cf491ffde4b1542721b160584dba691594ce00afd16f34c18444b7fd6dcd975a");
  assert.deepEqual(validateReport(primary, schema), []);
  const oldWindows = JSON.parse(await readFile(new URL("../data/window-evidence.json", import.meta.url), "utf8"));
  assert.equal(oldWindows.runs.length, 7);
  assert.equal(oldWindows.runs.some((run) => run.runKey === "hour-ramp-25-to-50"), false);
});

test("actual full rolling maxima are 268 in600s and30 in60s, not365 in ten minutes", () => {
  assert.equal(evidence.newNativeCalls, 0);
  assert.equal(evidence.identityControlReadsExcluded, 1);
  assert.equal(evidence.externalAndUnobservedServiceTraffic, "unknown");
  assert.equal(evidence.basis, "native_invocation_starts_including_failures");
  assert.equal(evidence.intervalConvention, "start_inclusive_end_exclusive");
  assert.equal(evidence.fullWindowsOnly, true);
  assert.deepEqual(evidence.windows, [
    { windowSeconds: 600, maximumStarts: 268, representativeStartSeconds: 235.03497700000003, representativeEndSeconds: 835.0349769999999, candidateWindowsChecked: 99 },
    { windowSeconds: 60, maximumStarts: 30, representativeStartSeconds: 775.0349769999999, representativeEndSeconds: 835.0349769999999, candidateWindowsChecked: 337 }
  ]);
  assert.deepEqual(ramp.segments.map((segment) => [segment.counts.attempted, segment.durationSeconds]), [[248, 600], [117, 235.03497699999997]]);
  assert.equal(evidence.windows[0].maximumStarts / 10, 26.8);
});

test("dispatch-window contract rejects partial, out-of-coverage, duplicate and impossible maxima", () => {
  reject((evidence) => { evidence.fullWindowsOnly = false; }, /contract constant/);
  reject((evidence) => { evidence.windows[0].representativeEndSeconds++; }, /full observed arrival coverage/);
  reject((evidence) => { evidence.windows[0].representativeStartSeconds++; }, /exact duration/);
  reject((evidence) => { evidence.windows[0].maximumStarts = 365; }, /nested full-window/);
  reject((evidence) => { evidence.windows[0].maximumStarts = 247; }, /fixed-bucket count/);
  reject((evidence) => { evidence.windows[1].maximumStarts = 29; }, /fixed-bucket count/);
  reject((evidence) => { evidence.windows[1] = structuredClone(evidence.windows[0]); }, /durations must be unique/);
  reject((evidence) => { evidence.windows[0].candidateWindowsChecked = 0; }, /must be >= 1/);
  reject((evidence) => { evidence.newNativeCalls = 1; }, /contract constant/);
  reject((evidence) => { evidence.numericWorkIqQuota = 30; }, /unknown field/);
  reject((evidence) => { evidence.reviewedOn = "2026-09-20"; }, /review no earlier/);
  reject((_, ramp) => { ramp.clockStatus = "unknown"; }, /clean complete clock/);
});
