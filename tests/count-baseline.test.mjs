import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateReport } from "../src/validate.mjs";
import { summarizeCapacity, summarizeCapacityStudies, observedPacedRpm } from "../src/capacity.mjs";
import { syntheticCountBaseline } from "./fixtures/synthetic-count-baseline.mjs";
import { syntheticCountRetest } from "./fixtures/synthetic-count-retest.mjs";

const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const reject = (change, pattern) => {
  const report = syntheticCountBaseline();
  change(report.runs[0].pacedMeasurement, report.runs[0], report);
  assert.match(validateReport(report, schema).join("\n"), pattern);
};

test("baseline preparation preserves all thirteen historical records and their campaign evidence", async () => {
  const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
  const history = {
    runs: report.runs.slice(0, 13), pacedCampaigns: report.pacedCampaigns.slice(0, 3),
    documentedLimits: report.documentedLimits, studyContext: report.studyContext
  };
  assert.equal(createHash("sha256").update(JSON.stringify(history)).digest("hex"), "f02b7070374a99cb9315f00e8af04a93eb27a65a7d81f6a8b20a3379089474fb");
});

test("125-count baseline counts ordinary outcomes and extensions without qualifying for hours", () => {
  for (const options of [{ failed: 0 }, { failed: 20 }, { failed: 125, disconnected: 125 }, { pending: 2 }]) {
    const report = syntheticCountBaseline(options);
    assert.deepEqual(validateReport(report, schema), []);
    const run = report.runs[0], paced = run.pacedMeasurement;
    assert.equal(run.counts.attempted, 125);
    assert.equal(paced.arrivalStatus, "count_complete");
    assert.equal(paced.plannedArrivalSeconds, 300);
    assert.equal(paced.arrivalSeconds, 312);
    assert.equal(observedPacedRpm(run), 125 / 312 * 60);
    assert.equal(paced.qualification, "not_evaluated");
    assert.equal(paced.qualifyingRunKey, null);
    assert.equal(summarizeCapacity(report.runs)[0].highestQualifiedRpm, null);
    assert.deepEqual(summarizeCapacityStudies(report.runs), []);
  }
});

test("baseline stopped and pending populations remain bounded and cannot invent returned conversations", () => {
  for (const options of [
    { attempted: 21, failed: 1, arrivalSeconds: 51, stopReason: "explicit_throttle" },
    { attempted: 1, failed: 1, disconnected: 1, arrivalSeconds: 2, stopReason: "safety" },
    { attempted: 10, failed: 0, pending: 2, arrivalSeconds: 23, stopReason: "observation_cutoff" }
  ]) {
    const report = syntheticCountBaseline(options);
    assert.deepEqual(validateReport(report, schema), []);
    const run = report.runs[0];
    assert.equal(run.counts.attempted + run.pacedMeasurement.unofferedSlots, 125);
    assert.equal(summarizeCapacity(report.runs)[0].windows.find((window) => window.seconds === 60).best, null);
  }
  reject((paced, run) => {
    run.errors = [{ category: "transport", count: run.counts.failed, evidence: "native_disconnected_no_conversation" }];
  }, /no returned conversation identifier/);
});

test("baseline cannot borrow historical or capacity scheduling, targets, policies, qualification or continuation", () => {
  reject((paced) => { paced.targetRpm = 100; }, /125 planned requests at 25/);
  reject((paced) => { paced.plannedSlots = 100; }, /planned slots/);
  reject((paced) => { paced.plannedArrivalSeconds = 60; }, /phase duration/);
  reject((paced) => { paced.arrivalStatus = "full_window"; }, /not a fixed full-minute/);
  reject((paced) => { paced.unofferedSlots = 1; }, /no unused slots/);
  reject((paced) => { paced.pacing.schedule = "absolute_slots"; }, /actual-dispatch rebasing/);
  reject((paced) => { paced.pacing.jitterAllowance = 0.05; }, /jitter allowance/);
  reject((paced) => { paced.pacing.observedMinIntervalMs = 2399; }, /declared allowance/);
  reject((paced) => { paced.pacing.observedMinIntervalMs = 3000; }, /duration must contain/);
  reject((paced) => { paced.pacing.observedMinIntervalMs = null; paced.pacing.violatingIntervals = null; }, /minimum spacing is required/);
  reject((paced) => { paced.arrivalEndObservedSeconds++; }, /actual arrival-close duration/);
  reject((paced) => { paced.qualification = "qualified"; }, /not a two-minute calibration/);
  reject((paced) => { paced.qualifyingRunKey = "offline-prior-screen"; }, /qualification for an hour/);
  reject((paced) => { delete paced.genericErrorPolicy; }, /counts ordinary errors/);
  for (const stopReason of ["native_error", "generic_error_threshold"]) {
    reject((paced) => { paced.stopReason = stopReason; paced.arrivalStatus = "stopped"; }, /counts ordinary errors/);
  }
  reject((paced) => { paced.runnerRetries = 1; }, /contract constant/);
  reject((paced) => { paced.rawResults = []; }, /unknown field/);
  reject((_, run, report) => { const copy = structuredClone(run); copy.runKey = "offline-resume"; report.runs.push(copy); }, /separate single-cohort/);
  const old = syntheticCountRetest();
  old.runs[0].pacedMeasurement.targetRpm = 25;
  assert.match(validateReport(old, schema).join("\n"), /bounded 100-request plan/);
});
