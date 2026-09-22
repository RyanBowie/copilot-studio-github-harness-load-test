import test from "node:test";
import { restoreHistoricalMetadata } from "./helpers/historical-metadata.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateReport } from "../src/validate.mjs";
import { summarizeCapacity } from "../src/capacity.mjs";
import { renderHtml } from "../scripts/build.mjs";
import { syntheticMinuteRetest } from "./fixtures/synthetic-minute-retest.mjs";

const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const reject = (edit, expected) => {
  const report = syntheticMinuteRetest();
  edit(report.runs[0].pacedMeasurement, report.runs[0], report);
  assert.match(validateReport(report, schema).join("\n"), expected);
};

test("the original ten public records and three campaign contexts remain unchanged when retests are appended", async () => {
  const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
  const history = {
    runs: report.runs.slice(0, 10), pacedCampaigns: report.pacedCampaigns.slice(0, 3),
    documentedLimits: report.documentedLimits, studyContext: report.studyContext
  };
  assert.equal(createHash("sha256").update(JSON.stringify(restoreHistoricalMetadata(history))).digest("hex"), "101ea0c18291eca5f4ef04960198f8948419030f6cd97350723d16b1f8217dc3");
});

test("synthetic one-minute retest counts every ordinary failure without claiming calibration qualification", async () => {
  for (const failed of [0, 30, 100]) {
    const report = syntheticMinuteRetest({ failed });
    assert.deepEqual(validateReport(report, schema), []);
    assert.equal(summarizeCapacity(report.runs)[0].highestQualifiedRpm, null);
    const minute = summarizeCapacity(report.runs)[0].windows.find((window) => window.seconds === 60);
    assert.deepEqual(minute.best.counts, report.runs[0].counts);
    const html = await renderHtml(report, schema);
    assert.match(html, /offline-minute-retest/);
  }
});

test("one-minute retest cannot be padded into 100 attempts or promoted into a two-minute calibration", () => {
  reject((paced) => { paced.plannedSlots = 200; }, /planned slots/);
  reject((paced) => { paced.plannedArrivalSeconds = 120; }, /phase duration/);
  reject((paced) => { paced.arrivalEndObservedSeconds = 59; }, /60 seconds of observed arrival coverage/);
  reject((paced) => { paced.targetRpm = 25; }, /bounded 100-request/);
  reject((paced) => { delete paced.genericErrorPolicy; }, /counts generic errors/);
  reject((paced) => { paced.genericErrorPolicy = "stop_after_three"; }, /genericErrorPolicy.*contract constant/);
  reject((paced) => { paced.qualification = "qualified"; }, /not a two-minute calibration/);
  reject((paced) => { paced.qualifyingRunKey = "offline-prior-stage"; }, /not a two-minute calibration/);
  reject((paced) => { paced.phase = "calibration"; }, /policy belongs only/);
  reject((_, __, report) => { report.pacedCampaigns[0].status = "completed_standalone_calibration"; }, /qualified full-window cohort/);
  reject((_, __, report) => {
    const duplicate = structuredClone(report.runs[0]);
    duplicate.runKey = "offline-second-minute";
    report.runs.push(duplicate);
  }, /separate single-cohort campaign/);
});

test("hard-stop and incomplete-drain minute observations stay partial, never unoffered failures", () => {
  const report = syntheticMinuteRetest({ attempted: 21, failed: 1, arrivalSeconds: 13, stopReason: "explicit_throttle" });
  const run = report.runs[0];
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(run.pacedMeasurement.unofferedSlots, 79);
  run.counts.failed += 79;
  assert.ok(validateReport(report, schema).length);
  assert.deepEqual(validateReport(syntheticMinuteRetest({ pending: 2 }), schema), []);
  reject((paced) => { paced.arrivalStatus = "stopped"; paced.stopReason = "generic_error_threshold"; }, /without an early generic-error stop/);
  reject((paced) => { paced.arrivalStatus = "stopped"; paced.stopReason = "native_error"; }, /without an early generic-error stop/);
});
