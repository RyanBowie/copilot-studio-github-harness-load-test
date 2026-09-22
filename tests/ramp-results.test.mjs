import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateReport } from "../src/validate.mjs";
import { summarizeCapacity, summarizeCapacityStudies } from "../src/capacity.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const run = report.runs.find((item) => item.runKey === "hour-ramp-25-to-50"), ramp = run.rampMeasurement;
const reject = (change, pattern) => {
  const modified = structuredClone(report), item = modified.runs.find((item) => item.runKey === run.runKey);
  change(item.rampMeasurement, item);
  assert.match(validateReport(modified, schema).join("\n"), pattern);
};

test("actual ramp retains 365/364/1/0 and unknown-layer HTTP429 without inventing a numeric quota", () => {
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(report.runs.length, 16);
  assert.deepEqual(run.counts, { attempted: 365, completed: 364, failed: 1, pending: 0 });
  assert.deepEqual(run.errors, [{ category: "throttling", count: 1, evidence: "native_http_429_no_conversation" }]);
  assert.equal(run.units.conversations, 364);
  assert.equal(ramp.failedConversations, 0);
  assert.equal(ramp.peakOutstanding, 7);
  assert.equal(ramp.unusedRequestBudget, 1885);
  assert.equal(ramp.requestCeiling, 2250);
  assert.equal(ramp.arrivalStatus, "stopped");
  assert.equal(ramp.stopReason, "explicit_throttle");
  assert.equal(ramp.drainStatus, "complete");
  assert.equal(ramp.runnerRetries, 0);
  assert.equal(Object.hasOwn(run, "cost"), false);
  assert.deepEqual(summarizeCapacity([run]), []);
  assert.deepEqual(summarizeCapacityStudies([run]), []);
});

test("actual ramp preserves partial rate coverage, carry-over and distinct completion populations", () => {
  assert.deepEqual(ramp.segments.map((segment) => [segment.targetRpm, segment.durationSeconds, ...Object.values(segment.counts)]), [
    [25, 600, 248, 248, 0, 0], [30, 235.03497699999997, 117, 116, 1, 0]
  ]);
  assert.equal(ramp.segments[0].outstandingAtEnd, 3);
  assert.equal(ramp.segments[1].outstandingAtStart, 3);
  assert.equal(ramp.segments[1].outstandingAtEnd, null);
  assert.deepEqual(ramp.segments.map((segment) => segment.distinctReturnedConversations), [248, 116]);
  assert.deepEqual(ramp.segments.map((segment) => segment.dispatchCohortPeakOutstanding), [7, 7]);
  assert.deepEqual(ramp.segments.map((segment) => segment.completionPopulations), [
    { withinNominalWindow: 245, afterNominalWindow: 3, allDispatchesWithinObservedWindow: 245 },
    { withinNominalWindow: 116, afterNominalWindow: 0, allDispatchesWithinObservedWindow: 116 }
  ]);
  assert.equal(ramp.successfulWithinArrivalWindow, 361);
  assert.equal(ramp.successfulAfterArrivalWindow, 3);
  assert.equal(ramp.minutes.length, 14);
  assert.deepEqual(ramp.minutes.map((minute) => minute.attempted), [25, 25, 25, 24, 25, 25, 25, 24, 25, 25, 30, 30, 29, 28]);
  assert.equal(ramp.minutes.at(-1).durationSeconds, 55.034976999999955);
  assert.equal(ramp.minutes.at(-1).failed, 1);
});

test("actual ramp callback, stop decision and local-loop interval remain different clocks", () => {
  assert.equal(ramp.arrivalSeconds, 835.0349769999999);
  assert.equal(ramp.arrivalEndObservedSeconds, ramp.arrivalSeconds);
  assert.equal(ramp.arrivalLoopEndObservedSeconds, 835.9737600999999);
  assert.equal(ramp.drainSeconds, 6.997626800000085);
  assert.equal(run.windowSeconds, 842.0326038000001);
  assert.ok(Math.abs(run.windowSeconds - ramp.arrivalSeconds - ramp.drainSeconds) < 1e-6);
  assert.equal(ramp.stopEvidence.triggeringAttempt, 365);
  assert.equal(ramp.stopEvidence.nativeDurationMs, 73.751600000076);
  assert.equal(ramp.stopEvidence.callbackFromArrivalStartMs, 835031.7282);
  assert.equal(ramp.stopEvidence.decisionFromArrivalStartMs, 835034.977);
  assert.deepEqual(ramp.stopEvidence.countsAtDecision, { attempted: 365, completed: 361, failed: 1, pending: 3 });
  assert.equal(ramp.clockStatus, "verified_clean");
  assert.equal(ramp.evidenceStatus, "verified_complete");
  assert.equal(ramp.pacing.violatingIntervals, null);
});

test("ramp timings keep whole-run versus dispatch-cohort percentiles and zero-sample nulls", () => {
  assert.deepEqual(ramp.success, { sampleCount: 364, minMs: 6294.930800000031, p50Ms: 7980.5468999999575, p95Ms: 10587.910900000017, maxMs: 32830.05099999998 });
  assert.deepEqual(ramp.failure, { sampleCount: 1, minMs: 73.751600000076, p50Ms: 73.751600000076, p95Ms: 73.751600000076, maxMs: 73.751600000076 });
  assert.equal(ramp.segments[0].nativeTimings.failure, null);
  assert.equal(ramp.segments[0].nativeTimings.success.p50Ms, 8132.154800000004);
  assert.equal(ramp.segments[1].nativeTimings.success.p50Ms, 7916.859999999986);
  const weightedMedian = ramp.segments.reduce((sum, segment) => sum + segment.counts.completed * segment.nativeTimings.success.p50Ms, 0) / run.counts.completed;
  assert.notEqual(ramp.success.p50Ms, weightedMedian);
});

test("ramp evidence rejects invented clocks, boundary zeros, populations, IDs and future-window outcomes", () => {
  reject((ramp) => { ramp.arrivalLoopEndObservedSeconds = 834; }, /observation-loop end/);
  reject((ramp) => { ramp.stopEvidence.callbackFromArrivalStartMs = 835100; }, /native HTTP 429 stop evidence/);
  reject((ramp) => { ramp.stopEvidence.decisionFromArrivalStartMs++; }, /dispatch-close decision/);
  reject((ramp) => { ramp.stopEvidence.countsAtDecision.attempted--; }, /no new dispatches/);
  reject((ramp) => { ramp.segments[1].outstandingAtEnd = 0; }, /unobserved nominal segment-end/);
  reject((ramp) => { ramp.segments[1].completionPopulations.allDispatchesWithinObservedWindow++; }, /partition the whole arrival-window/);
  reject((ramp) => { ramp.segments[0].completionPopulations.withinNominalWindow++; }, /own nominal-window outcomes/);
  reject((ramp) => { ramp.minutes.at(-1).durationSeconds = 60; }, /final bucket partial/);
  reject((ramp) => { ramp.minutes[0].completed--; ramp.minutes[0].attempted--; }, /reconcile to their containing/);
  reject((_, run) => { run.units.conversations = 365; }, /no returned conversation identifier/);
  reject((ramp) => { ramp.qualification = "qualified"; }, /unknown field/);
  reject((ramp) => { ramp.arrivalStatus = "full_window"; }, /requires 3600 seconds/);
});
