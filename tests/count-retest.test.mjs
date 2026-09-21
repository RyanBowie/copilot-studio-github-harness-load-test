import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateReport } from "../src/validate.mjs";
import { summarizeCapacity } from "../src/capacity.mjs";
import { syntheticCountRetest } from "./fixtures/synthetic-count-retest.mjs";
import { syntheticMinuteRetest } from "./fixtures/synthetic-minute-retest.mjs";

const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const reject = (edit, pattern) => {
  const report = syntheticCountRetest();
  edit(report.runs[0].pacedMeasurement, report.runs[0], report);
  assert.match(validateReport(report, schema).join("\n"), pattern);
};

test("all eleven reviewed records and original campaign contexts remain unchanged", async () => {
  const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
  const history = {
    runs: report.runs.slice(0, 11), pacedCampaigns: report.pacedCampaigns.slice(0, 3),
    documentedLimits: report.documentedLimits, studyContext: report.studyContext
  };
  assert.equal(createHash("sha256").update(JSON.stringify(history)).digest("hex"), "42664db765db324830f7df7c3ad754ecceeeae25cab49c0e698c834e9eb50ce4");
});

test("count-bound retests retain extended arrivals and every outcome without full-minute qualification", () => {
  for (const failed of [0, 30, 100]) {
    const report = syntheticCountRetest({ failed });
    assert.deepEqual(validateReport(report, schema), []);
    const [capacity] = summarizeCapacity(report.runs);
    assert.equal(capacity.highestQualifiedRpm, null);
    assert.equal(capacity.longestCompleted.runKey, report.runs[0].runKey);
    assert.ok(capacity.windows.find((window) => window.seconds === 60).best.counts.attempted < 100);
    assert.equal(capacity.windows.find((window) => window.seconds === 120).best, null);
    assert.equal(report.runs[0].pacedMeasurement.arrivalSeconds, 66);
  }
  assert.deepEqual(validateReport(syntheticCountRetest({ pending: 2 }), schema), []);
  assert.deepEqual(validateReport(syntheticCountRetest({ attempted: 21, failed: 1, arrivalSeconds: 14, stopReason: "explicit_throttle" }), schema), []);
});

test("count completion cannot hide unsent calls, fake a fixed window or alter historical scheduling", () => {
  reject((paced) => { paced.arrivalStatus = "full_window"; }, /not a fixed full-minute/);
  reject((paced) => { paced.phase = "minute_retest"; }, /count completion requires/);
  reject((paced) => { paced.pacing.schedule = "absolute_slots"; }, /actual-dispatch rebasing/);
  reject((paced) => { paced.pacing.missedSlotPolicy = "skip_without_replay"; }, /no catch-up/);
  reject((paced) => { paced.pacing.jitterAllowance = 0.05; }, /jitter allowance/);
  reject((paced) => { paced.skippedSlots = 1; }, /no unused slots/);
  reject((paced) => { paced.qualification = "qualified"; }, /not a two-minute calibration/);
  reject((paced) => { paced.genericErrorPolicy = "stop_after_three"; }, /contract constant/);
  reject((paced) => { paced.stopReason = "generic_error_threshold"; }, /without an early generic-error stop/);
  reject((paced) => { paced.pacing.observedMinIntervalMs = 599; }, /declared allowance/);
  reject((paced) => { paced.pacing.observedMinIntervalMs = null; paced.pacing.violatingIntervals = null; }, /minimum spacing is required/);
  reject((paced) => { paced.pacing.observedMinIntervalMs = 700; }, /duration must contain/);
  reject((paced) => { paced.arrivalEndObservedSeconds += 1; }, /actual arrival-close/);
  reject((_, __, report) => { report.pacedCampaigns[0].status = "standalone_minute_retest"; }, /matching retest/);
  reject((_, __, report) => {
    const extra = structuredClone(report.runs[0]);
    extra.runKey = "offline-second-count";
    report.runs.push(extra);
  }, /separate single-cohort/);
  const old = syntheticMinuteRetest();
  old.runs[0].pacedMeasurement.pacing.schedule = "dispatch_rebased";
  assert.match(validateReport(old, schema).join("\n"), /historical fixed-window phases/);
});
